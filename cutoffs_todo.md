# Cutoffs Architecture - Supabase + Hetzner VPS

## Current Problem

- 57,733 raw records → aggregated to ~44 rows (unpredictable)
- UG courses have 100-300 seats → aggregation produces very few rows
- No guaranteed row count per page
- Client-side aggregation is inefficient

---

## Chosen Architecture: Supabase Free + Hetzner CX22

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Free Tier                        │
│  • PostgreSQL (500MB, 2GB bandwidth)                        │
│  • Materialized views (aggregated_cutoffs)                  │
│  • Auth (built-in)                                          │
│  • Real-time subscriptions                                  │
│  • Cost: ₹0/month                                           │
└─────────────────────────────────────────────────────────────┘
                              ↓ API calls
┌─────────────────────────────────────────────────────────────┐
│               Hetzner CX22 VPS (~₹500/month)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Next.js   │  │ Meilisearch │  │    Redis    │         │
│  │   (App)     │  │  (Search)   │  │  (Cache)    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────┐        │
│  │              Nginx (Reverse Proxy + SSL)         │        │
│  └──────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

**Total Cost: ~₹500/month** (Hetzner CX22: 4 vCPU, 8GB RAM, 80GB SSD)

---

## Phase 1: FREE Tier (0-10 customers)

### 1.1 Materialized View for Pre-Aggregated Data

- [ ] Create `aggregated_cutoffs` materialized view in Supabase
- [ ] Index on filter columns (state, course, category, quota)
- [ ] Set up refresh trigger on data change
- [ ] Update API to query materialized view directly

```sql
CREATE MATERIALIZED VIEW aggregated_cutoffs AS
SELECT
  CONCAT(master_college_id, '-', master_course_id, '-',
         master_category_id, '-', master_quota_id, '-',
         year, '-', round_normalized) as id,
  partition_key,
  master_college_id, master_course_id, master_state_id,
  master_quota_id, master_category_id,
  college_name, course_name, state, category, quota,
  management, year, round_normalized as round,
  MIN(all_india_rank) as opening_rank,
  MAX(all_india_rank) as closing_rank,
  COUNT(*) as total_seats
FROM counselling_records
WHERE all_india_rank IS NOT NULL
GROUP BY
  partition_key,
  master_college_id, master_course_id, master_state_id,
  master_quota_id, master_category_id,
  college_name, course_name, state, category, quota,
  management, year, round_normalized;

-- Indexes
CREATE INDEX idx_agg_cutoffs_partition ON aggregated_cutoffs(partition_key);
CREATE INDEX idx_agg_cutoffs_state ON aggregated_cutoffs(state);
CREATE INDEX idx_agg_cutoffs_course ON aggregated_cutoffs(course_name);
CREATE INDEX idx_agg_cutoffs_closing ON aggregated_cutoffs(closing_rank);
```

### 1.2 TanStack Virtual for Infinite Scroll

- [ ] Install @tanstack/react-virtual
- [ ] Create VirtualizedCutoffTable component
- [ ] Implement infinite scroll with intersection observer
- [ ] Show skeleton rows while loading next batch

```bash
npm install @tanstack/react-virtual
```

### 1.3 API Changes

- [ ] Update /api/cutoffs to query aggregated_cutoffs
- [ ] Remove client-side aggregation
- [ ] Add cursor-based pagination support
- [ ] Return consistent 100 rows per request

### 1.4 Vercel Edge Caching

- [ ] Add cache headers to cutoffs API
- [ ] Cache filter-options for 24 hours
- [ ] Cache common queries for 5 minutes

```typescript
// Add to API response
return new Response(data, {
  headers: {
    "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
  },
});
```

---

## Phase 2: VPS Scaling (~₹500-1000/month)

### 2.1 VPS Setup (DigitalOcean/Hetzner/Contabo)

- [ ] Choose provider (Hetzner recommended - best value)
- [ ] Setup Ubuntu 22.04 with Docker
- [ ] Configure Nginx reverse proxy
- [ ] Setup SSL with Let's Encrypt

### 2.2 Self-Hosted Meilisearch

- [ ] Deploy Meilisearch container
- [ ] Index aggregated_cutoffs data
- [ ] Configure facets for filters
- [ ] Setup sync job from Supabase

### 2.3 Redis Cache Layer

- [ ] Deploy Redis container
- [ ] Cache filter options (24h TTL)
- [ ] Cache query results (5min TTL)
- [ ] Implement cache invalidation

### 2.4 Self-Hosted Supabase (Optional)

- [ ] When free tier limits hit
- [ ] Full control over database
- [ ] No row limits

---

## Phase 3: Enterprise Scale (Future)

### 3.1 Read Replicas

- Regional database replicas for low latency

### 3.2 CDN for Static Data

- Pre-generate popular filter combinations as static JSON

### 3.3 Real-time Updates

- WebSocket for live cutoff updates during counselling

---

## Implementation Checklist

### Phase 1 (Current Sprint)

- [ ] Create materialized view in Supabase
- [ ] Verify row count matches expectations
- [ ] Install TanStack Virtual
- [ ] Create VirtualizedCutoffTable
- [ ] Implement infinite scroll
- [ ] Update API to use materialized view
- [ ] Remove client-side aggregation
- [ ] Add edge cache headers
- [ ] Test with different filter combinations
- [ ] Verify 100 rows per scroll batch

### Metrics to Track

- Response time (target: <200ms)
- Rows per request (target: exactly 100)
- Scroll performance (target: 60fps)
- Cache hit rate (target: >80%)

---

## Files to Modify

| File                                                    | Change                     |
| ------------------------------------------------------- | -------------------------- |
| `supabase/migrations/xxx_create_aggregated_cutoffs.sql` | NEW - Materialized view    |
| `src/components/cutoffs/VirtualizedCutoffTable.tsx`     | NEW - Virtual scroll table |
| `src/app/api/cutoffs/route.ts`                          | Query aggregated view      |
| `src/services/supabase-data-service.ts`                 | Remove aggregateCutoffs()  |
| `src/components/cutoffs/CutoffsClient.tsx`              | Use virtualized table      |

---

## Cost Summary

| Phase   | Monthly Cost | Supports         |
| ------- | ------------ | ---------------- |
| Phase 1 | ₹0           | 0-100 users      |
| Phase 2 | ₹500-1000    | 100-10,000 users |
| Phase 3 | ₹5000+       | 10,000+ users    |
