# Fresh API Documentation

This document describes the new API endpoints created for the fresh database system with imported counselling data.

## Base URL
```
/api/fresh
```

## Endpoints

### 1. Colleges API

#### GET `/api/fresh/colleges`

Retrieve colleges with filtering and pagination.

**Query Parameters:**
- `query` (string, optional): Search term for college name, city, state, or university
- `state` (string, optional): Filter by state
- `city` (string, optional): Filter by city
- `type` (string, optional): Filter by college type
- `management` (string, optional): Filter by management type
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Records per page (default: 20)
- `sort_by` (string, optional): Sort field (default: 'name')
- `sort_order` (string, optional): Sort order - 'asc' or 'desc' (default: 'asc')

**Example Request:**
```
GET /api/fresh/colleges?state=Karnataka&type=Medical&page=1&limit=10
```

**Response:**
```json
{
  "data": [
    {
      "id": "college_001",
      "name": "Karnataka Medical College",
      "state": "Karnataka",
      "city": "Hubli",
      "type": "Medical",
      "management": "Government",
      "university_affiliation": "Rajiv Gandhi University",
      "website": "https://example.com",
      "address": "Hubli, Karnataka",
      "established_year": 1956,
      "recognition": "MCI",
      "affiliation": "Government",
      "created_at": "2025-09-27T12:00:00Z",
      "updated_at": "2025-09-27T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "total_pages": 15,
    "has_next": true,
    "has_prev": false
  },
  "filters": {
    "query": "",
    "state": "Karnataka",
    "city": "",
    "type": "Medical",
    "management": ""
  }
}
```

### 2. Courses API

#### GET `/api/fresh/courses`

Retrieve courses with filtering and pagination.

**Query Parameters:**
- `query` (string, optional): Search term for course name, code, stream, or branch
- `stream` (string, optional): Filter by stream
- `branch` (string, optional): Filter by branch
- `degree_type` (string, optional): Filter by degree type
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Records per page (default: 20)
- `sort_by` (string, optional): Sort field (default: 'name')
- `sort_order` (string, optional): Sort order - 'asc' or 'desc' (default: 'asc')

**Example Request:**
```
GET /api/fresh/courses?stream=Medical&degree_type=MBBS&page=1&limit=10
```

**Response:**
```json
{
  "data": [
    {
      "id": "course_001",
      "name": "Bachelor of Medicine and Bachelor of Surgery",
      "code": "MBBS",
      "stream": "Medical",
      "branch": "Medicine",
      "degree_type": "MBBS",
      "duration_years": 5.5,
      "syllabus": "Medical curriculum...",
      "career_prospects": "Doctor, Surgeon, etc.",
      "created_at": "2025-09-27T12:00:00Z",
      "updated_at": "2025-09-27T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  },
  "filters": {
    "query": "",
    "stream": "Medical",
    "branch": "",
    "degree_type": "MBBS"
  }
}
```

### 3. Counselling API

#### GET `/api/fresh/counselling`

Retrieve counselling records with comprehensive filtering.

**Query Parameters:**
- `query` (string, optional): Search term for college name, course name, or state
- `college_id` (string, optional): Filter by college ID
- `course_id` (string, optional): Filter by course ID
- `state` (string, optional): Filter by state
- `category` (string, optional): Filter by category
- `quota` (string, optional): Filter by quota
- `round` (number, optional): Filter by round
- `year` (number, optional): Filter by year
- `counselling_session` (string, optional): Filter by counselling session
- `min_rank` (number, optional): Minimum rank filter
- `max_rank` (number, optional): Maximum rank filter
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Records per page (default: 20)
- `sort_by` (string, optional): Sort field (default: 'all_india_rank')
- `sort_order` (string, optional): Sort order - 'asc' or 'desc' (default: 'asc')

**Example Request:**
```
GET /api/fresh/counselling?state=Karnataka&category=General&min_rank=1&max_rank=1000&page=1&limit=20
```

**Response:**
```json
{
  "data": [
    {
      "id": "counselling_001",
      "all_india_rank": 150,
      "college_id": "college_001",
      "college_name": "Karnataka Medical College",
      "course_id": "course_001",
      "course_name": "MBBS",
      "state": "Karnataka",
      "category": "General",
      "quota": "All India",
      "round": 1,
      "year": 2024,
      "opening_rank": 100,
      "closing_rank": 200,
      "counselling_session": "KEA 2024",
      "created_at": "2025-09-27T12:00:00Z",
      "updated_at": "2025-09-27T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5000,
    "total_pages": 250,
    "has_next": true,
    "has_prev": false
  },
  "filters": {
    "query": "",
    "college_id": "",
    "course_id": "",
    "state": "Karnataka",
    "category": "General",
    "quota": "",
    "round": null,
    "year": null,
    "counselling_session": "",
    "min_rank": 1,
    "max_rank": 1000
  }
}
```

### 4. Search API

#### GET `/api/fresh/search`

Universal search across colleges, courses, and counselling records.

**Query Parameters:**
- `query` (string, required): Search term
- `types` (string, optional): Comma-separated list of types to search ('college', 'course', 'counselling')
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Records per page (default: 20)

**Example Request:**
```
GET /api/fresh/search?query=MBBS&types=college,course,counselling&page=1&limit=10
```

**Response:**
```json
{
  "data": [
    {
      "type": "college",
      "id": "college_001",
      "name": "Karnataka Medical College",
      "description": "Hubli, Karnataka • Medical",
      "metadata": {
        "state": "Karnataka",
        "city": "Hubli",
        "type": "Medical",
        "management": "Government"
      }
    },
    {
      "type": "course",
      "id": "course_001",
      "name": "Bachelor of Medicine and Bachelor of Surgery",
      "description": "Medical • Medicine • MBBS",
      "metadata": {
        "code": "MBBS",
        "stream": "Medical",
        "branch": "Medicine",
        "degree_type": "MBBS",
        "duration_years": 5.5
      }
    },
    {
      "type": "counselling",
      "id": "counselling_001",
      "name": "Karnataka Medical College - MBBS",
      "description": "Rank 150 • Karnataka • KEA 2024",
      "metadata": {
        "all_india_rank": 150,
        "college_name": "Karnataka Medical College",
        "course_name": "MBBS",
        "state": "Karnataka",
        "category": "General",
        "quota": "All India",
        "round": 1,
        "year": 2024,
        "counselling_session": "KEA 2024"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false
  },
  "query": {
    "search_term": "MBBS",
    "types": ["college", "course", "counselling"],
    "total_results": 25
  }
}
```

### 5. Statistics API

#### GET `/api/fresh/stats`

Get comprehensive statistics about the database.

**Example Request:**
```
GET /api/fresh/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "colleges": {
      "total": 2440,
      "by_state": {
        "Karnataka": 150,
        "Tamil Nadu": 200,
        "Maharashtra": 180
      },
      "by_type": {
        "Medical": 500,
        "Dental": 300,
        "Engineering": 1000
      },
      "by_management": {
        "Government": 800,
        "Private": 1200,
        "Deemed": 440
      }
    },
    "courses": {
      "total": 16000,
      "by_stream": {
        "Medical": 5000,
        "Dental": 3000,
        "Engineering": 8000
      },
      "by_degree_type": {
        "MBBS": 5000,
        "BDS": 3000,
        "BE": 8000
      }
    },
    "counselling": {
      "total_records": 128602,
      "by_session": {
        "KEA 2024": 9860,
        "KEA 2023": 7041,
        "AIQ 2024": 57733,
        "AIQ 2023": 53968
      },
      "by_year": {
        "2024": 67593,
        "2023": 61009
      },
      "by_state": {
        "Karnataka": 16901,
        "Tamil Nadu": 25000,
        "Maharashtra": 20000
      },
      "by_category": {
        "General": 50000,
        "OBC": 30000,
        "SC": 25000,
        "ST": 10000
      },
      "by_quota": {
        "All India": 80000,
        "State": 40000,
        "Management": 8602
      },
      "rank_range": {
        "min": 1,
        "max": 200000,
        "average": 50000
      }
    },
    "last_updated": "2025-09-27T12:44:53.000Z"
  }
}
```

## Data Sources

The fresh API system uses the following data sources:

### Master Data
- **Colleges**: `data/colleges_master.json` - 2,440 colleges
- **Courses**: `data/courses_master.json` - 16,000 courses

### Counselling Data
- **KEA 2024**: `kea2024_counselling_processed_20250927_124353.json` - 9,860 records
- **KEA 2023**: `kea2023_counselling_processed_20250927_124448.json` - 7,041 records
- **AIQ 2024**: `aiq2024_counselling_processed_20250927_124438.json` - 57,733 records
- **AIQ 2023**: `aiq2023_counselling_processed_20250927_124415.json` - 53,968 records

**Total Counselling Records**: 128,602

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (missing required parameters)
- `404`: Not Found (data file not found)
- `500`: Internal Server Error

Error responses follow this format:
```json
{
  "error": "Error message description"
}
```

## Rate Limiting

Currently, there are no rate limits implemented. Consider implementing rate limiting for production use.

## Caching

The API does not implement caching. Consider implementing Redis or similar caching for frequently accessed data.

## Future Enhancements

1. **Authentication**: Add JWT-based authentication
2. **Rate Limiting**: Implement rate limiting per IP/user
3. **Caching**: Add Redis caching for better performance
4. **GraphQL**: Consider GraphQL for more flexible queries
5. **Real-time Updates**: WebSocket support for real-time data updates
6. **Analytics**: Add analytics tracking for API usage
7. **Documentation**: Interactive API documentation with Swagger/OpenAPI
