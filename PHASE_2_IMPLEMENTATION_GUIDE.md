# PHASE 2: Complete PostgreSQL Migration - Implementation Guide

## Status: IN PROGRESS

**Date Started**: 2025-11-08
**Complexity**: HIGH (2,000+ lines of SQLite code to migrate)
**Estimated Timeline**: 8-12 hours (spread over 2-3 days for testing)
**Test Data**: 16K seat_data, later 400K counselling_data

---

## Current State

### ✅ Completed
- PostgreSQL databases set up (seat_data, master_data, counselling_data_partitioned)
- Phase 1 validation layer working and tested ✅
- PostgreSQL connection manager (db_manager.py) created ✅
- PostgreSQL cascading matcher skeleton (cascading_hierarchical_ensemble_matcher_pg.py) created ✅
- PostgreSQL connections tested and validated ✅

### 🔄 In Progress
- Cascading matcher Stage 1 implementation (Python-based cross-database matching)
- Connection pool management for pandas.read_sql()

### ⏭️ Remaining
1. Complete cascading matcher (Stages 1, 2, 3)
2. Migrate recent.py (2000+ lines) to PostgreSQL
3. Create integration script (match_and_link_postgresql.py)
4. End-to-end testing with 16K records
5. Validate 400K counselling_data import strategy

---

## Architecture Overview: Phase 2

```
┌─────────────────────────────────────────────────────────────────┐
│                        PostgreSQL (Phase 2)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  sit_data (16K seat records + 400K counselling)          │  │
│  │  - Contains: seat_data, counselling_data tables          │  │
│  │  - Matching results stored here                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↑                                    │
│                    ┌───────┴────────┐                           │
│                    │                │                           │
│         ┌──────────▼──────┐  ┌──────▼────────────┐             │
│         │  master_data    │  │  (seat_db via     │             │
│         │  - colleges     │  │  Python matching) │             │
│         │  - states       │  │                   │             │
│         │  - courses      │  │ cascading_        │             │
│         │  - state_       │  │ hierarchical_     │             │
│         │    college_link │  │ ensemble_matcher  │             │
│         │  - state_course │  │ _pg.py            │             │
│         │    _college_    │  │                   │             │
│         │    link         │  └───────────────────┘             │
│         └─────────────────┘                                    │
│                                                                 │
│         ┌──────────────────────────────────────────────────┐   │
│         │  DB Manager (db_manager.py)                     │   │
│         │  - Connection pools (psycopg2)                  │   │
│         │  - Query execution & validation                 │   │
│         │  - Cross-database coordination                  │   │
│         └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Complete cascading_hierarchical_ensemble_matcher_pg.py

**Current File**: `cascading_hierarchical_ensemble_matcher_pg.py` (560 lines, incomplete)

**What's Done**:
- Class structure ✅
- Config loading ✅
- Stage 1 method (Python-based cross-database matching) ✅
- Main orchestration logic ✅

**What's Needed**:

#### 1.1 Fix Connection Handling
```python
# Current issue: pd.read_sql() needs a connection, not a pool
# Solution: Get connections from pool properly

def _get_connection(self, db: PostgreSQLManager):
    """Get a connection from the pool"""
    conn = db.pool.getconn()
    try:
        yield conn
    finally:
        db.pool.putconn(conn)
```

#### 1.2 Test Stage 1 with 16K records
```bash
python3 << 'EOF'
from cascading_hierarchical_ensemble_matcher_pg import CascadingHierarchicalEnsembleMatcherPG

seat_db_url = "postgresql://kashyapanand@localhost:5432/seat_data"
master_db_url = "postgresql://kashyapanand@localhost:5432/master_data"

matcher = CascadingHierarchicalEnsembleMatcherPG(seat_db_url, master_db_url)
results = matcher.match_all_records_cascading('seat_data')

print(f"Results: {results['final_matched']:,}/{results['total']:,} ({results['accuracy']:.2f}%)")
EOF
```

#### 1.3 Complete Stage 2 (RapidFuzz Fallback)
- Similar to Stage 1 but uses fuzzy matching
- Threshold: 80% name, 75% address
- Already implemented but needs connection pool fix

#### 1.4 Complete Stage 3 (Transformer Fallback)
- Optional (requires sentence-transformers)
- Uses embeddings for semantic matching
- Thresholds: 70% name, 60% address

---

### Step 2: Migrate recent.py to PostgreSQL

**Current File**: `recent.py` (2,000+ lines, SQLite-based)

**Scope of Changes**:

| Component | Changes Required | Complexity |
|-----------|------------------|-----------|
| Imports | Replace `sqlite3` with `psycopg2` + use `db_manager` | LOW |
| `__init__()` | Replace SQLite path with PostgreSQL URLs | LOW |
| DB Connection | Use `PostgreSQLManager` instead of `sqlite3.connect()` | MEDIUM |
| All SQL Queries | Replace SQLite syntax with PostgreSQL | MEDIUM |
| INSTR() function | Replace with STRPOS() or POSITION() | MEDIUM |
| Pandas read_sql | Ensure proper connection object passing | MEDIUM |
| File I/O | Some SQLite-specific optimizations need adjustment | LOW |

**Timeline**: 4-6 hours

**Key Changes**:
1. Line 30-50: Replace imports and initialization
2. Lines 100-200: Update connection handling
3. Lines 500-2000: Update all SQL queries (find with grep: `select\|insert\|update`)
4. Find all `INSTR(` calls and replace with `STRPOS()`
5. Test each major method after updating

---

### Step 3: Create PostgreSQL Integration Script

**New File**: `match_and_link_postgresql.py` (similar to `run_cascading_matcher_with_validation.py`)

**Purpose**:
- Replaces `recent.py` as the main entry point
- Orchestrates: cascading_hierarchical_ensemble_matcher_pg + Phase 1 validation

**Structure**:
```python
class AdvancedPostgreSQLMatcher:
    def __init__(self, seat_db_url, master_db_url, config_path='config.yaml'):
        self.seat_db = PostgreSQLManager(seat_db_url)
        self.master_db = PostgreSQLManager(master_db_url)

    def match_and_link_database_driven(self, table_name='seat_data'):
        # Stage 1: Cascading hierarchical matching
        results = self._run_cascading_matcher(table_name)

        # Stage 2: PostgreSQL validation (auto-clear false matches)
        validation = self._validate_results(table_name)

        # Return combined results
        return {**results, **validation}
```

---

### Step 4: End-to-End Testing (16K Records)

**Test Checklist**:
- [ ] Stage 1: Match count ≥ 13,900 (85%+)
- [ ] Stage 2: Additional matches (0-500)
- [ ] Stage 3: Optional enhancement (0-200)
- [ ] Final accuracy: 85-90%
- [ ] False matches: 0
- [ ] Execution time: < 2 minutes for 16K records
- [ ] No data corruption

**Test Command**:
```bash
python3 match_and_link_postgresql.py --table seat_data --validate
```

---

### Step 5: Prepare for 400K Counselling Data

**Import Process**:
1. Export counselling data from source
2. Import into PostgreSQL:
   ```sql
   COPY counselling_data FROM '/path/to/data.csv' WITH (FORMAT csv);
   ```
3. Normalize columns (same as seat_data)
4. Run cascading matcher
5. Validate results
6. Export final matched data

---

## Key Challenges & Solutions

### Challenge 1: Cross-Database Joins
**Problem**: PostgreSQL has separate databases (seat_data, master_data) - can't join directly

**Solution**: Use Python-based matching logic
- Query unmatched records from seat_db
- Query candidates from master_db
- Filter & match in Python
- Batch update results

**Trade-off**: ~10-20% slower than pure SQL, but still < 2 minutes for 16K records

---

### Challenge 2: Connection Pool Management
**Problem**: `pandas.read_sql()` needs a connection object, not a pool

**Solution**:
```python
# Get a connection from the pool for pandas
with self.seat_db.get_connection() as conn:
    df = pd.read_sql("SELECT ...", conn)
```

**File to Update**: `db_manager.py` (add `@contextmanager` helper)

---

### Challenge 3: SQL Dialect Differences
**SQLite → PostgreSQL**:
| Function | SQLite | PostgreSQL |
|----------|--------|------------|
| String contains | `INSTR(a, b) > 0` | `STRPOS(a, b) > 0` |
| NULL coalesce | `COALESCE()` | `COALESCE()` (same) |
| Case insensitive | `UPPER()` | `UPPER()` (same) |
| Concat | `\|\|` | `\|\|` (same) |
| Limit | `LIMIT n` | `LIMIT n` (same) |
| Insert ignore | `INSERT OR IGNORE` | `ON CONFLICT` |

---

### Challenge 4: Performance
**Expectations**:
- 16K seat_data: 1-2 minutes
- 400K counselling_data: 15-30 minutes (depending on network latency to PostgreSQL)

**Optimization Tips**:
1. Use batch operations (insert/update 100+ records at once)
2. Create indexes on normalized columns before matching
3. Run Stage 2 & 3 only if Stage 1 < 80% match rate

---

## File Summary: Phase 2

| File | Status | Action |
|------|--------|--------|
| `cascading_hierarchical_ensemble_matcher_pg.py` | Skeleton done | Fix Stage 1, complete 2-3 |
| `recent.py` | SQLite version | Migrate to PostgreSQL OR keep for Phase 1 fallback |
| `match_and_link_postgresql.py` | TBD | Create new |
| `db_manager.py` | Done | Minor: Add context manager helper |
| `config.yaml` | Updated | Add PostgreSQL URLs (done) |

---

## Recommendation: Phased Approach

Given complexity, I suggest:

### Week 1: Stage 1 Only
1. Complete cascading_hierarchical_ensemble_matcher_pg.py Stage 1
2. Test with 16K seat_data
3. Validate accuracy meets requirements

### Week 2: Stages 2-3 & Integration
1. Complete Stages 2-3 in cascading matcher
2. Create match_and_link_postgresql.py
3. End-to-end testing

### Week 3: Migration & 400K Data
1. Migrate recent.py if needed OR create wrapper
2. Import 400K counselling data
3. Production testing

---

## Command Reference: Phase 2

### Test PostgreSQL Matcher (Stage 1 only)
```bash
python3 << 'EOF'
from cascading_hierarchical_ensemble_matcher_pg import CascadingHierarchicalEnsembleMatcherPG

matcher = CascadingHierarchicalEnsembleMatcherPG(
    "postgresql://kashyapanand@localhost:5432/seat_data",
    "postgresql://kashyapanand@localhost:5432/master_data"
)

results = matcher.match_all_records_cascading('seat_data')
print(f"Matched: {results['final_matched']:,}/{results['total']:,} ({results['accuracy']:.2f}%)")
EOF
```

### Test with Validation (Phase 1 + PostgreSQL)
```bash
python3 match_and_link_postgresql.py --table seat_data --validate
```

### Import 400K Counselling Data
```bash
psql -U kashyapanand -d counselling_data_partitioned \
  -c "COPY counselling_data FROM '/path/to/data.csv' WITH (FORMAT csv)"
```

---

## Next Actions

**Immediate (Next 30 minutes)**:
1. Fix connection handling in cascading_hierarchical_ensemble_matcher_pg.py
2. Test Stage 1 with 10 sample records (quick validation)
3. Document any issues

**Short-term (Next 2 hours)**:
1. Complete Stage 1 testing with full 16K dataset
2. Verify accuracy matches Phase 1
3. Create integration script skeleton

**Medium-term (Next 4-6 hours)**:
1. Complete Stages 2-3 implementation
2. End-to-end testing
3. Create migration documentation

---

## Success Criteria: Phase 2

✅ Stage 1: 85%+ accuracy on 16K records
✅ False matches: 0
✅ Execution time: < 2 minutes for 16K
✅ Stage 2-3: Optional (0-5% additional accuracy)
✅ 400K import: Successful with same validation
✅ Production ready: All edge cases handled

---

## Support

For technical questions:
- Check cascading_hierarchical_ensemble_matcher_pg.py comments
- Refer to db_manager.py for PostgreSQL patterns
- Review PostgreSQL docs: https://www.postgresql.org/docs/

---

**Status**: Ready to proceed with Step 1 implementation

Would you like to proceed with implementing Stage 1 testing, or would you prefer a different approach?
