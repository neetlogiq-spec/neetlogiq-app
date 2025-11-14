# Self-Sustainable Architecture Setup Guide

## Overview

This guide will help you set up the **completely automated, self-sustainable architecture** for NeetLogIQ. Once configured, you'll only need to **upload new Parquet files to R2**, and the entire frontend will automatically update itself with **zero manual intervention**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR WORKFLOW (5 minutes per year)                         │
│  1. Scrape data from official sources                       │
│  2. Convert to XLSX and validate quality                    │
│  3. Convert to Parquet files                                │
│  4. Upload to Cloudflare R2                                  │
│  ✅ DONE! Everything else is automatic                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  AUTOMATED PIPELINE (30 minutes, hands-free)                │
│  1. R2 trigger detects new upload                           │
│  2. Generates updated manifest.json                         │
│  3. Invalidates all caches                                  │
│  4. Triggers GitHub Actions deployment                      │
│  5. Builds Next.js with new data                            │
│  6. Deploys to Cloudflare Pages                             │
│  7. Sends you Telegram notification ✅                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

1. **Cloudflare Account** (free tier is sufficient)
2. **GitHub Account** (free)
3. **Telegram Account** (optional, for notifications)

---

## Step 1: Cloudflare Setup

### 1.1 Create R2 Bucket

```bash
# Login to Cloudflare
wrangler login

# Create R2 bucket
wrangler r2 bucket create neetlogiq-data

# Verify
wrangler r2 bucket list
```

### 1.2 Deploy R2 Upload Trigger Worker

```bash
# Navigate to workers directory
cd workers

# Deploy the worker
wrangler deploy r2-upload-trigger.js --name r2-upload-trigger

# Configure environment variables
wrangler secret put GITHUB_TOKEN --name r2-upload-trigger
wrangler secret put TELEGRAM_BOT_TOKEN --name r2-upload-trigger
wrangler secret put TELEGRAM_CHAT_ID --name r2-upload-trigger

# Bind R2 bucket
wrangler r2 bucket bind neetlogiq-data --name R2_BUCKET

# Bind KV namespace
wrangler kv:namespace create "KV_NAMESPACE"
wrangler kv:namespace bind KV_NAMESPACE --name KV_NAMESPACE
```

### 1.3 Configure R2 Event Notifications

In Cloudflare Dashboard:
1. Go to R2 → `neetlogiq-data` bucket
2. Click "Settings" → "Event Notifications"
3. Add notification:
   - **Event types**: `Object Created`
   - **Prefix**: `data/parquet/`
   - **Worker**: Select `r2-upload-trigger`

---

## Step 2: GitHub Setup

### 2.1 Add Repository Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | Dashboard → Account → Account ID |
| `CLOUDFLARE_API_TOKEN` | API token with R2 and Pages permissions | Dashboard → API Tokens → Create Token |
| `R2_BUCKET_NAME` | Name of your R2 bucket | `neetlogiq-data` |
| `CLOUDFLARE_ZONE_ID` | Your domain zone ID (if using custom domain) | Dashboard → Domain → Zone ID |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | Talk to @BotFather on Telegram |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID | Send message to bot, check updates |

### 2.2 Create Telegram Bot (Optional but Recommended)

```bash
# 1. Open Telegram and search for @BotFather
# 2. Send: /newbot
# 3. Follow prompts to create bot
# 4. Copy the token (looks like: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)

# Get your chat ID:
# 1. Send a message to your bot
# 2. Visit: https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
# 3. Look for "chat":{"id":123456789}
# 4. Copy the chat ID
```

### 2.3 Enable GitHub Actions

The workflow file is already created at `.github/workflows/auto-deploy-on-data-update.yml`.

Ensure GitHub Actions is enabled:
1. Go to repository → Actions
2. Enable workflows if prompted
3. Workflow will run automatically on R2 uploads

---

## Step 3: Local Development Setup

### 3.1 Install Dependencies

```bash
pnpm install
```

### 3.2 Update package.json Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "generate:metadata": "node scripts/generate-static-metadata.js",
    "upload:r2": "wrangler r2 object put neetlogiq-data/data/parquet/",
    "test:automation": "node scripts/test-automation.js"
  }
}
```

---

## Step 4: Data Upload Workflow

### 4.1 Prepare Your Data

Ensure your Parquet files follow this naming convention:

```
{STREAM}_{YEAR}_R{ROUND}.parquet

Examples:
- UG_2024_R1.parquet
- UG_2024_R2.parquet
- PG_MEDICAL_2024_R1.parquet
- PG_DENTAL_2024_R1.parquet
```

### 4.2 Upload to R2

**Option A: Using Wrangler CLI**

```bash
# Upload single file
wrangler r2 object put neetlogiq-data/data/parquet/UG_2025_R1.parquet --file ./data/parquet/UG_2025_R1.parquet

# Upload all files in directory
for file in data/parquet/*.parquet; do
  wrangler r2 object put neetlogiq-data/data/parquet/$(basename $file) --file $file
done
```

**Option B: Using Cloudflare Dashboard**

1. Go to R2 → `neetlogiq-data`
2. Navigate to `data/parquet/` folder
3. Click "Upload"
4. Select your Parquet files
5. Upload

**Option C: Automated Script**

```bash
# Create upload script
cat > scripts/upload-to-r2.sh << 'EOF'
#!/bin/bash

PARQUET_DIR="./data/parquet"
R2_BUCKET="neetlogiq-data"
R2_PREFIX="data/parquet"

echo "📤 Uploading Parquet files to R2..."

for file in "$PARQUET_DIR"/*.parquet; do
  filename=$(basename "$file")
  echo "Uploading $filename..."

  wrangler r2 object put "$R2_BUCKET/$R2_PREFIX/$filename" --file "$file"

  if [ $? -eq 0 ]; then
    echo "✅ $filename uploaded successfully"
  else
    echo "❌ Failed to upload $filename"
  fi
done

echo "🎉 Upload complete!"
EOF

chmod +x scripts/upload-to-r2.sh

# Run the script
./scripts/upload-to-r2.sh
```

---

## Step 5: Verify Automation

### 5.1 Check Worker Execution

After uploading to R2:

```bash
# Monitor worker logs
wrangler tail r2-upload-trigger

# You should see:
# - R2 Upload detected
# - File analysis
# - Manifest generation
# - Cache invalidation
# - Deployment trigger
```

### 5.2 Check GitHub Actions

1. Go to repository → Actions
2. Look for workflow run: "Auto Deploy on Data Update"
3. Monitor progress (should take 5-10 minutes)

### 5.3 Check Telegram Notification

You should receive messages like:

```
✅ Data Update Complete

✅ File Analysis: completed
   Details: { streams: ["UG"], years: [2025] }

✅ Manifest Generation: completed
   Details: { version: "2025.01.08", totalFiles: 12 }

✅ Cache Invalidation: completed
   Details: { invalidatedKeys: 45, newCacheVersion: "123" }

✅ Deployment Trigger: completed
   Details: { workflow: "deploy.yml", triggered: true }

🕐 Time: 2025-01-08T10:30:00Z
```

Then after deployment:

```
🎉 Deployment Successful

📦 Version: 2025.01.08
🚀 Deployed to: https://neetlogiq.pages.dev
⏰ Time: 2025-01-08 10:45:32 UTC
🔗 Commit: abc123def456
```

---

## Step 6: Frontend Integration

### 6.1 Update Cutoffs Page to Use ID-Based Data

Replace your cutoffs page with the new ID-based approach:

```typescript
// src/app/cutoffs/page.tsx
'use client';

import { useIdBasedData } from '@/hooks/useIdBasedData';
import { useAvailableYears, useAvailableRounds } from '@/hooks/useConfigMetadata';

export default function CutoffsPage() {
  const { years } = useAvailableYears();
  const [selectedYear, setSelectedYear] = useState(years[0]);
  const { rounds } = useAvailableRounds(selectedYear);
  const [selectedRound, setSelectedRound] = useState(1);

  const { data, loading, error } = useIdBasedData({
    stream: 'UG',
    year: selectedYear,
    round: selectedRound
  });

  return (
    <div>
      {/* Year selector - automatically populated from data */}
      <select onChange={(e) => setSelectedYear(Number(e.target.value))}>
        {years.map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>

      {/* Round selector - automatically populated based on selected year */}
      <select onChange={(e) => setSelectedRound(Number(e.target.value))}>
        {rounds.map(round => (
          <option key={round} value={round}>Round {round}</option>
        ))}
      </select>

      {/* Data table - shows master data names with linked cutoffs */}
      {data.map(cutoff => (
        <div key={`${cutoff.college_id}-${cutoff.course_id}`}>
          <h3>{cutoff.college_name}</h3> {/* Master data name */}
          <p>{cutoff.course_name}</p> {/* Master data name */}
          <p>Closing Rank: {cutoff.closing_rank}</p> {/* Cutoff data */}
        </div>
      ))}
    </div>
  );
}
```

### 6.2 Add Update Notification Component

```typescript
// src/components/UpdateNotification.tsx
'use client';

import { useDataVersionCheck } from '@/hooks/useConfigMetadata';

export function UpdateNotification() {
  const { hasUpdates, latestVersion, updateNow } = useDataVersionCheck();

  if (!hasUpdates) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg">
      <p>🎉 New data available (v{latestVersion})</p>
      <button
        onClick={updateNow}
        className="mt-2 bg-white text-blue-500 px-4 py-2 rounded"
      >
        Update Now
      </button>
    </div>
  );
}
```

Add to your layout:

```typescript
// src/app/layout.tsx
import { UpdateNotification } from '@/components/UpdateNotification';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <UpdateNotification />
      </body>
    </html>
  );
}
```

---

## Step 7: Testing

### 7.1 Test the Complete Flow

```bash
# 1. Create test Parquet file
# (Assume you have test_2025_R1.parquet)

# 2. Upload to R2
wrangler r2 object put neetlogiq-data/data/parquet/UG_2025_R1.parquet --file ./test_2025_R1.parquet

# 3. Watch worker logs
wrangler tail r2-upload-trigger

# 4. Check GitHub Actions
# Visit: https://github.com/YOUR_USERNAME/YOUR_REPO/actions

# 5. Wait for Telegram notification

# 6. Verify deployment
curl https://neetlogiq.pages.dev/data/manifest.json
```

### 7.2 Verify Data is Displayed

```bash
# Check that 2025 appears in years dropdown
curl https://neetlogiq.pages.dev/data/metadata/available-years.json

# Should show:
# { "years": [2025, 2024, 2023], "latest": 2025, ... }
```

---

## Your Yearly Workflow

Once everything is set up, your **annual workflow** is:

### As a Busy Doctor 👨‍⚕️

```
1. When NEET results are announced:
   - Open your scraping script (you already have this)
   - Download data from official website
   - Convert to XLSX
   - Validate data quality (manual check)
   - Run: npm run convert:parquet
   - Run: ./scripts/upload-to-r2.sh
   - ✅ DONE! (5-10 minutes)

2. Wait 30 minutes:
   - ☕ Grab coffee
   - 📱 Receive Telegram: "✅ Data Update Complete"
   - 📱 Receive Telegram: "🎉 Deployment Successful"

3. Verify (optional):
   - Visit: https://neetlogiq.pages.dev
   - Check that 2025 data is visible
   - ✅ Everything works!

4. Return to saving lives 👨‍⚕️
```

**Total time investment per year: 5-10 minutes**

---

## Troubleshooting

### Problem: Worker not triggering

```bash
# Check R2 event notification configuration
# Dashboard → R2 → neetlogiq-data → Settings → Event Notifications

# Verify worker is deployed
wrangler deployments list --name r2-upload-trigger

# Check worker logs
wrangler tail r2-upload-trigger
```

### Problem: GitHub Actions failing

```bash
# Check secrets are set correctly
# Repository → Settings → Secrets

# Manually trigger workflow
# Repository → Actions → Auto Deploy → Run workflow

# Check logs for errors
```

### Problem: No Telegram notifications

```bash
# Test bot token
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"

# Test sending message
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage" \
  -d "chat_id=<YOUR_CHAT_ID>" \
  -d "text=Test message"
```

### Problem: Old data still showing

```bash
# Clear all caches manually
# Visit: https://neetlogiq.pages.dev?clearCache=true

# Or clear Cloudflare cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -d '{"purge_everything":true}'
```

---

## Cost Breakdown

With this architecture, your monthly costs are:

| Service | Free Tier | Expected Usage | Monthly Cost |
|---------|-----------|----------------|--------------|
| Cloudflare Pages | Unlimited requests | 100% | $0 |
| Cloudflare Workers | 100K req/day | <5K/day | $0 |
| Cloudflare R2 | 10GB storage | 2-3GB | $0 |
| Cloudflare KV | 100K reads/day | 10K/day | $0 |
| GitHub Actions | 2,000 min/month | 50 min/month | $0 |
| **TOTAL** | | | **$0/month** |

Even with 10x traffic (50K daily users), costs would be ~$5-10/month.

---

## Maintenance

**Required maintenance: ZERO**

The system is fully self-sustaining. You only need to:
1. Upload new data once per year
2. Verify deployment succeeded (via Telegram)

**Optional monitoring:**
- Check GitHub Actions dashboard monthly
- Review Cloudflare Analytics quarterly
- Update dependencies annually (automated with Dependabot)

---

## Summary

✅ **What You Built:**
- Fully automated data-to-deployment pipeline
- Zero manual frontend updates needed
- ID-based data linking for quality
- Multi-layer caching for performance
- Cost: $0/month (free tier)

✅ **Your Workflow:**
1. Upload Parquet files to R2 (5 minutes)
2. Wait for Telegram notification (30 minutes)
3. Done!

✅ **Time Saved:**
- Previous workflow: 20-30 hours per year
- New workflow: 10 minutes per year
- **Savings: 99.5% time reduction**

Now you can focus on what matters: **saving lives as a doctor!** 👨‍⚕️

---

## Support

If you encounter issues:
1. Check worker logs: `wrangler tail r2-upload-trigger`
2. Check GitHub Actions logs
3. Review Telegram notifications for error details
4. Refer to troubleshooting section above

---

*Last Updated: 2025-01-08*
