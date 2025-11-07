# Source and Level ID Migration Guide

## Overview

This guide explains how to add `master_source_id` and `master_level_id` to counselling data to complete the ID-based system.

## Why Add These IDs?

**Benefits:**
1. **Consistency**: All entities (colleges, courses, states, categories, quotas, sources, levels) use master IDs
2. **Performance**: Direct ID lookups are faster than code-to-ID mappings
3. **Data Integrity**: IDs remain stable even if codes change
4. **Standardization**: Complete ID-based architecture across all data

## Current State

Counselling data currently has:
- ✅ `master_college_id`
- ✅ `master_course_id`
- ✅ `master_state_id`
- ✅ `master_quota_id`
- ✅ `master_category_id`
- ❌ `master_source_id` (missing)
- ❌ `master_level_id` (missing)

But it has:
- `source_normalized` (AIQ, KEA)
- `level_normalized` (UG, PG, DEN)

## Master Source and Level Mappings

### Sources
- `AIQ` → `SRC001` (All India Quota)
- `KEA` → `SRC002` (Karnataka Engineering Admission)

### Levels
- `UG` → `LVL001` (Undergraduate)
- `PG` → `LVL002` (Postgraduate)
- `DEN` → `LVL003` (Dental)

## Migration Steps

### Step 1: Run the Migration Script

```bash
# With backup (recommended)
python scripts/add_source_level_ids_to_counselling.py \
  output/counselling_data_export_20251029_001424.parquet \
  --backup

# Or without backup (overwrites file)
python scripts/add_source_level_ids_to_counselling.py \
  output/counselling_data_export_20251029_001424.parquet
```

### Step 2: Verify Results

```bash
python -c "
import pandas as pd
df = pd.read_parquet('output/counselling_data_export_20251029_001424.parquet')
print('Has master_source_id:', 'master_source_id' in df.columns)
print('Has master_level_id:', 'master_level_id' in df.columns)
print('\nSource ID distribution:')
print(df['master_source_id'].value_counts())
print('\nLevel ID distribution:')
print(df['master_level_id'].value_counts())
"
```

### Step 3: Test the API

```bash
# Test filtering by source ID
curl "http://localhost:3000/api/id-based-data/counselling?source_id=SRC001&limit=10"

# Test filtering by level ID
curl "http://localhost:3000/api/id-based-data/counselling?level_id=LVL002&limit=10"
```

## What the Script Does

1. **Loads** the counselling data parquet file
2. **Checks** if `master_source_id` and `master_level_id` columns exist
3. **Maps** `source_normalized` → `master_source_id` using SOURCE_MAPPING
4. **Maps** `level_normalized` → `master_level_id` using LEVEL_MAPPING
5. **Saves** the updated file

## Service Support

The `IdBasedDataService` now supports both approaches:

### Priority Order:
1. **If `master_source_id` exists in data** → Use it directly
2. **Else if `source_normalized` exists** → Look up ID from code
3. **Else** → Set to "Unknown Source"

Same logic applies for levels.

### Filtering:
- Filter by ID: `?source_id=SRC001`
- Filter by code: `?source_id=AIQ` (works via code lookup)

Both work seamlessly!

## After Migration

Once IDs are added, you can:

### Filter by Source ID
```typescript
const data = await service.getCounsellingData({
  source_id: 'SRC001', // Direct ID lookup
  year: 2024
});
```

### Filter by Level ID
```typescript
const data = await service.getCounsellingData({
  level_id: 'LVL002', // Direct ID lookup
  year: 2024
});
```

### Get Standardized Names
```typescript
// All responses now include:
{
  source_name: "All India Quota",  // Standardized
  level_name: "Postgraduate",       // Standardized
  master_source_id: "SRC001",      // Direct ID reference
  master_level_id: "LVL002"        // Direct ID reference
}
```

## Rollback

If you need to rollback:

```bash
# If backup was created
cp output/counselling_data_export_20251029_001424_backup.parquet \
   output/counselling_data_export_20251029_001424.parquet

# Or remove the columns
python -c "
import pandas as pd
df = pd.read_parquet('output/counselling_data_export_20251029_001424.parquet')
df = df.drop(columns=['master_source_id', 'master_level_id'], errors='ignore')
df.to_parquet('output/counselling_data_export_20251029_001424.parquet', compression='snappy', index=False)
print('Rolled back successfully')
"
```

## Next Steps

1. ✅ Run migration script
2. ✅ Verify data integrity
3. ✅ Test API endpoints
4. ✅ Update any direct parquet readers to use new IDs
5. ✅ Update documentation

## Compatibility

The service is **backwards compatible**:
- Works with old data (without IDs) using code lookup
- Works with new data (with IDs) using direct ID lookup
- Automatically upgrades old data during enrichment

No breaking changes!


