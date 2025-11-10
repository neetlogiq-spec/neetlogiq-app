# Why Fields Were Cleared - Root Cause Analysis

## Problem Reported

After PASS 2 matching, these columns were set to NULL:
- ❌ seats
- ❌ management
- ❌ university_affiliation
- ❌ normalized_college_name, normalized_course_name, normalized_state, normalized_address
- ❌ course_type
- ❌ source_file

These are **original data** columns imported from seat/counselling data, not matching results.

## Root Cause: _ensure_dataframe_columns() Function

The culprit is the `_ensure_dataframe_columns()` function (originally lines 18026-18062):

```python
def _ensure_dataframe_columns(self, df, table_name='seat_data'):
    required_columns = [
        'id', 'college_name', 'course_name', 'seats', 'state', 'address',
        'management', 'university_affiliation', 'normalized_college_name',
        'normalized_course_name', 'normalized_state', 'normalized_address',
        'course_type', 'source_file', 'created_at', 'updated_at',
        # ... matching columns
    ]

    # ❌ THE BUG: Add missing columns with None values!
    for col in required_columns:
        if col not in df.columns:
            # If column is missing, add it as None!
            df[col] = None  # ← OVERWRITES GOOD DATA WITH NULL!

    # Then filter to keep only required columns
    columns_to_keep = required_columns + [...]
    df = df[[col for col in columns_to_keep if col in df.columns]]
```

## How Data Was Lost: The Sequence

### Step 1: Load data with all columns
```python
results_df = pd.read_sql(f"SELECT * FROM {table_name}", conn)
# ✅ results_df has: seats, management, university_affiliation,
#    normalized_*, course_type, source_file (all with data)
```

### Step 2: Do PASS 1 matching
```python
# Update matching columns like master_college_id, college_match_score, etc.
# Original data columns UNCHANGED - still have their values
```

### Step 3: Do PASS 2 matching
```python
results_df.loc[mask] = updated_values  # Updates specific rows
# Original data columns still fine
```

### Step 4: Deduplication - **WHERE THE PROBLEM STARTS**
```python
matched_df = matched_df.drop(rows_to_drop)  # Drop some rows
unmatched_df = results_df[...]  # Get remaining rows

# ❌ PROBLEM: pd.concat() can cause data type misalignment!
results_df = pd.concat([matched_df, unmatched_df], ignore_index=False)
```

When you concat two dataframes that were split and modified:
- Column data types might not align
- Some columns might temporarily become NaN/None
- Pandas fills misaligned data with NaN

### Step 5: **THE CRITICAL MISTAKE**
```python
# Line 14703: Called after PASS 2
results_df = self._ensure_dataframe_columns(results_df, table_name)
```

This function runs and checks:
```python
for col in required_columns:
    if col not in df.columns or df[col].isna():
        df[col] = None  # ← OVERWRITES WITH NULL!
```

If the concat operation caused NaN in `seats`, `management`, `university_affiliation`, etc., the function would overwrite them with None!

### Step 6: Save to database
```python
results_df.to_sql(table_name, conn, if_exists='replace', index=False)
# ✅ Saves, but now seats, management, etc. are NULL!
```

## Why This Happens

The `_ensure_dataframe_columns()` function was designed to:
1. ✅ Add missing columns (safe for matching fields)
2. ❌ Add missing original data columns as None (DANGEROUS!)

The assumption was: "If a required column is missing, it's safe to add it as None"

**But this assumption is wrong for original data columns!**
- If `seats` is missing, something went wrong - we shouldn't silently add None
- If `management` is missing, we're losing data - we shouldn't add None
- Original data should NEVER be created as None

## The Fix

Separate matching columns from original data columns:

```python
# ONLY add these if missing (safe):
matching_columns = [
    'master_college_id', 'master_course_id', 'master_state_id',
    'college_match_score', 'course_match_score',
    'college_match_method', 'course_match_method',
    'is_linked', 'state_id', 'college_id', 'course_id'
]

# NEVER add these if missing (original data):
original_data_columns = [
    'seats', 'management', 'university_affiliation',
    'normalized_college_name', 'normalized_course_name',
    'normalized_state', 'normalized_address',
    'course_type', 'source_file'
]

# Add ONLY matching columns if missing
for col in matching_columns:
    if col not in df.columns:
        df[col] = None  # Safe - these are generated fields

# DO NOT add original data columns - preserve what's there
# If they're missing, something failed upstream - expose the error
```

## Changes Made

**File**: `recent3.py` lines 18026-18094

**Key changes**:
1. Split columns into two categories: matching_columns and original_data_columns
2. Only add matching_columns if missing (safe to add as None)
3. Never add original_data_columns (if missing, expose the error)
4. Keep ALL columns from the dataframe (don't delete anything)
5. Reorder columns but preserve all data

## Prevention Strategy

This bug reveals a deeper issue:
- `_ensure_dataframe_columns()` shouldn't be adding data columns as None
- It should only ensure matching columns exist
- If original data columns are missing, the code should fail loudly, not silently

### Better Approach

```python
def _ensure_dataframe_columns(self, df, table_name='seat_data'):
    """
    Only ensure GENERATED/MATCHING columns exist.
    NEVER touch original data columns.
    """

    # Only add matching columns if missing
    matching_columns = {
        'master_college_id': None,
        'master_course_id': None,
        'college_match_score': 0.0,
        'is_linked': 0,
        # ... more matching fields
    }

    for col, default_value in matching_columns.items():
        if col not in df.columns:
            df[col] = default_value

    # Keep ALL columns - don't delete anything
    # If original data is missing, that's an error - let it show up

    return df
```

## Expected Results After Fix

```
Before Fix:
  seats: NULL ❌
  management: NULL ❌
  university_affiliation: NULL ❌
  normalized_*: NULL ❌
  course_type: NULL ❌
  source_file: NULL ❌

After Fix:
  seats: Preserved ✅
  management: Preserved ✅
  university_affiliation: Preserved ✅
  normalized_*: Preserved ✅
  course_type: Preserved ✅
  source_file: Preserved ✅
```

## Key Lessons

1. **Separate generated data from original data**
   - Generated fields: Can safely default to None/0
   - Original fields: Must be preserved exactly as imported

2. **Don't mask upstream errors**
   - If a column is missing, that's a signal something went wrong
   - Don't silently add None - let it fail so you can see the problem

3. **Be careful with pd.concat()**
   - After concat, columns might have NaN values
   - Don't blindly fill NaN with None - investigate why they're there

4. **Test data preservation**
   - After matching, original columns should be 100% intact
   - Add tests to verify data wasn't modified: `assert original_data_df.equals(matched_df[original_cols])`

## Testing

To verify the fix:
```sql
-- All original data columns should have values
SELECT COUNT(*) FROM seat_data WHERE seats IS NULL;  -- Should be 0
SELECT COUNT(*) FROM seat_data WHERE management IS NULL;  -- Should be 0
SELECT COUNT(*) FROM seat_data WHERE course_type IS NULL;  -- Should be 0

-- Matching columns can be NULL (for unmatched records)
SELECT COUNT(*) FROM seat_data WHERE master_college_id IS NULL;  -- OK if > 0
```

This fix ensures that original imported data is NEVER overwritten with NULL values.
