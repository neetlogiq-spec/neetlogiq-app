# Supabase Google OAuth Setup Guide

## Error: "OAuth client was not found" / "Error 401: invalid_client"

This error occurs when Google OAuth is not properly configured in Supabase or the redirect URI doesn't match.

## Step-by-Step Setup

### 1. Configure Google OAuth in Google Cloud Console

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/
   - Select your project (or create a new one)

2. **Enable Google+ API:**
   - Navigate to **APIs & Services** → **Library**
   - Search for "Google+ API" and enable it
   - Also enable "People API" (for user profile access)

3. **Create OAuth 2.0 Credentials:**
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - If prompted, configure the OAuth consent screen first:
     - User Type: **External** (for public apps)
     - App name: **NeetLogIQ** (or your app name)
     - Support email: Your email
     - Developer contact: Your email
     - Click **Save and Continue**
     - Scopes: Add `email`, `profile`, `openid`
     - Test users: Add your email for testing
     - Click **Save and Continue**

4. **Create OAuth Client ID:**
   - Application type: **Web application**
   - Name: **NeetLogIQ Web Client** (or any name)
   - **Authorized JavaScript origins:**
     ```
     http://localhost:3000
     http://localhost:3500
     https://your-domain.com
     ```
   - **Authorized redirect URIs:**
     ```
     http://localhost:3000/auth/callback
     http://localhost:3500/auth/callback
     https://dbkpoiatlynvhrcnpvgw.supabase.co/auth/v1/callback
     https://your-domain.com/auth/callback
     ```
   - Click **Create**
   - **Copy the Client ID and Client Secret** (you'll need these for Supabase)

### 2. Configure Google OAuth in Supabase

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard
   - Select your project: `dbkpoiatlynvhrcnpvgw`

2. **Navigate to Authentication:**
   - Click **Authentication** in the left sidebar
   - Click **Providers** tab

3. **Enable Google Provider:**
   - Find **Google** in the list
   - Toggle it **ON**
   - Enter your **Client ID** (from Google Cloud Console)
   - Enter your **Client Secret** (from Google Cloud Console)
   - Click **Save**

4. **Configure Redirect URLs:**
   - Go to **Authentication** → **URL Configuration**
   - **Site URL:** `http://localhost:3500` (for development)
   - **Redirect URLs:** Add:
     ```
     http://localhost:3500/auth/callback
     http://localhost:3000/auth/callback
     https://your-domain.com/auth/callback
     ```

### 3. Update Your Application Code

Make sure your callback route matches:

**File: `src/app/auth/callback/route.ts`**
```typescript
// Should redirect to /auth/callback
```

**File: `src/contexts/AuthContext.tsx`**
```typescript
// Should use: redirectTo: `${window.location.origin}/auth/callback`
```

### 4. Test the Setup

1. **Restart your dev server:**
   ```bash
   npm run dev
   ```

2. **Try signing in:**
   - Go to `/login`
   - Click "Sign in with Google"
   - You should be redirected to Google
   - After authorization, you'll be redirected back to `/auth/callback`
   - Then redirected to `/dashboard`

### 5. Common Issues & Solutions

#### Issue: "redirect_uri_mismatch"
**Solution:** Make sure the redirect URI in Google Cloud Console exactly matches:
- Supabase callback: `https://dbkpoiatlynvhrcnpvgw.supabase.co/auth/v1/callback`
- Your app callback: `http://localhost:3500/auth/callback`

#### Issue: "OAuth client not found"
**Solution:** 
- Verify Client ID and Secret are correct in Supabase
- Make sure Google OAuth is enabled in Supabase
- Check that the OAuth consent screen is configured

#### Issue: "Access blocked"
**Solution:**
- If your app is in testing mode, add your email to test users
- Publish your OAuth consent screen if ready for production

### 6. Production Setup

For production:

1. **Update Google Cloud Console:**
   - Add your production domain to authorized origins
   - Add production callback URL

2. **Update Supabase:**
   - Change Site URL to your production domain
   - Add production redirect URL

3. **Publish OAuth Consent Screen:**
   - In Google Cloud Console, go to OAuth consent screen
   - Click **Publish** (if ready for public use)

## Quick Checklist

- [ ] Google Cloud Console project created
- [ ] Google+ API enabled
- [ ] OAuth consent screen configured
- [ ] OAuth 2.0 Client ID created
- [ ] Authorized redirect URIs added (including Supabase callback)
- [ ] Client ID and Secret copied
- [ ] Google provider enabled in Supabase
- [ ] Client ID and Secret added to Supabase
- [ ] Redirect URLs configured in Supabase
- [ ] Dev server restarted
- [ ] Test sign-in works

## Need Help?

If you're still having issues:
1. Check Supabase logs: Dashboard → Logs → Auth Logs
2. Check browser console for errors
3. Verify all URLs match exactly (no trailing slashes, correct protocol)
4. Make sure you're using the correct Supabase project

