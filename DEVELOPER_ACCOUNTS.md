# Developer Accounts - Unrestricted Access

## Overview

Developer accounts have **full unrestricted access** to all data, bypassing stream filtering. This is useful for:
- Development and testing
- Data verification across all streams
- Admin tasks
- Quality assurance

---

## Developer Email Addresses

The following email addresses are recognized as developer accounts:

1. **kashyap0071232000@gmail.com**
2. **kashyap2k007@gmail.com**
3. **neetlogiq@gmail.com**

When logged in with any of these accounts, you get:
- ✅ **No stream selection modal** - Modal never appears
- ✅ **Unrestricted data access** - See ALL colleges, courses, cutoffs
- ✅ **No filtering** - MEDICAL, DENTAL, DNB, UG, PG all visible
- ✅ **Full administrative privileges** - Access to all features

---

## How It Works

### 1. Developer Detection

When you sign in with a developer email:

```typescript
// src/contexts/StreamContext.tsx
const DEVELOPER_EMAILS = [
  'kashyap0071232000@gmail.com',
  'kashyap2k007@gmail.com',
  'neetlogiq@gmail.com'
];

function isDeveloperAccount(email: string): boolean {
  return DEVELOPER_EMAILS.includes(email.toLowerCase());
}
```

### 2. Modal Bypass

The stream selection modal is **automatically hidden** for developers:

```typescript
// Modal never shows for developers
{isInitialized && !isDeveloper && (
  <StreamSelectionModal ... />
)}
```

### 3. Data Filtering Bypass

All data filtering is **automatically disabled** for developers:

```typescript
// IdBasedDataService.ts
if (params.selectedStream && !params.isDeveloper) {
  // Apply filtering for regular users
} else {
  // Developers see everything
  return allData;
}
```

---

## User Experience Comparison

### Regular User Experience:

```
1. Visit /colleges
   ↓
2. Modal appears: "Welcome! Select your level"
   ↓
3. Select "UG"
   ↓
4. See only: MEDICAL + DENTAL colleges
   ↓
5. Cutoffs filtered to: UG level only
```

### Developer Account Experience:

```
1. Sign in with developer email
   ↓
2. Visit /colleges
   ↓
3. NO MODAL - Go straight to data
   ↓
4. See ALL: MEDICAL + DENTAL + DNB colleges
   ↓
5. Cutoffs show: UG + PG (all levels)
```

---

## Technical Implementation

### Context (`StreamContext.tsx`)

```typescript
export const StreamProvider = ({ children }) => {
  const { user } = useAuth();
  const isDeveloper = isDeveloperAccount(user?.email);

  // Developers bypass stream selection
  if (isDeveloper) {
    setIsInitialized(true);
    return; // Skip modal logic
  }

  // ... regular user logic
};
```

### Service (`IdBasedDataService.ts`)

```typescript
async getEnrichedCutoffs(params: {
  stream: string;
  year: number;
  round: number;
  selectedStream?: StreamType | null;
  isDeveloper?: boolean; // ← New parameter
  filters?: { ... };
}): Promise<EnrichedCutoffData[]> {
  // ... fetch and enrich data

  // Filter by stream (skip for developers)
  if (params.selectedStream && !params.isDeveloper) {
    return enrichedData.filter(item => {
      // Apply stream filtering
    });
  }

  // Developers see all data
  return enrichedData;
}
```

### Hook (`useIdBasedData.ts`)

```typescript
export function useIdBasedData(params) {
  const { selectedStream, isDeveloper } = useStream();

  const result = await service.getEnrichedCutoffs({
    ...params,
    selectedStream,
    isDeveloper // ← Automatically passed
  });
}
```

---

## Adding New Developer Accounts

To add a new developer account, edit the list in `StreamContext.tsx`:

```typescript
// src/contexts/StreamContext.tsx
const DEVELOPER_EMAILS = [
  'kashyap0071232000@gmail.com',
  'kashyap2k007@gmail.com',
  'neetlogiq@gmail.com',
  'newdeveloper@gmail.com' // ← Add here
];
```

**No other code changes needed!** The system will automatically:
- Hide the modal for this account
- Bypass all filtering
- Grant full data access

---

## Security Considerations

### ⚠️ Important Notes:

1. **Email Validation**
   - Email comparison is case-insensitive
   - Uses exact string matching
   - No wildcards or patterns

2. **Client-Side Check**
   - Developer check happens in the browser
   - For UI purposes only (hiding modal, disabling filters)
   - **NOT for security** - server should still verify permissions

3. **Admin vs Developer**
   - Developer accounts bypass **stream filtering**
   - Admin accounts (via `isAdmin` flag) control **write access**
   - These are separate concerns

4. **Production Use**
   - In production, consider moving this list to environment variables
   - Or fetch from a secure admin configuration API

---

## Testing Developer Access

### Test as Developer:

```bash
# 1. Sign out (if signed in)
# 2. Sign in with a developer account
#    - kashyap0071232000@gmail.com
#    - kashyap2k007@gmail.com
#    - neetlogiq@gmail.com

# 3. Visit /colleges
# ✅ No modal should appear
# ✅ Should see all colleges (MEDICAL + DENTAL + DNB)

# 4. Visit /cutoffs
# ✅ Should see all levels (UG + PG)

# 5. Search colleges
# ✅ Should find colleges from all streams
```

### Test as Regular User:

```bash
# 1. Sign in with a non-developer email
# 2. Visit /colleges
# ✅ Modal should appear
# ✅ After selecting UG, only see MEDICAL + DENTAL

# 3. Visit /cutoffs
# ✅ Only see UG level data
```

---

## Debugging

### Check if Developer Mode is Active:

```typescript
// In any component
import { useStream } from '@/contexts/StreamContext';

const { isDeveloper } = useStream();
console.log('Is Developer:', isDeveloper);
```

### Check in Browser Console:

```javascript
// Check current user email
localStorage.getItem('firebase:authUser:...')

// Check if developer detection is working
// Should see isDeveloper: true in context
```

---

## Use Cases

### 1. Development & Testing
```
As a developer, I want to see all data to:
- Test UI with different streams
- Verify data consistency
- Debug issues across all levels
```

### 2. Data Verification
```
As a developer, I want to:
- Compare cutoffs across UG and PG
- Find duplicate or missing colleges
- Verify data migrations worked correctly
```

### 3. Quality Assurance
```
As a developer, I want to:
- Test search across all streams
- Verify filtering logic for regular users
- Check edge cases with mixed data
```

### 4. Admin Tasks
```
As a developer, I want to:
- Review all colleges before publishing
- Check data quality across streams
- Perform bulk operations on all data
```

---

## FAQ

**Q: Can I add multiple developer accounts?**
A: Yes! Just add them to the `DEVELOPER_EMAILS` array.

**Q: What if I want to test as a regular user?**
A: Sign in with a non-developer email, or temporarily remove your email from the list.

**Q: Does this affect admin privileges?**
A: No. Developer status (data filtering bypass) and admin status (write permissions) are separate.

**Q: Can I have different developer levels?**
A: Currently all developer accounts have the same privileges. For more granular control, you'd need to implement role-based access control (RBAC).

**Q: Is this secure?**
A: This is a **client-side convenience** for hiding modals and disabling filters. For actual security, implement server-side authentication and authorization.

**Q: What happens if I change a developer's email in the list?**
A: The old email will no longer be recognized as a developer. The new email will immediately get developer privileges on next login.

---

## Summary

Developer accounts provide a **seamless unrestricted experience** for development and testing:

✅ **No interruptions** - No modal prompts
✅ **Full visibility** - See all data across all streams
✅ **Easy testing** - Test filtering logic by comparing with regular accounts
✅ **Simple management** - Add/remove emails in one place
✅ **Zero code changes** - Everything is automatic

Perfect for doctors who need to manage the platform while focusing on medicine! 👨‍⚕️

---

*Last Updated: 2025-01-08*
