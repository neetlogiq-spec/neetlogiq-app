# ID-Based Data System Documentation

## Overview

The ID-based system ensures standardized names across all pages by:
1. **Master Data** contains all entities (colleges, courses, states, categories, quotas) with unique IDs and standardized names
2. **Seat Data** and **Counselling Data** reference master data entities via IDs (`master_college_id`, `master_course_id`, etc.)
3. When displaying data, names are retrieved from master data using these IDs
4. This creates a single source of truth for entity names across the entire application

## Architecture

### Data Flow

```
┌─────────────────┐
│  Master Data    │  ← Contains IDs and standardized names
│  (Parquet)      │     - Colleges (medical_colleges.parquet, etc.)
└────────┬────────┘     - Courses (courses.parquet)
         │               - States (states.parquet)
         │               - Categories (categories.parquet)
         │               - Quotas (quotas.parquet)
         │
         ↓ (ID references)
┌─────────────────┐
│  Seat Data      │  ← Contains master_*_id fields
│  (Parquet)      │     - master_college_id
└────────┬────────┘     - master_course_id
         │               - master_state_id
         │
         ↓
┌─────────────────┐
│  Counselling    │  ← Contains master_*_id fields
│  Data (Parquet) │     - master_college_id
└────────┬────────┘     - master_course_id
         │               - master_state_id
         │               - master_quota_id
         │               - master_category_id
         │
         ↓ (Enrichment)
┌─────────────────┐
│  Enriched Data  │  ← Names from master data
│  (API Response) │     - college_name (standardized)
└─────────────────┘     - course_name (standardized)
                         - state_name (standardized)
                         - quota_name (standardized)
                         - category_name (standardized)
```

## Services

### 1. MasterDataService

**Location:** `src/services/master-data-service.ts`

Loads and caches master data from parquet files. Provides ID-based lookups for names.

```typescript
import { getMasterDataService } from '@/services/master-data-service';

const service = getMasterDataService();
await service.initialize();

// Get name by ID
const collegeName = service.getCollegeName('MED0001');
const courseName = service.getCourseName('CRS001');
const stateName = service.getStateName('STATE001');

// Get full entity
const college = service.getCollege('MED0001');
const course = service.getCourse('CRS001');
```

### 2. IdBasedDataService

**Location:** `src/services/id-based-data-service.ts`

Retrieves seat and counselling data and enriches it with standardized names from master data.

```typescript
import { getIdBasedDataService } from '@/services/id-based-data-service';

const service = getIdBasedDataService();
await service.initialize();

// Get enriched seat data
const seatData = await service.getSeatData({
  college_id: 'MED0001',
  year: 2024,
  limit: 50
});

// Get enriched counselling data
const counsellingData = await service.getCounsellingData({
  course_id: 'CRS001',
  year: 2024
});

// Get combined college data
const collegeData = await service.getCollegeData('MED0001', 2024);
// Returns: { college, seats, counselling }
```

## API Endpoints

### GET `/api/id-based-data/seat`

Get enriched seat data with standardized names.

**Query Parameters:**
- `college_id` - Filter by college ID
- `course_id` - Filter by course ID
- `state_id` - Filter by state ID
- `year` - Filter by year
- `limit` - Number of records (default: 100)
- `offset` - Pagination offset (default: 0)

**Example:**
```bash
GET /api/id-based-data/seat?college_id=MED0001&year=2024&limit=50
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "college_name": "AIIMS New Delhi", // Standardized from master data
      "course_name": "MBBS",              // Standardized from master data
      "state": "Delhi",                   // Standardized from master data
      "master_college_id": "MED0001",
      "master_course_id": "CRS001",
      "master_state_id": "STATE009",
      "seats": 100,
      "year": 2024
    }
  ],
  "total": 150
}
```

### GET `/api/id-based-data/counselling`

Get enriched counselling data with standardized names.

**Query Parameters:**
- `college_id` - Filter by college ID
- `course_id` - Filter by course ID
- `state_id` - Filter by state ID
- `quota_id` - Filter by quota ID
- `category_id` - Filter by category ID
- `year` - Filter by year
- `limit` - Number of records (default: 100)
- `offset` - Pagination offset (default: 0)

**Example:**
```bash
GET /api/id-based-data/counselling?college_id=MED0001&year=2023
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "all_india_rank": 1,
      "college_name": "AIIMS New Delhi",      // Standardized
      "course_name": "MD General Medicine",   // Standardized
      "state_name": "Delhi",                  // Standardized
      "quota_name": "All India",              // Standardized
      "category_name": "General",             // Standardized
      "round": 1,
      "year": 2023,
      "master_college_id": "MED0001",
      "master_course_id": "CRS0175",
      "master_state_id": "STATE009",
      "master_quota_id": "QUOTA002",
      "master_category_id": "CAT005"
    }
  ],
  "total": 500
}
```

### GET `/api/id-based-data/colleges/[id]`

Get combined data for a college (seats + counselling).

**Query Parameters:**
- `year` - Filter by year (optional)

**Example:**
```bash
GET /api/id-based-data/colleges/MED0001?year=2024
```

**Response:**
```json
{
  "success": true,
  "data": {
    "college": {
      "id": "MED0001",
      "name": "AIIMS New Delhi",
      "type": "MEDICAL",
      "state": "Delhi"
    },
    "seats": [...],
    "counselling": [...]
  }
}
```

### GET `/api/id-based-data/courses/[id]`

Get combined data for a course (seats + counselling).

**Example:**
```bash
GET /api/id-based-data/courses/CRS001?year=2024
```

### GET `/api/id-based-data/master`

Get master data entities.

**Query Parameters:**
- `type` - Entity type: `colleges`, `courses`, `states`, `categories`, `quotas`, or `all` (default)

**Example:**
```bash
GET /api/id-based-data/master?type=colleges
```

## Usage in Components

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

function CollegeDataComponent({ collegeId }: { collegeId: string }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const response = await fetch(
        `/api/id-based-data/colleges/${collegeId}?year=2024`
      );
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      }
      setLoading(false);
    }
    
    fetchData();
  }, [collegeId]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>{data.college.name}</h1> {/* Standardized name */}
      
      <h2>Seats</h2>
      {data.seats.map(seat => (
        <div key={seat.id}>
          {seat.college_name} - {seat.course_name}
        </div>
      ))}
      
      <h2>Counselling Data</h2>
      {data.counselling.map(record => (
        <div key={record.id}>
          {record.college_name} - {record.course_name} - Rank: {record.all_india_rank}
        </div>
      ))}
    </div>
  );
}
```

## Benefits

1. **Standardized Names**: All pages show the same name for the same entity
2. **Single Source of Truth**: Master data is the only place where names are defined
3. **Easy Updates**: Update a name in master data, and it reflects everywhere
4. **Data Integrity**: IDs ensure correct relationships even if names change
5. **Performance**: In-memory caching provides fast lookups
6. **Type Safety**: TypeScript interfaces ensure data consistency

## File Structure

```
output/
├── master_data_export_20251029_001424/
│   ├── medical_colleges.parquet
│   ├── dental_colleges.parquet
│   ├── dnb_colleges.parquet
│   ├── courses.parquet
│   ├── states.parquet
│   ├── categories.parquet
│   └── quotas.parquet
├── seat_data_export_20251029_001424.parquet
└── counselling_data_export_20251029_001424.parquet
```

## Migration Guide

To migrate existing code to use the ID-based system:

1. **Replace direct data access** with API calls to `/api/id-based-data/*`
2. **Use standardized name fields**: `college_name`, `course_name`, etc. (from enriched data)
3. **Filter by IDs**: Use `college_id`, `course_id` instead of name strings
4. **Remove name-based matching**: IDs provide exact matches

### Before (Old Pattern)
```typescript
// Direct parquet reading
const data = await readParquet('seat_data.parquet');
// Names may vary: "AIIMS New Delhi", "AIIMS Delhi", etc.
```

### After (New Pattern)
```typescript
// ID-based API
const response = await fetch('/api/id-based-data/seat?college_id=MED0001');
const result = await response.json();
// Always standardized: "AIIMS New Delhi"
```

## Troubleshooting

### Master data not loading
- Check that parquet files exist in `output/master_data_export_*/`
- Verify file paths in service configuration

### Missing names in responses
- Ensure master data IDs match IDs in seat/counselling data
- Check that master data service is initialized before use

### Performance issues
- Master data is cached in memory after first load
- Consider pagination for large datasets

## Future Enhancements

1. **Real-time Updates**: WebSocket support for master data changes
2. **Batch Operations**: Bulk enrichment of multiple IDs
3. **Search by Name**: Reverse lookup from name to ID
4. **Caching Strategy**: Redis for distributed caching
5. **Validation**: Ensure all IDs in seat/counselling data exist in master data


