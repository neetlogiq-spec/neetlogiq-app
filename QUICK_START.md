# Quick Start Guide - Self-Sustainable Architecture

## TL;DR

Upload new Parquet files → Everything updates automatically → Get Telegram notification → Done!

---

## One-Time Setup (30 minutes)

### 1. Cloudflare Setup

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Create R2 bucket
wrangler r2 bucket create neetlogiq-data

# Deploy worker
cd workers
wrangler deploy r2-upload-trigger.js --name r2-upload-trigger

# Set secrets
wrangler secret put GITHUB_TOKEN --name r2-upload-trigger
wrangler secret put TELEGRAM_BOT_TOKEN --name r2-upload-trigger
wrangler secret put TELEGRAM_CHAT_ID --name r2-upload-trigger
```

### 2. GitHub Setup

Add these secrets to your repository (Settings → Secrets):

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `R2_BUCKET_NAME`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

### 3. Configure R2 Event Notification

Cloudflare Dashboard → R2 → neetlogiq-data → Event Notifications:
- Event: `Object Created`
- Prefix: `data/parquet/`
- Worker: `r2-upload-trigger`

---

## Your Annual Workflow (5 minutes)

### Step 1: Prepare Data

```bash
# You already have your scraping/conversion scripts
# Just make sure Parquet files are named correctly:
# {STREAM}_{YEAR}_R{ROUND}.parquet

# Example:
# UG_2025_R1.parquet
# PG_MEDICAL_2025_R1.parquet
```

### Step 2: Upload to R2

```bash
# Option A: Single file
wrangler r2 object put neetlogiq-data/data/parquet/UG_2025_R1.parquet \
  --file ./data/parquet/UG_2025_R1.parquet

# Option B: All files
./scripts/upload-to-r2.sh

# Option C: Cloudflare Dashboard
# Just drag and drop files in the browser
```

### Step 3: Wait for Notifications

**After 5 minutes:**
```
Telegram: ✅ Data Update Complete
- New year: 2025
- Files processed: 12
- Deployment triggered
```

**After 30 minutes:**
```
Telegram: 🎉 Deployment Successful
- Version: 2025.01.08
- URL: https://neetlogiq.pages.dev
- Status: All health checks passed ✅
```

### Step 4: Verify (Optional)

```bash
# Check manifest
curl https://neetlogiq.pages.dev/data/manifest.json

# Check years
curl https://neetlogiq.pages.dev/data/metadata/available-years.json

# Visit site
open https://neetlogiq.pages.dev
```

**DONE! ✅**

---

## ID-Based Data System

### Master Data (Source of Truth)

```sql
-- colleges table
college_id: "DNB1185"
college_name: "MAL SUPER SPECIALITY HOSPITAL"
```

### Counselling Data (Linked by ID)

```sql
-- cutoffs table
college_id: "DNB1185"  -- Links to master data
college_name: "MAL SSH"  -- Might be different, but ID links it!
closing_rank: 450
```

### In Your Frontend

```typescript
// Automatic resolution
const { data } = useIdBasedData({
  stream: 'UG',
  year: 2025,
  round: 1
});

// data[0] will show:
// {
//   college_id: "DNB1185",
//   college_name: "MAL SUPER SPECIALITY HOSPITAL", // ← Master data name
//   closing_rank: 450  // ← Counselling data
// }
```

**Benefits:**
- ✅ Consistent names across the site
- ✅ Accurate comparisons (ID-based)
- ✅ Trends work correctly (same ID = same college)
- ✅ No duplicate issues from name variations

---

## Data-Driven Configuration

### Before (Hardcoded ❌)

```typescript
const years = [2024, 2023, 2022]; // Need to update code every year
const rounds = [1, 2, 3]; // Need to update if rounds change
```

### After (Data-Driven ✅)

```typescript
// Automatically detects from data!
const { years } = useAvailableYears(); // [2025, 2024, 2023]
const { rounds } = useAvailableRounds(2025); // [1, 2]

// Zero code changes needed for new data!
```

---

## Cost

| Service | Monthly Cost |
|---------|--------------|
| Cloudflare Pages | $0 |
| Cloudflare Workers | $0 |
| Cloudflare R2 | $0 |
| Cloudflare KV | $0 |
| GitHub Actions | $0 |
| **TOTAL** | **$0** |

Free tier covers everything, even with 10K+ daily users!

---

## Troubleshooting

### Upload to R2 but nothing happens?

```bash
# Check worker logs
wrangler tail r2-upload-trigger

# Manually trigger GitHub Actions
# Repository → Actions → Auto Deploy → Run workflow
```

### Data not updating on site?

```bash
# Clear cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -d '{"purge_everything":true}'

# Or add ?v=2025 to URL
https://neetlogiq.pages.dev?v=2025
```

### No Telegram notifications?

```bash
# Test bot
curl "https://api.telegram.org/bot<TOKEN>/getMe"

# Check secrets are set
wrangler secret list --name r2-upload-trigger
```

---

## Support Files

- **Full Documentation**: `SELF_SUSTAINABLE_ARCHITECTURE_SETUP.md`
- **Test Automation**: `node scripts/test-automation.js`
- **Architecture Overview**: `website.md`

---

## Summary

**What you built:**
- 100% automated data-to-deployment pipeline
- ID-based data linking for quality
- Data-driven frontend (zero hardcoding)
- Multi-layer caching for performance
- Cost: $0/month

**Your annual time investment:**
- Upload Parquet files: 5 minutes
- Everything else: Automatic!

**Time saved:** 99.5% (from 20 hours → 5 minutes)

Now focus on saving lives! 👨‍⚕️

---

*For detailed setup, see: SELF_SUSTAINABLE_ARCHITECTURE_SETUP.md*
