# 🔧 Apply Supabase Schema Fix

This guide will help you update your Supabase schema to match SQLite structure for successful data migration.

---

## 📋 What This Fixes

This migration updates Supabase tables to match SQLite schema:

1. **Courses Table**: Changes ID from UUID to TEXT (matches SQLite "CRS0001" format)
2. **State-College-Link**: Removes 'id' column, uses composite primary key
3. **State-Course-College-Link**: Removes 'id' column, uses composite primary key  
4. **Seat Data**: Changes ID from VARCHAR(50) to TEXT (accommodates 79-char IDs)
5. **Course Aliases**: Updates foreign key to reference TEXT course_id

---

## 🚀 How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/dbkpoiatlynvhrcnpvgw/sql/new)

2. Open the SQL Editor

3. Copy the entire contents of:
   ```
   supabase/migrations/20250114_fix_sqlite_compatibility.sql
   ```

4. Paste into the SQL Editor

5. Click **Run** (or press Cmd/Ctrl + Enter)

6. Verify success - you should see:
   ```
   Schema update complete! Tables now match SQLite structure.
   ```

---

### Option 2: Supabase CLI

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref dbkpoiatlynvhrcnpvgw

# Apply migration
supabase db push
```

---

## ⚠️ Important Notes

### Data Loss Warning

**This migration will DROP and recreate some tables:**
- `courses` - Will be dropped and recreated
- `state_college_link` - Will be dropped and recreated
- `state_course_college_link` - Will be dropped and recreated
- `course_aliases` - Will be dropped and recreated

**If you have existing data in these tables, it will be lost!**

**However**, since we're migrating FROM SQLite, this is expected. The migration script will repopulate these tables with SQLite data.

### Tables That Are Safe

These tables are **NOT** dropped (only altered if needed):
- `states` ✅
- `categories` ✅
- `quotas` ✅
- `medical_colleges` ✅
- `dental_colleges` ✅
- `dnb_colleges` ✅
- `college_aliases` ✅
- `state_aliases` ✅
- `seat_data` ✅ (altered, not dropped)

---

## ✅ After Applying Migration

1. **Verify Schema**:
   ```bash
   npm run test:supabase
   ```

2. **Run Migration Again**:
   ```bash
   npm run migrate:sqlite-to-supabase
   ```

3. **Expected Results**:
   - ✅ Courses: 205 records
   - ✅ Course Aliases: All records
   - ✅ State-College-Link: 2,439 records
   - ✅ State-Course-College-Link: All records
   - ✅ Seat Data: 2,320 records

---

## 🔍 Verify Changes

After applying, you can verify the schema matches:

```sql
-- Check courses table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'courses' 
ORDER BY ordinal_position;

-- Should show: id (text), name (text), normalized_name (text), tfidf_vector (text)

-- Check state_college_link
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'state_college_link' 
ORDER BY ordinal_position;

-- Should NOT have 'id' column, should have composite PK

-- Check seat_data id column
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'seat_data' AND column_name = 'id';

-- Should show: id (text) with no length limit
```

---

## 🐛 Troubleshooting

### Error: "relation does not exist"
- Some tables might not exist yet - that's okay, the migration creates them

### Error: "cannot drop table because other objects depend on it"
- The migration uses `CASCADE` to handle dependencies
- If issues persist, drop dependent objects manually first

### Error: "permission denied"
- Make sure you're using the service role key
- Check you have admin access to the Supabase project

---

## 📝 Migration File

The migration file is located at:
```
supabase/migrations/20250114_fix_sqlite_compatibility.sql
```

---

**Ready to apply?** Copy the SQL from the migration file and run it in Supabase SQL Editor!

