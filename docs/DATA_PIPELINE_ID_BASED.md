# Data Pipeline: SQLite → Optimized Parquet (ID-Based System)

## Overview

This document explains how counselling data flows from the ID-based SQLite database (`counselling_data_partitioned.db`) to optimized Parquet files with the hybrid schema (pre-calculated aggregates + rank arrays).

## Data Flow

```
SQLite Database (counselling_data_partitioned.db)
    │
    ├── Individual Records
    │   ├── master_source_id (SRC001, SRC002)
    │   ├── master_level_id (LVL001, LVL002, LVL003)
    │   ├── master_college_id, master_course_id
    │   ├── all_india_rank (individual ranks)
    │   └── quota, category, round, year
    │
    ▼
Processing Script (export_counselling_to_optimized_parquet.py)
    │
    ├── Group by: source_id, level_id, year, college_id, course_id, round, quota, category
    ├── Aggregate: MIN(rank) → opening_rank, MAX(rank) → closing_rank
    ├── Collect: all ranks → all_ranks array
    └── Count: len(ranks) → seat_count
    │
    ▼
Partitioned Parquet Files
    │
    ├── source=SRC001_level=LVL001_year=2024.parquet
    ├── source=SRC001_level=LVL002_year=2024.parquet
    ├── source=SRC002_level=LVL003_year=2024.parquet
    └── ... (one file per source/level/year combination)
```

## SQLite Schema (Current)

```sql
CREATE TABLE counselling_records (
    id TEXT PRIMARY KEY,
    
    -- Individual record data
    all_india_rank INTEGER NOT NULL,
    quota TEXT,
    category TEXT,
    round_raw TEXT,
    year INTEGER,
    
    -- Master IDs (ID-based system)
    master_source_id TEXT,      -- SRC001, SRC002 (or NULL during construction)
    master_level_id TEXT,       -- LVL001, LVL002, LVL003 (or NULL)
    master_college_id TEXT,     -- MED0001, DEN0001, etc.
    master_course_id TEXT,      -- CRS0001, CRS0002, etc.
    master_state_id TEXT,
    master_quota_id TEXT,
    master_category_id TEXT,
    
    -- Normalized values (fallback during construction)
    source_normalized TEXT,     -- AIQ, KEA (used if master_source_id missing)
    level_normalized TEXT,      -- UG, PG, DEN (used if master_level_id missing)
    college_institute_normalized TEXT,
    course_normalized TEXT,
    
    -- Raw values
    college_institute_raw TEXT,
    course_raw TEXT,
    state_raw TEXT,
    
    -- Metadata
    partition_key TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    ...
)
```

## Parquet Schema (Optimized Output)

```typescript
interface AggregatedCutoffRecord {
  // Partition keys
  master_source_id: string;     // SRC001, SRC002
  master_level_id: string;      // LVL001, LVL002, LVL003
  year: number;
  
  // Master IDs
  master_college_id: string;    // MED0001, etc.
  college_name: string;
  master_course_id: string;      // CRS0001, etc.
  course_name: string;
  
  // Grouping dimensions
  round: string;                // R1, R2, AIQ_R2, etc.
  round_normalized: number;     // 1, 2, 3, etc.
  quota: string;                // ALL INDIA, STATE, etc.
  category: string;             // OBC, OPEN, SC, ST, etc.
  master_quota_id?: string;
  master_category_id?: string;
  
  // Pre-calculated aggregates (FAST for queries)
  opening_rank: number;         // MIN(all_ranks)
  closing_rank: number;         // MAX(all_ranks)
  seat_count: number;           // COUNT = len(all_ranks)
  
  // Raw ranks array (for display/validation)
  all_ranks: number[];         // [3460, 3764, 3897, 4000]
  
  // Additional metadata
  state?: string;
  master_state_id?: string;
  calculated_at: timestamp;
  data_source: string;
}
```

## Handling Missing Columns (During Construction)

### Fallback Logic for master_source_id

```python
def get_source_id(row):
    # Priority 1: Use master_source_id if available
    if master_source_id exists and not NULL:
        return master_source_id
    
    # Priority 2: Map from Source column
    if Source column exists:
        mapping = {
            'AIQ': 'SRC001',
            'KEA': 'SRC002'
        }
        return mapping.get(Source.upper())
    
    # Priority 3: Map from source_normalized
    if source_normalized exists:
        mapping = {
            'AIQ': 'SRC001',
            'KEA': 'SRC002'
        }
        return mapping.get(source_normalized.upper())
    
    # Fallback: NULL (filtered out)
    return None
```

### Fallback Logic for master_level_id

```python
def get_level_id(row):
    # Priority 1: Use master_level_id if available
    if master_level_id exists and not NULL:
        return master_level_id
    
    # Priority 2: Map from Level column
    if Level column exists:
        mapping = {
            'UG': 'LVL001',
            'PG': 'LVL002',
            'DEN': 'LVL003',
            'DENTAL': 'LVL003'
        }
        return mapping.get(Level.upper())
    
    # Priority 3: Map from level_normalized
    if level_normalized exists:
        mapping = {
            'UG': 'LVL001',
            'PG': 'LVL002',
            'DEN': 'LVL003'
        }
        return mapping.get(level_normalized.upper())
    
    # Fallback: NULL (filtered out)
    return None
```

## Aggregation Logic

### Grouping Dimensions

Records are grouped by these dimensions:
1. `master_source_id` (or fallback)
2. `master_level_id` (or fallback)
3. `year`
4. `master_college_id`
5. `master_course_id`
6. `round_raw` / `round_normalized`
7. `quota`
8. `category`

### Aggregation Rules

For each group:
```python
ranks = [record.all_india_rank for record in group]

aggregated_record = {
    'opening_rank': min(ranks),      # Lowest rank (best)
    'closing_rank': max(ranks),     # Highest rank (worst)
    'seat_count': len(ranks),       # Number of seats
    'all_ranks': sorted(ranks),     # All ranks as array
    # ... other fields from first record in group
}
```

### Example Transformation

**Before (Raw Records in SQLite):**
```
Record 1: {college_id: "MED001", course_id: "CRS001", quota: "ALL INDIA", category: "OPEN", rank: 3460}
Record 2: {college_id: "MED001", course_id: "CRS001", quota: "ALL INDIA", category: "OPEN", rank: 3764}
Record 3: {college_id: "MED001", course_id: "CRS001", quota: "ALL INDIA", category: "OPEN", rank: 3897}
Record 4: {college_id: "MED001", course_id: "CRS001", quota: "ALL INDIA", category: "OPEN", rank: 4000}
```

**After (Aggregated in Parquet):**
```
{
  master_college_id: "MED001",
  master_course_id: "CRS001",
  quota: "ALL INDIA",
  category: "OPEN",
  opening_rank: 3460,
  closing_rank: 4000,
  seat_count: 4,
  all_ranks: [3460, 3764, 3897, 4000]
}
```

## Partitioning Strategy

Parquet files are partitioned by:
- **master_source_id** (SRC001, SRC002)
- **master_level_id** (LVL001, LVL002, LVL003)
- **year** (2023, 2024, ...)

### File Naming Convention

```
output/counselling_data_optimized/
├── source=SRC001_level=LVL001_year=2024.parquet
├── source=SRC001_level=LVL002_year=2024.parquet
├── source=SRC001_level=LVL002_year=2023.parquet
├── source=SRC002_level=LVL002_year=2024.parquet
└── manifest.json
```

### Benefits

1. **Query Performance**: Read only relevant partition files
2. **File Size**: Each file under 3.8MB (Cloudflare Workers limit)
3. **Incremental Updates**: Update single partition without touching others
4. **Parallel Processing**: Process partitions independently

## Usage

### Running the Export Script

```bash
# Basic usage
python scripts/export_counselling_to_optimized_parquet.py \
    data/sqlite/counselling_data_partitioned.db \
    --output-dir output/counselling_data_optimized

# With custom paths
python scripts/export_counselling_to_optimized_parquet.py \
    /path/to/database.db \
    --output-dir /path/to/output
```

### Querying Partitioned Parquet

```sql
-- Query specific partition (fast - only reads one file)
SELECT 
    college_name,
    course_name,
    quota,
    category,
    opening_rank,
    closing_rank,
    seat_count
FROM read_parquet('output/counselling_data_optimized/source=SRC001_level=LVL002_year=2024.parquet')
WHERE closing_rank <= 10000
ORDER BY closing_rank
LIMIT 100;

-- Query with DuckDB glob pattern (reads matching files)
SELECT *
FROM read_parquet('output/counselling_data_optimized/source=SRC001_level=*_year=2024.parquet')
WHERE category = 'OPEN'
ORDER BY closing_rank;

-- Query with individual ranks (for detail view)
SELECT 
    college_name,
    course_name,
    quota,
    category,
    opening_rank,
    closing_rank,
    seat_count,
    all_ranks  -- ← Array of individual ranks
FROM read_parquet('output/counselling_data_optimized/source=SRC001_level=LVL002_year=2024.parquet')
WHERE master_college_id = 'MED001'
  AND master_course_id = 'CRS001';
```

## Migration Path

### Phase 1: During Construction (Current)
- SQLite has `master_source_id` and `master_level_id` columns (may be NULL)
- Export script uses fallback logic:
  - `Source` column → maps to `master_source_id`
  - `Level` column → maps to `master_level_id`
  - `source_normalized` / `level_normalized` as final fallback

### Phase 2: Complete ID-Based System
- All records have `master_source_id` and `master_level_id` populated
- Export script uses master IDs directly
- No fallback needed

### Phase 3: Optimized Queries
- Frontend queries use master IDs for partitioning
- Fast queries: Read only relevant partition files
- Column projection: Only read needed columns

## Benefits

1. ✅ **Handles Missing Columns**: Graceful fallback during construction phase
2. ✅ **Fast Queries**: Pre-calculated aggregates (opening_rank, closing_rank, seat_count)
3. ✅ **Rich Display**: Individual ranks available in `all_ranks` array
4. ✅ **Single Source**: No sync issues between aggregated and raw data
5. ✅ **Partitioned**: Fast partition pruning for queries
6. ✅ **Edge-Optimized**: Files under 3.8MB, perfect for Cloudflare Workers
7. ✅ **Validated**: Raw ranks match aggregates (calculated from same source)

## Troubleshooting

### Missing master_source_id / master_level_id

If columns exist but are NULL:
- Script uses fallback logic automatically
- Check `Source` and `Level` columns
- Verify mapping dictionaries in script

### Empty Partitions

If partition files are empty:
- Check grouping dimensions are not NULL
- Verify master IDs or fallback values are valid
- Review filter logic in export script

### Array Size Issues

If Parquet LIST arrays cause problems:
- Try alternative: Two-file strategy (aggregated + raw separate)
- Check PyArrow version supports LIST<INT32>
- Verify data types in schema definition

