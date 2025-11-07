# Cutoffs Architecture Comparison

## 📊 Current Architecture Analysis

### Colleges & Courses (Static JSON - CDN Delivered)
```typescript
// Current Implementation
colleges_data: {
  size: "50-200 KB",
  format: "Static JSON (gzipped)",
  delivery: "CDN edge cache",
  load_time: "< 50ms",
  caching: "Browser cache + CDN",
  cost: "Minimal - cached at edge"
}
```

**Pros:**
- ✅ Instant loading (cached at CDN edge)
- ✅ No client-side storage needed
- ✅ Works offline with Service Worker
- ✅ No bandwidth issues
- ✅ Consistent performance

**Cons:**
- ⚠️ Limited by data size (works for small datasets)
- ⚠️ Can't handle very large datasets without pagination

### Cutoffs (Client Download + DuckDB)
```typescript
// Proposed Implementation
cutoffs_data: {
  size: "2-5 MB (initial) + more on demand",
  format: "Parquet + DuckDB",
  delivery: "Client download + IndexedDB",
  load_time: "200-500ms (first time), 20ms (cached)",
  caching: "IndexedDB with TTL",
  cost: "Bandwidth on first load"
}
```

**Pros:**
- ✅ Can handle massive datasets
- ✅ Fast queries after initial load
- ✅ Offline-first approach
- ✅ Rich query capabilities with DuckDB

**Cons:**
- ❌ Initial download time (especially on slow connections)
- ❌ Bandwidth usage (repeats on device change)
- ❌ IndexedDB storage limitations
- ❌ UX issues during initial load

---

## 🔄 Recommended Solution: Hybrid Approach

### Option 1: Static JSON for Cutoffs (Like Colleges/Courses) ⭐ RECOMMENDED

**Why?** Consistency and immediate usability, tied to your stream partitioning (UG, PG_MEDICAL, PG_DENTAL).

```typescript
cutoffs_data: {
  initial_load: {
    UG: "50-100 KB (Round 1 & 2 only)",
    PG_MEDICAL: "30-60 KB (Round 1 & 2 only)",
    PG_DENTAL: "20-40 KB (Round 1 & 2 only)"
  },
  format: "Static JSON (gzipped)",
  delivery: "CDN edge cache",
  load_time: "< 100ms",
  caching: "Browser cache + CDN",
  streaming: "Load more rounds on scroll/demand"
}
```

**Implementation:**
```javascript
// Load only priority rounds (1 & 2) initially
const initialCutoffs = await fetch('/data/cutoffs/UG_priority_rounds.json');
// Then load others on demand:
const moreCutoffs = await fetch('/data/cutoffs/UG_other_rounds.json');
```

**Benefits:**
- ⚡ Fast initial load (< 100ms)
- 💰 Bandwidth-friendly
- 🎯 Progressive loading
- 🔄 Same method as colleges/courses

---

### Option 2: Pure Server-Side Queries (No Client Download)

**Why?** Centralized processing and smallest client bundle.

```typescript
cutoffs_data: {
  delivery: "Server-side queries via Cloudflare Workers",
  load_time: "< 50ms per query",
  caching: "Edge cache + Server cache",
  query: "On-demand SQL queries"
}
```

**Benefits:**
- ⚡ Fast queries
- 💰 No bandwidth cost on client
- 🔄 Server-side updates only
- 🎯 No storage limits

**Drawbacks:**
- ❌ Requires server processing
- ❌ Data sync overhead

---

## 🎯 **Recommendation: Use Static JSON (Like Colleges/Courses)**

### Implementation Strategy

```typescript
// 1. Initial Load (Fast - Like Colleges)
GET /data/cutoffs/UG_priority_rounds.json      // 50-100 KB
GET /data/cutoffs/PG_MEDICAL_priority_rounds.json  // 30-60 KB
GET /data/cutoffs/PG_DENTAL_priority_rounds.json // 20-40 KB

// 2. Progressive Loading (On Demand)
GET /data/cutoffs/UG_other_rounds.json         // Load when needed
GET /data/cutoffs/UG_round_3.json
GET /data/cutoffs/UG_round_4.json
// etc.

// 3. Filtering & Search (Client-Side)
- Use JavaScript for filtering
- Use virtual scrolling for performance
- Use IndexedDB for caching (optional)
```

### Performance Comparison

| Metric | Current (Client Download) | Recommended (Static JSON) |
|--------|--------------------------|---------------------------|
| **Initial Load** | 200-500ms | < 100ms |
| **First Query** | 200ms (includes download) | 20ms (filtering) |
| **Subsequent Queries** | 20ms | 20ms |
| **Bandwidth** | 2-5 MB (first time) | 100-200 KB total |
| **Browser Cache** | IndexedDB (complex) | HTTP Cache (simple) |
| **Offline Support** | Needs setup | HTTP Cache works |

---

## 🚀 Next Steps

1. **Convert Parquet to Static JSON**
   - Keep the stream-based partitioning
   - Use gzip compression
   - Cache at CDN edge

2. **Implement Progressive Loading**
   - Load priority rounds (1 & 2) initially
   - Load other rounds on demand
   - Use virtual scrolling for performance

3. **Use Client-Side Filtering**
   - JavaScript filtering (fast for in-memory data)
   - No need for DuckDB-WASM for initial queries
   - Use DuckDB-WASM only for complex analytics (optional)

4. **Match Colleges/Courses Architecture**
   - Same delivery method
   - Same caching strategy
   - Same performance characteristics
