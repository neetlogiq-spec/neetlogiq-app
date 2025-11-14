# Implementation Plan - Optimal Architecture

## 🎯 Goal
Build a self-sustaining, edge-native platform with:
- Static frontend (Cloudflare Pages)
- Worker APIs (Cloudflare Workers)
- R2 data storage (Cloudflare R2)
- Automatic cache invalidation
- Cost: <$1/month

---

## 📅 Timeline: 2-3 Weeks

### Week 1: Foundation
- ✅ Fix critical bugs in current codebase
- ✅ Create Worker API structure
- ✅ Set up R2 bucket and upload data
- ✅ Create API client library
- ✅ Update frontend to call Workers

### Week 2: Workers Development
- ✅ Implement colleges Worker
- ✅ Implement cutoffs Worker
- ✅ Implement comparison Worker
- ✅ Add KV caching layer
- ✅ Test all endpoints

### Week 3: Automation & Deployment
- ✅ Create data-sync Worker
- ✅ Set up R2 event triggers
- ✅ Deploy to Cloudflare Pages
- ✅ Configure custom domain
- ✅ Set up monitoring

---

## 🔧 Step-by-Step Implementation

### STEP 1: Fix Current Critical Bugs (Day 1)

**Files to modify:**
1. `src/components/auth/AuthGuard.tsx` - Add /login, /signup to PUBLIC_PATHS
2. `src/contexts/AuthContext.tsx` - Use shared isDeveloperAccount
3. Remove dimmed content in AuthGuard

**Commands:**
```bash
# Run these fixes first
git checkout -b fix/critical-bugs
# Apply fixes
git commit -m "fix: Critical authentication and routing bugs"
```

---

### STEP 2: Set Up Cloudflare Account (Day 1)

1. **Create Cloudflare Account**: https://dash.cloudflare.com/sign-up
2. **Install Wrangler CLI**:
   ```bash
   npm install -g wrangler
   wrangler login
   ```

3. **Create R2 Bucket**:
   ```bash
   wrangler r2 bucket create neetlogiq-data
   ```

4. **Create KV Namespace**:
   ```bash
   wrangler kv:namespace create "CACHE"
   wrangler kv:namespace create "CACHE" --preview
   ```

5. **Create Queue**:
   ```bash
   wrangler queues create data-sync-queue
   ```

---

### STEP 3: Upload Data to R2 (Day 1)

**Create upload script**: `scripts/upload-to-r2.js`

```javascript
const fs = require('fs');
const { exec } = require('child_process');

const files = [
  'data/colleges.parquet',
  'data/cutoffs.parquet',
  'data/courses.parquet',
];

files.forEach(file => {
  const fileName = file.split('/').pop();
  exec(`wrangler r2 object put neetlogiq-data/${fileName} --file=${file}`, (err, stdout) => {
    if (err) {
      console.error(`Error uploading ${fileName}:`, err);
      return;
    }
    console.log(`✅ Uploaded ${fileName}`);
  });
});
```

**Run:**
```bash
node scripts/upload-to-r2.js
```

---

### STEP 4: Create Worker Project Structure (Day 2)

```bash
mkdir -p workers/{colleges,cutoffs,comparison,data-sync}/src
cd workers
```

**Create base Worker**: `workers/colleges/src/index.ts`

```typescript
import { DuckDBWasm } from '@duckdb/duckdb-wasm';

interface Env {
  R2_BUCKET: R2Bucket;
  CACHE: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path === '/colleges') {
        return handleColleges(request, env, corsHeaders);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

async function handleColleges(request: Request, env: Env, corsHeaders: any) {
  const url = new URL(request.url);
  const stream = url.searchParams.get('stream') || 'UG';
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  // Try cache first
  const cacheKey = `colleges:${stream}:${limit}:${offset}`;
  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
      },
    });
  }

  // Load Parquet from R2
  const parquetFile = await env.R2_BUCKET.get('colleges.parquet');
  if (!parquetFile) {
    throw new Error('Colleges data not found');
  }

  const arrayBuffer = await parquetFile.arrayBuffer();

  // Query with DuckDB
  const db = await initDuckDB();
  await db.registerFileBuffer('colleges.parquet', new Uint8Array(arrayBuffer));

  const result = await db.query(`
    SELECT * FROM read_parquet('colleges.parquet')
    WHERE stream = ?
    ORDER BY name ASC
    LIMIT ? OFFSET ?
  `, [stream, limit, offset]);

  const json = JSON.stringify(result);

  // Cache for 1 hour
  await env.CACHE.put(cacheKey, json, { expirationTtl: 3600 });

  return new Response(json, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

let duckdbInstance: any = null;

async function initDuckDB() {
  if (duckdbInstance) return duckdbInstance;

  const DUCKDB_BUNDLES = {
    mvp: {
      mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm',
      mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js',
    },
  };

  const bundle = DUCKDB_BUNDLES.mvp;
  const logger = new ConsoleLogger();
  const worker = new Worker(bundle.mainWorker);
  const db = new AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule);
  const conn = await db.connect();

  duckdbInstance = conn;
  return conn;
}
```

**Create wrangler.toml**: `workers/colleges/wrangler.toml`

```toml
name = "neetlogiq-colleges-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "neetlogiq-data"

[[kv_namespaces]]
binding = "CACHE"
id = "YOUR_KV_ID_HERE"  # Get from: wrangler kv:namespace list
```

---

### STEP 5: Create Frontend API Client (Day 2-3)

**File**: `src/lib/api-client.ts`

```typescript
const WORKER_URLS = {
  colleges: process.env.NEXT_PUBLIC_COLLEGES_API || 'https://colleges.neetlogiq.workers.dev',
  cutoffs: process.env.NEXT_PUBLIC_CUTOFFS_API || 'https://cutoffs.neetlogiq.workers.dev',
  comparison: process.env.NEXT_PUBLIC_COMPARISON_API || 'https://comparison.neetlogiq.workers.dev',
};

export interface CollegeFilters {
  stream?: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL';
  state?: string;
  quota?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CutoffFilters {
  stream?: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL';
  quota?: string;
  category?: string;
  year?: number;
  maxRank?: number;
  limit?: number;
  offset?: number;
}

class APIClient {
  private baseURL: string;

  constructor(service: 'colleges' | 'cutoffs' | 'comparison') {
    this.baseURL = WORKER_URLS[service];
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(endpoint, this.baseURL);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
      // Enable caching in browser
      cache: 'default',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `API Error: ${response.status}`);
    }

    return response.json();
  }

  async post<T>(endpoint: string, body: any): Promise<T> {
    const url = new URL(endpoint, this.baseURL);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `API Error: ${response.status}`);
    }

    return response.json();
  }
}

// API Clients
export const collegesAPI = new APIClient('colleges');
export const cutoffsAPI = new APIClient('cutoffs');
export const comparisonAPI = new APIClient('comparison');

// Helper functions
export async function getColleges(filters: CollegeFilters) {
  return collegesAPI.get('/colleges', filters);
}

export async function getCutoffs(filters: CutoffFilters) {
  return cutoffsAPI.get('/cutoffs', filters);
}

export async function compareColleges(collegeIds: string[]) {
  return comparisonAPI.post('/compare', { collegeIds });
}
```

---

### STEP 6: Update Frontend Pages to Use Worker APIs (Day 3-4)

**Example**: `src/app/colleges/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getColleges, CollegeFilters } from '@/lib/api-client';
import { useStream } from '@/contexts/StreamContext';

export default function CollegesPage() {
  const { selectedStream } = useStream();
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CollegeFilters>({
    stream: selectedStream || 'UG',
    limit: 50,
    offset: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getColleges(filters);
        setColleges(data);
      } catch (error) {
        console.error('Failed to fetch colleges:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters]);

  // ... rest of component
}
```

---

### STEP 7: Create Data Sync Worker (Day 5)

**File**: `workers/data-sync/src/index.ts`

```typescript
interface Env {
  CACHE: KVNamespace;
  DATA_SYNC_QUEUE: Queue;
}

export default {
  // Triggered by R2 object creation
  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const { object } = message.body;

      console.log(`Data updated: ${object.key}`);

      // Determine which cache keys to invalidate
      const cachePattern = getCachePattern(object.key);

      // Clear all matching cache keys
      await clearCacheByPattern(env.CACHE, cachePattern);

      console.log(`✅ Cache cleared for pattern: ${cachePattern}`);
    }
  },
};

function getCachePattern(objectKey: string): string {
  if (objectKey.includes('colleges')) return 'colleges:';
  if (objectKey.includes('cutoffs')) return 'cutoffs:';
  if (objectKey.includes('courses')) return 'courses:';
  return '';
}

async function clearCacheByPattern(kv: KVNamespace, pattern: string) {
  const list = await kv.list({ prefix: pattern });

  for (const key of list.keys) {
    await kv.delete(key.name);
  }
}
```

**Configure R2 Event Notifications**:
```bash
wrangler r2 bucket notification create neetlogiq-data \
  --event-type object-create \
  --queue data-sync-queue
```

---

### STEP 8: Update next.config.mjs for Static Export (Day 5)

```javascript
const nextConfig = {
  output: 'export',  // ✅ Enable static export

  images: {
    unoptimized: true,
  },

  typescript: {
    ignoreBuildErrors: false,  // ✅ Re-enable type checking
  },

  // Remove webpack config - not needed anymore!
  // All queries handled by Workers
};

export default nextConfig;
```

---

### STEP 9: Deploy Everything (Day 6)

**Deploy Workers:**
```bash
cd workers/colleges
wrangler deploy

cd ../cutoffs
wrangler deploy

cd ../comparison
wrangler deploy

cd ../data-sync
wrangler deploy
```

**Deploy Frontend:**
```bash
cd ../../
npm run build
wrangler pages deploy out --project-name=neetlogiq
```

**Configure Custom Domain** (optional):
```bash
wrangler pages domains add neetlogiq neetlogiq.com
```

---

### STEP 10: Testing (Day 7)

**Test checklist:**
- [ ] Landing page loads
- [ ] Authentication works
- [ ] Stream selection appears after login
- [ ] Colleges page fetches from Worker
- [ ] Cutoffs page works with filters
- [ ] Comparison feature works
- [ ] Upload new Parquet → Cache auto-clears
- [ ] Check Cloudflare Analytics dashboard

---

## 📊 Success Metrics

After deployment, verify:
1. **Lighthouse Score**: >95
2. **First Load**: <1s
3. **API Response**: <200ms (cached)
4. **Cost**: <$1/month
5. **Uptime**: 99.9%+

---

## 🚀 Deployment Commands Reference

```bash
# One-time setup
wrangler login
wrangler r2 bucket create neetlogiq-data
wrangler kv:namespace create "CACHE"
wrangler queues create data-sync-queue

# Deploy Workers
cd workers && wrangler deploy --config colleges/wrangler.toml
cd workers && wrangler deploy --config cutoffs/wrangler.toml
cd workers && wrangler deploy --config comparison/wrangler.toml
cd workers && wrangler deploy --config data-sync/wrangler.toml

# Deploy Frontend
npm run build
wrangler pages deploy out --project-name=neetlogiq

# Upload data
node scripts/upload-to-r2.js

# View logs
wrangler tail neetlogiq-colleges-api
wrangler tail neetlogiq-cutoffs-api
```

---

## 🔍 Monitoring

**Cloudflare Dashboard**:
- Workers → Analytics (requests, errors, latency)
- R2 → Metrics (storage, bandwidth)
- KV → Metrics (reads, writes)
- Pages → Analytics (visits, bandwidth)

**Set up alerts**:
```bash
wrangler alerts create \
  --name "High Error Rate" \
  --type worker-errors \
  --threshold 100 \
  --notification-email your@email.com
```

---

## 📝 Next Steps

After this implementation:
1. Set up CI/CD with GitHub Actions
2. Add more Worker endpoints (search, recommendations)
3. Implement WebSocket for real-time updates
4. Add Cloudflare Analytics integration
5. Optimize with Cloudflare Argo (optional)

Total estimated time: **2-3 weeks**
Result: **Production-ready, self-sustaining platform**
