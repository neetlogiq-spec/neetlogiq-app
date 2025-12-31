"""
LLM Response Cache for Agentic Matcher/Verifier.

Caches LLM responses for identical (college_name, state, address) combinations
to reduce API calls on re-runs.
"""

import sqlite3
import hashlib
import json
import time
import logging
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass
from contextlib import contextmanager

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Cached LLM response entry."""
    cache_key: str
    matched_college_id: Optional[str]
    confidence: float
    reason: str
    model_name: str
    created_at: float
    hit_count: int = 0
    verified: bool = False  # True = Guardian approved, False = LLM match only


class LLMResponseCache:
    """
    SQLite-based cache for LLM matching responses.
    
    Features:
    - Hash-based lookup for (college_name, state, address) tuples
    - TTL-based expiration (default 7 days)
    - Hit count tracking for analytics
    - Thread-safe with connection per thread
    """
    
    def __init__(
        self, 
        db_path: str = 'data/sqlite/llm_cache.db',
        ttl_days: int = 7,
    ):
        self.db_path = db_path
        self.ttl_seconds = ttl_days * 24 * 3600
        self._init_db()
        
        # Stats
        self.stats = {
            'hits': 0,
            'misses': 0,
            'writes': 0,
        }
    
    def _init_db(self):
        """Initialize cache database schema."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS llm_cache (
                cache_key TEXT PRIMARY KEY,
                matched_college_id TEXT,
                confidence REAL,
                reason TEXT,
                model_name TEXT,
                created_at REAL,
                hit_count INTEGER DEFAULT 0,
                verified INTEGER DEFAULT 0,
                request_hash TEXT,
                college_name TEXT,
                state TEXT,
                address TEXT
            )
        """)
        # Add verified column if upgrading from old schema (MUST be before CREATE INDEX)
        try:
            conn.execute("ALTER TABLE llm_cache ADD COLUMN verified INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass  # Column already exists
        
        # Create indexes
        conn.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON llm_cache(created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_verified ON llm_cache(verified)")
        conn.commit()
        conn.close()
        logger.info(f"LLM Response Cache initialized at {self.db_path}")
    
    @contextmanager
    def _get_conn(self):
        """Get a database connection (thread-safe)."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _create_cache_key(
        self, 
        college_name: str, 
        state: str, 
        address: str,
        course_type: Optional[str] = None,
    ) -> str:
        """
        Create a deterministic cache key from input fields.
        
        Normalizes inputs before hashing for better cache hit rate.
        """
        # Normalize inputs
        norm_name = (college_name or '').upper().strip()
        norm_state = (state or '').upper().strip()
        norm_addr = (address or '').upper().strip()
        norm_course = (course_type or '').upper().strip()
        
        # Normalize course types for better cache hit rate
        # Diploma courses are offered by medical colleges, so use same cache key
        if norm_course == 'DIPLOMA':
            norm_course = 'MEDICAL'
        
        # Create composite string
        composite = f"{norm_name}|{norm_state}|{norm_addr}|{norm_course}"
        
        # SHA256 hash
        return hashlib.sha256(composite.encode()).hexdigest()[:32]
    
    def get(
        self, 
        college_name: str, 
        state: str, 
        address: str,
        course_type: Optional[str] = None,
        verified_only: bool = True,  # Only return verified (Guardian-approved) entries
    ) -> Optional[CacheEntry]:
        """
        Get cached response for a college match request.
        
        Args:
            verified_only: If True, only return verified (Guardian-approved) matches.
                          If False, return any cached match.
        
        Returns None if not found, expired, or not verified (when verified_only=True).
        """
        cache_key = self._create_cache_key(college_name, state, address, course_type)
        
        with self._get_conn() as conn:
            if verified_only:
                cursor = conn.execute("""
                    SELECT * FROM llm_cache 
                    WHERE cache_key = ? AND created_at > ? AND verified = 1
                """, (cache_key, time.time() - self.ttl_seconds))
            else:
                cursor = conn.execute("""
                    SELECT * FROM llm_cache 
                    WHERE cache_key = ? AND created_at > ?
                """, (cache_key, time.time() - self.ttl_seconds))
            
            row = cursor.fetchone()
            
            if row:
                # Update hit count
                conn.execute("""
                    UPDATE llm_cache SET hit_count = hit_count + 1 
                    WHERE cache_key = ?
                """, (cache_key,))
                conn.commit()
                
                self.stats['hits'] += 1
                
                return CacheEntry(
                    cache_key=row['cache_key'],
                    matched_college_id=row['matched_college_id'],
                    confidence=row['confidence'],
                    reason=row['reason'],
                    model_name=row['model_name'],
                    created_at=row['created_at'],
                    hit_count=row['hit_count'] + 1,
                    verified=bool(row['verified']) if 'verified' in row.keys() else False,
                )
            
            self.stats['misses'] += 1
            return None
    
    def set(
        self,
        college_name: str,
        state: str,
        address: str,
        matched_college_id: Optional[str],
        confidence: float,
        reason: str,
        model_name: str,
        course_type: Optional[str] = None,
        verified: bool = False,  # Set to True if Guardian-approved
    ):
        """
        Cache an LLM response.
        
        Args:
            verified: If True, mark as Guardian-approved (will be used for future matches).
                     If False, this is just an LLM suggestion (won't be returned by default).
        """
        cache_key = self._create_cache_key(college_name, state, address, course_type)
        
        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO llm_cache 
                (cache_key, matched_college_id, confidence, reason, model_name, 
                 created_at, hit_count, verified, college_name, state, address)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
            """, (
                cache_key, matched_college_id, confidence, reason, model_name,
                time.time(), 1 if verified else 0, college_name, state, address
            ))
            conn.commit()
        
        self.stats['writes'] += 1
    
    def mark_verified(
        self,
        college_name: str,
        state: str,
        address: str,
        course_type: Optional[str] = None,
    ) -> bool:
        """
        Mark an existing cache entry as verified (Guardian-approved).
        
        Call this after Guardian APPROVES a match.
        Returns True if entry was found and updated, False otherwise.
        """
        cache_key = self._create_cache_key(college_name, state, address, course_type)
        
        with self._get_conn() as conn:
            cursor = conn.execute("""
                UPDATE llm_cache SET verified = 1 
                WHERE cache_key = ?
            """, (cache_key,))
            conn.commit()
            
            if cursor.rowcount > 0:
                logger.info(f"Cache entry verified: {cache_key[:8]}...")
                return True
            return False
    
    def invalidate(
        self,
        college_name: str,
        state: str,
        address: str,
        course_type: Optional[str] = None,
    ) -> bool:
        """
        Invalidate (delete) a cache entry.
        
        Call this after Guardian REJECTS a match to prevent reuse.
        Returns True if entry was found and deleted, False otherwise.
        """
        cache_key = self._create_cache_key(college_name, state, address, course_type)
        
        with self._get_conn() as conn:
            cursor = conn.execute("""
                DELETE FROM llm_cache WHERE cache_key = ?
            """, (cache_key,))
            conn.commit()
            
            if cursor.rowcount > 0:
                logger.info(f"Cache entry invalidated: {cache_key[:8]}...")
                return True
            return False
    
    def get_batch(
        self, 
        records: list,
    ) -> Tuple[list, list]:
        """
        Check cache for a batch of records.
        
        Returns:
            (cached_records, uncached_records)
        """
        cached = []
        uncached = []
        
        for record in records:
            entry = self.get(
                college_name=record.get('college_name', ''),
                state=record.get('state', ''),
                address=record.get('address', ''),
                course_type=record.get('course_type'),
            )
            
            if entry:
                # Add cache result to record
                record['_cache_hit'] = True
                record['_cached_match'] = entry.matched_college_id
                record['_cached_confidence'] = entry.confidence
                record['_cached_reason'] = entry.reason
                cached.append(record)
            else:
                uncached.append(record)
        
        return cached, uncached
    
    def cache_batch_results(
        self,
        records: list,
        results: list,
        model_name: str,
    ):
        """
        Cache results from an LLM batch response.
        
        Args:
            records: Original input records
            results: LLM match decisions
            model_name: Model that produced results
        """
        # Build lookup from record_id to result
        result_map = {r.record_id: r for r in results if hasattr(r, 'record_id')}
        
        for record in records:
            record_id = record.get('record_id')
            if record_id and record_id in result_map:
                result = result_map[record_id]
                self.set(
                    college_name=record.get('college_name', ''),
                    state=record.get('state', ''),
                    address=record.get('address', ''),
                    matched_college_id=result.matched_college_id,
                    confidence=result.confidence,
                    reason=result.reason,
                    model_name=model_name,
                    course_type=record.get('course_type'),
                )
    
    def cleanup_expired(self) -> int:
        """Remove expired cache entries. Returns count of deleted rows."""
        with self._get_conn() as conn:
            cursor = conn.execute("""
                DELETE FROM llm_cache WHERE created_at < ?
            """, (time.time() - self.ttl_seconds,))
            conn.commit()
            return cursor.rowcount
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._get_conn() as conn:
            cursor = conn.execute("SELECT COUNT(*) as count FROM llm_cache")
            total_entries = cursor.fetchone()['count']
            
            cursor = conn.execute("SELECT SUM(hit_count) as hits FROM llm_cache")
            total_hits = cursor.fetchone()['hits'] or 0
        
        hit_rate = self.stats['hits'] / max(self.stats['hits'] + self.stats['misses'], 1)
        
        return {
            'total_entries': total_entries,
            'session_hits': self.stats['hits'],
            'session_misses': self.stats['misses'],
            'session_writes': self.stats['writes'],
            'hit_rate': f"{hit_rate:.1%}",
            'total_historical_hits': total_hits,
        }
    
    def clear(self):
        """Clear entire cache (for testing/reset)."""
        with self._get_conn() as conn:
            conn.execute("DELETE FROM llm_cache")
            conn.commit()
        self.stats = {'hits': 0, 'misses': 0, 'writes': 0}


# Verification cache (separate from matcher)
class VerificationCache:
    """
    Cache for LLM verification results.
    
    Different from matcher cache - keyed by (seat_name, master_id) pair.
    """
    
    def __init__(
        self, 
        db_path: str = 'data/sqlite/llm_cache.db',
        ttl_days: int = 7,
    ):
        self.db_path = db_path
        self.ttl_seconds = ttl_days * 24 * 3600
        self._init_db()
        self.stats = {'hits': 0, 'misses': 0, 'writes': 0}
    
    def _init_db(self):
        """Initialize verification cache schema."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS verification_cache (
                cache_key TEXT PRIMARY KEY,
                verdict TEXT,
                confidence REAL,
                reason TEXT,
                model_name TEXT,
                created_at REAL,
                hit_count INTEGER DEFAULT 0
            )
        """)
        conn.commit()
        conn.close()
    
    @contextmanager
    def _get_conn(self):
        """Get a database connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _create_key(self, seat_name: str, master_id: str, match_score: float) -> str:
        """Create cache key from verification inputs."""
        composite = f"{(seat_name or '').upper()}|{master_id}|{match_score:.2f}"
        return hashlib.sha256(composite.encode()).hexdigest()[:32]
    
    def get(self, seat_name: str, master_id: str, match_score: float) -> Optional[Dict]:
        """Get cached verification result."""
        cache_key = self._create_key(seat_name, master_id, match_score)
        
        with self._get_conn() as conn:
            cursor = conn.execute("""
                SELECT * FROM verification_cache 
                WHERE cache_key = ? AND created_at > ?
            """, (cache_key, time.time() - self.ttl_seconds))
            
            row = cursor.fetchone()
            
            if row:
                conn.execute("""
                    UPDATE verification_cache SET hit_count = hit_count + 1 
                    WHERE cache_key = ?
                """, (cache_key,))
                conn.commit()
                
                self.stats['hits'] += 1
                return {
                    'verdict': row['verdict'],
                    'confidence': row['confidence'],
                    'reason': row['reason'],
                    'model_name': row['model_name'],
                }
            
            self.stats['misses'] += 1
            return None
    
    def set(
        self, 
        seat_name: str, 
        master_id: str, 
        match_score: float,
        verdict: str,
        confidence: float,
        reason: str,
        model_name: str,
    ):
        """Cache a verification result."""
        cache_key = self._create_key(seat_name, master_id, match_score)
        
        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO verification_cache 
                (cache_key, verdict, confidence, reason, model_name, created_at, hit_count)
                VALUES (?, ?, ?, ?, ?, ?, 0)
            """, (cache_key, verdict, confidence, reason, model_name, time.time()))
            conn.commit()
        
        self.stats['writes'] += 1


# Singleton instances
_matcher_cache: Optional[LLMResponseCache] = None
_verifier_cache: Optional[VerificationCache] = None


def get_matcher_cache(db_path: str = 'data/sqlite/llm_cache.db') -> LLMResponseCache:
    """Get or create singleton matcher cache."""
    global _matcher_cache
    if _matcher_cache is None:
        _matcher_cache = LLMResponseCache(db_path)
    return _matcher_cache


def get_verifier_cache(db_path: str = 'data/sqlite/llm_cache.db') -> VerificationCache:
    """Get or create singleton verifier cache."""
    global _verifier_cache
    if _verifier_cache is None:
        _verifier_cache = VerificationCache(db_path)
    return _verifier_cache
