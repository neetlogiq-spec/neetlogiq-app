#!/usr/bin/env python3
"""
Multi-field Weighted Matching Algorithm
Intelligent field-level matching with configurable weights
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from rapidfuzz import fuzz
import logging

logger = logging.getLogger(__name__)

@dataclass
class FieldWeight:
    """Configuration for field matching weights"""
    name: str
    weight: float
    method: str = 'fuzzy'  # 'fuzzy', 'exact', 'semantic', 'phonetic'
    required: bool = False
    boost_if_match: float = 0.0  # Additional boost if field matches


class MultiFieldMatcher:
    """Advanced multi-field weighted matching"""

    def __init__(
        self,
        field_weights: Optional[Dict[str, FieldWeight]] = None,
        semantic_matcher=None,
        phonetic_matcher=None
    ):
        """
        Initialize multi-field matcher

        Args:
            field_weights: Dictionary of field weights
            semantic_matcher: Optional transformer matcher
            phonetic_matcher: Optional phonetic matcher
        """
        self.field_weights = field_weights or self._default_weights()
        self.semantic_matcher = semantic_matcher
        self.phonetic_matcher = phonetic_matcher

    def _default_weights(self) -> Dict[str, FieldWeight]:
        """Default field weights for college matching"""
        return {
            'name': FieldWeight(
                name='name',
                weight=0.50,
                method='hybrid',  # Use multiple methods
                required=True,
                boost_if_match=0.10
            ),
            'state': FieldWeight(
                name='state',
                weight=0.20,
                method='exact',
                required=False,
                boost_if_match=0.05
            ),
            'address': FieldWeight(
                name='address',
                weight=0.15,
                method='fuzzy',
                required=False,
                boost_if_match=0.03
            ),
            'city': FieldWeight(
                name='city',
                weight=0.10,
                method='fuzzy',
                required=False,
                boost_if_match=0.02
            ),
            'type': FieldWeight(
                name='type',
                weight=0.05,
                method='exact',
                required=False,
                boost_if_match=0.0
            ),
        }

    def match_field(
        self,
        value1: str,
        value2: str,
        method: str = 'fuzzy'
    ) -> float:
        """
        Match a single field using specified method

        Args:
            value1: First value
            value2: Second value
            method: Matching method

        Returns:
            Similarity score (0-1)
        """
        if not value1 or not value2:
            return 0.0

        v1 = str(value1).strip().upper()
        v2 = str(value2).strip().upper()

        if method == 'exact':
            return 1.0 if v1 == v2 else 0.0

        elif method == 'fuzzy':
            return fuzz.ratio(v1, v2) / 100

        elif method == 'token_set':
            return fuzz.token_set_ratio(v1, v2) / 100

        elif method == 'partial':
            return fuzz.partial_ratio(v1, v2) / 100

        elif method == 'semantic':
            if self.semantic_matcher:
                return self.semantic_matcher.semantic_similarity(value1, value2)
            else:
                # Fallback to fuzzy
                return fuzz.ratio(v1, v2) / 100

        elif method == 'phonetic':
            if self.phonetic_matcher:
                is_match, _, score = self.phonetic_matcher.phonetic_match(value1, value2)
                return score if is_match else 0.0
            else:
                return fuzz.ratio(v1, v2) / 100

        elif method == 'hybrid':
            # Combine multiple methods
            scores = []

            # Exact match bonus
            if v1 == v2:
                return 1.0

            # Fuzzy
            scores.append(fuzz.ratio(v1, v2) / 100)

            # Token set (handles word order differences)
            scores.append(fuzz.token_set_ratio(v1, v2) / 100)

            # Semantic (if available)
            if self.semantic_matcher:
                scores.append(self.semantic_matcher.semantic_similarity(value1, value2))

            # Return max score
            return max(scores) if scores else 0.0

        else:
            logger.warning(f"Unknown method: {method}, using fuzzy")
            return fuzz.ratio(v1, v2) / 100

    def calculate_weighted_score(
        self,
        record1: Dict,
        record2: Dict,
        field_weights: Optional[Dict[str, FieldWeight]] = None
    ) -> Tuple[float, Dict[str, float]]:
        """
        Calculate weighted similarity score across all fields

        Args:
            record1: First record
            record2: Second record
            field_weights: Optional custom field weights

        Returns:
            (total_score, field_scores_dict)
        """
        weights = field_weights or self.field_weights

        total_score = 0.0
        field_scores = {}
        total_weight = 0.0

        for field_name, field_config in weights.items():
            # Get field values
            value1 = record1.get(field_name, '')
            value2 = record2.get(field_name, '')

            # Skip if required field is missing
            if field_config.required and (not value1 or not value2):
                logger.debug(f"Required field '{field_name}' missing")
                return 0.0, {}

            # Calculate field similarity
            field_score = self.match_field(value1, value2, field_config.method)
            field_scores[field_name] = field_score

            # Apply weight
            weighted_score = field_score * field_config.weight

            # Apply boost if exact match
            if field_score >= 0.98 and field_config.boost_if_match > 0:
                weighted_score += field_config.boost_if_match

            total_score += weighted_score
            total_weight += field_config.weight

        # Normalize score
        if total_weight > 0:
            normalized_score = min(1.0, total_score / total_weight)
        else:
            normalized_score = 0.0

        return normalized_score, field_scores

    def find_best_match(
        self,
        query_record: Dict,
        candidate_records: List[Dict],
        threshold: float = 0.7,
        top_k: int = 5,
        state_filter: bool = True
    ) -> List[Tuple[Dict, float, Dict]]:
        """
        Find best matching records

        Args:
            query_record: Query record
            candidate_records: List of candidate records
            threshold: Minimum score threshold
            top_k: Return top K matches
            state_filter: Filter by state first

        Returns:
            List of (record, score, field_scores) tuples
        """
        if not candidate_records:
            return []

        # Apply state filter if enabled
        if state_filter and query_record.get('state'):
            query_state = str(query_record.get('state', '')).strip().upper()
            candidates = [
                r for r in candidate_records
                if str(r.get('state', '')).strip().upper() == query_state
            ]
            if not candidates:
                candidates = candidate_records  # Fallback
        else:
            candidates = candidate_records

        # Calculate scores
        results = []
        for candidate in candidates:
            score, field_scores = self.calculate_weighted_score(
                query_record,
                candidate
            )

            if score >= threshold:
                results.append((candidate, score, field_scores))

        # Sort by score (descending)
        results.sort(key=lambda x: x[1], reverse=True)

        return results[:top_k]

    def explain_match(
        self,
        record1: Dict,
        record2: Dict,
        score: float,
        field_scores: Dict[str, float]
    ) -> str:
        """
        Generate human-readable explanation of match

        Args:
            record1: First record
            record2: Second record
            score: Overall score
            field_scores: Individual field scores

        Returns:
            Explanation string
        """
        lines = []
        lines.append(f"Overall Match Score: {score:.2%}")
        lines.append("\nField-by-Field Breakdown:")
        lines.append("-" * 60)

        for field_name, field_score in sorted(field_scores.items(), key=lambda x: x[1], reverse=True):
            field_config = self.field_weights.get(field_name)
            if not field_config:
                continue

            value1 = record1.get(field_name, '')
            value2 = record2.get(field_name, '')

            weight_pct = field_config.weight * 100
            contribution = field_score * field_config.weight * 100

            status = "✓" if field_score >= 0.9 else "~" if field_score >= 0.7 else "✗"

            lines.append(
                f"{status} {field_name.upper()}: {field_score:.2%} "
                f"(weight: {weight_pct:.0f}%, contributes: {contribution:.1f}%)"
            )
            lines.append(f"   Query:     '{value1}'")
            lines.append(f"   Candidate: '{value2}'")
            lines.append("")

        return "\n".join(lines)

    def adaptive_weighting(
        self,
        query_record: Dict,
        candidate_records: List[Dict]
    ) -> Dict[str, FieldWeight]:
        """
        Dynamically adjust field weights based on data quality

        Args:
            query_record: Query record
            candidate_records: Candidate records

        Returns:
            Adjusted field weights
        """
        adjusted_weights = {}

        # Analyze field availability
        field_availability = {}
        for field_name in self.field_weights.keys():
            # Count how many candidates have this field
            candidates_with_field = sum(
                1 for c in candidate_records
                if c.get(field_name)
            )
            availability = candidates_with_field / len(candidate_records) if candidate_records else 0
            field_availability[field_name] = availability

        # Adjust weights based on availability
        total_weight = 0.0
        for field_name, field_config in self.field_weights.items():
            availability = field_availability.get(field_name, 0)

            # If field is not available in candidates, reduce its weight
            if availability < 0.5:
                adjusted_weight = field_config.weight * 0.5
            else:
                adjusted_weight = field_config.weight

            # If query doesn't have this field, reduce weight
            if not query_record.get(field_name):
                adjusted_weight *= 0.3

            adjusted_weights[field_name] = FieldWeight(
                name=field_config.name,
                weight=adjusted_weight,
                method=field_config.method,
                required=field_config.required,
                boost_if_match=field_config.boost_if_match
            )
            total_weight += adjusted_weight

        # Normalize weights to sum to 1.0
        if total_weight > 0:
            for field_name in adjusted_weights:
                adjusted_weights[field_name].weight /= total_weight

        return adjusted_weights

    def batch_match(
        self,
        query_records: List[Dict],
        candidate_records: List[Dict],
        threshold: float = 0.7,
        show_progress: bool = True
    ) -> List[Dict]:
        """
        Match multiple records in batch

        Args:
            query_records: List of query records
            candidate_records: List of candidates
            threshold: Minimum score
            show_progress: Show progress bar

        Returns:
            List of match results
        """
        from tqdm import tqdm

        results = []

        iterator = tqdm(query_records, desc="Matching") if show_progress else query_records

        for query in iterator:
            matches = self.find_best_match(
                query,
                candidate_records,
                threshold=threshold,
                top_k=1
            )

            if matches:
                best_match, score, field_scores = matches[0]
                result = {
                    'query': query,
                    'match': best_match,
                    'score': score,
                    'field_scores': field_scores,
                    'method': 'multi_field_weighted'
                }
            else:
                result = {
                    'query': query,
                    'match': None,
                    'score': 0.0,
                    'field_scores': {},
                    'method': 'no_match'
                }

            results.append(result)

        return results


# Standalone usage
if __name__ == "__main__":
    # Initialize matcher
    matcher = MultiFieldMatcher()

    # Example data
    query = {
        'name': 'GOVT MEDICAL COLLEGE',
        'state': 'KERALA',
        'city': 'TRIVANDRUM',
        'address': 'Medical College PO'
    }

    candidates = [
        {
            'id': 1,
            'name': 'Government Medical College Thiruvananthapuram',
            'state': 'KERALA',
            'city': 'THIRUVANANTHAPURAM',
            'address': 'Medical College, Trivandrum',
            'type': 'MEDICAL'
        },
        {
            'id': 2,
            'name': 'Government Medical College Kozhikode',
            'state': 'KERALA',
            'city': 'KOZHIKODE',
            'address': 'Medical College, Calicut',
            'type': 'MEDICAL'
        },
    ]

    # Find matches
    matches = matcher.find_best_match(query, candidates, threshold=0.5, top_k=2)

    print("\n" + "="*80)
    print("Multi-field Weighted Matching Results")
    print("="*80 + "\n")

    for i, (match, score, field_scores) in enumerate(matches, 1):
        print(f"\n{'='*80}")
        print(f"Match #{i}")
        print(f"{'='*80}")
        explanation = matcher.explain_match(query, match, score, field_scores)
        print(explanation)
