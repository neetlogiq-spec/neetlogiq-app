# Counselling Data Partitioning Implementation

## Overview

The counselling data is now partitioned by `source`, `level`, and `year` for optimal query performance.

## Partition Structure

### Hive-Style Partitioning (Flat)

```
output/
└── counselling_data_export_20251029_001424_partitioned/
    ├── source=SRC001_level=LVL001_year=2023.parquet
    ├── source=SRC001_level=LVL001_year=2024.parquet
    ├── source=SRC001_level=LVL002_year=2023.parquet
    ├── source=SRC001_level=LVL002_year=2024.parquet
    ├── source=SRC002_level=LVL002_year=2023.parquet
    ├── source=SRC002_level=LVL002_year=2024.parquet
    ├── source=SRC002_level=LVL003_year=2023.parquet
    ├── source=SRC002_level=LVL003_year=2024.parquet
    └── manifest.json
```

## Creating Partitions

### Step 1: Run Partition Script

```bash
python scripts/partition_counselling_data.py \
  output/counselling_data_export_20251029_001424.parquet \
  --style hive
```

### Step 2: Verify Partitions

```bash
ls -lh output/counselling_data_export_20251029_001424_partitioned/
cat output/counselling_data_export_20251029_001424_partitioned/manifest.json
```

## Service Behavior

The `IdBasedDataService` automatically:

1. **Checks for partitioned data** on initialization
2. **Uses partitioned files** if available (faster)
3. **Falls back to single file** if partitions don't exist
4. **Builds partition-aware queries** using DuckDB glob patterns

### Example Partition Pruning

```typescript
// Query: AIQ PG data for 2024
// Reads only: source=SRC001_level=LVL002_year=2024.parquet (57K records)
// Instead of: entire 216K record file

const data = await service.getCounsellingData({
  source_id: 'SRC001',
  level_id: 'LVL002',
  year: 2024
});
```

## Performance Benefits

| Query Type | Single File | Partitioned | Speedup |
|------------|-------------|-------------|---------|
| Specific partition (source+level+year) | 5.2 MB read | 0.04-1.4 MB read | **3-10x** |
| Filtered by source | 5.2 MB read | ~2-3 MB read | **2x** |
| All data | 5.2 MB read | 5.2 MB read | Same |

## DuckDB Partition Pruning

DuckDB automatically:
1. Reads glob pattern: `source=SRC001*_level=LVL002*_year=2024*.parquet`
2. Matches only relevant files
3. Queries only those partitions
4. Skips irrelevant partitions

## Migration Path

### Phase 1: Create Partitions (Optional)
- Keep original single file
- Create partitioned version alongside
- Service uses partitioned if available

### Phase 2: Test & Validate
- Test all queries work correctly
- Verify performance improvements
- Check edge cases

### Phase 3: Full Migration (Optional)
- Remove single file (or archive)
- Use partitioned only
- Simpler deployment

## Manifest File

The `manifest.json` contains:

```json
{
  "total_partitions": 8,
  "total_records": 216705,
  "total_size_mb": 5.2,
  "partition_style": "hive",
  "partitions": [
    {
      "source_id": "SRC001",
      "level_id": "LVL002",
      "year": 2024,
      "records": 57733,
      "size_mb": 1.4,
      "filename": "source=SRC001_level=LVL002_year=2024.parquet"
    }
  ]
}
```

## Adding New Partitions

When new data arrives:

1. **Add records** to appropriate partition
2. **Or create new partition** if new source/level/year
3. **Update manifest** (or regenerate)

## Backwards Compatibility

✅ **Full backwards compatibility:**
- Service checks for partitions first
- Falls back to single file automatically
- No breaking changes
- Can use both simultaneously

## Recommendations

1. ✅ **Create partitions** - Significant performance benefits
2. ✅ **Keep single file as backup** - Safety net
3. ✅ **Use partitioned for production** - Better performance
4. ✅ **Update manifest** when adding data - Maintains metadata


