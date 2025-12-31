#!/usr/bin/env python3
"""
Agentic Course Normalizer
AI-powered course name standardization using LLM with caching and learning.

Replaces the rule-based DataProcessor with a 3-layer intelligent normalizer:
  Layer 1: Cache Check (instant lookups from previous normalizations)
  Layer 2: Standard Terms Check (exact matches against curated list)
  Layer 3: LLM Normalization (OpenRouter API for semantic understanding)

The normalizer auto-learns from LLM decisions to build an error map.
"""

import os
import json
import logging
import hashlib
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
import time

# Rich console for progress display
try:
    from rich.console import Console
    from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
    from rich.panel import Panel
    from rich.table import Table
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False

# Import OpenRouter client
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))  # Add root to path
from openrouter_client import OpenRouterClient

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# DATA CLASSES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class NormalizationDecision:
    """Result of normalizing a course name."""
    original: str                           # Original input term
    normalized: str                         # Standardized output
    confidence: float                       # 0.0 - 1.0 confidence score
    match_type: str                         # "cache", "exact", "llm_high", "llm_medium", "llm_low", "failed"
    reason: str                             # Human-readable explanation
    source_model: Optional[str] = None      # Which LLM model was used (if any)
    processing_time_ms: float = 0.0         # Time taken to process
    
    def to_dict(self) -> Dict:
        return {
            "original": self.original,
            "normalized": self.normalized,
            "confidence": self.confidence,
            "match_type": self.match_type,
            "reason": self.reason,
            "source_model": self.source_model,
            "processing_time_ms": self.processing_time_ms,
        }


@dataclass 
class NormalizationStats:
    """Statistics for a normalization run."""
    total_processed: int = 0
    cache_hits: int = 0
    exact_matches: int = 0
    fuzzy_matches: int = 0      # NEW: Layer 2.5
    semantic_matches: int = 0   # NEW: Layer 2.7
    llm_normalizations: int = 0
    failed: int = 0
    total_time_seconds: float = 0.0
    council_votes: int = 0
    
    @property
    def cache_hit_rate(self) -> float:
        return (self.cache_hits / self.total_processed * 100) if self.total_processed > 0 else 0.0


@dataclass
class ModelStats:
    """Performance statistics for a specific LLM model."""
    model_name: str
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    total_confidence: float = 0.0
    total_time_ms: float = 0.0
    
    @property
    def success_rate(self) -> float:
        return (self.successful_calls / self.total_calls * 100) if self.total_calls > 0 else 0.0
    
    @property
    def avg_confidence(self) -> float:
        return (self.total_confidence / self.successful_calls) if self.successful_calls > 0 else 0.0
    
    @property
    def avg_time_ms(self) -> float:
        return (self.total_time_ms / self.total_calls) if self.total_calls > 0 else 0.0


@dataclass
class ModelVote:
    """A single model's vote for course normalization."""
    model: str                    # Model that made this vote
    normalized: str               # The normalized form suggested
    confidence: float             # Model's confidence
    reason: str                   # Model's reasoning
    processing_time_ms: float = 0.0


@dataclass
class CouncilDecision:
    """Result of multi-model council normalization with voting."""
    original: str
    normalized: str               # Consensus result
    confidence: float             # Average confidence across agreeing models
    match_type: str               # "council_unanimous", "council_majority", "council_split", "failed"
    reason: str
    votes: List[ModelVote] = field(default_factory=list)
    agreement_rate: float = 0.0   # % of models that agreed on the normalized form
    
    def to_dict(self) -> Dict:
        return {
            "original": self.original,
            "normalized": self.normalized,
            "confidence": self.confidence,
            "match_type": self.match_type,
            "reason": self.reason,
            "votes": [{"model": v.model.split("/")[-1], "normalized": v.normalized, "confidence": v.confidence} for v in self.votes],
            "agreement_rate": self.agreement_rate,
        }



# ═══════════════════════════════════════════════════════════════════════════════
# MODEL CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

MODEL_CONFIG = {
    # Priority 0: Best reasoning models (primary tier)
    "tngtech/deepseek-r1t-chimera:free": {
        "max_tokens": 8192,
        "batch_size": 20,  # Normalizer prompts are smaller, can batch more
        "timeout": 120,
        "priority": 0,
        "description": "DeepSeek R1 - Excellent reasoning"
    },
    "google/gemini-2.0-flash-exp:free": {
        "max_tokens": 8000,
        "batch_size": 15,
        "timeout": 90,
        "priority": 0,
        "description": "Gemini 2.0 Flash - Fast & accurate"
    },
    
    # Priority 1: Quality fallback (reliable alternatives)
    "qwen/qwen3-235b-a22b:free": {
        "max_tokens": 8000,
        "batch_size": 10,
        "timeout": 120,
        "priority": 1,
        "description": "Qwen 235B - Large model"
    },
    "meta-llama/llama-3.3-70b-instruct:free": {
        "max_tokens": 8192,
        "batch_size": 15,
        "timeout": 90,
        "priority": 1,
        "description": "Llama 3.3 70B - Reliable"
    },
    "kwaipilot/kat-coder-pro:free": {
        "max_tokens": 32768,
        "batch_size": 25,
        "timeout": 90,
        "priority": 1,
        "description": "Kat Coder Pro - High capacity"
    },
    
    # Priority 2: Capacity fallback (high throughput models)
    "qwen/qwen3-coder:free": {
        "max_tokens": 65536,
        "batch_size": 30,
        "timeout": 120,
        "priority": 2,
        "description": "Qwen3 Coder - Very high capacity"
    },
    "amazon/nova-2-lite-v1:free": {
        "max_tokens": 65536,
        "batch_size": 35,
        "timeout": 120,
        "priority": 2,
        "description": "Nova 2 Lite - Highest capacity"
    },
    "mistralai/mistral-small-3.1-24b-instruct:free": {
        "max_tokens": 16384,
        "batch_size": 15,
        "timeout": 90,
        "priority": 2,
        "description": "Mistral Small - Fast fallback"
    },
    "z-ai/glm-4.5-air:free": {
        "max_tokens": 8192,
        "batch_size": 12,
        "timeout": 60,
        "priority": 2,
        "description": "GLM 4.5 Air - Last resort"
    },
}

# Priority-sorted list of models for fallback rotation
WORKER_MODELS = sorted(MODEL_CONFIG.keys(), key=lambda m: MODEL_CONFIG[m]["priority"])


# ═══════════════════════════════════════════════════════════════════════════════
# SYSTEM PROMPT FOR LLM
# ═══════════════════════════════════════════════════════════════════════════════

NORMALIZER_SYSTEM_PROMPT = """You are an expert at standardizing medical and dental course names for Indian education data.

Your task is to normalize messy course names to match the EXACT standard course names provided in the reference list.

CRITICAL RULES:
1. PRESERVE THE COURSE TYPE PREFIX (MD, MS, DNB, DM, MCH, DIPLOMA, MDS) - NEVER change it!
   - "MS ORTHO" → "MS ORTHOPAEDICS" (keep MS, not DNB)
   - "MD PAEDS" → "MD PAEDIATRICS" (keep MD, not DNB)
   - "DNB ORTHO" → "DNB ORTHOPAEDICS" (keep DNB)
2. MATCH the standard course names EXACTLY as given in the reference list
3. Look for a standard that has BOTH the same prefix AND specialty
4. Use standard spellings (ANAESTHESIOLOGY not ANESTHESIOLOGY in Indian context)
5. Output UPPERCASE normalized names

MATCHING LOGIC:
- Input "MS ORTHO" → find standard starting with "MS" that contains "ORTHO" → "MS ORTHOPAEDICS"
- Input "MD PAEDS" → find standard starting with "MD" that contains "PAED" → "MD PAEDIATRICS"
- Input "DNB CARDIO" → find standard starting with "DNB" that contains "CARDIO" → "DNB CARDIOLOGY"

COMMON COURSE TYPES (in order of preference for matching):
- MD: Doctor of Medicine (medical PG)
- MS: Master of Surgery (surgical PG)
- DNB: Diplomate of National Board
- DM: Doctorate of Medicine (super-specialty)
- MCH: Magister Chirurgiae (super-specialty surgical)
- DIPLOMA: Short-form specialty courses
- MDS: Master of Dental Surgery

CONFIDENCE:
- 0.95-1.0: Exact prefix + specialty match
- 0.80-0.94: Correct prefix, close specialty match
- 0.60-0.79: Partial match or interpretation needed
- Below 0.60: Unable to match

You will receive:
1. A list of STANDARD COURSES to match against
2. A batch of course names to normalize

For EACH course, respond with JSON:
{"original": "input name", "normalized": "MATCHED STANDARD", "confidence": 0.95, "reason": "brief explanation"}

Respond ONLY with valid JSON objects, one per line. No markdown."""


# ═══════════════════════════════════════════════════════════════════════════════
# AGENTIC NORMALIZER CLASS
# ═══════════════════════════════════════════════════════════════════════════════

class AgenticNormalizer:
    """
    AI-powered course name normalizer with 3-layer architecture:
    
    1. Cache Layer: Instant lookup from previous normalizations
    2. Standards Layer: Exact match against curated standard terms  
    3. LLM Layer: OpenRouter API for semantic normalization
    
    Auto-learns from LLM decisions to improve future performance.
    """
    
    def __init__(
        self,
        config: Dict = None,
        api_key: Optional[str] = None,
        cache_dir: Optional[Path] = None,
        standards_file: Optional[Path] = None,
        max_workers: int = 4,
    ):
        """
        Initialize the Agentic Normalizer.
        
        Args:
            config: Configuration dict (from config.yaml)
            api_key: OpenRouter API key (falls back to config or env)
            cache_dir: Directory for cache files
            standards_file: Path to standard course terms Excel/CSV
            max_workers: Number of parallel workers for LLM calls
        """
        self.config = config or {}
        self.max_workers = max_workers
        
        # Setup console
        self.console = Console() if RICH_AVAILABLE else None
        
        # Get API key from config or environment
        self.api_key = api_key
        if not self.api_key:
            agentic_config = self.config.get("agentic_matcher", {})
            api_keys = agentic_config.get("api_keys", [])
            if api_keys:
                self.api_key = api_keys[0]  # Use first key
            else:
                self.api_key = os.getenv("OPENROUTER_API_KEY")
        
        if not self.api_key:
            raise ValueError("OpenRouter API key required. Set in config.yaml or OPENROUTER_API_KEY env var.")
        
        # Initialize OpenRouter client
        self.client = OpenRouterClient(api_key=self.api_key)
        
        # Setup paths
        self.cache_dir = cache_dir or Path(__file__).parent.parent.parent / "data" / "cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        self.cache_file = self.cache_dir / "normalization_cache.json"
        self.error_map_file = self.cache_dir / "learned_error_map.json"
        
        # Load caches
        self._cache: Dict[str, NormalizationDecision] = {}
        self._error_map: Dict[str, str] = {}
        self._standards: Dict[str, str] = {}  # normalized_key -> standard_name
        
        self._load_cache()
        self._load_error_map()
        
        # Load standards from file
        if standards_file:
            self._load_standards(standards_file)
        else:
            # Auto-load standard_courses.xlsx from common locations (txt fallback)
            self._auto_load_standards()
        
        # Stats
        self.stats = NormalizationStats()
        
        logger.info(f"AgenticNormalizer initialized with {len(self._cache)} cached items, {len(self._error_map)} learned corrections, {len(self._standards)} standard courses")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CACHE MANAGEMENT
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _cache_key(self, term: str) -> str:
        """Generate a consistent cache key for a term."""
        normalized = term.upper().strip()
        return hashlib.md5(normalized.encode()).hexdigest()[:16]
    
    def _load_cache(self):
        """Load normalization cache from disk."""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r') as f:
                    data = json.load(f)
                    for key, val in data.items():
                        self._cache[key] = NormalizationDecision(**val)
                logger.debug(f"Loaded {len(self._cache)} cached normalizations")
            except Exception as e:
                logger.warning(f"Failed to load cache: {e}")
    
    def _save_cache(self):
        """Persist normalization cache to disk."""
        try:
            data = {k: v.to_dict() for k, v in self._cache.items()}
            with open(self.cache_file, 'w') as f:
                json.dump(data, f, indent=2)
            logger.debug(f"Saved {len(self._cache)} cached normalizations")
        except Exception as e:
            logger.warning(f"Failed to save cache: {e}")
    
    def _load_error_map(self):
        """Load learned error corrections from disk."""
        if self.error_map_file.exists():
            try:
                with open(self.error_map_file, 'r') as f:
                    self._error_map = json.load(f)
                logger.debug(f"Loaded {len(self._error_map)} learned corrections")
            except Exception as e:
                logger.warning(f"Failed to load error map: {e}")
    
    def _save_error_map(self):
        """Persist learned error corrections to disk."""
        try:
            with open(self.error_map_file, 'w') as f:
                json.dump(self._error_map, f, indent=2, ensure_ascii=False)
            logger.debug(f"Saved {len(self._error_map)} learned corrections")
        except Exception as e:
            logger.warning(f"Failed to save error map: {e}")
    
    def _load_standards(self, standards_file: Path):
        """Load standard course terms from file."""
        try:
            import pandas as pd
            if standards_file.suffix == '.xlsx':
                df = pd.read_excel(standards_file)
            else:
                df = pd.read_csv(standards_file)
            
            # Assume first column is the standard name
            col = df.columns[0]
            for name in df[col].dropna():
                key = str(name).upper().strip()
                self._standards[key] = key
            
            logger.info(f"Loaded {len(self._standards)} standard courses")
        except Exception as e:
            logger.warning(f"Failed to load standards: {e}")
    
    def _auto_load_standards(self):
        """Auto-detect and load standard_courses.xlsx from common locations."""
        # Search order for standard courses file (xlsx preferred, txt fallback)
        search_paths = [
            Path("standard_courses.xlsx"),  # Current working directory
            Path(__file__).parent.parent.parent / "standard_courses.xlsx",  # course_standardizer/
            Path(__file__).parent.parent.parent.parent / "standard_courses.xlsx",  # One level up
            Path.home() / "Public" / "New" / "standard_courses.xlsx",  # User's project dir
            Path.home() / "Public" / "New" / "course_standardizer" / "standard_courses.xlsx",
            # Fallback to .txt versions
            Path("standard_courses.txt"),
            Path.home() / "Public" / "New" / "standard_courses.txt",
        ]
        
        for path in search_paths:
            if path.exists():
                if path.suffix == ".xlsx":
                    self._load_standards_xlsx(path)
                else:
                    self._load_standards_txt(path)
                return
        
        logger.info("No standard_courses file found - Layer 2 (Standards) will be skipped")
    
    def _load_standards_txt(self, path: Path):
        """Load standards from text file (one course per line)."""
        try:
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    course = line.strip()
                    if course and not course.startswith("#"):  # Skip empty and comments
                        key = course.upper()
                        self._standards[key] = key
            
            # Remove duplicates like "ALL PG COURSES" header
            self._standards.pop("ALL PG COURSES", None)
            self._standards.pop("BDS", None)  # Often a header
            
            logger.info(f"Loaded {len(self._standards)} standard courses from {path.name}")
        except Exception as e:
            logger.warning(f"Failed to load {path}: {e}")
    
    def _load_standards_xlsx(self, path: Path):
        """Load standards from Excel file (.xlsx)."""
        try:
            import pandas as pd
            df = pd.read_excel(path)
            
            # Try common column names for course names
            course_col = None
            for col in ['Course', 'course', 'COURSE', 'Course Name', 'course_name', 'Name', 'name', 'Standard Course']:
                if col in df.columns:
                    course_col = col
                    break
            
            # If no named column found, use first column
            if course_col is None and len(df.columns) > 0:
                course_col = df.columns[0]
            
            if course_col:
                for course in df[course_col].dropna():
                    course_str = str(course).strip()
                    if course_str and not course_str.upper().startswith("ALL "):  # Skip headers
                        key = course_str.upper()
                        self._standards[key] = key
            
            logger.info(f"Loaded {len(self._standards)} standard courses from {path.name}")
        except ImportError:
            logger.warning("pandas not installed - cannot load .xlsx files")
        except Exception as e:
            logger.warning(f"Failed to load {path}: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 1: CACHE CHECK
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _check_cache(self, term: str) -> Optional[NormalizationDecision]:
        """Check if term is already normalized in cache."""
        key = self._cache_key(term)
        if key in self._cache:
            decision = self._cache[key]
            # Return a copy with updated match_type
            return NormalizationDecision(
                original=term,
                normalized=decision.normalized,
                confidence=decision.confidence,
                match_type="cache",
                reason=f"Cached: {decision.reason}",
                source_model=decision.source_model,
            )
        
        # Also check error map
        upper_term = term.upper().strip()
        if upper_term in self._error_map:
            return NormalizationDecision(
                original=term,
                normalized=self._error_map[upper_term],
                confidence=0.95,
                match_type="cache",
                reason="Learned correction from previous LLM decision",
            )
        
        return None
    
    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 2: STANDARD TERMS CHECK
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _check_standards(self, term: str) -> Optional[NormalizationDecision]:
        """Check if term exactly matches a standard course name."""
        upper_term = term.upper().strip()
        
        if upper_term in self._standards:
            return NormalizationDecision(
                original=term,
                normalized=self._standards[upper_term],
                confidence=1.0,
                match_type="exact",
                reason="Exact match to standard term",
            )
        return None
    
    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 2.5: FUZZY PRE-MATCHING (reduces LLM calls)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _check_fuzzy_match(self, term: str, threshold: float = 0.90) -> Optional[NormalizationDecision]:
        """
        Check for fuzzy matches against standard terms.
        
        Uses rapidfuzz for fast fuzzy matching. If a near-match is found
        above the threshold, returns it without needing LLM.
        
        Args:
            term: Input term to match
            threshold: Minimum similarity ratio (0.0-1.0)
            
        Returns:
            NormalizationDecision if fuzzy match found, None otherwise
        """
        try:
            from rapidfuzz import fuzz, process
        except ImportError:
            return None  # Skip fuzzy matching if rapidfuzz not available
        
        if not self._standards:
            return None
        
        upper_term = term.upper().strip()
        standards_list = list(self._standards.keys())
        
        # Find best match using token_set_ratio (handles word order differences)
        result = process.extractOne(
            upper_term,
            standards_list,
            scorer=fuzz.token_set_ratio,
            score_cutoff=threshold * 100,  # rapidfuzz uses 0-100
        )
        
        if result:
            matched_standard, score, _ = result
            confidence = score / 100.0
            
            # Track fuzzy match stats
            self.stats.fuzzy_matches = getattr(self.stats, 'fuzzy_matches', 0) + 1
            
            return NormalizationDecision(
                original=term,
                normalized=self._standards[matched_standard],
                confidence=confidence,
                match_type="fuzzy",
                reason=f"Fuzzy match ({confidence:.0%} similar to '{matched_standard}')",
            )
        
        return None
    
    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 2.7: SEMANTIC SIMILARITY MATCHING
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _init_semantic_model(self):
        """Initialize sentence embedding model (lazy loading)."""
        if hasattr(self, '_semantic_model'):
            return self._semantic_model is not None
        
        try:
            from sentence_transformers import SentenceTransformer
            self._semantic_model = SentenceTransformer('all-MiniLM-L6-v2')
            
            # Pre-compute embeddings for standards
            if self._standards:
                standards_list = list(self._standards.keys())
                self._standards_embeddings = self._semantic_model.encode(standards_list, convert_to_tensor=True)
                self._standards_list = standards_list
            else:
                self._standards_embeddings = None
                self._standards_list = []
            
            logger.info(f"Semantic model initialized with {len(self._standards_list)} standard embeddings")
            return True
        except ImportError:
            self._semantic_model = None
            logger.info("sentence-transformers not available - semantic matching disabled")
            return False
    
    def _check_semantic_match(self, term: str, threshold: float = 0.85) -> Optional[NormalizationDecision]:
        """
        Check for semantically similar standard terms using embeddings.
        
        Uses sentence-transformers for semantic similarity even when
        text differs significantly (e.g., synonyms, rewordings).
        
        Args:
            term: Input term to match
            threshold: Minimum cosine similarity (0.0-1.0)
            
        Returns:
            NormalizationDecision if semantic match found, None otherwise
        """
        # Lazy-init semantic model
        if not self._init_semantic_model():
            return None
        
        if not self._standards_embeddings is not None or len(self._standards_list) == 0:
            return None
        
        try:
            from sentence_transformers import util
            
            # Encode input term
            term_embedding = self._semantic_model.encode(term.upper().strip(), convert_to_tensor=True)
            
            # Compute cosine similarity
            similarities = util.cos_sim(term_embedding, self._standards_embeddings)[0]
            
            # Find best match
            best_idx = similarities.argmax().item()
            best_score = similarities[best_idx].item()
            
            if best_score >= threshold:
                matched_standard = self._standards_list[best_idx]
                
                return NormalizationDecision(
                    original=term,
                    normalized=self._standards[matched_standard],
                    confidence=best_score,
                    match_type="semantic",
                    reason=f"Semantic match ({best_score:.0%} similarity to '{matched_standard}')",
                )
        except Exception as e:
            logger.warning(f"Semantic matching failed: {e}")
        
        return None
    
    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 3: LLM NORMALIZATION
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _build_prompt(self, terms: List[str]) -> str:
        """Build the LLM prompt for batch normalization with standard courses reference."""
        term_list = "\n".join([f"- {t}" for t in terms])
        
        # Include standard courses for LLM to match against (limit to avoid token overflow)
        standards_list = list(self._standards.keys())[:150]  # Top 150 standards
        standards_text = "\n".join(standards_list)
        
        return f"""STANDARD COURSES (match these EXACTLY):
{standards_text}

---

COURSES TO NORMALIZE:
{term_list}

---

INSTRUCTIONS:
1. For each input course, find the BEST MATCHING standard course from the list above
2. Output the EXACT standard course name, not an expanded version
3. If no exact match, find the closest match based on meaning
4. Output ONE JSON object per line: {{"original": "...", "normalized": "STANDARD NAME", "confidence": 0.95, "reason": "..."}}"""
    
    def _parse_response(self, response_text: str, original_terms: List[str]) -> List[NormalizationDecision]:
        """Parse LLM response into NormalizationDecision objects."""
        decisions = []
        term_map = {t.lower().strip(): t for t in original_terms}
        
        # Try to extract JSON objects from response
        lines = response_text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line or not line.startswith('{'):
                continue
            
            try:
                # Clean up common issues
                line = line.rstrip(',')
                obj = json.loads(line)
                
                original = obj.get("original", "")
                normalized = obj.get("normalized", "").upper().strip()
                confidence = float(obj.get("confidence", 0.7))
                reason = obj.get("reason", "LLM normalization")
                
                # Determine match type based on confidence
                if confidence >= 0.95:
                    match_type = "llm_high"
                elif confidence >= 0.80:
                    match_type = "llm_medium"
                else:
                    match_type = "llm_low"
                
                decisions.append(NormalizationDecision(
                    original=original,
                    normalized=normalized,
                    confidence=confidence,
                    match_type=match_type,
                    reason=reason,
                ))
                
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                logger.warning(f"Failed to parse JSON line: {line[:100]}... - {e}")
                continue
        
        return decisions
    
    def _normalize_batch_llm(
        self,
        terms: List[str],
        model: str = None,
    ) -> List[NormalizationDecision]:
        """Normalize a batch of terms using LLM."""
        if not terms:
            return []
        
        model = model or "google/gemini-2.0-flash-exp:free"
        config = MODEL_CONFIG.get(model, {"max_tokens": 8000, "timeout": 90})
        
        start_time = time.time()
        
        try:
            messages = [
                {"role": "system", "content": NORMALIZER_SYSTEM_PROMPT},
                {"role": "user", "content": self._build_prompt(terms)},
            ]
            
            response = self.client.complete_with_retry(
                messages=messages,
                model=model,
                max_tokens=config["max_tokens"],
                timeout=config.get("timeout", 90),
                temperature=0.1,
            )
            
            processing_time = (time.time() - start_time) * 1000
            decisions = self._parse_response(response.content, terms)
            
            # Add model info and timing
            for d in decisions:
                d.source_model = response.model
                d.processing_time_ms = processing_time / len(terms)
            
            # Cache successful decisions and update error map
            for d in decisions:
                if d.confidence >= 0.70:
                    key = self._cache_key(d.original)
                    self._cache[key] = d
                    
                    # Add to error map for future quick lookups
                    if d.original.upper().strip() != d.normalized:
                        self._error_map[d.original.upper().strip()] = d.normalized
            
            return decisions
            
        except Exception as e:
            logger.error(f"LLM normalization failed for batch: {e}")
            # Return failed decisions for all terms
            return [
                NormalizationDecision(
                    original=t,
                    normalized=t.upper().strip(),
                    confidence=0.0,
                    match_type="failed",
                    reason=f"LLM error: {str(e)[:50]}",
                )
                for t in terms
            ]
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MAIN NORMALIZATION METHOD
    # ═══════════════════════════════════════════════════════════════════════════
    
    def normalize_courses(
        self,
        terms: List[str],
        batch_size: int = 10,
        show_progress: bool = True,
        max_rounds: int = 2,
        round_delay: float = 10.0,
    ) -> List[NormalizationDecision]:
        """
        Normalize a list of course names using GROUP-BY-EXACT-NAME philosophy.
        
        OPTIMIZATION: Groups identical course names to process unique terms only,
        then bulk-applies results to all rows with the same original name.
        
        Example: 1000 rows with 50 unique courses → 50 LLM calls instead of 1000
        
        Uses 3-layer approach with multi-round fallback:
        1. Cache check (instant)
        2. Standard terms check (instant)  
        3. LLM normalization (batched API calls with parallel model fallback)
        
        FALLBACK FEATURES (like agentic_matcher):
        - WORKER_MODELS: Priority-sorted model list for rotation
        - Parallel fallback: Immediate retry on 429/503 with next model
        - Multi-round: Re-process low-confidence items with different models
        
        Args:
            terms: List of course names to normalize
            batch_size: Number of unique terms per LLM batch
            show_progress: Show rich progress bar
            max_rounds: Number of retry rounds for low-confidence terms
            round_delay: Delay between rounds in seconds
            
        Returns:
            List of NormalizationDecision for each input term (preserves order)
        """
        start_time = time.time()
        
        # Reset stats
        self.stats = NormalizationStats()
        self.stats.total_processed = len(terms)
        
        # ───────────────────────────────────────────────────────────────────────
        # PHASE 1: GROUP BY EXACT NAME
        # ───────────────────────────────────────────────────────────────────────
        # Build a mapping: normalized_key -> list of original indices
        # This deduplicates the work needed
        
        unique_terms: Dict[str, str] = {}  # key -> first occurrence of term
        term_to_key: Dict[int, str] = {}   # index -> key (for result mapping)
        
        for idx, term in enumerate(terms):
            key = term.upper().strip()
            if key not in unique_terms:
                unique_terms[key] = term  # Store first occurrence
            term_to_key[idx] = key
        
        unique_count = len(unique_terms)
        reduction_pct = ((len(terms) - unique_count) / len(terms) * 100) if terms else 0
        
        if self.console and show_progress:
            self.console.print(f"[cyan]📊 Grouping:[/] {len(terms)} rows → {unique_count} unique terms ({reduction_pct:.1f}% reduction)")
        
        # ───────────────────────────────────────────────────────────────────────
        # PHASE 2: PROCESS UNIQUE TERMS (Cache → Standards → LLM)
        # ───────────────────────────────────────────────────────────────────────
        
        unique_results: Dict[str, NormalizationDecision] = {}  # key -> decision
        llm_needed: List[Tuple[str, str]] = []  # (key, term) pairs needing LLM
        
        for key, term in unique_terms.items():
            # Layer 1: Cache Check
            cached = self._check_cache(term)
            if cached:
                unique_results[key] = cached
                self.stats.cache_hits += 1
                continue
            
            # Layer 2: Standards Check (exact match)
            standard = self._check_standards(term)
            if standard:
                unique_results[key] = standard
                self.stats.exact_matches += 1
                continue
            
            # Layer 2.5: Fuzzy Matching (near-match to standards)
            fuzzy = self._check_fuzzy_match(term)
            if fuzzy:
                unique_results[key] = fuzzy
                self.stats.fuzzy_matches += 1
                continue
            
            # Layer 2.7: Semantic Matching (if available)
            semantic = self._check_semantic_match(term)
            if semantic:
                unique_results[key] = semantic
                self.stats.semantic_matches += 1
                continue
            
            # Need LLM
            llm_needed.append((key, term))
        
        # ───────────────────────────────────────────────────────────────────────
        # PHASE 3: LLM NORMALIZATION WITH PARALLEL FALLBACK
        # ───────────────────────────────────────────────────────────────────────
        
        if llm_needed:
            if self.console and show_progress:
                self.console.print(Panel(
                    f"[bold cyan]Agentic Normalizer[/]\n"
                    f"📦 Total Rows: {len(terms)} | 🔢 Unique: {unique_count}\n"
                    f"💾 Cached: {self.stats.cache_hits} | ✅ Exact: {self.stats.exact_matches} | 🤖 LLM Needed: {len(llm_needed)}\n"
                    f"🔄 Models: {len(WORKER_MODELS)} available for fallback",
                    title="Course Normalization (Grouped + Fallback)",
                ))
            
            # Batch the LLM calls by unique terms
            batches = []
            llm_list = list(llm_needed)
            for i in range(0, len(llm_list), batch_size):
                batch = llm_list[i:i + batch_size]
                batches.append(batch)
            
            total_batches = len(batches)
            max_model_attempts = min(len(WORKER_MODELS), 5)  # Max models to try per batch
            
            # Track which models have been tried per batch
            models_tried_per_batch: Dict[int, set] = {i: set() for i in range(total_batches)}
            completed_results: Dict[int, List[NormalizationDecision]] = {}
            
            def process_batch_with_model(batch_idx: int, batch: List, model: str):
                """Process a batch with a specific model. Returns (batch_idx, decisions, success, error)."""
                terms_batch = [t for _, t in batch]
                try:
                    decisions = self._normalize_batch_llm(terms_batch, model=model)
                    # Check if any decisions failed (confidence 0.0)
                    all_failed = all(d.confidence == 0.0 for d in decisions)
                    if all_failed:
                        return batch_idx, [], False, "All decisions failed"
                    return batch_idx, decisions, True, None
                except Exception as e:
                    error_type = "429" if "429" in str(e) else ("503" if "503" in str(e) else "error")
                    return batch_idx, [], False, error_type
            
            # Process batches with parallel fallback
            if self.console and show_progress and RICH_AVAILABLE:
                from concurrent.futures import as_completed
                
                with Progress(
                    SpinnerColumn(),
                    TextColumn("[progress.description]{task.description}"),
                    BarColumn(),
                    TaskProgressColumn(),
                    console=self.console,
                ) as progress:
                    task_id = progress.add_task(f"[cyan]LLM ({len(llm_needed)} unique, {len(WORKER_MODELS)} models)...", total=total_batches)
                    
                    with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                        # Submit initial jobs with different models (round-robin)
                        futures = {}
                        for i, batch in enumerate(batches):
                            model = WORKER_MODELS[i % len(WORKER_MODELS)]
                            models_tried_per_batch[i].add(model)
                            future = executor.submit(process_batch_with_model, i, batch, model)
                            futures[future] = (i, batch)
                        
                        # Process results and retry failures
                        while futures:
                            done_futures = []
                            for future in as_completed(futures):
                                batch_idx, decisions, success, error = future.result()
                                original_batch = futures[future][1]
                                
                                if success and decisions:
                                    # Success! Record results
                                    completed_results[batch_idx] = decisions
                                    model_short = decisions[0].source_model.split("/")[-1][:15] if decisions[0].source_model else "?"
                                    progress.console.print(f"   [green]✓ Batch {batch_idx+1}/{total_batches}: {len(decisions)} ({model_short})[/green]")
                                    progress.advance(task_id)
                                else:
                                    # Failed - try next model if available
                                    tried = models_tried_per_batch[batch_idx]
                                    next_model = None
                                    for m in WORKER_MODELS:
                                        if m not in tried and len(tried) < max_model_attempts:
                                            next_model = m
                                            break
                                    
                                    if next_model:
                                        # Retry with different model
                                        models_tried_per_batch[batch_idx].add(next_model)
                                        new_future = executor.submit(process_batch_with_model, batch_idx, original_batch, next_model)
                                        futures[new_future] = (batch_idx, original_batch)
                                        short_name = next_model.split("/")[-1][:12]
                                        progress.console.print(f"   [yellow]↻ Batch {batch_idx+1} retry → {short_name}[/yellow]")
                                    else:
                                        # All models exhausted for this batch
                                        completed_results[batch_idx] = [
                                            NormalizationDecision(
                                                original=orig,
                                                normalized=orig.upper().strip(),
                                                confidence=0.0,
                                                match_type="failed",
                                                reason=f"All {max_model_attempts} models failed",
                                            )
                                            for _, orig in original_batch
                                        ]
                                        progress.console.print(f"   [red]✗ Batch {batch_idx+1}: All models failed[/red]")
                                        progress.advance(task_id)
                                        self.stats.failed += len(original_batch)
                                
                                done_futures.append(future)
                            
                            for f in done_futures:
                                del futures[f]
            else:
                # Non-rich fallback (sequential with retries)
                for i, batch in enumerate(batches):
                    success = False
                    for model in WORKER_MODELS[:max_model_attempts]:
                        if model in models_tried_per_batch[i]:
                            continue
                        models_tried_per_batch[i].add(model)
                        _, decisions, success, _ = process_batch_with_model(i, batch, model)
                        if success:
                            completed_results[i] = decisions
                            break
                    
                    if not success:
                        completed_results[i] = [
                            NormalizationDecision(
                                original=orig,
                                normalized=orig.upper().strip(),
                                confidence=0.0,
                                match_type="failed",
                                reason="All models failed",
                            )
                            for _, orig in batch
                        ]
                        self.stats.failed += len(batch)
            
            # Map completed results back to unique_results
            for batch_idx, batch in enumerate(batches):
                decisions = completed_results.get(batch_idx, [])
                for (key, orig), decision in zip(batch, decisions):
                    unique_results[key] = decision
                    if decision.confidence > 0:
                        self.stats.llm_normalizations += 1
        
        # ───────────────────────────────────────────────────────────────────────
        # PHASE 3.5: MULTI-ROUND RETRY FOR LOW-CONFIDENCE (like agentic_matcher)
        # ───────────────────────────────────────────────────────────────────────
        
        LOW_CONFIDENCE_THRESHOLD = 0.7
        
        for round_num in range(2, max_rounds + 1):
            # Find low-confidence terms that need retry
            low_conf_terms = [
                (key, unique_results[key].original)
                for key in unique_results
                if unique_results[key].confidence < LOW_CONFIDENCE_THRESHOLD
                and unique_results[key].match_type != "failed"
            ]
            
            if not low_conf_terms:
                break
            
            if self.console and show_progress:
                self.console.print(f"\n[bold yellow]🔄 ROUND {round_num}/{max_rounds}: Retrying {len(low_conf_terms)} low-confidence terms[/bold yellow]")
                if round_delay > 0:
                    self.console.print(f"[dim]Waiting {round_delay}s before retry...[/dim]")
                    time.sleep(round_delay)
            
            # Process retry batch with different models (shift by round number)
            retry_batch = [(key, term) for key, term in low_conf_terms]
            terms_batch = [t for _, t in retry_batch]
            
            # Use a different model for retry based on round number
            retry_model = WORKER_MODELS[(round_num - 1) % len(WORKER_MODELS)]
            
            try:
                retry_decisions = self._normalize_batch_llm(terms_batch, model=retry_model)
                
                # Update results only if new confidence is higher
                improved = 0
                for (key, orig), new_decision in zip(retry_batch, retry_decisions):
                    if new_decision.confidence > unique_results[key].confidence:
                        unique_results[key] = new_decision
                        improved += 1
                
                if self.console and show_progress:
                    self.console.print(f"[green]   ✓ Improved {improved}/{len(low_conf_terms)} terms[/green]")
            except Exception as e:
                if self.console and show_progress:
                    self.console.print(f"[red]   ✗ Round {round_num} failed: {e}[/red]")
        
        # ───────────────────────────────────────────────────────────────────────
        # PHASE 4: BULK UPDATE - Apply results to all rows
        # ───────────────────────────────────────────────────────────────────────
        
        # Save caches
        self._save_cache()
        self._save_error_map()
        
        # Finalize stats
        self.stats.total_time_seconds = time.time() - start_time
        
        # Show summary
        if self.console and show_progress:
            self._print_summary(unique_count, len(llm_needed))
        
        # Map results back to original order using term_to_key
        results = []
        for idx in range(len(terms)):
            key = term_to_key[idx]
            if key in unique_results:
                decision = unique_results[key]
                # Create a copy with the original term from this row
                results.append(NormalizationDecision(
                    original=terms[idx],
                    normalized=decision.normalized,
                    confidence=decision.confidence,
                    match_type=decision.match_type,
                    reason=decision.reason,
                    source_model=decision.source_model,
                    processing_time_ms=decision.processing_time_ms,
                ))
            else:
                # Shouldn't happen, but fallback
                results.append(NormalizationDecision(
                    original=terms[idx],
                    normalized=terms[idx].upper().strip(),
                    confidence=0.0,
                    match_type="failed",
                    reason="No result found",
                ))
        
        return results
    
    def _print_summary(self, unique_count: int = 0, llm_processed: int = 0):
        """Print normalization summary."""
        if not RICH_AVAILABLE:
            return
        
        table = Table(title="Normalization Results")
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")
        
        table.add_row("Total Rows", str(self.stats.total_processed))
        table.add_row("Unique Terms", str(unique_count))
        table.add_row("Cache Hits", f"{self.stats.cache_hits} ({self.stats.cache_hit_rate:.1f}%)")
        table.add_row("Exact Matches", str(self.stats.exact_matches))
        table.add_row("LLM Processed", str(llm_processed))
        table.add_row("Failed", str(self.stats.failed))
        table.add_row("Total Time", f"{self.stats.total_time_seconds:.2f}s")
        
        self.console.print(table)

    # ═══════════════════════════════════════════════════════════════════════════
    # COUNCIL OF MODELS - Multi-Model Voting for Higher Accuracy
    # ═══════════════════════════════════════════════════════════════════════════
    
    def normalize_with_council(
        self,
        terms: List[str],
        num_models: int = 3,
        batch_size: int = 10,
        show_progress: bool = True,
    ) -> List[CouncilDecision]:
        """
        Normalize course names using a COUNCIL of multiple LLM models.
        
        Each unique term is processed by multiple models in PARALLEL.
        Final result is determined by MAJORITY VOTING on the normalized form.
        
        This provides higher accuracy than single-model normalization by:
        1. Reducing individual model errors through consensus
        2. Increasing confidence when models agree
        3. Flagging uncertain terms when models disagree
        
        Args:
            terms: List of course names to normalize
            num_models: Number of models to vote (default 3)
            batch_size: Terms per LLM batch
            show_progress: Show progress UI
            
        Returns:
            List of CouncilDecision with voting results
        """
        import random
        from collections import Counter
        
        start_time = time.time()
        
        # Reset stats
        self.stats = NormalizationStats()
        self.stats.total_processed = len(terms)
        
        # ═══════════════════════════════════════════════════════════════════════
        # PHASE 1: GROUP BY EXACT NAME (same as single model)
        # ═══════════════════════════════════════════════════════════════════════
        
        unique_terms: Dict[str, str] = {}
        term_to_key: Dict[int, str] = {}
        
        for idx, term in enumerate(terms):
            key = term.upper().strip()
            if key not in unique_terms:
                unique_terms[key] = term
            term_to_key[idx] = key
        
        unique_count = len(unique_terms)
        
        if self.console and show_progress:
            self.console.print(Panel(
                f"[bold magenta]🤝 COUNCIL OF MODELS[/bold magenta]\n"
                f"📦 Total Rows: {len(terms)} | 🔢 Unique: {unique_count}\n"
                f"🗳️ Models voting: {num_models} | ⚡ Running in parallel",
                title="Multi-Model Consensus",
                border_style="magenta",
            ))
        
        # ═══════════════════════════════════════════════════════════════════════
        # PHASE 2: CHECK CACHE (skip council for cached terms)
        # ═══════════════════════════════════════════════════════════════════════
        
        unique_results: Dict[str, CouncilDecision] = {}
        council_needed: List[Tuple[str, str]] = []
        
        for key, term in unique_terms.items():
            cached = self._check_cache(term)
            if cached:
                unique_results[key] = CouncilDecision(
                    original=term,
                    normalized=cached.normalized,
                    confidence=cached.confidence,
                    match_type="cache",
                    reason="Cached from previous decision",
                    votes=[],
                    agreement_rate=1.0,
                )
                self.stats.cache_hits += 1
            else:
                council_needed.append((key, term))
        
        # ═══════════════════════════════════════════════════════════════════════
        # PHASE 3: PARALLEL MULTI-MODEL VOTING
        # ═══════════════════════════════════════════════════════════════════════
        
        if council_needed:
            # Select models for the council
            available_models = list(MODEL_CONFIG.keys())
            random.shuffle(available_models)
            selected_models = available_models[:num_models + 2]  # Extra for fallback
            
            if self.console and show_progress:
                model_names = [m.split("/")[-1][:15] for m in selected_models[:num_models]]
                self.console.print(f"  [cyan]Selected council:[/cyan] {', '.join(model_names)}")
            
            # Track votes per term
            term_votes: Dict[str, List[ModelVote]] = {key: [] for key, _ in council_needed}
            
            # Worker function for each model
            def process_with_model(model: str) -> Dict[str, NormalizationDecision]:
                """Process all terms with a single model."""
                terms_to_process = [t for _, t in council_needed]
                decisions = self._normalize_batch_llm(terms_to_process, model=model)
                return {
                    council_needed[i][0]: decisions[i] if i < len(decisions) else None
                    for i in range(len(council_needed))
                }
            
            # Run models in PARALLEL
            if self.console and show_progress:
                self.console.print(f"  [cyan]⚡ Running {num_models} models in parallel...[/cyan]")
            
            with ThreadPoolExecutor(max_workers=num_models) as executor:
                futures = {}
                for model in selected_models[:num_models]:
                    future = executor.submit(process_with_model, model)
                    futures[future] = model
                
                completed = 0
                for future in as_completed(futures):
                    model = futures[future]
                    model_short = model.split("/")[-1][:20]
                    completed += 1
                    
                    try:
                        results = future.result()
                        if results:
                            for key, decision in results.items():
                                if decision and decision.confidence > 0:
                                    term_votes[key].append(ModelVote(
                                        model=model,
                                        normalized=decision.normalized,
                                        confidence=decision.confidence,
                                        reason=decision.reason,
                                        processing_time_ms=decision.processing_time_ms,
                                    ))
                            if self.console and show_progress:
                                self.console.print(f"    ✓ Model {completed}/{num_models}: [green]{model_short}[/green]")
                    except Exception as e:
                        if self.console and show_progress:
                            self.console.print(f"    ✗ Model {completed}/{num_models}: [red]{model_short}[/red] → {str(e)[:40]}")
            
            # ═══════════════════════════════════════════════════════════════════
            # PHASE 4: TALLY VOTES AND DETERMINE CONSENSUS
            # ═══════════════════════════════════════════════════════════════════
            
            for key, term in council_needed:
                votes = term_votes[key]
                
                if not votes:
                    # No successful votes
                    unique_results[key] = CouncilDecision(
                        original=term,
                        normalized=term.upper().strip(),
                        confidence=0.0,
                        match_type="failed",
                        reason="No models returned valid results",
                        votes=[],
                        agreement_rate=0.0,
                    )
                    self.stats.failed += 1
                    continue
                
                # Count votes for each normalized form
                vote_counts = Counter(v.normalized for v in votes)
                total_votes = len(votes)
                
                # Find the winning normalized form
                winner, winner_count = vote_counts.most_common(1)[0]
                agreement_rate = winner_count / total_votes
                
                # Calculate average confidence of agreeing votes
                agreeing_votes = [v for v in votes if v.normalized == winner]
                avg_confidence = sum(v.confidence for v in agreeing_votes) / len(agreeing_votes)
                
                # Determine match type based on agreement
                if agreement_rate == 1.0:
                    match_type = "council_unanimous"
                    boost = 0.05  # Boost confidence for unanimous
                elif agreement_rate >= 0.67:  # 2/3 majority
                    match_type = "council_majority"
                    boost = 0.0
                else:
                    match_type = "council_split"
                    boost = -0.1  # Reduce confidence for split
                
                final_confidence = min(1.0, max(0.0, avg_confidence + boost))
                
                # Build reason
                if agreement_rate == 1.0:
                    reason = f"Unanimous: {total_votes}/{total_votes} models agree"
                else:
                    reason = f"Majority: {winner_count}/{total_votes} models agree"
                
                unique_results[key] = CouncilDecision(
                    original=term,
                    normalized=winner,
                    confidence=final_confidence,
                    match_type=match_type,
                    reason=reason,
                    votes=votes,
                    agreement_rate=agreement_rate,
                )
                self.stats.council_votes += 1
                
                # Cache the consensus result
                if final_confidence >= 0.7:
                    cache_key = self._cache_key(term)
                    self._cache[cache_key] = NormalizationDecision(
                        original=term,
                        normalized=winner,
                        confidence=final_confidence,
                        match_type=match_type,
                        reason=reason,
                    )
                    if term.upper().strip() != winner:
                        self._error_map[term.upper().strip()] = winner
            
            # Save caches
            self._save_cache()
            self._save_error_map()
        
        # Finalize stats
        self.stats.total_time_seconds = time.time() - start_time
        
        # Show summary
        if self.console and show_progress:
            self._print_council_summary(unique_count, len(council_needed), num_models)
        
        # ═══════════════════════════════════════════════════════════════════════
        # PHASE 5: BULK UPDATE - Apply to all rows
        # ═══════════════════════════════════════════════════════════════════════
        
        results = []
        for idx in range(len(terms)):
            key = term_to_key[idx]
            if key in unique_results:
                decision = unique_results[key]
                results.append(CouncilDecision(
                    original=terms[idx],
                    normalized=decision.normalized,
                    confidence=decision.confidence,
                    match_type=decision.match_type,
                    reason=decision.reason,
                    votes=decision.votes,
                    agreement_rate=decision.agreement_rate,
                ))
            else:
                results.append(CouncilDecision(
                    original=terms[idx],
                    normalized=terms[idx].upper().strip(),
                    confidence=0.0,
                    match_type="failed",
                    reason="No result found",
                    votes=[],
                    agreement_rate=0.0,
                ))
        
        return results
    
    def _print_council_summary(self, unique_count: int, council_processed: int, num_models: int):
        """Print council normalization summary."""
        if not RICH_AVAILABLE:
            return
        
        table = Table(title="Council Voting Results")
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")
        
        table.add_row("Total Rows", str(self.stats.total_processed))
        table.add_row("Unique Terms", str(unique_count))
        table.add_row("Cache Hits", f"{self.stats.cache_hits}")
        table.add_row("Council Votes", f"{council_processed} terms × {num_models} models")
        table.add_row("Failed", str(self.stats.failed))
        table.add_row("Total Time", f"{self.stats.total_time_seconds:.2f}s")
        
        self.console.print(table)

    
    # ═══════════════════════════════════════════════════════════════════════════
    # UTILITY METHODS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def normalize_single(self, term: str) -> NormalizationDecision:
        """Normalize a single course name."""
        results = self.normalize_courses([term], show_progress=False)
        return results[0]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current stats as dict."""
        return {
            "total_processed": self.stats.total_processed,
            "cache_hits": self.stats.cache_hits,
            "cache_hit_rate": self.stats.cache_hit_rate,
            "exact_matches": self.stats.exact_matches,
            "fuzzy_matches": self.stats.fuzzy_matches,
            "semantic_matches": self.stats.semantic_matches,
            "llm_normalizations": self.stats.llm_normalizations,
            "council_votes": self.stats.council_votes,
            "failed": self.stats.failed,
            "total_time_seconds": self.stats.total_time_seconds,
            "cache_size": len(self._cache),
            "error_map_size": len(self._error_map),
            "standards_loaded": len(self._standards),
        }
    
    def clear_cache(self):
        """Clear all caches (use with caution)."""
        self._cache.clear()
        self._error_map.clear()
        if self.cache_file.exists():
            self.cache_file.unlink()
        if self.error_map_file.exists():
            self.error_map_file.unlink()
        logger.info("All caches cleared")
    
    def export_error_map(self, output_path: Path) -> None:
        """Export learned error map to JSON file."""
        with open(output_path, 'w') as f:
            json.dump(self._error_map, f, indent=2, ensure_ascii=False)
        logger.info(f"Exported {len(self._error_map)} corrections to {output_path}")
    
    def export_corrections_excel(self, output_path: Path) -> None:
        """
        Export learned corrections to Excel for review/editing.
        
        Creates a spreadsheet with columns:
        - Original Term
        - Normalized Term
        - Source (cache/llm/council)
        - Confidence
        """
        try:
            import pandas as pd
            
            data = []
            
            # Export from cache
            for key, decision in self._cache.items():
                data.append({
                    "Original": decision.original,
                    "Normalized": decision.normalized,
                    "Source": decision.match_type,
                    "Confidence": decision.confidence,
                    "Reason": decision.reason,
                })
            
            # Export from error map (if not already in cache)
            for original, normalized in self._error_map.items():
                if original not in {d["Original"].upper() for d in data}:
                    data.append({
                        "Original": original,
                        "Normalized": normalized,
                        "Source": "learned",
                        "Confidence": 0.95,
                        "Reason": "Learned from previous session",
                    })
            
            df = pd.DataFrame(data)
            df = df.sort_values("Original")
            df.to_excel(output_path, index=False)
            
            logger.info(f"Exported {len(df)} corrections to {output_path}")
            return len(df)
        except Exception as e:
            logger.error(f"Failed to export corrections: {e}")
            raise


# ═══════════════════════════════════════════════════════════════════════════════
# CLI INTERFACE
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse
    import yaml
    
    parser = argparse.ArgumentParser(description="Agentic Course Normalizer")
    parser.add_argument("--input", "-i", help="Input file (Excel/CSV) with course names")
    parser.add_argument("--column", "-c", default="course_name", help="Column name containing courses")
    parser.add_argument("--output", "-o", help="Output file for results")
    parser.add_argument("--config", default="config.yaml", help="Path to config.yaml")
    parser.add_argument("--batch-size", type=int, default=10, help="LLM batch size")
    parser.add_argument("--workers", type=int, default=4, help="Parallel workers")
    parser.add_argument("--clear-cache", action="store_true", help="Clear all caches before running")
    
    args = parser.parse_args()
    
    # Load config
    config = {}
    config_path = Path(args.config)
    if config_path.exists():
        with open(config_path) as f:
            config = yaml.safe_load(f)
    
    # Initialize normalizer
    normalizer = AgenticNormalizer(config=config, max_workers=args.workers)
    
    if args.clear_cache:
        normalizer.clear_cache()
        print("Cache cleared!")
    
    if args.input:
        import pandas as pd
        
        # Load input
        input_path = Path(args.input)
        if input_path.suffix == '.xlsx':
            df = pd.read_excel(input_path)
        else:
            df = pd.read_csv(input_path)
        
        if args.column not in df.columns:
            print(f"Column '{args.column}' not found. Available: {list(df.columns)}")
            exit(1)
        
        terms = df[args.column].dropna().astype(str).tolist()
        print(f"Loaded {len(terms)} course names from {input_path}")
        
        # Normalize
        results = normalizer.normalize_courses(terms, batch_size=args.batch_size)
        
        # Create output DataFrame
        output_df = pd.DataFrame([r.to_dict() for r in results])
        
        # Save output
        if args.output:
            output_path = Path(args.output)
            if output_path.suffix == '.xlsx':
                output_df.to_excel(output_path, index=False)
            else:
                output_df.to_csv(output_path, index=False)
            print(f"Saved results to {output_path}")
        else:
            print(output_df.to_string())
    else:
        # Interactive mode
        print("Agentic Course Normalizer - Interactive Mode")
        print("Enter course names (one per line, empty line to process):")
        
        terms = []
        while True:
            line = input().strip()
            if not line:
                break
            terms.append(line)
        
        if terms:
            results = normalizer.normalize_courses(terms, batch_size=args.batch_size)
            for r in results:
                print(f"\n{r.original} → {r.normalized}")
                print(f"  Confidence: {r.confidence:.0%} | Type: {r.match_type} | Reason: {r.reason}")
