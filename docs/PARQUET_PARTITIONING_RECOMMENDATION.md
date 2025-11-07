# Parquet Partitioning Recommendation

## Analysis

### Current State
- **Single file:** 5.2 MB
- **Total records:** 216,705
- **Partition dimensions:**
  - 2 sources (AIQ, KEA)
  - 3 levels (UG, PG, DEN)
  - 2 years (2023, 2024)
- **Possible partitions:** 8 total partitions

### Partition Size Distribution

| Source | Level | Year | Records | Est. Size |
|--------|-------|------|---------|-----------|
| SRC001 (AIQ) | LVL002 (PG) | 2024 | 57,733 | ~1.4 MB |
| SRC001 (AIQ) | LVL002 (PG) | 2023 | 53,968 | ~1.3 MB |
| SRC001 (AIQ) | LVL001 (UG) | 2024 | 45,314 | ~1.1 MB |
| SRC001 (AIQ) | LVL001 (UG) | 2023 | 42,790 | ~1.0 MB |
| SRC002 (KEA) | LVL002 (PG) | 2024 | 7,105 | ~0.17 MB |
| SRC002 (KEA) | LVL002 (PG) | 2023 | 5,616 | ~0.14 MB |
| SRC002 (KEA) | LVL003 (DEN) | 2024 | 2,755 | ~0.07 MB |
| SRC002 (KEA) | LVL003 (DEN) | 2023 | 1,424 | ~0.04 MB |

## Recommendation: **✅ PARTITION BY SOURCE, LEVEL, AND YEAR**

### Why Partition?

#### 1. **Query Performance** ⚡
- **Current:** Must read entire 5.2 MB file even for single partition queries
- **Partitioned:** Read only relevant partition (0.04 MB - 1.4 MB)
- **Speedup:** 3-10x faster for filtered queries

#### 2. **Edge/Cloud Deployment** ☁️
- Better for Cloudflare Workers (3.8 MB limit)
- Smaller files = faster CDN distribution
- Parallel processing across partitions

#### 3. **Incremental Updates** 🔄
- Update single year/source/level without touching other data
- No need to regenerate entire file
- Faster data refresh cycles

#### 4. **Compression** 📦
- Better compression per partition (similar data grouped)
- Smaller overall size
- Faster decompression

#### 5. **Scalability** 📈
- As data grows, partitions keep individual files manageable
- Easy to add new years/sources/levels
- No single huge file issues

### File Structure

```
output/
└── counselling_data_partitioned/
    ├── source=SRC001/
    │   ├── level=LVL001/
    │   │   ├── year=2023.parquet
    │   │   └── year=2024.parquet
    │   ├── level=LVL002/
    │   │   ├── year=2023.parquet
    │   │   └── year=2024.parquet
    │   └── level=LVL003/
    │       └── year=2023.parquet (if exists)
    └── source=SRC002/
        ├── level=LVL002/
        │   ├── year=2023.parquet
        │   └── year=2024.parquet
        └── level=LVL003/
            ├── year=2023.parquet
            └── year=2024.parquet
```

**Or Hive-style partitioning:**
```
output/
└── counselling_data_partitioned/
    ├── source=SRC001_level=LVL001_year=2023.parquet
    ├── source=SRC001_level=LVL001_year=2024.parquet
    ├── source=SRC001_level=LVL002_year=2023.parquet
    ├── source=SRC001_level=LVL002_year=2024.parquet
    └── ... (8 total files)
```

## Implementation Considerations

### Service Updates Needed

1. **Update IdBasedDataService** to:
   - Detect partition structure
   - Query specific partitions when filters match
   - Fallback to single file if partitioned doesn't exist
   - Support both single file and partitioned modes

2. **Partition Pruning:**
   ```typescript
   // Example: Query PG data for 2024 from AIQ
   // Only reads: source=SRC001/level=LVL002/year=2024.parquet
   // Instead of: entire 5.2 MB file
   ```

3. **Manifest File:**
   - Create `manifest.json` listing all partitions
   - Enables fast discovery without scanning files
   - Contains metadata (record counts, sizes, etc.)

### DuckDB Partition Pruning

DuckDB automatically prunes partitions:
```sql
-- If partitioned correctly, DuckDB will:
-- 1. Read manifest
-- 2. Identify relevant partitions
-- 3. Query only those files
SELECT * FROM 'counselling_data_partitioned/**/*.parquet'
WHERE master_source_id = 'SRC001'
  AND master_level_id = 'LVL002'
  AND year = 2024
-- Reads only: source=SRC001/level=LVL002/year=2024.parquet
```

## Migration Strategy

### Option 1: Keep Both (Recommended)
- Keep single file for backwards compatibility
- Add partitioned version for new code
- Migrate gradually

### Option 2: Replace Single File
- Partition existing file
- Update all services immediately
- One-time migration

## Recommendation: **HYBRID APPROACH**

1. **Keep single file** in `output/counselling_data_export_*.parquet`
2. **Create partitioned version** in `output/counselling_data_partitioned/`
3. **Service checks:** Partitioned first, falls back to single file
4. **Future:** Migrate to partitioned-only once stable

## Benefits Summary

| Aspect | Single File | Partitioned | Winner |
|--------|-------------|-------------|--------|
| **Query Speed** | Slow (full scan) | Fast (partition pruning) | ✅ Partitioned |
| **Update Speed** | Slow (full rewrite) | Fast (single partition) | ✅ Partitioned |
| **Deployment** | Large file | Smaller files | ✅ Partitioned |
| **Simplicity** | Very simple | More complex | ✅ Single |
| **Maintenance** | Easy | File management | ✅ Single |

**Verdict:** Partitioned wins 4/5 categories

## Conclusion

**✅ RECOMMEND PARTITIONING**

Given:
- Only 8 partitions (manageable)
- Clear query patterns (filter by source/level/year)
- Edge deployment needs
- Growing data size
- Performance benefits

The complexity is minimal (8 files), but benefits are significant.


