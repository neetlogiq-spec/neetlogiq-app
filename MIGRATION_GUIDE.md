# 🚀 Migration Guide: Firebase → Supabase + Hostinger VPS

## Overview

This guide will help you migrate from the current Cloudflare + Firebase architecture to a Hostinger VPS + Supabase + Cloudflare CDN hybrid setup.

**Estimated Timeline:** 2-3 weeks
**Downtime Required:** Minimal (can run both in parallel)

---

## 📋 Prerequisites

### Required Services
- [ ] Hostinger VPS (2 vCPU, 8GB RAM, 100GB NVMe) - ~₹800/month
- [ ] Domain name (if not already owned)
- [ ] Cloudflare account (Free tier is sufficient)
- [ ] GitHub account (for Coolify deployments)

### Required Tools
- [ ] SSH client
- [ ] Git
- [ ] Node.js 18+ and npm
- [ ] PostgreSQL client (optional, for local testing)

---

## Phase 1: VPS Setup (Week 1, Days 1-2)

### Step 1: Purchase and Access VPS

1. **Purchase Hostinger VPS:**
   ```
   - Go to hostinger.com/vps-hosting
   - Choose VPS 2: 2 vCPU, 8GB RAM, 100GB NVMe
   - Select Mumbai or Singapore datacenter (for Indian users)
   - Complete purchase
   ```

2. **Access VPS via SSH:**
   ```bash
   ssh root@your-vps-ip
   # Use password provided by Hostinger
   ```

3. **Update System:**
   ```bash
   apt update && apt upgrade -y
   ```

4. **Create Non-Root User:**
   ```bash
   adduser deploy
   usermod -aG sudo deploy

   # Setup SSH for deploy user
   mkdir -p /home/deploy/.ssh
   cp ~/.ssh/authorized_keys /home/deploy/.ssh/
   chown -R deploy:deploy /home/deploy/.ssh
   chmod 700 /home/deploy/.ssh
   chmod 600 /home/deploy/.ssh/authorized_keys

   # Switch to deploy user
   su - deploy
   ```

5. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER

   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose

   # Logout and login again for group changes to take effect
   exit
   su - deploy
   ```

6. **Configure Firewall:**
   ```bash
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp   # HTTPS
   sudo ufw allow 8000/tcp  # Coolify UI
   sudo ufw enable
   ```

---

## Phase 2: Coolify Installation (Week 1, Day 3)

### Step 1: Install Coolify

```bash
curl -fsSL https://get.coollabs.io/coolify/install.sh | bash
```

### Step 2: Access Coolify

1. Open browser: `https://your-vps-ip:8000`
2. Create admin account
3. Setup complete!

### Step 3: Configure Coolify

1. **Add GitHub Integration:**
   - Settings → GitHub → Connect
   - Authorize Coolify to access your repositories

2. **Setup Domain:**
   - Settings → Domains
   - Add your domain (e.g., neetcounseling.com)
   - Coolify will auto-configure SSL via Let's Encrypt

---

## Phase 3: Supabase Self-Hosted Setup (Week 1, Days 4-5)

### Step 1: Clone Supabase

```bash
cd /home/deploy
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
```

### Step 2: Configure Environment

```bash
cp .env.example .env
nano .env
```

**Edit the following variables:**

```env
############
# Secrets
############
POSTGRES_PASSWORD=your_super_secret_postgres_password
JWT_SECRET=your_super_secret_jwt_token_with_at_least_32_characters_long
ANON_KEY=generate_using_script_below
SERVICE_ROLE_KEY=generate_using_script_below

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# API
############
API_EXTERNAL_URL=https://api.your-domain.com
SUPABASE_PUBLIC_URL=https://supabase.your-domain.com

############
# Auth
############
SITE_URL=https://your-domain.com
ADDITIONAL_REDIRECT_URLS=
DISABLE_SIGNUP=false

# Google OAuth (get from Google Cloud Console)
SUPABASE_AUTH_GOOGLE_CLIENT_ID=your_google_client_id
SUPABASE_AUTH_GOOGLE_SECRET=your_google_client_secret

############
# Email (SendGrid)
############
SMTP_ADMIN_EMAIL=admin@your-domain.com
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
```

### Step 3: Generate JWT Keys

```bash
# Install Supabase CLI
npm install -g supabase

# Generate keys
supabase init
supabase gen keys

# Copy ANON_KEY and SERVICE_ROLE_KEY to .env
```

### Step 4: Start Supabase

```bash
docker-compose up -d

# Wait for all services to start (2-3 minutes)
docker-compose ps

# You should see all services running:
# - db (PostgreSQL)
# - auth (GoTrue)
# - rest (PostgREST)
# - realtime
# - storage
# - meta (Supabase Studio)
```

### Step 5: Access Supabase Studio

1. Open: `https://your-vps-ip:3000` or `https://supabase.your-domain.com`
2. Default credentials: Check `.env` file

---

## Phase 4: Database Migration (Week 1-2, Days 6-10)

### Step 1: Run SQL Migration

1. Access Supabase Studio
2. Go to SQL Editor
3. Copy contents of `/home/user/New/supabase/migrations/001_initial_schema.sql`
4. Run the migration
5. Verify all tables are created

### Step 2: Export SQLite Data

```bash
cd /home/user/New

# Install dependencies
npm install

# Run export script (create this)
npm run export:sqlite

# This will create:
# - exports/colleges.json
# - exports/courses.json
# - exports/cutoffs.json
```

### Step 3: Import to PostgreSQL

```bash
# Run import script
npm run import:postgres

# Verify import
psql -h your-vps-ip -U postgres -d neet_counseling -c "SELECT COUNT(*) FROM colleges;"
# Should return 2442

psql -h your-vps-ip -U postgres -d neet_counseling -c "SELECT COUNT(*) FROM cutoffs;"
# Should return 16284
```

---

## Phase 5: Application Deployment (Week 2, Days 11-14)

### Step 1: Update Environment Variables

Create `.env.production`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://supabase.your-domain.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database
DATABASE_URL=postgresql://postgres:password@db:5432/neet_counseling

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Razorpay (get from razorpay.com dashboard)
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret

# SendGrid (optional for emails)
SENDGRID_API_KEY=SG.xxxxx

# Twilio (optional for SMS)
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=your_twilio_token
```

### Step 2: Deploy via Coolify

1. In Coolify Dashboard:
   - Click "New Resource" → "Application"
   - Source: GitHub → Select your repository
   - Branch: `main` or `production`
   - Build Pack: Next.js
   - Port: 3000

2. Add Environment Variables:
   - Paste all variables from `.env.production`

3. Deploy:
   - Click "Deploy"
   - Wait for build to complete (5-10 minutes)
   - Coolify will auto-deploy on every git push

### Step 3: Configure Nginx (Automatic with Coolify)

Coolify automatically creates Nginx config, but you can customize:

```nginx
# /etc/nginx/sites-available/your-domain.com
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL (Auto-configured by Coolify/Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Proxy to Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Supabase endpoints
    location /supabase/ {
        proxy_pass http://localhost:8000/;
    }
}
```

---

## Phase 6: Cloudflare CDN Setup (Week 2, Day 15)

### Step 1: Add Domain to Cloudflare

1. Login to Cloudflare
2. Add Site → Enter your domain
3. Copy nameservers provided

### Step 2: Update DNS at Domain Registrar

1. Go to your domain registrar (e.g., GoDaddy, Namecheap)
2. Change nameservers to Cloudflare's:
   ```
   ns1.cloudflare.com
   ns2.cloudflare.com
   ```
3. Wait for propagation (up to 24 hours)

### Step 3: Configure DNS in Cloudflare

```
Type    Name    Content             Proxy Status
A       @       your-vps-ip         Proxied (orange cloud)
A       www     your-vps-ip         Proxied
CNAME   api     your-domain.com     Proxied
CNAME   supabase your-vps-ip        DNS Only (gray cloud)
```

### Step 4: Configure Cloudflare Settings

**SSL/TLS:**
- Mode: Full (Strict)
- Always Use HTTPS: On
- Minimum TLS Version: 1.2

**Caching:**
- Caching Level: Standard
- Browser Cache TTL: 4 hours

**Page Rules** (Create 3 rules):

1. **Static Assets:**
   ```
   URL: *your-domain.com/_next/static/*
   Settings:
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 year
   - Browser Cache TTL: 1 year
   ```

2. **API with Caching:**
   ```
   URL: *your-domain.com/api/colleges*
   Settings:
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 hour
   ```

3. **Dynamic API:**
   ```
   URL: *your-domain.com/api/user/*
   Settings:
   - Cache Level: Bypass
   ```

---

## Phase 7: Code Migration (Week 2-3, Days 16-20)

### Step 1: Install Dependencies

```bash
cd /home/user/New

npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm uninstall firebase  # Remove Firebase

# Update package.json scripts
```

### Step 2: Replace AuthContext

```bash
# Backup old AuthContext
mv src/contexts/AuthContext.tsx src/contexts/AuthContext.firebase.tsx

# Rename new AuthContext
mv src/contexts/AuthContext.supabase.tsx src/contexts/AuthContext.tsx
```

### Step 3: Update Components

Files to update (already created in this session):
- ✅ `src/lib/supabase.ts` - Supabase client
- ✅ `src/lib/database.types.ts` - Type definitions
- ✅ `src/lib/subscription-plans.ts` - Subscription tiers
- ✅ `src/contexts/AuthContext.tsx` - Auth with Supabase
- ✅ `src/app/auth/callback/route.ts` - OAuth callback

### Step 4: Test Locally

```bash
# Set env variables
cp .env.example .env.local
# Add your Supabase credentials

# Run dev server
npm run dev

# Test:
# - Google OAuth login
# - Database queries
# - Subscriptions
```

---

## Phase 8: Go Live (Week 3, Days 21-23)

### Step 1: Final Checklist

- [ ] All data migrated to PostgreSQL
- [ ] Google OAuth configured in Supabase
- [ ] SSL certificates active
- [ ] Cloudflare CDN caching configured
- [ ] Environment variables set in Coolify
- [ ] Backup strategy in place

### Step 2: Deployment

```bash
# Push to production branch
git checkout -b production
git push origin production

# Coolify will auto-deploy
```

### Step 3: DNS Cutover

1. Update A records to point to VPS IP
2. Wait for propagation (5-30 minutes)
3. Test: `curl -I https://your-domain.com`

### Step 4: Monitor

```bash
# Check Docker containers
docker ps

# Check logs
docker-compose logs -f

# Check Nginx
sudo systemctl status nginx

# Check disk space
df -h
```

---

## 🔐 Security Hardening

### 1. SSH Security

```bash
# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
# Set: PasswordAuthentication no

sudo systemctl restart sshd
```

### 2. Install Fail2Ban

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Setup Automated Backups

```bash
# Create backup script
cat > /home/deploy/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL
docker exec supabase_db pg_dump -U postgres neet_counseling > $BACKUP_DIR/db_$DATE.sql

# Backup uploaded files (if any)
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /home/deploy/uploads

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x /home/deploy/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/deploy/backup.sh
```

---

## 📊 Monitoring Setup

### 1. Install Uptime Robot

- Go to uptimerobot.com
- Add HTTP(S) monitor for your domain
- Get alerts via email/SMS

### 2. Setup Logs

```bash
# View application logs
docker-compose logs -f app

# View database logs
docker-compose logs -f db

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🚨 Troubleshooting

### Issue: Can't connect to database

```bash
# Check if PostgreSQL is running
docker ps | grep db

# Check logs
docker-compose logs db

# Restart
docker-compose restart db
```

### Issue: Supabase Auth not working

1. Check Google OAuth credentials in Supabase dashboard
2. Verify redirect URL: `https://your-domain.com/auth/callback`
3. Check browser console for errors

### Issue: Slow response times

1. Check Cloudflare cache hit rate
2. Optimize PostgreSQL queries
3. Add database indexes
4. Enable Cloudflare APO (Advanced Page Optimization)

---

## 💰 Cost Breakdown

| Service | Monthly Cost |
|---------|-------------|
| Hostinger VPS | ₹800 |
| Domain | ₹100 (₹1200/year) |
| Cloudflare | ₹0 (Free tier) |
| **Total** | **₹900/month** |

Compare to Cloudflare Workers at scale:
- 50M requests/month = ₹6000+/month
- VPS = ₹800/month (unlimited requests)

**Savings: ₹5200/month** at scale! 🎉

---

## ✅ Post-Migration Checklist

After migration is complete:

- [ ] Test all core features (search, favorites, recommendations)
- [ ] Test Google OAuth login
- [ ] Test subscription upgrade flow (Razorpay integration)
- [ ] Test mobile experience
- [ ] Check SEO (meta tags, sitemap)
- [ ] Monitor performance (Lighthouse score)
- [ ] Setup analytics (Google Analytics / Plausible)
- [ ] Announce to users (if applicable)

---

## 📞 Support

For issues during migration:
1. Check Coolify docs: docs.coollabs.io
2. Supabase docs: supabase.com/docs
3. Hostinger support: hostinger.com/support

---

## 🎉 Congratulations!

You've successfully migrated to a scalable, cost-effective hybrid architecture!

**Next Steps:**
1. Implement Razorpay integration (see RAZORPAY_INTEGRATION.md)
2. Add advanced recommendation engine
3. Setup real-time counseling tracker
4. Launch premium features! 🚀
