# Automation Guide - Self-Sustaining Updates

## 🎯 Overview

Your NeetLogIQ platform is **completely self-sustaining**. When you upload new Parquet files, everything updates automatically with **zero manual intervention**.

---

## 🔄 How It Works

### **The Magic Flow:**

```
┌─────────────────────────────────────────────────────────┐
│ 1. You Upload New Cutoffs                               │
│    $ node scripts/upload-to-r2.js data/cutoffs.parquet │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│ 2. R2 Detects Upload (automatic)                        │
│    • File: data/cutoffs.parquet                         │
│    • Event: PutObject                                   │
│    • Timestamp: 2024-01-15 10:30:00                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│ 3. R2 → Queue (automatic, ~2 seconds)                   │
│    • Sends event to data-sync-queue                     │
│    • Includes object metadata                           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│ 4. data-sync Worker Activates (automatic, ~3 seconds)   │
│    • Receives event from queue                          │
│    • Detects "cutoffs" in filename                      │
│    • Determines cache pattern: "cutoffs:*"              │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Cache Clearing (automatic, ~5 seconds)               │
│    • Scans KV for keys matching "cutoffs:*"             │
│    • Deletes all matching entries                       │
│    • Updates data-version timestamp                     │
│    • Logs: "✅ Cleared 47 cache entries"                │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Users Get Fresh Data (immediate)                     │
│    • Next API request = cache MISS                      │
│    • Worker loads fresh Parquet from R2                 │
│    • Caches result for future requests                  │
│    • User sees updated cutoffs!                         │
└─────────────────────────────────────────────────────────┘
```

**Total time from upload to live data: ~10-15 seconds**

---

## 📤 Upload Commands

### **Upload All Data Files:**
```bash
node scripts/upload-to-r2.js
```

Uploads:
- `data/colleges.parquet`
- `data/cutoffs.parquet`
- `data/courses.parquet`

### **Upload Specific File:**
```bash
node scripts/upload-to-r2.js data/cutoffs.parquet
```

### **Upload Multiple Specific Files:**
```bash
node scripts/upload-to-r2.js data/cutoffs.parquet data/courses.parquet
```

---

## 🔍 Monitoring & Verification

### **1. Watch Upload Progress:**
```bash
node scripts/upload-to-r2.js
```

Output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 Uploading files to Cloudflare R2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bucket: neetlogiq-data
Files: 1

[1/1] Processing: data/cutoffs.parquet
   📊 Size: 28.45 MB
   ⬆️  Uploading to data/cutoffs.parquet...
   ✅ Upload complete
   🔔 R2 event triggered → Queue → data-sync Worker
   🗑️  Cache will clear automatically in ~10-15 seconds

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Uploaded: 1
⚠️  Skipped: 0
❌ Errors: 0

🎉 Success!
```

### **2. Monitor data-sync Worker:**
```bash
wrangler tail neetlogiq-data-sync
```

Output:
```
2024-01-15 10:30:05 📦 Processing 1 R2 events...
2024-01-15 10:30:05 🔔 Event: PutObject on data/cutoffs.parquet
2024-01-15 10:30:05 🗑️  Clearing cache for: data/cutoffs.parquet
2024-01-15 10:30:06    ✓ Cleared 47 keys matching "cutoffs:"
2024-01-15 10:30:06 ✅ Total cleared: 47 cache entries
2024-01-15 10:30:06 📱 Updated data version for frontend notifications
2024-01-15 10:30:06 ✅ Batch processing complete
```

### **3. Monitor API Worker (see cache MISS → HIT):**
```bash
wrangler tail neetlogiq-cutoffs-api
```

First request after upload (cache MISS):
```
2024-01-15 10:30:20 GET /cutoffs?stream=UG&limit=50
2024-01-15 10:30:20 Cache key: cutoffs:{"stream":"UG","limit":50}
2024-01-15 10:30:20 Cache: MISS (cache was cleared)
2024-01-15 10:30:20 Loading from R2: data/cutoffs.parquet
2024-01-15 10:30:21 Query complete: 50 results
2024-01-15 10:30:21 Caching for 1 hour
2024-01-15 10:30:21 Response: 200 OK (X-Cache: MISS)
```

Second request (cache HIT):
```
2024-01-15 10:30:25 GET /cutoffs?stream=UG&limit=50
2024-01-15 10:30:25 Cache key: cutoffs:{"stream":"UG","limit":50}
2024-01-15 10:30:25 Cache: HIT
2024-01-15 10:30:25 Response: 200 OK (X-Cache: HIT) - 45ms
```

### **4. Check Queue Status:**
```bash
wrangler queues consumer list data-sync-queue
```

---

## 🧪 Testing the Automation

### **Test 1: Full Flow Test**

```bash
# 1. Make a small change to your Parquet file
# (or just re-upload the same file for testing)
node scripts/upload-to-r2.js data/cutoffs.parquet

# 2. In another terminal, watch the Worker logs
wrangler tail neetlogiq-data-sync

# 3. Wait ~10-15 seconds

# 4. Check that cache was cleared
# You should see: "✅ Total cleared: X cache entries"

# 5. Make an API request (use curl or browser)
curl https://cutoffs.neetlogiq.workers.dev/cutoffs?stream=UG

# 6. Check response headers
# First request: X-Cache: MISS
# Second request: X-Cache: HIT
```

### **Test 2: Manual Cache Clear (for testing)**

```bash
# Clear cache manually via data-sync Worker endpoint
curl -X POST https://neetlogiq-data-sync.workers.dev/clear-cache \
  -H "Content-Type: application/json" \
  -d '{"pattern":"cutoffs:"}'

# Response:
# {"success":true,"cleared":47,"pattern":"cutoffs:"}
```

### **Test 3: Check Data Version (for frontend notifications)**

```bash
# Get current data version
wrangler kv:key get --namespace-id=YOUR_KV_ID "data-version"

# Response: 1737028805000 (timestamp)
```

---

## 🎯 Cache Invalidation Rules

The data-sync Worker automatically determines which cache to clear based on filename:

| File Uploaded | Cache Keys Cleared | Reason |
|---------------|-------------------|---------|
| `colleges.parquet` | `colleges:*`, `search:*` | Colleges data + search results |
| `cutoffs.parquet` | `cutoffs:*` | Cutoffs data only |
| `courses.parquet` | `courses:*`, `search:*` | Courses data + search results |
| Unknown file | All caches | Safety fallback |

**Smart clearing** means:
- ✅ Uploading cutoffs doesn't clear college cache
- ✅ Uploading colleges doesn't clear cutoff cache
- ✅ Only relevant data is refreshed
- ✅ Unrelated cached data stays cached (faster responses)

---

## 📱 Frontend Notification (Optional Enhancement)

### **Current Behavior:**
- Users on the site won't see updates until they refresh
- New visitors automatically get fresh data

### **Add Real-Time Notifications:**

```typescript
// src/hooks/useDataVersion.ts
import { useEffect, useState } from 'react';

export function useDataVersion() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch('https://api.neetlogiq.com/version');
        const serverVersion = await response.text();
        const localVersion = localStorage.getItem('dataVersion');

        if (localVersion && serverVersion !== localVersion) {
          setUpdateAvailable(true);
        }

        localStorage.setItem('dataVersion', serverVersion);
      } catch (error) {
        console.error('Failed to check version:', error);
      }
    };

    // Check every 5 minutes
    checkVersion();
    const interval = setInterval(checkVersion, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return { updateAvailable };
}

// Usage in layout:
const { updateAvailable } = useDataVersion();

{updateAvailable && (
  <div className="fixed top-0 inset-x-0 bg-blue-600 text-white p-3 text-center">
    New cutoffs available!{' '}
    <button onClick={() => window.location.reload()} className="underline">
      Refresh to see updates
    </button>
  </div>
)}
```

---

## 🚨 Troubleshooting

### **Issue: Cache not clearing after upload**

**Check 1: Is R2 event notification configured?**
```bash
wrangler r2 bucket notification list neetlogiq-data
```

Expected output:
```
Queue: data-sync-queue
Events: object-create
```

**Fix:**
```bash
wrangler r2 bucket notification create neetlogiq-data \
  --event-type object-create \
  --queue data-sync-queue
```

---

### **Issue: data-sync Worker not receiving events**

**Check 1: Is Worker deployed?**
```bash
wrangler deployments list --name=neetlogiq-data-sync
```

**Check 2: Are there messages in queue?**
```bash
wrangler queues consumer list data-sync-queue
```

**Fix:**
```bash
cd workers/data-sync
wrangler deploy
```

---

### **Issue: Cache cleared but API still returns old data**

**Possible cause:** Worker is reading from wrong R2 version

**Check:** R2 versioning
```bash
wrangler r2 object get neetlogiq-data/data/cutoffs.parquet --version
```

**Fix:** Ensure Workers use latest version (they do by default)

---

## 📊 Monitoring Dashboard

### **Create a simple dashboard** (optional):

```bash
# Get cache stats
curl https://neetlogiq-data-sync.workers.dev/stats

# Response:
{
  "colleges:": 23,
  "cutoffs:": 47,
  "courses:": 15,
  "search:": 12,
  "total": 97,
  "lastUpdate": "2024-01-15T10:30:06Z"
}
```

---

## ✅ Summary

**What you do:**
```bash
node scripts/upload-to-r2.js data/cutoffs.parquet
```

**What happens automatically:**
1. ✅ R2 detects upload
2. ✅ Queue receives event
3. ✅ Worker clears cache
4. ✅ Users get fresh data
5. ✅ New cache builds

**Time:** 10-15 seconds
**Manual steps:** 0
**Cost:** $0 (within free tier)
**Maintenance:** None

---

## 🎉 You're All Set!

Your platform is now **fully self-sustaining**. Just upload new data and everything updates automatically!

Need help? Check the logs:
```bash
wrangler tail neetlogiq-data-sync
wrangler tail neetlogiq-cutoffs-api
```
