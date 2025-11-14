# OAuth Troubleshooting: "OAuth client was not found"

## Error: Error 401: invalid_client

This error means Google cannot find the OAuth client ID you're using. Let's fix this step by step.

## Step 1: Verify Google Cloud Console Setup

### Check Your OAuth Client Exists

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID
3. **Click on it** to view details
4. Verify:
   - ✅ Client ID is visible
   - ✅ Client Secret is visible (click "Show" if needed)
   - ✅ Application type is "Web application"

### Check Authorized Redirect URIs

In the OAuth client details, verify these URIs are in **Authorized redirect URIs**:

```
https://dbkpoiatlynvhrcnpvgw.supabase.co/auth/v1/callback
http://localhost:3500/auth/callback
http://localhost:3000/auth/callback
```

**Important:** The Supabase callback URL MUST be there!

### Check OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Verify:
   - ✅ OAuth consent screen is configured
   - ✅ Publishing status: Either "Testing" (with your email as test user) or "In production"
   - ✅ Scopes include: `email`, `profile`, `openid`

## Step 2: Verify Supabase Configuration

### Check Google Provider Settings

1. Go to: https://supabase.com/dashboard/project/dbkpoiatlynvhrcnpvgw/auth/providers
2. Click on **Google** provider
3. Verify:
   - ✅ Enabled: **ON**
   - ✅ Client ID: Matches exactly from Google Cloud Console (no spaces, no quotes)
   - ✅ Client Secret: Matches exactly from Google Cloud Console (no spaces, no quotes)

### Common Mistakes:
- ❌ Copying Client ID with extra spaces
- ❌ Copying Client Secret with extra spaces
- ❌ Using quotes around the values
- ❌ Using the wrong Client ID (from a different project)

## Step 3: Double-Check Client ID Match

### In Google Cloud Console:
1. Copy the **Client ID** (the long string starting with something like `123456789-abc...`)
2. Make sure you're copying the **full** Client ID

### In Supabase:
1. Go to Authentication → Providers → Google
2. Compare the Client ID character by character
3. Make sure there are no extra spaces before/after

## Step 4: Verify Project Match

Make sure you're using credentials from the **same Google Cloud project**:

1. Check which project is selected in Google Cloud Console (top bar)
2. Make sure the OAuth client is in that project
3. Make sure Supabase is using credentials from that same project

## Step 5: Recreate OAuth Client (If Needed)

If nothing works, try creating a new OAuth client:

1. **In Google Cloud Console:**
   - Go to APIs & Services → Credentials
   - Delete the old OAuth client (or create a new one)
   - Create new OAuth 2.0 Client ID:
     - Type: Web application
     - Name: NeetLogIQ (or any name)
     - Authorized redirect URIs:
       ```
       https://dbkpoiatlynvhrcnpvgw.supabase.co/auth/v1/callback
       http://localhost:3500/auth/callback
       http://localhost:3000/auth/callback
       ```
   - Copy the NEW Client ID and Client Secret

2. **In Supabase:**
   - Go to Authentication → Providers → Google
   - Update with the NEW Client ID
   - Update with the NEW Client Secret
   - Click Save

3. **Wait 1-2 minutes** for changes to propagate

4. **Try again**

## Step 6: Check OAuth Consent Screen Status

If your app is in "Testing" mode:

1. Go to OAuth consent screen
2. Add your email (`kashyap0071232000@gmail.com`) to **Test users**
3. Save

If you want to make it public:
1. Go to OAuth consent screen
2. Click **Publish App**
3. Confirm

## Step 7: Verify Redirect URI Format

The redirect URI in Google Cloud Console must be **exactly**:
```
https://dbkpoiatlynvhrcnpvgw.supabase.co/auth/v1/callback
```

Check for:
- ✅ Correct protocol: `https://` (not `http://`)
- ✅ Correct domain: `dbkpoiatlynvhrcnpvgw.supabase.co`
- ✅ Correct path: `/auth/v1/callback`
- ✅ No trailing slash
- ✅ No extra characters

## Step 8: Clear Browser Cache

Sometimes cached OAuth data causes issues:

1. Clear browser cache and cookies
2. Try in incognito/private mode
3. Try a different browser

## Step 9: Check Supabase Logs

1. Go to Supabase Dashboard → Logs → Auth Logs
2. Look for recent authentication attempts
3. Check for any error messages

## Quick Verification Checklist

- [ ] OAuth client exists in Google Cloud Console
- [ ] Client ID in Supabase matches Google Cloud Console exactly
- [ ] Client Secret in Supabase matches Google Cloud Console exactly
- [ ] Supabase callback URL is in Google's authorized redirect URIs
- [ ] OAuth consent screen is configured
- [ ] Your email is in test users (if app is in testing mode)
- [ ] No extra spaces in Client ID/Secret in Supabase
- [ ] Using credentials from the same Google Cloud project
- [ ] Waited 1-2 minutes after updating Supabase settings

## Still Not Working?

If you've checked everything above:

1. **Create a completely new OAuth client** in Google Cloud Console
2. **Update Supabase** with the new credentials
3. **Wait 2-3 minutes**
4. **Try again in incognito mode**

The error "OAuth client was not found" means Google literally cannot find that Client ID, so it's almost certainly a mismatch between what's in Supabase and what's in Google Cloud Console.

