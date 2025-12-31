"""
Smart Validation Module for Name Fixer Pipeline.

This module provides multi-stage validation for college name corrections:
1. Master data existence check
2. LLM verification (is this the same college?)
3. Character-level similarity
4. Confidence aggregation

Author: Auto-generated
"""

import sqlite3
import logging
from typing import Optional, Tuple, List, Dict
from rapidfuzz import fuzz
import time

logger = logging.getLogger(__name__)


class SmartValidator:
    """
    Multi-stage validation for name corrections.
    
    Combines multiple signals to determine if a correction is valid:
    - Master data existence (30%)
    - LLM verification (40%)
    - Character similarity (30%)
    """
    
    def __init__(
        self,
        master_db_path: str = 'data/sqlite/master_data.db',
        api_keys: List[str] = None,
        models: List[str] = None,
    ):
        self.master_db_path = master_db_path
        self.api_keys = api_keys or self._load_api_keys()
        self.models = models or self._load_models()
        self._key_index = 0
        
        # Initialize advanced rate limiting (same as Name Fixer)
        from llm_performance_tracker import SmartRetryQueue, CircuitBreaker
        self.retry_queue = SmartRetryQueue()  # Uses global tracker
        self.circuit_breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=60.0)
        
        # Build master name lookup cache
        self._master_cache = {}
        self._build_master_cache()
    
    def _load_api_keys(self) -> List[str]:
        """Load API keys from config."""
        import yaml
        try:
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
            if 'agentic_matcher' in config and 'api_keys' in config['agentic_matcher']:
                return config['agentic_matcher']['api_keys']
            return config.get('api_keys', [])
        except Exception:
            return []
    
    def _load_models(self) -> List[str]:
        """Load models from config."""
        import yaml
        try:
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
            if 'agentic_matcher' in config and 'models' in config['agentic_matcher']:
                return config['agentic_matcher']['models']
            return ['google/gemini-2.0-flash-exp:free']
        except Exception:
            return ['google/gemini-2.0-flash-exp:free']
    
    def _build_master_cache(self):
        """Build cache of master college names by state."""
        conn = sqlite3.connect(self.master_db_path)
        cursor = conn.cursor()
        
        # Load from all college tables
        tables = [
            ('medical_colleges', 'medical'),
            ('dental_colleges', 'dental'),
            ('dnb_colleges', 'dnb'),
        ]
        
        for table, course_type in tables:
            try:
                cursor.execute(f"""
                    SELECT id, UPPER(COALESCE(normalized_name, name)), UPPER(state)
                    FROM {table}
                """)
                for row in cursor.fetchall():
                    college_id, name, state = row
                    if state not in self._master_cache:
                        self._master_cache[state] = {}
                    
                    # Store both original and normalized versions
                    self._master_cache[state][name] = {
                        'id': college_id,
                        'name': name,
                        'type': course_type,
                    }
                    
                    # Also store version without spaces for fuzzy matching
                    name_nospace = ''.join(name.split())
                    self._master_cache[state][name_nospace] = {
                        'id': college_id,
                        'name': name,
                        'type': course_type,
                    }
            except Exception as e:
                logger.warning(f"Error loading {table}: {e}")
        
        conn.close()
        logger.info(f"Built master cache with {len(self._master_cache)} states")
    
    def validate_correction(
        self,
        original: str,
        corrected: str,
        state: str,
        llm_confidence: float,
    ) -> Tuple[str, float, str]:
        """
        Validate a correction using multiple signals.
        
        Args:
            original: Original broken name
            corrected: LLM-suggested correction
            state: State of the college
            llm_confidence: Confidence from the correction LLM
            
        Returns:
            (status, confidence, reason)
            status: 'auto_applied' | 'pending_review' | 'rejected'
        """
        signals = {}
        
        # ===== SIGNAL 1: Master Data Existence (30%) =====
        master_result = self._check_master_exists(corrected, state)
        signals['master_exists'] = master_result['score']
        signals['master_match'] = master_result.get('match')
        
        # ===== SIGNAL 2: Character Similarity + Unique ID Check =====
        char_result = self._char_similarity(original, corrected)
        signals['char_similarity'] = char_result['score']
        signals['char_reason'] = char_result.get('reason', '')
        
        # ===== HARD RULE 1: Unique ID Mismatch = REJECT =====
        if char_result.get('reason') == 'unique_id_mismatch':
            signals['hard_rule_failed'] = 'unique_id_mismatch'
            return 'rejected', 0.15, f"HARD RULE FAILED: {char_result.get('reason')}"
        
        # ===== HARD RULE 2: Master Data MUST Exist for Auto-Apply =====
        if signals['master_exists'] < 0.7:
            # Not in master data with high confidence - cannot auto-apply
            signals['hard_rule_failed'] = 'master_not_found'
            # Check if it's an encoding fix (high char similarity)
            if signals['char_similarity'] >= 0.9:
                # Likely valid but master data incomplete - pending review
                return 'pending_review', signals['char_similarity'] * 0.8, \
                    f"master={signals['master_exists']:.0%} (not found), char={signals['char_similarity']:.0%}"
            else:
                return 'rejected', signals['char_similarity'] * 0.5, \
                    f"HARD RULE FAILED: master_not_found ({signals['master_exists']:.0%})"
        
        # ===== SIGNAL 3: LLM Verification (40%) =====
        # Only do LLM verification if other signals are ambiguous
        if signals['master_exists'] >= 0.9 and signals['char_similarity'] >= 0.9:
            # High confidence from other signals, skip LLM
            signals['llm_verify'] = 1.0
            signals['llm_reason'] = 'Skipped - high confidence from other signals'
        elif signals['char_similarity'] < 0.5:
            # Low char similarity - likely wrong
            signals['llm_verify'] = 0.0
            signals['llm_reason'] = 'Skipped - low char similarity'
        else:
            # Ambiguous - use LLM to verify
            llm_result = self._llm_verify(original, corrected, state)
            signals['llm_verify'] = llm_result['score']
            signals['llm_reason'] = llm_result.get('reason', '')
        
        # ===== AGGREGATE CONFIDENCE =====
        # Weights: master_exists (35%) + char_similarity (30%) + llm_verify (25%) + llm_confidence (10%)
        final_confidence = (
            signals['master_exists'] * 0.35 +
            signals['char_similarity'] * 0.30 +
            signals['llm_verify'] * 0.25 +
            llm_confidence * 0.10
        )
        
        # ===== DETERMINE STATUS (with higher threshold for auto-apply) =====
        if final_confidence >= 0.95 and signals['master_exists'] >= 0.85:
            status = 'auto_applied'
        elif final_confidence >= 0.70:
            status = 'pending_review'
        else:
            status = 'rejected'
        
        # Build reason string
        reason = (
            f"master={signals['master_exists']:.0%}, "
            f"char={signals['char_similarity']:.0%}, "
            f"llm={signals['llm_verify']:.0%}"
        )
        if signals.get('char_reason'):
            reason += f" ({signals['char_reason']})"
        
        return status, final_confidence, reason
    
    def _check_master_exists(self, name: str, state: str) -> Dict:
        """
        Check if corrected name exists in master data.
        
        Returns:
            {'score': float, 'match': str or None}
        """
        name_upper = name.upper().strip()
        state_upper = state.upper().strip() if state else ''
        name_nospace = ''.join(name_upper.split())
        
        # Try exact match first
        if state_upper in self._master_cache:
            state_colleges = self._master_cache[state_upper]
            
            # Exact match
            if name_upper in state_colleges:
                return {'score': 1.0, 'match': state_colleges[name_upper]['id']}
            
            # No-space match
            if name_nospace in state_colleges:
                return {'score': 1.0, 'match': state_colleges[name_nospace]['id']}
            
            # Fuzzy match
            best_score = 0
            best_match = None
            for master_name, info in state_colleges.items():
                if len(master_name) < 5:  # Skip short keys (no-space versions)
                    continue
                score = fuzz.ratio(name_upper, master_name) / 100.0
                if score > best_score:
                    best_score = score
                    best_match = info['id']
            
            if best_score >= 0.85:
                return {'score': best_score, 'match': best_match}
        
        # Try across all states if not found
        for s, colleges in self._master_cache.items():
            if name_upper in colleges:
                return {'score': 0.7, 'match': colleges[name_upper]['id']}  # Lower score for wrong state
        
        return {'score': 0.0, 'match': None}
    def _char_similarity(self, original: str, corrected: str) -> Dict:
        """
        Calculate character-level similarity after normalization.
        
        Handles:
        - Encoding fixes (GOVER NMENT → GOVERNMENT)
        - Suffix additions (X → X AND HOSPITAL)
        - Acronym expansions (MGM → MAHATMA GANDHI MEMORIAL)
        - CRITICAL: Unique identifier overlap check (VYDEHI ≠ A J INSTITUTE)
        """
        orig_upper = original.upper().strip()
        corr_upper = corrected.upper().strip()
        
        # CRITICAL CHECK: Unique identifier words must overlap
        # This catches VYDEHI INSTITUTE → A J INSTITUTE (completely different)
        common_words = {
            'INSTITUTE', 'OF', 'MEDICAL', 'SCIENCE', 'SCIENCES', 'AND', 'RESEARCH',
            'CENTRE', 'CENTER', 'COLLEGE', 'HOSPITAL', 'UNIVERSITY', 'DENTAL',
            'GOVERNMENT', 'GOVT', 'THE', 'FOR', 'POST', 'GRADUATE', 'POSTGRADUATE',
            'GENERAL', 'DISTRICT', 'STATE', 'NATIONAL', 'SUPER', 'SPECIALTY',
            'MULTI', 'CHARITABLE', 'TRUST', 'SOCIETY', 'FOUNDATION', 'A', 'AN',
        }
        
        orig_words = set(orig_upper.split())
        corr_words = set(corr_upper.split())
        
        # Known city name variations (same place, different names)
        city_variations = {
            'BANGALORE': 'BENGALURU', 'BENGALURU': 'BANGALORE',
            'BOMBAY': 'MUMBAI', 'MUMBAI': 'BOMBAY',
            'CALCUTTA': 'KOLKATA', 'KOLKATA': 'CALCUTTA',
            'MADRAS': 'CHENNAI', 'CHENNAI': 'MADRAS',
            'POONA': 'PUNE', 'PUNE': 'POONA',
            'TRIVANDRUM': 'THIRUVANANTHAPURAM', 'THIRUVANANTHAPURAM': 'TRIVANDRUM',
            'BARODA': 'VADODARA', 'VADODARA': 'BARODA',
            'COCHIN': 'KOCHI', 'KOCHI': 'COCHIN',
        }
        
        # Extract unique identifiers (non-common words with length > 2)
        orig_unique = {w for w in orig_words - common_words if len(w) > 2}
        corr_unique = {w for w in corr_words - common_words if len(w) > 2}
        
        # CRITICAL: If original has unique identifiers, the LONGEST/most specific one MUST match
        # This catches: SRI SIDDHARTHA → SRINIVAS (SRI matches but SIDDHARTHA doesn't!)
        if orig_unique:
            # Sort by length descending - longest word is most specific identifier
            orig_unique_sorted = sorted(orig_unique, key=len, reverse=True)
            
            # The LONGEST unique identifier MUST appear in corrected
            # Don't stop at first short match (like SRI in SRINIVAS)
            longest_identifier = orig_unique_sorted[0]
            
            # Check if longest identifier matches in corrected
            longest_matched = False
            for cw in corr_unique:
                # Require high similarity (>=80) for the longest identifier
                ratio = fuzz.ratio(longest_identifier, cw)
                if ratio >= 80 or longest_identifier == cw:
                    longest_matched = True
                    break
                # Also check city name variations (BANGALORE = BENGALURU)
                if longest_identifier in city_variations:
                    alt_name = city_variations[longest_identifier]
                    if cw == alt_name or fuzz.ratio(alt_name, cw) >= 80:
                        longest_matched = True
                        break
            
            # Also check full corrected text
            if not longest_matched:
                if longest_identifier in corr_upper:
                    longest_matched = True
                # Check city variation in full text
                elif longest_identifier in city_variations:
                    alt_name = city_variations[longest_identifier]
                    if alt_name in corr_upper:
                        longest_matched = True
            
            if not longest_matched:
                # Most specific identifier not found - likely WRONG match
                # e.g., SIDDHARTHA not in SRINIVAS
                return {'score': 0.15, 'reason': 'unique_id_mismatch'}
        
        # Remove all spaces for comparison
        orig_nospace = ''.join(orig_upper.split())
        corr_nospace = ''.join(corr_upper.split())
        
        # Check 1: No-space similarity (catches encoding fixes)
        nospace_sim = fuzz.ratio(orig_nospace, corr_nospace) / 100.0
        if nospace_sim >= 0.90:
            return {'score': 1.0, 'reason': 'encoding_fix'}
        
        # Check 2: Containment (catches suffix additions)
        if orig_nospace in corr_nospace:
            return {'score': 0.95, 'reason': 'contained'}
        
        # Check 3: Partial ratio (catches truncated names)
        partial_sim = fuzz.partial_ratio(orig_nospace, corr_nospace) / 100.0
        if partial_sim >= 0.95:
            return {'score': 0.90, 'reason': 'partial_match'}
        
        # Check 4: Acronym expansion
        # MGM → MAHATMA GANDHI MEMORIAL
        orig_word_list = orig_upper.split()
        corr_word_list = corr_upper.split()
        
        # Get single-letter abbreviations from original
        orig_abbrevs = [w for w in orig_word_list if len(w) <= 2 and w.isalpha()]
        
        if len(orig_abbrevs) >= 2:
            # Get first letters of corrected words
            corr_first_letters = [w[0] for w in corr_word_list if len(w) > 2]
            
            # Check if abbreviations match first letters (acronym expansion)
            matches = sum(1 for a in orig_abbrevs if a[0] in corr_first_letters)
            if matches >= len(orig_abbrevs) * 0.5:
                return {'score': 0.85, 'reason': 'acronym_expansion'}
        
        # Check 5: Abbreviation mismatch detection (S R → B M)
        corr_abbrevs = [w for w in corr_word_list if len(w) <= 2 and w.isalpha()]
        
        if len(orig_abbrevs) >= 2 and len(corr_abbrevs) >= 2:
            orig_set = set(orig_abbrevs)
            corr_set = set(corr_abbrevs)
            overlap = len(orig_set & corr_set)
            
            if overlap == 0:
                # Complete mismatch - likely different person
                return {'score': 0.2, 'reason': 'abbrev_mismatch'}
        
        # Default: use token sort ratio
        token_sim = fuzz.token_sort_ratio(orig_upper, corr_upper) / 100.0
        return {'score': token_sim, 'reason': 'fuzzy'}
    
    def _llm_verify(self, original: str, corrected: str, state: str, max_retries: int = 3) -> Dict:
        """
        Ask LLM to verify if original and corrected are the same college.
        Uses SmartRetryQueue and CircuitBreaker for rate limit handling (same as Name Fixer).
        
        Returns:
            {'score': float, 'reason': str}
        """
        import requests
        
        prompt = f"""You are a college name verification expert for Indian medical/dental colleges.

TASK: Determine if these two names refer to the SAME college or DIFFERENT colleges.

ORIGINAL NAME (may have encoding issues, truncation, or abbreviations):
"{original}"

CORRECTED NAME:
"{corrected}"

STATE: {state}

IMPORTANT CONSIDERATIONS:
1. Encoding issues: "GOVER NMENT" = "GOVERNMENT" (extra spaces)
2. Truncation: "MEDICAL COLLEG" = "MEDICAL COLLEGE" (cut off)
3. Abbreviations: "MGM" = "MAHATMA GANDHI MEMORIAL"
4. BUT: "S R PATIL" ≠ "B M PATIL" (different people!)
5. Suffix additions are OK: "X COLLEGE" = "X COLLEGE AND HOSPITAL"

RESPOND WITH ONLY ONE OF:
- YES: These are the same college
- NO: These are different colleges
- UNSURE: Cannot determine

Then provide a brief reason.

Format: YES|NO|UNSURE: reason"""

        for attempt in range(max_retries):
            try:
                # Get available model using circuit breaker (cycles through models)
                available_models = [m for m in self.models if self.circuit_breaker.is_available(m)]
                if not available_models:
                    # All models tripped - wait for recovery
                    time.sleep(2)
                    available_models = self.models[:1]  # Try first model anyway
                
                # Use retry queue to get model with cooldown handling
                model = self.retry_queue.get_next_model(available_models)
                if not model:
                    model = available_models[0]
                
                # Rotate API key
                api_key = self.api_keys[self._key_index % len(self.api_keys)]
                self._key_index += 1
                
                response = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.1,
                        "max_tokens": 100,
                    },
                    timeout=30,
                )
                
                if response.status_code == 429:
                    # Rate limited - apply cooldown via retry queue
                    self.retry_queue.add_to_cooldown(model, cooldown_seconds=30)
                    self.circuit_breaker.record_failure(model)
                    logger.debug(f"Rate limited on {model}, cooling down...")
                    time.sleep(1)  # Brief pause before retry
                    continue
                
                response.raise_for_status()
                
                # Record success
                self.circuit_breaker.record_success(model)
                
                data = response.json()
                answer = data['choices'][0]['message']['content'].strip().upper()
                
                if answer.startswith('YES'):
                    return {'score': 1.0, 'reason': answer}
                elif answer.startswith('NO'):
                    return {'score': 0.0, 'reason': answer}
                else:
                    return {'score': 0.5, 'reason': answer}
                    
            except requests.exceptions.Timeout:
                logger.warning(f"Timeout on attempt {attempt + 1}")
                continue
            except Exception as e:
                logger.warning(f"LLM verification failed on attempt {attempt + 1}: {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                break
        
        # All retries exhausted - return uncertain
        return {'score': 0.5, 'reason': 'max_retries_exhausted'}


def test_validator():
    """Test the smart validator with known cases."""
    from rich.console import Console
    from rich.table import Table
    
    console = Console()
    validator = SmartValidator()
    
    test_cases = [
        # (original, corrected, state, expected_status)
        ('GOVER NMENT MEDICA L COLLEG E', 'GOVERNMENT MEDICAL COLLEGE', 'ANDHRA PRADESH', 'auto_applied'),
        ('S R PATIL MEDICAL COLLEGE', 'SHRI B M PATIL MEDICAL COLLEGE', 'KARNATAKA', 'rejected'),
        ('M G M MEDICA L COLLEG E', 'MAHATMA GANDHI MEMORIAL MEDICAL COLLEGE', 'MADHYA PRADESH', 'auto_applied'),
        ('SETH G S MEDICAL COLLEGE', 'SETH GS MEDICAL COLLEGE AND KEM HOSPITAL', 'MAHARASHTRA', 'auto_applied'),
        ('HINDU RAO HOSPITAL', 'CHACHA NEHRU BAL CHIKITSALAYA', 'DELHI (NCT)', 'rejected'),
    ]
    
    table = Table(title="Smart Validator Test Results")
    table.add_column("Original", style="cyan", max_width=30)
    table.add_column("Corrected", style="green", max_width=30)
    table.add_column("Expected")
    table.add_column("Got")
    table.add_column("Conf")
    table.add_column("Status")
    
    for orig, corr, state, expected in test_cases:
        status, conf, reason = validator.validate_correction(orig, corr, state, 0.9)
        passed = "✅" if status == expected else "❌"
        table.add_row(
            orig[:28] + ".." if len(orig) > 30 else orig,
            corr[:28] + ".." if len(corr) > 30 else corr,
            expected,
            status,
            f"{conf:.0%}",
            passed,
        )
    
    console.print(table)


if __name__ == '__main__':
    test_validator()
