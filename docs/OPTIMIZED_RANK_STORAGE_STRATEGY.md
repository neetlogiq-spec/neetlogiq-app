# Optimized Rank Storage Strategy

## Overview
Better approach combining pre-calculated aggregates with preserved raw data in a single, efficient schema.

## Problem Statement
- Need **opening_rank** (MIN) and **closing_rank** (MAX) for display
- Need **seat_count** (COUNT of individual ranks) for availability
- Need **individual ranks** preserved for validation/audit
- Need **fast website queries** (Cloudflare Edge, <3.8MB files)
- Already have **partitioning by source/level/year** (excellent foundation)

## Recommended Solution: Hybrid Nested Schema

### Schema Design

```typescript
interface AggregatedCutoffRecord {
  // Partition keys (already in file name, duplicated for query convenience)
  master_source_id: string;      // SRC001, SRC002
  master_level_id: string;       // LVL001, LVL002, LVL003
  year: number;
  
  // Grouping keys
  college_id: string;            // Master college ID
  college_name: string;
  course_id: string;             // Master course ID
  course_name: string;
  round: string;                 // R1, R2, etc.
  quota: string;                 // ALL INDIA, STATE, etc.
  category: string;              // OBC, OPEN, SC, ST, etc.
  
  // Pre-calculated aggregates (FAST for queries)
  opening_rank: number;          // MIN of all_ranks
  closing_rank: number;          // MAX of all_ranks
  seat_count: number;            // COUNT = length of all_ranks array
  
  // Raw data preserved (COMPACT storage)
  all_ranks: number[];           // Parquet LIST<INT32> - individual ranks
                                  // [4124, 4402] for OBC
                                  // [3460, 3764, 3897, 4000] for OPEN
                                  // [14753] for SC
  
  // Metadata
  calculated_at: timestamp;
  data_source: string;
}
```

### Why This Is Better

#### 1. Single Source of Truth ✅
- No sync issues between aggregated and raw files
- Raw data always matches aggregates (calculated from same source)

#### 2. Fast Queries ✅
```sql
-- Most common query: List cutoffs with seat counts
SELECT college_name, course_name, quota, category,
       opening_rank, closing_rank, seat_count
FROM cutoffs
WHERE master_source_id = 'SRC001'
  AND master_level_id = 'LVL002'
  AND year = 2024
  AND closing_rank <= 10000;
-- Reads ONLY: source=SRC001_level=LVL002_year=2024.parquet
-- Column projection: Skips all_ranks array (not needed)
```

#### 3. Compact Storage ✅
```python
# Parquet LIST compression example:
# Instead of 4 rows:
# {quota: "OPEN", category: "OBC", rank: 3460}
# {quota: "OPEN", category: "OBC", rank: 3764}
# {quota: "OPEN", category: "OBC", rank: 3897}
# {quota: "OPEN", category: "OBC", rank: 4000}

# Store 1 row:
# {quota: "OPEN", category: "OBC", 
#  opening_rank: 3460, closing_rank: 4000, seat_count: 4,
#  all_ranks: [3460, 3764, 3897, 4000]}

# Space savings: ~75% reduction (4 rows → 1 row)
# Query speed: Same or faster (column projection skips all_ranks)
```

#### 4. Validation/Drill-Down Available ✅
```sql
-- Verify aggregate calculation
SELECT quota, category,
       opening_rank, closing_rank,
       MIN(all_ranks[0:]) as calculated_min,  -- Verify opening
       MAX(all_ranks[0:]) as calculated_max,  -- Verify closing
       array_length(all_ranks) as calculated_count  -- Verify seat count
FROM cutoffs
WHERE college_id = 'MED001'
  AND course_id = 'CRS001'
  AND year = 2024;

-- Get individual ranks for a specific quota-category
SELECT all_ranks
FROM cutoffs
WHERE quota = 'ALL INDIA'
  AND category = 'OBC'
  AND year = 2024
  AND round = 'R2';
```

#### 5. Edge-Optimized ✅
- Small file sizes (partitioned by source/level/year)
- Column projection (read only needed columns)
- Efficient for Cloudflare Workers (<3.8MB per file)

## Implementation

### Step 1: Schema Definition (Python/Pandas)

```python
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

# Define schema with LIST type for ranks
schema = pa.schema([
    pa.field('master_source_id', pa.string()),
    pa.field('master_level_id', pa.string()),
    pa.field('year', pa.int32()),
    pa.field('college_id', pa.string()),
    pa.field('college_name', pa.string()),
    pa.field('course_id', pa.string()),
    pa.field('course_name', pa.string()),
    pa.field('round', pa.string()),
    pa.field('quota', pa.string()),
    pa.field('category', pa.string()),
    
    # Aggregated fields
    pa.field('opening_rank', pa.int32()),
    pa.field('closing_rank', pa.int32()),
    pa.field('seat_count', pa.int32()),
    
    # Raw ranks array
    pa.field('all_ranks', pa.list_(pa.int32())),
    
    # Metadata
    pa.field('calculated_at', pa.timestamp('ms')),
    pa.field('data_source', pa.string()),
])
```

### Step 2: Data Processing

```python
def process_to_aggregated_format(raw_records):
    """
    Transform raw counselling records to aggregated format
    """
    # Group by: source, level, year, college, course, round, quota, category
    grouped = raw_records.groupby([
        'master_source_id', 'master_level_id', 'year',
        'college_id', 'course_id', 'round', 'quota', 'category'
    ])
    
    aggregated_records = []
    
    for (source_id, level_id, year, college_id, course_id, round, quota, category), group in grouped:
        ranks = group['all_india_rank'].tolist()
        ranks.sort()  # Optional: sorted for easier debugging
        
        aggregated_records.append({
            'master_source_id': source_id,
            'master_level_id': level_id,
            'year': year,
            'college_id': college_id,
            'college_name': group.iloc[0]['college_name'],
            'course_id': course_id,
            'course_name': group.iloc[0]['course_name'],
            'round': round,
            'quota': quota,
            'category': category,
            
            # Pre-calculated
            'opening_rank': min(ranks),
            'closing_rank': max(ranks),
            'seat_count': len(ranks),
            
            # Raw data preserved
            'all_ranks': ranks,
            
            # Metadata
            'calculated_at': pd.Timestamp.now(),
            'data_source': group.iloc[0]['source_file'],
        })
    
    return pd.DataFrame(aggregated_records)
```

### Step 3: Query Optimization (DuckDB)

```sql
-- Fast query (List View): Only reads aggregated columns, skips arrays
SELECT 
    college_name,
    course_name,
    quota,
    category,
    opening_rank,
    closing_rank,
    seat_count
FROM read_parquet('source=SRC001_level=LVL002_year=2024.parquet')
WHERE closing_rank <= 10000
ORDER BY closing_rank
LIMIT 100;
-- Column projection: all_ranks array is NOT read from disk
-- Parquet automatically skips unused columns → FAST ⚡

-- Detail View: Include all_ranks array when displaying individual ranks
SELECT 
    college_name,
    course_name,
    quota,
    category,
    opening_rank,
    closing_rank,
    seat_count,
    all_ranks  -- ← Read array only when needed
FROM read_parquet('source=SRC001_level=LVL002_year=2024.parquet')
WHERE college_id = 'MED001'
  AND course_id = 'CRS001'
  AND round = 'R2'
  AND quota = 'ALL INDIA'
  AND category = 'OPEN';
-- Returns: [3460, 3764, 3897, 4000] - can display in UI
```

## Use Cases & Query Patterns

### 1. List View (Most Common) - NO array read
```sql
-- Fast: Skips all_ranks array
SELECT college_name, course_name, quota, category,
       opening_rank, closing_rank, seat_count
FROM cutoffs
WHERE closing_rank <= 10000;
-- Performance: FAST ⚡ (no array read overhead)
```

### 2. Detail View with Seat Ranks - INCLUDES array
```sql
-- Reads all_ranks array to show individual ranks
SELECT college_name, course_name, quota, category,
       opening_rank, closing_rank, seat_count,
       all_ranks  -- ← Individual ranks for display
FROM cutoffs
WHERE college_id = 'MED001' AND course_id = 'CRS001';
-- Returns: all_ranks = [3460, 3764, 3897, 4000]
-- UI can display: "OPEN: 3460, 3764, 3897, 4000 (4 seats)"
```

### 3. Conditional Array Read (TypeScript/JavaScript)
```typescript
interface CutoffRecord {
  // Always available (fast)
  opening_rank: number;
  closing_rank: number;
  seat_count: number;
  
  // Available when needed (read on-demand)
  all_ranks?: number[];  // Optional - only fetch for detail views
}

// List view query (fast)
async function getCutoffsList(): Promise<CutoffRecord[]> {
  // Don't include all_ranks in SELECT - Parquet skips reading it
  const query = `
    SELECT college_name, course_name, quota, category,
           opening_rank, closing_rank, seat_count
    FROM cutoffs
    WHERE closing_rank <= ?`;
  // Result: Fast, small payload, no array data
}

// Detail view query (includes ranks)
async function getCutoffDetail(collegeId: string): Promise<CutoffRecord> {
  // Include all_ranks - Parquet reads it for this specific record
  const query = `
    SELECT college_name, course_name, quota, category,
           opening_rank, closing_rank, seat_count,
           all_ranks  -- ← Only read when showing detail
    FROM cutoffs
    WHERE college_id = ?`;
  // Result: Includes [3460, 3764, 3897, 4000] for UI display
}
```

## Performance Comparison

| Operation | Raw Records | Pre-Aggregated (No Array) | Hybrid (With Array) |
|-----------|-------------|---------------------------|---------------------|
| **List View Query** | Slow (group by on-the-fly) | Fast ✅ | Fast ✅ (skips array) |
| **Detail View (with ranks)** | Fast (raw data) | ❌ Lost | Fast ✅ (reads array) |
| **Seat Count** | Slow (COUNT(*) on-the-fly) | Fast ✅ | Fast ✅ |
| **Show Individual Ranks** | Fast (raw data) | ❌ Lost | Fast ✅ (from array) |
| **Validation** | Fast (raw data) | ❌ Lost | Fast ✅ |
| **File Size** | Large | Medium | Medium (small overhead) |
| **Single Source** | ✅ | ❌ (separate files) | ✅ |

## Alternative: Two-File Strategy (If Arrays Don't Work)

If Parquet LIST arrays cause issues, use:

1. **`cutoffs_aggregated.parquet`** - Pre-calculated aggregates only
   - Fast for website queries
   - Smaller file size
   - Used 95% of the time

2. **`cutoffs_raw.parquet`** - Individual rank records
   - For validation/admin
   - Used 5% of the time
   - Can be stored separately (not needed for website)

## Recommendation

**✅ Use Hybrid Nested Schema** with `all_ranks` array if Parquet LIST support is reliable.

**Fallback:** Two-file strategy if arrays don't work well in your Parquet library.

## Benefits Summary

1. ✅ **Fast website queries** - Pre-calculated aggregates
2. ✅ **Seat counts available** - Already calculated
3. ✅ **Raw data preserved** - For validation/drill-down
4. ✅ **Single source of truth** - No sync issues
5. ✅ **Efficient storage** - Array compression
6. ✅ **Edge-optimized** - Partitioned, column projection
7. ✅ **Future-proof** - Can add more aggregated fields later

