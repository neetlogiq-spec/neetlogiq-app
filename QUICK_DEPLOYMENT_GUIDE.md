# ⚡ Quick Deployment Guide - 30 Minutes to Live!

**Current Status:** All code ready, database migrations prepared!

---

## 🚀 Step 1: Run Database Migrations (5 minutes)

**Option A: One-Click (Easiest)**


3. Paste into SQL Editor

4. Click **RUN** (bottom right)

5. Wait ~30 seconds for completion

**Option B: Supabase CLI**

```bash
# Install CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to project


# Push all migrations
supabase db push
```

**Verify migrations worked:**

```sql
-- Run this in Supabase SQL Editor
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should return 27+ tables
```

---

## 👤 Step 2: Create Super Admin (2 minutes)

1. **Sign up as a user** in your app (or run locally: `npm run dev`)

2. **Get your user ID** from Supabase:
   ```sql
   SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
   ```

3. **Make yourself super admin:**
   ```sql
   -- Replace 'YOUR-USER-ID' with the actual ID from step 2
   UPDATE user_profiles
   SET role = 'super_admin'
   WHERE user_id = 'YOUR-USER-ID';

   -- Verify
   SELECT user_id, email, role FROM user_profiles
   JOIN auth.users ON user_profiles.user_id = auth.users.id
   WHERE role = 'super_admin';
   ```

---

## 🔐 Step 3: Setup Firebase (10 minutes)

1. **Create Firebase Project:**
   - Go to: https://console.firebase.google.com/
   - Click "Add project"
   - Name: `neetlogiq`
   - Disable Google Analytics (optional)
   - Click "Create Project"

2. **Enable Authentication:**
   - Go to **Authentication** > **Sign-in method**
   - Enable **Email/Password**
   - Click "Save"

3. **Get Config Values:**
   - Go to **Project Settings** (gear icon) > **General**
   - Scroll to "Your apps"
   - Click **Web** icon (`</>`)
   - Register app name: `NEETLogIQ Web`
   - **Copy the config values** (you'll need these for Vercel)

4. **Add Authorized Domain (do this AFTER Vercel deployment):**
   - **Authentication** > **Settings** > **Authorized domains**
   - Add: `your-app.vercel.app`

---

## 📦 Step 4: Deploy to Vercel (10 minutes)

### A. Connect Repository

1. Go to: https://vercel.com/new
2. Import your Git repository
3. Click **Import**

### B. Configure Project

**Framework Preset:** Next.js (auto-detected)

**Build Settings:**
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

### C. Add Environment Variables

Click **Environment Variables** and add all these:



**IMPORTANT:** Select environment for each variable:
- ✅ Production
- ✅ Preview
- ✅ Development

### D. Deploy!

1. Click **Deploy**
2. Wait 3-5 minutes for build
3. Copy your deployment URL (e.g., `https://neetlogiq.vercel.app`)

---

## 🔄 Step 5: Post-Deployment Setup (5 minutes)

### A. Update Firebase Authorized Domain

1. Go back to Firebase Console
2. **Authentication** > **Settings** > **Authorized domains**
3. Click "Add domain"
4. Add: `your-app.vercel.app` (your actual Vercel URL)
5. Save

### B. Update App URL in Vercel

1. Go to Vercel Dashboard > Your Project > **Settings** > **Environment Variables**
2. Find `NEXT_PUBLIC_APP_URL`
3. Update value to: `https://your-actual-app.vercel.app`
4. Redeploy (Vercel > Deployments > ⋯ > Redeploy)

### C. Setup Razorpay Webhook

1. Go to: https://dashboard.razorpay.com/app/webhooks
2. Click "Create Webhook"
3. Add URL: `https://your-app.vercel.app/api/payments/webhook`
4. Select events:
   - ✅ payment.authorized
   - ✅ payment.captured
   - ✅ payment.failed
   - ✅ payment.refunded
   - ✅ subscription.activated
   - ✅ subscription.cancelled
   - ✅ subscription.charged
   - ✅ subscription.completed
5. Click "Create"
6. **Copy the Webhook Secret**
7. Update `RAZORPAY_WEBHOOK_SECRET` in Vercel env vars
8. Redeploy

---

## ✅ Step 6: Test Everything (5 minutes)

### Critical Tests:

- [ ] Visit your site: `https://your-app.vercel.app`
- [ ] Sign up as new user
- [ ] Verify trial starts automatically (check user profile)
- [ ] Login/logout works
- [ ] Try to save a college
- [ ] Check usage limits work
- [ ] Admin dashboard accessible (as super admin)
- [ ] Stream switching works

### Test Payment (Test Mode):

- [ ] Click "Upgrade to Premium"
- [ ] Payment modal opens
- [ ] Use Razorpay test card: `4111 1111 1111 1111`
- [ ] CVV: any 3 digits, Expiry: any future date
- [ ] Payment succeeds
- [ ] Subscription activated
- [ ] Premium features unlocked

---

## 🎉 You're Live!

Your platform is now deployed and functional!

### Next Steps:

1. **Monitor for 24 hours** - Check Vercel logs for any errors
2. **Test all features thoroughly** - Make a checklist
3. **Get Razorpay Production Keys** - When ready for real payments
4. **Add Custom Domain** (Optional) - In Vercel settings

### Monitoring:

- **Vercel Logs:** https://vercel.com/dashboard

- **Razorpay Dashboard:** https://dashboard.razorpay.com/

---

## 🆘 Common Issues

### Build Fails on Vercel

**Error: Module not found**
```bash
# Solution: Check all imports are correct
# Vercel is case-sensitive!
```

**Error: Type errors**
```bash
# Run locally first: npm run build
# Fix TypeScript errors before deploying
```

### Authentication Not Working

- Check Firebase authorized domains includes Vercel URL
- Verify all Firebase env vars are correct
- Check browser console for errors

### Payment Not Working

- Verify Razorpay keys are correct (test mode)
- Check webhook URL is correct in Razorpay
- View Vercel logs for webhook errors

### Database Errors

- Verify all migrations ran successfully
- Check Supabase logs
- Ensure service role key is correct

---

## 📊 Deployment Checklist

- [ ] Database migrations run
- [ ] Super admin created
- [ ] Firebase configured
- [ ] Vercel deployed
- [ ] Environment variables set
- [ ] Firebase domain authorized
- [ ] Razorpay webhook configured
- [ ] All tests passing
- [ ] Monitoring enabled

**Time to complete:** ~30-40 minutes

**Deployment Status:** 🟢 READY TO DEPLOY

---

## 🚀 Ready to Go Live?

Everything is prepared. Follow the steps above in order, and you'll be live in 30 minutes!

Need help? Check `DEPLOYMENT.md` for detailed troubleshooting.
