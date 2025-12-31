#!/usr/bin/env python3
"""Test parallel processing with 3 API keys."""
import sys
sys.path.insert(0, '/Users/kashyapanand/Public/New')

from agentic_matcher import AgenticMatcher
import time



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
