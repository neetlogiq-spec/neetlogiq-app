# Cached Cutoffs Architecture

## Overview

This architecture minimizes Cloudflare Worker usage through aggressive multi-layer caching, resulting in **<5% Worker invocations** for typical usage patterns.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Request                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: Browser Cache (Service Worker)                         │
│ - TTL: 10 minutes                                               │
│ - Storage: localStorage                                         │
│ - Cost: $0                                                      │
│ - Hit Rate: 60-70% (repeat queries)                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (cache miss)
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: CDN Cache (Cloudflare)                                │
│ - TTL: 1-24 hours                                               │
│ - Storage: Global edge network                                 │
│ - Cost: $0                                                      │
│ - Hit Rate: 90%+ (common queries)                              │
│ - Worker Usage: 0% (served from CDN)                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (cache miss)
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: KV Cache (Cloudflare KV)                              │
│ - TTL: 30 minutes                                               │
│ - Storage: Edge locations                                       │
│ - Cost: $0.50 per million operations                           │
│ - Hit Rate: 5-10% (uncommon queries)                           │
│ - Worker Usage: 0% (lightweight KV read)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (cache miss)
┌─────────────────────────────────────────────────────────────────┐
│ Layer 4: Worker Query (Cloudflare Worker + D1)                │
│ - Storage: D1 Database                                         │
│ - Cost: $5 per million requests                                │
│ - Hit Rate: <5% (only on cache misses)                         │
│ - Worker Usage: <5% of total requests                          │
└─────────────────────────────────────────────────────────────────┘
```

## Optimization Features

### 1. Request Coalescing
Multiple identical requests within a short time window are coalesced into a single Worker query.

```typescript
// User triggers 10 identical requests
// Worker only processes 1 query
// Result: 90% reduction in Worker usage
```

### 2. Smart Prefetching
Predict user needs and preload likely data in the background.

```typescript
// User is viewing Round 1
// Automatically prefetches Round 2 in background
// Result: 0% Worker usage when user clicks Round 2
```

### 3. Progressive Loading
Load critical data first, additional data in background.

```typescript
// Initial load: Round 1 + 2 (most important)
// Background: Load rounds 3-10
// Result: Instant UI, background loading
```

### 4. Batch Queries
Combine multiple queries into a single Worker call.

```typescript
// 5 separate queries → 1 Worker batch call
// Result: 80% reduction in Worker invocations
```

## Expected Worker Usage

### Scenario 1: First Visit
```
Total Requests: 10
Layer 1 (Browser): 0 hits (0%)
Layer 2 (CDN): 0 hits (0%)
Layer 3 (KV): 0 hits (0%)
Layer 4 (Worker): 10 hits (100%)
→ Worker Usage: 100% (expected for first visit)
```

### Scenario 2: Typical User Session
```
Total Requests: 100
Layer 1 (Browser): 60 hits (60%)
Layer 2 (CDN): 30 hits (30%)
Layer 3 (KV): 5 hits (5%)
Layer 4 (Worker): 5 hits (5%)
→ Worker Usage: 5% (typical usage)
```

### Scenario 3: Popular Query (e.g., "Round 1 2024")
```
Total Requests: 10,000
Layer 1 (Browser): 4,000 hits (40%)
Layer 2 (CDN): 5,500 hits (55%)
Layer 3 (KV): 400 hits (4%)
Layer 4 (Worker): 100 hits (1%)
→ Worker Usage: 1% (highly cached data)
```

## Cost Analysis

### Monthly Cost Estimate (10 million requests)

#### With Aggressive Caching:
- **CDN Cache (90%)**: 9,000,000 requests × $0 = $0
- **KV Cache (5%)**: 500,000 requests × $0.50/million = $0.25
- **Worker (5%)**: 500,000 requests × $5/million = $2.50
- **Total**: $2.75/month

#### Without Caching:
- **Worker (100%)**: 10,000,000 requests × $5/million = $50.00/month

**Savings: 95% cost reduction**

## Cache Key Strategy

```typescript
// Generate cache key from request
const cacheKey = `cutoffs:${stream}:${year}:${round}:${JSON.stringify(filters)}`;

// Example cache keys:
cutoffs:UG:2024:1:{"category":"GENERAL"}
cutoffs:UG:2024:2:{"college_id":"MED001"}
cutoffs:PG_MEDICAL:2024:all:{"rank":{"min":1000,"max":5000}}
```

## Implementation Files

### Services
- `src/services/CachedCutoffsService.ts` - Main caching service
- `src/worker.js` - Updated with caching logic

### Hooks
- `src/hooks/useCachedCutoffs.ts` - React hook for cached cutoffs

### Pages
- `src/app/cutoffs/cached/page.tsx` - Cached cutoffs page

## Testing

### Test Cache Hit Rate
```bash
# 1. Clear all caches
localStorage.clear()

# 2. Make same request twice
# Expected: First request hits Worker, second hits browser cache

# 3. Check cache stats
# Should show 50% hit rate (1 hit, 1 miss)
```

### Test Request Coalescing
```bash
# 1. Trigger 10 identical requests simultaneously
# 2. Check Worker logs
# Expected: Only 1 Worker query executed
```

### Test Smart Prefetching
```bash
# 1. Load Round 1 data
# 2. Check console logs
# Expected: Round 2 prefetched in background
```

## Deployment Checklist

- [ ] Cloudflare Worker deployed with caching logic
- [ ] KV namespace created and configured
- [ ] CDN cache headers configured (Cache-Control)
- [ ] Service Worker registered for browser caching
- [ ] Cache key generation tested
- [ ] Request coalescing tested
- [ ] Smart prefetching tested
- [ ] Monitoring dashboard created
- [ ] Cost alerts configured

## Monitoring

### Key Metrics
1. **Cache Hit Rate**: Should be >90%
2. **Worker Usage**: Should be <5%
3. **Average Response Time**: <50ms (cached), <500ms (uncached)
4. **Cache Layer Distribution**: 60% Browser, 30% CDN, 5% KV, 5% Worker

### Alerts
- Cache hit rate drops below 80% → Investigate cache keys
- Worker usage exceeds 10% → Check cache TTLs
- Response time exceeds 1000ms → Check D1 query performance

## Future Optimizations

1. **Static HTML Pre-rendering**: Most common queries as static HTML pages
2. **Edge Caching**: Deploy to multiple edge locations
3. **Predictive Caching**: Use ML to predict likely queries
4. **Compression**: Add gzip/brotli compression for cached responses
5. **Partial Caching**: Cache partial results for progressive loading

