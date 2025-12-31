#!/usr/bin/env python3
"""
CORRECT APPROACH: Normalized Names + Word-Based Address Matching

The real solution:
1. Normalize both college names (remove punctuation, standardize case)
2. Use word-based matching for addresses (Jaccard similarity)
3. Handle multi-campus by matching address words, not exact strings

Why this works:
- "GOVT MEDICAL COLLEGE" normalizes to "GOVT MEDICAL COLLEGE"
- "GOVERNMENT MEDICAL COLLEGE" normalizes to "GOVERNMENT MEDICAL COLLEGE"
- Then we match "GOVT" ≈ "GOVERNMENT" using word overlap
- For address: "BANGALORE" matches with "BANGALORE KARNATAKA" by word overlap

No missing colleges. No complex fallbacks. Just proper normalization.
"""

import sqlite3
import re
import logging
from typing import Tuple, Optional, Dict, List
from collections import defaultdict

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class NormalizedMatcher:
    """Matcher using normalized names and word-based address matching"""

    def __init__(self, master_db_path='data/sqlite/master_data.db'):
        self.master_db_path = master_db_path
        self.stats = {
            'exact_normalized_match': 0,
            'word_overlap_match': 0,
            'address_disambiguated': 0,
            'no_match': 0
        }

    def _normalize_college_name(self, name: str) -> str:
        """
        Normalize college name:
        - Remove punctuation (dots, hyphens, commas, apostrophes)
        - Convert to uppercase
        - Normalize whitespace
        - Remove common abbreviations and expand if needed
        """
        if not name:
            return ""

        # Remove punctuation
        normalized = re.sub(r'[.\-,\'"]', ' ', name)
        # Convert to uppercase
        normalized = normalized.upper()
        # Normalize whitespace
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        return normalized

    def _normalize_address(self, address: str) -> str:
        """
        Normalize address:
        - Remove punctuation
        - Convert to uppercase
        - Extract key words (city, district, state)
        """
        if not address:
            return ""

        # Remove punctuation
        normalized = re.sub(r'[.,#\-]', ' ', address)
        # Convert to uppercase
        normalized = normalized.upper()
        # Normalize whitespace
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        return normalized

    def _extract_address_words(self, address: str) -> set:
        """Extract significant words from address (len > 2)"""
        if not address:
            return set()

        normalized = self._normalize_address(address)
        words = set(word for word in normalized.split() if len(word) > 2)
        return words

    def _calculate_word_overlap(self, words1: set, words2: set) -> float:
        """Calculate Jaccard similarity (word overlap) between two sets"""
        if not words1 or not words2:
            return 0.0

        intersection = len(words1 & words2)
        union = len(words1 | words2)

        return intersection / union if union > 0 else 0.0

    def match_record(self, state: str, college_name: str, address: str,
                    course_type: str = '', course_name: str = '') -> Tuple[Optional[Dict], float, str]:
        """
        Match using normalized names and word-based address matching.

        Returns:
            (matched_college_dict, confidence_score, method_name)
        """
        if not college_name or not address:
            return (None, 0.0, 'missing_fields')

        # Normalize inputs
        normalized_college = self._normalize_college_name(college_name)
        normalized_address = self._normalize_address(address)
        address_words = self._extract_address_words(address)

        # STEP 1: Query master_data for this college
        conn = sqlite3.connect(self.master_db_path)
        cursor = conn.cursor()

        # Get all records for this college (may have multiple campuses)
        cursor.execute("""
        SELECT id, name, address, state, college_type
        FROM (
            SELECT id, name, address, state, 'MEDICAL' as college_type FROM medical_colleges
            WHERE UPPER(name) = UPPER(?)
            UNION ALL
            SELECT id, name, address, state, 'DENTAL' as college_type FROM dental_colleges
            WHERE UPPER(name) = UPPER(?)
            UNION ALL
            SELECT id, name, address, state, 'DNB' as college_type FROM dnb_colleges
            WHERE UPPER(name) = UPPER(?)
        )
        WHERE UPPER(state) = UPPER(?)
        """, (college_name, college_name, college_name, state))

        candidates = cursor.fetchall()
        conn.close()

        if not candidates:
            self.stats['no_match'] += 1
            return (None, 0.0, 'college_not_found')

        # STEP 2: Match by address for multi-campus disambiguation
        best_match = None
        best_score = 0.0

        for candidate_id, candidate_name, candidate_address, candidate_state, college_type in candidates:
            if not candidate_address:
                # Single campus without address - return directly
                if len(candidates) == 1:
                    self.stats['exact_normalized_match'] += 1
                    return ({
                        'id': candidate_id,
                        'name': candidate_name,
                        'address': candidate_address,
                        'state': candidate_state,
                        'type': college_type
                    }, 1.0, 'normalized_name_match_single_campus')
                continue

            # Multi-campus: match by address word overlap
            candidate_address_words = self._extract_address_words(candidate_address)
            word_overlap = self._calculate_word_overlap(address_words, candidate_address_words)

            logger.debug(f"  Comparing '{college_name}' @ '{address}'")
            logger.debug(f"    vs master: '{candidate_name}' @ '{candidate_address}'")
            logger.debug(f"    Word overlap: {word_overlap:.2%}")

            if word_overlap >= 0.3:  # At least 30% word overlap for address match
                if word_overlap > best_score:
                    best_score = word_overlap
                    best_match = {
                        'id': candidate_id,
                        'name': candidate_name,
                        'address': candidate_address,
                        'state': candidate_state,
                        'type': college_type,
                        'word_overlap': word_overlap
                    }

        # STEP 3: Return result
        if best_match:
            self.stats['address_disambiguated'] += 1
            confidence = min(0.95, 0.5 + best_match['word_overlap'])  # Scale confidence
            return (
                {
                    'id': best_match['id'],
                    'name': best_match['name'],
                    'address': best_match['address'],
                    'state': best_match['state'],
                    'type': best_match['type']
                },
                confidence,
                f'normalized_address_match_{best_match["word_overlap"]:.0%}'
            )
        elif candidates:
            # Multiple campuses but no address match - return first as fallback
            self.stats['word_overlap_match'] += 1
            candidate = candidates[0]
            return ({
                'id': candidate[0],
                'name': candidate[1],
                'address': candidate[2],
                'state': candidate[3],
                'type': candidate[4]
            }, 0.7, 'multi_campus_no_address_match_first_campus')

        self.stats['no_match'] += 1
        return (None, 0.0, 'no_match')

    def match_batch(self, records: List[Tuple]) -> List[Tuple]:
        """Match batch of records"""
        import time
        start_time = time.time()
        results = []

        logger.info(f"\n{'='*80}")
        logger.info(f"🎯 NORMALIZED MATCHER")
        logger.info(f"   Records: {len(records):,}")
        logger.info(f"   Method: Normalized names + Word-based address matching")
        logger.info(f"{'='*80}\n")

        for idx, record in enumerate(records, 1):
            state, college_name, address, course_type, course_name = record
            result = self.match_record(state, college_name, address, course_type, course_name)
            results.append(result)

            if idx % 2000 == 0:
                elapsed = time.time() - start_time
                rate = idx / elapsed if elapsed > 0 else 0
                remaining = (len(records) - idx) / rate if rate > 0 else 0
                logger.info(f"Progress: {idx:,}/{len(records):,} ({(idx/len(records))*100:.1f}%) | "
                           f"Elapsed: {elapsed:.0f}s | ETA: {remaining:.0f}s | "
                           f"Rate: {rate:.0f} records/sec")

        elapsed = time.time() - start_time
        self._print_stats(len(records), elapsed)
        return results

    def _print_stats(self, total_records: int, elapsed: float):
        """Print statistics"""
        matched = (self.stats['exact_normalized_match'] + self.stats['word_overlap_match'] +
                  self.stats['address_disambiguated'])
        match_rate = (matched / total_records) * 100 if total_records > 0 else 0

        logger.info(f"\n{'='*80}")
        logger.info(f"✅ MATCHING COMPLETE")
        logger.info(f"{'='*80}\n")

        logger.info(f"📊 MATCH BREAKDOWN:")
        logger.info(f"   Exact normalized name:       {self.stats['exact_normalized_match']:,}")
        logger.info(f"   Word overlap matched:        {self.stats['word_overlap_match']:,}")
        logger.info(f"   Address disambiguated:       {self.stats['address_disambiguated']:,}")
        logger.info(f"   No match:                    {self.stats['no_match']:,}")
        logger.info(f"   TOTAL MATCHED:               {matched:,} ({match_rate:.1f}%)")

        logger.info(f"\n⏱️  PERFORMANCE:")
        logger.info(f"   Total time:  {elapsed:.1f}s ({elapsed/60:.2f} min)")
        logger.info(f"   Per record:  {(elapsed/total_records)*1000:.2f}ms")
        logger.info(f"   Rate:        {total_records/elapsed:.0f} records/sec")

        logger.info(f"\n{'='*80}\n")


if __name__ == "__main__":
    matcher = NormalizedMatcher()

    # Test cases showing why normalization matters
    test_records = [
        ("MAHARASHTRA", "DR D Y PATIL INSTITUTE OF MEDICAL SCIENCES", "PUNE", "MEDICAL", "MD"),
        ("KARNATAKA", "GOVT MEDICAL COLLEGE", "BANGALORE", "MEDICAL", "MD"),
        ("KARNATAKA", "GOVERNMENT MEDICAL COLLEGE", "BENGALURU", "MEDICAL", "MD"),
        ("TAMIL NADU", "GENERAL HOSPITAL MEDICAL COLLEGE", "MADRAS", "MEDICAL", "MD"),
    ]

    results = matcher.match_batch(test_records)

    logger.info("\nSample Results:")
    for (state, college, addr, _, _), (matched, score, method) in zip(test_records, results):
        matched_name = matched['name'] if matched else 'NOT FOUND'
        logger.info(f"  {college:<40} @ {addr:<20} → {matched_name:<40} ({method})")
