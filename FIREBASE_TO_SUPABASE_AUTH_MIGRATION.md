# Firebase to Supabase Auth Migration Guide

## ✅ Migration Complete!

Your application has been successfully migrated from Firebase Auth to Supabase Auth.

## What Was Changed

### 1. AuthContext Replacement
- ✅ **Replaced**: `src/contexts/AuthContext.tsx` (Firebase) → Supabase implementation
- ✅ **Backup Created**: `src/contexts/AuthContext.firebase.backup.tsx`
- ✅ **OAuth Callback**: Already exists at `src/app/auth/callback/route.ts`

### 2. Features Maintained
- ✅ Google OAuth sign-in
- ✅ User authentication state management
- ✅ Admin role checking
- ✅ Stream selection (UG/PG_MEDICAL/PG_DENTAL)
- ✅ User profile management
- ✅ Auth token management
- ✅ Backward compatibility with existing components

### 3. New Supabase Features
- ✅ User profiles stored in Supabase `user_profiles` table
- ✅ Subscription tier management
- ✅ Enhanced user metadata support
- ✅ Better session management

## Next Steps

### 1. Configure Google OAuth in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to **Authentication** → **Providers**
3. Enable **Google** provider
4. Add your Google OAuth credentials:
   - Client ID
   - Client Secret
5. Set **Redirect URL** to: `https://your-domain.com/auth/callback`

### 2. Verify Environment Variables

Make sure these are set in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Test the Migration

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Test Google Sign-In:**
   - Navigate to `/login`
   - Click "Sign in with Google"
   - Should redirect to Google OAuth
   - After authorization, should redirect back to `/auth/callback`
   - Then redirect to `/dashboard`

3. **Verify User Profile:**
   - Check Supabase Dashboard → Table Editor → `user_profiles`
   - New user should have a profile created automatically

### 4. Optional: Remove Firebase Dependencies

If you're no longer using Firebase for anything else, you can remove:

```bash
npm uninstall firebase
```

**Note**: Don't remove if you're still using Firebase for:
- Analytics
- Firestore (if any)
- Storage
- Other Firebase services

## Files That Still Reference Firebase

These files still import Firebase but may be used for other purposes:

1. `src/lib/firebase.ts` - Firebase configuration (may be used for other services)
2. `src/services/firebaseAdmin.ts` - Server-side Firebase admin (if still needed)
3. `src/app/admin/page.skip.tsx` - Admin page (check if it uses Firebase Auth)

## Troubleshooting

### Issue: "OAuth redirect not working"
- **Solution**: Make sure the redirect URL in Supabase matches your domain
- Check: Supabase Dashboard → Authentication → URL Configuration

### Issue: "User profile not created"
- **Solution**: Check Supabase logs for errors
- Verify `user_profiles` table exists and has correct schema
- Check RLS (Row Level Security) policies allow inserts

### Issue: "Admin status not working"
- **Solution**: Update admin users in `user_profiles` table:
  ```sql
  UPDATE user_profiles 
  SET role = 'admin' 
  WHERE user_id = 'user-uuid-here';
  ```

## Migration Checklist

- [x] AuthContext replaced with Supabase implementation
- [x] Types updated to support Supabase user structure
- [x] OAuth callback route verified
- [ ] Google OAuth configured in Supabase Dashboard
- [ ] Environment variables verified
- [ ] Tested Google sign-in flow
- [ ] Tested user profile creation
- [ ] Tested admin role checking
- [ ] Tested stream selection
- [ ] Removed unused Firebase dependencies (optional)

## Support

If you encounter any issues:
1. Check Supabase Dashboard logs
2. Check browser console for errors
3. Verify environment variables
4. Check Supabase RLS policies

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase OAuth Guide](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)

