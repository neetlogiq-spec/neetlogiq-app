# NeetLogIQ Backend Setup Guide

This guide will help you set up the complete Cloudflare-based backend for NeetLogIQ, including R2 storage, D1 database, Vectorize search, AutoRAG, and Workers.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Excel Data    │───▶│  Data Pipeline  │───▶│   R2 Storage    │
│   (Raw Input)   │    │   (DuckDB)      │    │  (Parquet/JSON) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │◀───│  Cloudflare     │◀───│   AutoRAG       │
│   (Next.js)     │    │   Workers       │    │  (Vectorize)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   D1 Database   │
                       │  (Admin Data)   │
                       └─────────────────┘
```

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Cloudflare account
- Wrangler CLI installed: `npm install -g wrangler`

### 2. One-Command Setup

```bash
# Run the automated setup script
npm run cloudflare:setup
```

This will:
- Create R2 bucket for data storage
- Set up D1 database with schema
- Create Vectorize index for search
- Deploy Workers backend
- Insert sample data
- Create necessary directories

### 3. Manual Setup (Alternative)

If you prefer manual setup:

```bash
# 1. Login to Cloudflare
wrangler login

# 2. Create R2 bucket
wrangler r2 bucket create neetlogiq-data

# 3. Create D1 database
wrangler d1 create neetlogiq-admin

# 4. Create Vectorize index
wrangler vectorize create neetlogiq-vectors --dimensions=768 --metric=cosine

# 5. Deploy Workers
wrangler deploy
```

## 📊 Data Pipeline

### Excel to Parquet Conversion

1. **Place Excel files** in `data/raw/` directory
2. **Run data pipeline**:
   ```bash
   npm run data:pipeline
   ```

This will:
- Convert Excel files to CSV
- Create Parquet files for efficient storage
- Generate JSON artifacts for SSR
- Create search documents for AutoRAG
- Upload everything to R2

### Data Structure

```
data/
├── raw/                    # Excel input files
│   ├── colleges.xlsx
│   ├── courses.xlsx
│   └── cutoffs.xlsx
├── processed/
│   ├── parquet/           # Efficient columnar storage
│   │   ├── colleges_2024.parquet
│   │   ├── courses_2024.parquet
│   │   └── cutoffs_2024.parquet
│   ├── json/              # SSR-ready artifacts
│   │   ├── colleges/
│   │   ├── courses/
│   │   └── search_index.json
│   └── docs/              # Search documents
│       ├── colleges/
│       └── courses/
```

## 🔍 Search Implementation

### AutoRAG Configuration

1. **Go to Cloudflare Dashboard** > Workers & Pages > AutoRAG
2. **Create new project**:
   - Data source: R2 bucket `neetlogiq-data`
   - Prefix: `docs/2024/`
   - File types: `.md`, `.txt`
3. **Configure indexing**:
   - Chunk size: 500 characters
   - Overlap: 50 characters
   - Metadata extraction: `college_id`, `course_id`, `state`, `type`

### Search API Usage

```javascript
// Semantic search
const response = await fetch('/api/search?q=medical colleges in delhi&state=Delhi&limit=10');
const results = await response.json();

// College details
const college = await fetch('/api/colleges/college_001');
const collegeData = await college.json();

// Comparison
const comparison = await fetch('/api/compare?ids=college_001,college_002&type=colleges');
const comparisonData = await comparison.json();
```

## 🛠️ Development

### Local Development

```bash
# Start Next.js frontend
npm run dev

# Start Workers backend (in another terminal)
npm run worker:dev
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/colleges` | GET | List colleges with pagination |
| `/api/colleges/{id}` | GET | Get specific college |
| `/api/courses` | GET | List courses with pagination |
| `/api/courses/{id}` | GET | Get specific course |
| `/api/search` | GET | Semantic search |
| `/api/compare` | GET | Compare colleges/courses |
| `/api/cutoffs` | GET | Get cutoff data |
| `/api/admin/colleges` | POST | Create college (admin) |
| `/api/admin/courses` | POST | Create course (admin) |
| `/api/analytics/metrics` | GET | Get analytics data |

## 📈 Performance Optimization

### Caching Strategy

- **R2 Assets**: Immutable, cached aggressively
- **API Responses**: Cached with TTL (1 hour)
- **Search Results**: Cached by query + filters
- **College/Course Pages**: Cached individually

### Edge Performance

- **Workers**: Global edge execution
- **R2**: Zero egress to Workers
- **Vectorize**: Sub-100ms search
- **AutoRAG**: Managed similarity caching

## 🔒 Security

### Authentication

```javascript
// Add to your Workers
const authHeader = request.headers.get('Authorization');
if (!isValidAuth(authHeader)) {
  return new Response('Unauthorized', { status: 401 });
}
```

### Data Protection

- **Admin routes**: Protected with authentication
- **D1 database**: Access controlled via Workers
- **R2 assets**: Public read, admin write
- **Vectorize**: Metadata filtering for access control

## 📊 Analytics

### Tracked Metrics

- **Search queries**: Query text, result count, filters
- **Page views**: College/course page visits
- **User behavior**: Comparison usage, popular searches
- **Performance**: Response times, cache hit rates

### Analytics API

```javascript
// Track custom events
await env.ANALYTICS.writeDataPoint({
  blobs: ['search'],
  doubles: [resultCount],
  indexes: [query]
});
```

## 🚀 Deployment

### Production Deployment

```bash
# Deploy to production
wrangler deploy --env production

# Update environment variables
wrangler secret put API_KEY --env production
```

### Environment Configuration

```bash
# Development
wrangler dev

# Staging
wrangler deploy --env staging

# Production
wrangler deploy --env production
```

## 🔧 Troubleshooting

### Common Issues

1. **Wrangler not found**: Install with `npm install -g wrangler`
2. **Authentication failed**: Run `wrangler login`
3. **Database errors**: Check D1 database ID in `wrangler.toml`
4. **Search not working**: Verify AutoRAG configuration
5. **Upload failures**: Check R2 bucket permissions

### Debug Commands

```bash
# Check Workers logs
wrangler tail

# Test D1 database
wrangler d1 execute neetlogiq-admin --command="SELECT COUNT(*) FROM colleges"

# List R2 objects
wrangler r2 object list neetlogiq-data

# Check Vectorize index
wrangler vectorize list
```

## 📚 Additional Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [R2 Storage Docs](https://developers.cloudflare.com/r2/)
- [Vectorize Docs](https://developers.cloudflare.com/vectorize/)
- [AutoRAG Docs](https://developers.cloudflare.com/autorag/)

## 🎯 Next Steps

1. **Set up AutoRAG** through Cloudflare dashboard
2. **Upload your Excel data** to `data/raw/`
3. **Run data pipeline** to process and upload data
4. **Test the API endpoints** with sample data
5. **Integrate with frontend** using the API
6. **Monitor performance** and optimize as needed

---

**Need help?** Check the troubleshooting section or create an issue in the repository.
