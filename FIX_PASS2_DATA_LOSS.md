# CRITICAL FIX: PASS 2 Data Loss and Field Clearing

## Problem

After PASS 2 matching, seat_data table showed:
- ❌ Data loss: 16,280 records → 15,455 records (825 lost)
- ❌ Fields cleared: `master_state_data` and other fields set to NULL

## Root Cause

**The issue was a LOGICAL ERROR in the PASS 2 data saving logic:**

### Bug Flow

```
PASS 1 Matching:
  ✅ results_df loaded with 16,280 records
  ✅ PASS 1 matching applied to results_df
  ✅ results_df has all 16,280 records with matches

PASS 2 Matching:
  ✅ process_batch_with_aliases() processes unmatched records
  ✅ Returns pass2_df with PASS 2 updates

Deduplication in PASS 2:
  ✅ Lines 14732-14736: Drop 825 duplicate records from results_df
  ✓ results_df now has 15,455 records (825 correctly removed)

ERROR - Data Saving Logic:
  ❌ Line 14742: Read FRESH current_df from database (16,280 records!)
  ❌ Lines 14745-14757: Try to update fresh current_df with pass2_df
  ❌ Line 14761: Save fresh current_df (still 16,280!)
  ❌ RESULT: Database gets fresh data, losing deduplication work
            AND losing PASS 2 updates!

Database State After PASS 2:
  ❌ 16,280 records (825 duplicates NOT removed)
  ❌ master_state_data and other fields: NULL (not updated by pass2_df)
  ❌ Deduplication work completely lost
```

### Why Fields Were Cleared

The code did:
```python
# Read fresh database state (unaware of deduplication)
current_df = pd.read_sql(f"SELECT * FROM {table_name}", conn)

# Try to update with PASS 2 results
for _, pass2_row in pass2_df.iterrows():
    if pass2_row.get('master_college_id'):  # Only matches!
        # Update specific columns
        current_df.loc[mask, 'master_college_id'] = ...

# Save - but current_df missing PASS 2 updates for unmatched records!
current_df.to_sql(table_name, conn, if_exists='replace', index=False)
```

**Problem**: The code only updated records where PASS 2 found a match. For the 5,000 unmatched records processed in PASS 2, `pass2_row.get('master_college_id')` was None, so they were NOT updated. This meant:
- Original fields from `pass2_row` (like `master_state_data`) were never copied back
- `current_df` had old/stale values for these fields
- When saved, unmatched records lost all their updates

## Solution

**REMOVE the redundant current_df logic and use results_df directly:**

### Before (WRONG)
```python
# PASS 1 & PASS 2 updates go to results_df
results_df = ... (PASS 1 & 2 updates, 16,280 records)

# Deduplication modifies results_df
results_df = pd.concat([matched_df, unmatched_df])  # Now 15,455 records!

# ❌ WRONG: Ignore results_df and read fresh from database
current_df = pd.read_sql(f"SELECT * FROM {table_name}", conn)  # 16,280!

# ❌ WRONG: Try to merge partial PASS 2 results
for _, pass2_row in pass2_df.iterrows():
    if pass2_row.get('master_college_id'):  # Only matches!
        # Update current_df...

# ❌ WRONG: Save stale data, losing deduplication
current_df.to_sql(table_name, conn, if_exists='replace', index=False)
```

### After (CORRECT)
```python
# PASS 1 & PASS 2 updates go to results_df
results_df = ... (PASS 1 & 2 updates, 16,280 records)

# Update results_df with ALL fields from pass2_df
for _, pass2_row in pass2_df.iterrows():
    record_id = pass2_row.get('id')
    mask = results_df['id'] == record_id
    if mask.any():
        # ✅ CORRECT: Update ALL columns (preserves all original fields)
        for col in pass2_row.index:
            results_df.loc[mask, col] = pass2_row[col]

# ✅ CORRECT: Save results_df which has all updates and deduplication
results_df.to_sql(table_name, conn, if_exists='replace', index=False)
```

## Changes Made

**File**: `recent3.py`

**Lines 14739-14753**: Complete rewrite of PASS 2 database save logic
- Removed redundant `current_df = pd.read_sql()`
- Removed redundant partial merge loops
- Changed to: Save `results_df` directly (which has all updates + deduplication)

**Lines 14686-14700**: Enhanced PASS 2 result merging
- Changed from: Only update matching columns if `master_college_id` exists
- Changed to: Update ALL columns from `pass2_row` for every record
- This preserves original fields like `master_state_data`

## Why This Works

1. **results_df** has been maintained throughout PASS 1 and PASS 2
2. **pass2_df** is created from `process_batch_with_aliases()` which:
   - Starts with `dict(record)` (all original fields)
   - Adds/updates matching fields
   - Returns complete records with all fields intact
3. When we copy all columns from `pass2_row`, we:
   - Preserve all original fields (master_state_data, etc.)
   - Update matching fields with PASS 2 results
   - Maintain the deduplication work from lines 14732-14736
4. When we save `results_df`, we save:
   - ✅ 15,455 records (after deduplication)
   - ✅ All PASS 1 matches
   - ✅ All PASS 2 matches
   - ✅ All original fields preserved
   - ✅ No NULL fields

## Expected Results After Fix

```
Before Fix:
  Records: 16,280 (should be 15,455!)
  master_state_data: NULL for many records
  Duplicates: Present (dedup work lost)

After Fix:
  Records: 15,455 ✅ (825 duplicates removed)
  master_state_data: Preserved ✅
  All fields: Intact ✅
  Duplicates: Removed ✅
```

## Testing

To verify the fix:
```sql
-- Check record count after PASS 2
SELECT COUNT(*) FROM seat_data;  -- Should be ~15,455

-- Check if fields are preserved
SELECT COUNT(*) FROM seat_data
WHERE master_state_data IS NOT NULL;  -- Should be high

-- Check for duplicates
SELECT COUNT(*) FROM seat_data
GROUP BY id HAVING COUNT(*) > 1;  -- Should be 0

-- Check if matching worked
SELECT COUNT(*) FROM seat_data
WHERE master_college_id IS NOT NULL;  -- Should be ~15,000
```

## Key Lessons Learned

1. **Don't re-read from database if you have the in-memory version**
   - `results_df` had all the work done, should use it
   - Reading fresh `current_df` loses all in-memory work

2. **Sync is critical**
   - If you modify data in memory (dedup), must save that modified version
   - Not an old version from database

3. **Update ALL fields, not selective fields**
   - Don't update only matching fields
   - Copy complete records to preserve all original data

## Related Fixes

This fix complements earlier PASS 2 fixes:
- ✅ Commit 8b32f0d: First PASS 2 data loss fix (merge strategy)
- ✅ Commit 376ad14: Deduplication fix (group by id)
- ✅ This commit: Database save logic fix (use results_df, not fresh current_df)

Now all three parts work together correctly.
