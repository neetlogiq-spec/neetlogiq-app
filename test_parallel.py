#!/usr/bin/env python3
"""Test parallel processing with 3 API keys."""
import sys
sys.path.insert(0, '/Users/kashyapanand/Public/New')

from agentic_matcher import AgenticMatcher
import time

# Test with 10 API keys for 10 parallel workers!
api_keys = [
    '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',
    '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',
    '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',
    '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',
    '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',
    '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',
    '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',
    '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',
    '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',
    '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',
    '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',
]

matcher = AgenticMatcher(
    seat_db_path='data/sqlite/counselling_data_partitioned.db',
    master_db_path='data/sqlite/master_data.db',
    api_keys=api_keys
)

print(f'Workers: {len(matcher.clients)} (parallel mode!)')

start = time.time()

matched, unresolved, decisions = matcher.resolve_unmatched(
    table='counselling_records',
    batch_size=15,       # Smaller batches for reliable JSON parsing
    batch_delay=30,
    parallel=True,
    max_rounds=2,     # Round 2 retries unmatched from Round 1
    round_delay=30,   # Wait between rounds
    dry_run=True
)

elapsed = time.time() - start
print(f'\nCompleted in {elapsed:.1f} seconds')
print(f'Result: {matched} matched, {unresolved} unresolved')
