# ⚡ Quick Start Guide

**Get NEETLogIQ running in production in under 30 minutes!**

---

## 🎯 Prerequisites

- GitHub account
- Vercel account (free)
- Supabase project created
- Razorpay account (for payments)

---

## 🚀 Three-Step Deployment

### Step 1: Database Setup (10 minutes)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/dbkpoiatlynvhrcnpvgw)
2. Click **SQL Editor** > **New Query**
3. Copy `supabase/migrations/consolidated_all_migrations.sql`
4. Paste and click **Run**
5. Run this to add stream data:

```sql
INSERT INTO stream_config (stream_id, stream_name, description, enabled)
VALUES
  ('UG', 'Undergraduate (UG)', 'Undergraduate medical courses including MBBS', true),
  ('PG', 'Postgraduate (PG)', 'Postgraduate medical courses including MD/MS', true),
  ('DIPLOMA', 'Diploma', 'Diploma medical courses', true);
```

✅ **Done!** Database ready.

---

### Step 2: Deploy to Vercel (10 minutes)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import repository: `kashyap2k/New`
3. Add environment variables (from `.env.local`):

**Required:**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://dbkpoiatlynvhrcnpvgw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from_supabase_dashboard>
SUPABASE_SERVICE_ROLE_KEY=<from_supabase_dashboard>

# AI
NEXT_PUBLIC_GEMINI_API_KEY=ff2d76242389488a9db04a89eeedbf91.uuFP8YmmC5cLRk4Q

# Payments (get from Razorpay Dashboard)
NEXT_PUBLIC_RAZORPAY_KEY_ID=<your_key>
RAZORPAY_KEY_SECRET=<your_secret>
```

**Optional:**
```bash
# Firebase (already configured)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBoTOrLIfgMkfr3lMQQJd3f_ZWqfi-bFjk
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=neetlogiq-15499.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=neetlogiq-15499
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=neetlogiq-15499.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=100369453309
NEXT_PUBLIC_FIREBASE_APP_ID=1:100369453309:web:205c0f116b5d899580ee94
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-V4V48LV46K
```

4. Click **Deploy**
5. Wait 5-10 minutes for build

✅ **Done!** App deployed.

---

### Step 3: Create Super Admin (5 minutes)

1. Visit your deployed app
2. Sign up with your email
3. Copy your User ID from [Supabase Auth](https://supabase.com/dashboard/project/dbkpoiatlynvhrcnpvgw/auth/users)
4. Run this SQL:

```sql
UPDATE user_profiles
SET role = 'super_admin'
WHERE id = 'YOUR_USER_ID';
```

5. Refresh and go to `/admin`

✅ **Done!** Admin access granted.

---

## 🧪 Quick Test

1. **Sign up** - Create an account
2. **Select stream** - Choose UG/PG/Diploma
3. **Search colleges** - Try filtering
4. **Save favorite** - Heart icon
5. **Ask chatbot** - Test AI (15 req/min limit)
6. **Try payment** - Use test card: `4111 1111 1111 1111`
7. **Check admin** - Go to `/admin`

---

## 📚 Detailed Guides

- **Database:** `DATABASE_SETUP_GUIDE.md`
- **Deployment:** `DEPLOYMENT_CHECKLIST.md`
- **Platform Status:** `PLATFORM_STATUS.md`
- **Tests:** `TEST_COVERAGE.md`

---

## 🎉 You're Live!

**Total time:** ~25 minutes
**Status:** Production ready
**Next:** Monitor, test, launch! 🚀

---

## 🆘 Need Help?

### Common Issues

**"Table doesn't exist"**
- Run migrations in Supabase SQL Editor

**"API not available"**
- Check environment variables are set

**"Payment failed"**
- Verify Razorpay keys are correct
- Use test card: `4111 1111 1111 1111`

**"Unauthorized"**
- Check you're logged in
- Verify RLS policies enabled

### Get Support

- Check documentation files
- Review error logs in Vercel
- Check Supabase logs
- Test locally first: `npm run dev`

---

**Ready to launch? Follow the steps above! 🚀**
