# Automatic Data Refresh - How It Works

## Yes! Updates Are Automatic 🎉

When new parquet files are added or updated, the frontend will automatically discover them. Here's how:

## How Automatic Updates Work

### 1. **DuckDB Glob Pattern Magic** ✨

The service uses DuckDB's glob pattern matching:

```typescript
// When querying, uses patterns like:
'source=SRC001*_level=LVL002*_year=*'

// This matches:
// ✅ source=SRC001_level=LVL002_year=2023.parquet (existing)
// ✅ source=SRC001_level=LVL002_year=2024.parquet (existing)
// ✅ source=SRC001_level=LVL002_year=2025.parquet (NEW - automatically included!)
```

**Key Point:** DuckDB reads files **on-demand** during queries. New files matching the pattern are automatically included!

### 2. **Manifest Auto-Discovery** 📋

The service checks the `manifest.json` file periodically:

- **On Service Init:** Checks for partitions
- **Before Each Query:** Checks if manifest was modified (throttled to every 60 seconds)
- **On Demand:** Can force refresh via `refreshPartitions()`

When you add a new partition:
1. Create new file: `source=SRC001_level=LVL002_year=2025.parquet`
2. Update `manifest.json` (or just add the file - DuckDB finds it!)
3. Next query automatically includes the new partition

### 3. **No Cache Issues** ✅

**Important:** The service doesn't cache parquet data in memory. It reads directly from files each query.

Benefits:
- ✅ New files immediately available
- ✅ Updated files reflect changes instantly
- ✅ No stale cache problems
- ✅ No service restart needed

## Update Workflow

### Adding New Year (2025)

```bash
# 1. Create new partition file
python scripts/partition_counselling_data.py \
  new_counselling_data_2025.parquet \
  -o output/counselling_data_export_20251029_001424_partitioned

# Or manually add:
# source=SRC001_level=LVL002_year=2025.parquet

# 2. Update manifest (optional - DuckDB will find it anyway)
# Or let the partition script regenerate manifest

# 3. That's it! Next query automatically includes 2025 data
```

### Adding New Source

```bash
# 1. Add master source to master data
# 2. Create partition files:
#    source=SRC003_level=LVL001_year=2024.parquet
#    source=SRC003_level=LVL002_year=2024.parquet
# 3. Update manifest (or let DuckDB discover)
# 4. Done! New source appears automatically
```

### Adding New Level

```bash
# 1. Add master level to master data
# 2. Create partition files with new level:
#    source=SRC001_level=LVL004_year=2024.parquet
# 3. Next query includes new level automatically
```

## Example: New Year Appears Automatically

**Before:** Only 2023, 2024 data
```
GET /api/id-based-data/counselling?year=2024
→ Returns only 2024 data
```

**After adding 2025 partition:**

```
GET /api/id-based-data/counselling?year=2025
→ Returns 2025 data (automatic!)

GET /api/id-based-data/counselling
→ Returns 2023, 2024, AND 2025 data (all automatically included!)
```

## API Endpoints for Discovery

### Get Available Years

```typescript
GET /api/id-based-data/available-years
// Returns: [2025, 2024, 2023] // Latest first, automatically includes new years
```

### Get Available Sources

```typescript
GET /api/id-based-data/available-sources
// Returns: ['SRC001', 'SRC002', 'SRC003'] // Automatically includes new sources
```

### Get Available Levels

```typescript
GET /api/id-based-data/available-levels
// Returns: ['LVL001', 'LVL002', 'LVL003', 'LVL004'] // Automatically includes new levels
```

## Implementation Details

### Service Initialization

```typescript
const service = getIdBasedDataService();
await service.initialize();

// Checks for partitions on init
// Reads manifest.json if exists
// Sets up glob patterns for queries
```

### Query Execution

```typescript
// Each query:
// 1. Checks manifest (throttled - every 60 seconds)
// 2. Builds glob pattern
// 3. DuckDB reads matching files on-demand
// 4. New files are automatically included!

const data = await service.getCounsellingData({
  year: 2025  // Will find 2025 partition even if added after service started
});
```

### Manual Refresh (Optional)

```typescript
// Force refresh manifest check
service.refreshPartitions();
```

## Best Practices

### 1. **Update Manifest** (Recommended)

When adding new partitions, update `manifest.json`:

```json
{
  "total_partitions": 9,  // Updated count
  "total_records": 250000,  // Updated count
  "partitions": [
    // ... existing partitions
    {
      "source_id": "SRC001",
      "level_id": "LVL002",
      "year": 2025,
      "records": 45000,
      "filename": "source=SRC001_level=LVL002_year=2025.parquet"
    }
  ]
}
```

### 2. **Use Naming Convention**

Stick to the convention:
- `source={source_id}_level={level_id}_year={year}.parquet`

Example:
- ✅ `source=SRC001_level=LVL002_year=2025.parquet`
- ❌ `SRC001_LVL002_2025.parquet`

### 3. **No Service Restart Needed**

The service reads files on-demand, so:
- ✅ No restart required
- ✅ No cache invalidation needed
- ✅ Updates appear within 60 seconds (manifest check interval)

## Frontend Integration

### React Hook Example

```typescript
// Hook that automatically refreshes when new data is available
function useAvailableYears() {
  const [years, setYears] = useState<number[]>([]);
  
  useEffect(() => {
    async function fetchYears() {
      const response = await fetch('/api/id-based-data/available-years');
      const data = await response.json();
      setYears(data.years);
    }
    
    fetchYears();
    
    // Poll every 5 minutes for new years
    const interval = setInterval(fetchYears, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  return years;
}
```

## Summary

✅ **Yes, updates are automatic!**

- New partitions discovered via DuckDB glob patterns
- Manifest checked periodically (every 60 seconds)
- No service restart needed
- No cache issues
- New data appears in frontend automatically

Just add new partition files following the naming convention, and they'll be automatically included in queries!


