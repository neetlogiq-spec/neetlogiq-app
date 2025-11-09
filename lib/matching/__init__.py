"""Matching module - College matching algorithms"""

from .base_matcher import BaseMatcher
from .stage1_hierarchical import Stage1HierarchicalMatcher
from .stage2_fuzzy import Stage2FuzzyMatcher
from .matcher_pipeline import MatcherPipeline
from .cascading_pipeline import CascadingHierarchicalEnsemblePipeline
from .hierarchical_filters import HierarchicalFilters

__all__ = [
    'BaseMatcher',
    'Stage1HierarchicalMatcher',
    'Stage2FuzzyMatcher',
    'MatcherPipeline',
    'CascadingHierarchicalEnsemblePipeline',
    'HierarchicalFilters'
]
