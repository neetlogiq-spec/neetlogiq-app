# Fix: college_institute_raw and college_institute_normalized Columns Being Deleted

## Problem

After running match and link on counselling data, the `college_institute_raw` and `college_institute_normalized` columns were being deleted/lost.

## Root Cause

**Location**: `match_and_link_parallel()` function

The issue occurred in multiple places:

### Issue 1: `process_batch()` Only Returns Subset of Columns (Line 16061)

**Problem**: The `process_batch()` function was creating a new result dictionary with only matching-related fields, losing all original columns from the input record.

**Before Fix**:
```python
result = {
    'id': record_id,
    'college_name': college_name,
    'course_name': course_name,
    'state': state,
    'address': address,
    'master_college_id': ...,
    # ... only matching fields
    # MISSING: college_institute_raw, college_institute_normalized, etc.
}
```

**After Fix**:
```python
result = dict(record)  # Start with ALL original columns
result.update({
    'id': record_id,
    # ... update only matching fields
})
```

### Issue 2: `_ensure_dataframe_columns()` Doesn't Handle counselling_records (Line 20506)

**Problem**: The function only handled `seat_data` table, returning DataFrame as-is for `counselling_records` without ensuring all columns are present.

**Before Fix**:
```python
if table_name != 'seat_data':
    return df  # Returns as-is, missing columns not added
```

**After Fix**:
```python
if table_name == 'counselling_records':
    # Add missing matching columns only
    # Preserve all original data columns
    return df
```

### Issue 3: Merge Logic Doesn't Preserve All Columns (Line 16366)

**Problem**: When merging `new_row` with `existing_row`, only specific matching fields were preserved, not all original columns.

**Before Fix**:
```python
if record_id in existing_records:
    existing_row = existing_records[record_id]
    # Only preserves manual mappings, not all columns
    if has_manual_college:
        new_row['master_college_id'] = existing_row['master_college_id']
    # ... other columns lost!
```

**After Fix**:
```python
if record_id in existing_records:
    existing_row = existing_records[record_id]
    
    # CRITICAL FIX: Preserve ALL original columns from existing record
    for col in existing_row.index:
        if col not in new_row.index or (pd.isna(new_row.get(col)) and not pd.isna(existing_row.get(col))):
            new_row[col] = existing_row[col]  # Preserve original data
```

### Issue 4: `to_sql(if_exists='replace')` Drops Missing Columns

**Problem**: When `results_df` is missing columns and `to_sql(if_exists='replace')` is called, it replaces the entire table with only the columns present in `results_df`, effectively deleting missing columns.

**Solution**: Fixed by ensuring `results_df` contains ALL original columns before saving.

---

## Fixes Applied

### Fix 1: Preserve All Columns in `process_batch()` (Line 16060-16082)

**Changed**: Start with all original columns, then update only matching fields

```python
# CRITICAL FIX: Preserve ALL original columns from input record
result = dict(record)  # Start with ALL original columns

# Update with matching results (overwrite only matching-related fields)
result.update({
    'id': record_id,
    'master_college_id': ...,
    # ... only matching fields
})
```

### Fix 2: Handle counselling_records in `_ensure_dataframe_columns()` (Line 20511-20548)

**Changed**: Added specific handling for `counselling_records` table

```python
if table_name == 'counselling_records':
    # Add ONLY missing matching columns (safe to add as None/False)
    # DO NOT add original data columns - they must be preserved from source
    # Keep all columns that exist in df (preserve original data)
    return df
```

### Fix 3: Preserve All Columns in Merge Logic (Line 16369-16375)

**Changed**: Preserve all columns from existing record before updating matching fields

```python
# CRITICAL FIX: Preserve ALL original columns from existing record
for col in existing_row.index:
    if col not in new_row.index or (pd.isna(new_row.get(col)) and not pd.isna(existing_row.get(col))):
        new_row[col] = existing_row[col]  # Preserve original data
```

---

## Data Flow After Fix

### Step 1: Load Data (Line 16263)
```python
df = pd.read_sql(f"SELECT * FROM {table_name}", conn)
# Contains ALL columns including college_institute_raw, college_institute_normalized
```

### Step 2: Process Batches (Line 16289)
```python
executor.submit(self.process_batch, batch.to_dict('records'))
# process_batch now preserves ALL original columns
```

### Step 3: Merge with Existing (Line 16363-16413)
```python
# Preserves ALL columns from existing record
# Only updates matching-related fields
```

### Step 4: Ensure Columns (Line 16416)
```python
results_df = self._ensure_dataframe_columns(results_df, table_name)
# Adds missing matching columns only, preserves all original data
```

### Step 5: Save (Line 16884)
```python
results_df.to_sql(table_name, conn, if_exists='replace', index=False)
# results_df now contains ALL original columns
```

---

## Columns Preserved

### Original Data Columns (Preserved)
- `college_institute_raw` ✅
- `college_institute_normalized` ✅
- `state_raw` ✅
- `state_normalized` ✅
- `course_raw` ✅
- `course_normalized` ✅
- `address` ✅
- `address_normalized` ✅
- `all_india_rank`, `quota`, `category`, `round_raw`, `year` ✅
- `source_normalized`, `level_normalized`, `round_normalized` ✅
- `partition_key` ✅

### Matching Columns (Updated)
- `master_college_id` (updated)
- `master_course_id` (updated)
- `master_state_id` (updated)
- `college_match_score` (updated)
- `college_match_method` (updated)
- `course_match_score` (updated)
- `course_match_method` (updated)
- `is_matched` (updated)

---

## Testing Checklist

- [x] Fix 1: `process_batch()` preserves all columns
- [x] Fix 2: `_ensure_dataframe_columns()` handles counselling_records
- [x] Fix 3: Merge logic preserves all columns
- [ ] Test: Run match and link on counselling data
- [ ] Verify: `college_institute_raw` column still has data
- [ ] Verify: `college_institute_normalized` column still has data
- [ ] Verify: All other original columns preserved
- [ ] Verify: Matching results are updated correctly

---

## Files Modified

1. **recent3.py**:
   - Line 16060-16082: `process_batch()` - Preserve all original columns
   - Line 16369-16375: Merge logic - Preserve all columns from existing record
   - Line 20511-20548: `_ensure_dataframe_columns()` - Handle counselling_records table

---

## Status

✅ **FIXES IMPLEMENTED** - Ready for testing

The code now:
- Preserves ALL original columns from input records
- Preserves ALL original columns when merging with existing records
- Only updates matching-related fields
- Prevents data loss during table replacement

**Expected Result**: `college_institute_raw` and `college_institute_normalized` columns will no longer be deleted after matching.

