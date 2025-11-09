#!/usr/bin/env python3
"""
Base Matcher Class
Abstract base class for all matching algorithms.
"""

from abc import ABC, abstractmethod
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class MatchResult:
    """Result of a matching operation"""
    record_id: int
    master_college_id: int
    stage: int
    confidence: float
    matched: bool
    reason: Optional[str] = None


class BaseMatcher(ABC):
    """Abstract base class for matching algorithms"""

    def __init__(self, config: Dict = None):
        """
        Initialize matcher with configuration.

        Args:
            config: Dictionary of configuration parameters
        """
        self.config = config or {}
        self.stage = 0
        self.name = "BaseMatcher"

    @abstractmethod
    def match(self, table_name: str) -> List[MatchResult]:
        """
        Match records in a table.

        Args:
            table_name: Name of table to match (e.g., 'seat_data')

        Returns:
            List of MatchResult objects
        """
        pass

    def _validate_result(self, result: MatchResult) -> bool:
        """Validate a match result"""
        if result.master_college_id is None:
            return False
        if result.master_college_id <= 0:
            return False
        return True

    def log_summary(self, results: List[MatchResult], start_count: int) -> Dict:
        """
        Log matching summary statistics.

        Args:
            results: List of match results
            start_count: Initial unmatched count

        Returns:
            Summary dictionary
        """
        matched = len([r for r in results if r.matched])
        unmatched = len([r for r in results if not r.matched])
        accuracy = (matched / (matched + unmatched) * 100) if (matched + unmatched) > 0 else 0

        summary = {
            'stage': self.stage,
            'name': self.name,
            'matched': matched,
            'unmatched': unmatched,
            'accuracy': accuracy,
            'total': matched + unmatched
        }

        logger.info(f"[{self.name}] Matched: {matched:,} ({accuracy:.2f}%)")

        return summary
