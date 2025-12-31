"""
Learning Manager for Auto-Learning System
Tracks user corrections and suggests patterns for error map
"""

import json
import os
from datetime import datetime
from collections import defaultdict

class LearningManager:
    """Manages auto-learning of correction patterns"""
    
    def __init__(self, config, database, logger):
        self.config = config
        self.db = database
        self.logger = logger
        self.corrections = defaultdict(int)  # {(original, correction): count}
        self.ignored_patterns = set()
        self.learned_patterns = set()
        self.threshold = config.get("learning_threshold", 3)
        self.enabled = config.get("learning_enabled", True)
        
        # Load previous corrections from database
        self.load_corrections()
    
    def load_corrections(self):
        """Load tracked corrections from database"""
        try:
            cursor = self.db.conn.cursor()
            cursor.execute("""
                SELECT original, correction, count, status 
                FROM learning_corrections
            """)
            for original, correction, count, status in cursor.fetchall():
                pattern = (original, correction)
                self.corrections[pattern] = count
                if status == 'ignored':
                    self.ignored_patterns.add(pattern)
                elif status == 'learned':
                    self.learned_patterns.add(pattern)
            cursor.close()
        except:
            # Table doesn't exist yet, will be created
            self._init_learning_table()
    
    def _init_learning_table(self):
        """Create learning_corrections table"""
        try:
            cursor = self.db.conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS learning_corrections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original TEXT NOT NULL,
                    correction TEXT NOT NULL,
                    count INTEGER DEFAULT 1,
                    status TEXT DEFAULT 'pending',
                    first_seen TIMESTAMP,
                    last_seen TIMESTAMP,
                    UNIQUE(original, correction)
                )
            """)
            self.db.conn.commit()
            cursor.close()
        except Exception as e:
            self.logger.error(f"Failed to create learning table: {e}")
    
    def track_correction(self, original, correction):
        """Track a user correction"""
        if not self.enabled:
            return
        
        # Normalize
        original = original.strip().upper()
        correction = correction.strip().upper()
        
        # Ignore self-corrections
        if original == correction:
            return
        
        pattern = (original, correction)
        
        # Ignore if already learned or explicitly ignored
        if pattern in self.learned_patterns or pattern in self.ignored_patterns:
            return
        
        # Increment count
        self.corrections[pattern] += 1
        
        # Update database
        now = datetime.now().isoformat()
        try:
            cursor = self.db.conn.cursor()
            cursor.execute("""
                INSERT INTO learning_corrections (original, correction, count, first_seen, last_seen)
                VALUES (?, ?, 1, ?, ?)
                ON CONFLICT(original, correction) 
                DO UPDATE SET count = count + 1, last_seen = ?
            """, (original, correction, now, now, now))
            self.db.conn.commit()
            cursor.close()
        except Exception as e:
            self.logger.error(f"Failed to track correction: {e}")
        
        self.logger.info(f"Tracked correction: {original} -> {correction} (count: {self.corrections[pattern]})")
    
    def get_suggestions(self):
        """Get patterns that crossed the threshold"""
        suggestions = []
        for pattern, count in self.corrections.items():
            if count >= self.threshold and pattern not in self.learned_patterns and pattern not in self.ignored_patterns:
                suggestions.append({
                    'original': pattern[0],
                    'correction': pattern[1],
                    'count': count
                })
        return sorted(suggestions, key=lambda x: x['count'], reverse=True)
    
    def apply_suggestion(self, original, correction, action='learn'):
        """Apply a suggestion - learn it, ignore it, or defer"""
        pattern = (original, correction)
        
        if action == 'learn':
            self.learned_patterns.add(pattern)
            # Update database
            try:
                cursor = self.db.conn.cursor()
                cursor.execute("""
                    UPDATE learning_corrections 
                    SET status = 'learned' 
                    WHERE original = ? AND correction = ?
                """, (original, correction))
                self.db.conn.commit()
                cursor.close()
            except Exception as e:
                self.logger.error(f"Failed to mark as learned: {e}")
            
            self.logger.info(f"Learned pattern: {original} -> {correction}")
            return True
            
        elif action == 'ignore':
            self.ignored_patterns.add(pattern)
            # Update database
            try:
                cursor = self.db.conn.cursor()
                cursor.execute("""
                    UPDATE learning_corrections 
                    SET status = 'ignored' 
                    WHERE original = ? AND correction = ?
                """, (original, correction))
                self.db.conn.commit()
                cursor.close()
            except Exception as e:
                self.logger.error(f"Failed to mark as ignored: {e}")
            
            self.logger.info(f"Ignored pattern: {original} -> {correction}")
            return True
        
        # 'defer' - do nothing, keep tracking
        return False
    
    def get_stats(self):
        """Get learning statistics"""
        return {
            'total_patterns': len(self.corrections),
            'learned_patterns': len(self.learned_patterns),
            'ignored_patterns': len(self.ignored_patterns),
            'pending_suggestions': len(self.get_suggestions()),
            'total_corrections': sum(self.corrections.values())
        }
    
    def reset(self):
        """Reset all learning data"""
        self.corrections.clear()
        self.ignored_patterns.clear()
        self.learned_patterns.clear()
        try:
            cursor = self.db.conn.cursor()
            cursor.execute("DELETE FROM learning_corrections")
            self.db.conn.commit()
            cursor.close()
        except Exception as e:
            self.logger.error(f"Failed to reset learning data: {e}")
