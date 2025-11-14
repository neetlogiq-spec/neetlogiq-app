# Complete Fix: Counselling Table Deletion Issue

## Problem Summary

The `counselling_records` table was being deleted after running match and link operations, causing import failures with error:
```
❌ Import failed: no such table: counselling_records
```

## Root Causes Identified

### 1. **Unsafe Table Replacement (Lines 16853, 17032)**
- `to_sql()` with `if_exists='replace'` drops table first, then recreates
- If save fails, table is dropped but not recreated = DATA LOSS
- No backup or error handling

### 2. **Missing Table Creation in Import (Line 21260)**
- Import function assumes table exists
- If table was deleted, import fails immediately
- No table creation logic

## Fixes Implemented

### Fix 1: Safe Table Replacement with Backup (Lines 16852-16926, 17097-17167)

**Location**: `match_and_link_parallel()` function - PASS 1 and PASS 2 save operations

**Changes**:
1. **Pre-save Validation**:
   - Check if `results_df` is empty (prevents saving empty data)
   - Check if required 'id' column exists
   - Raise error before attempting save

2. **Backup Creation**:
   - Create timestamped backup table before replacing
   - Log backup creation with record count
   - Continue without backup if creation fails (with warning)

3. **Transaction Wrapper**:
   - Wrap save operation in transaction
   - Rollback on error

4. **Post-save Verification**:
   - Verify row count matches expected
   - Raise error if mismatch

5. **Error Recovery**:
   - On error, rollback transaction
   - Restore table from backup if available
   - Clear error messages to user

6. **Cleanup**:
   - Drop backup table after successful save
   - Log all operations

**Code Pattern**:
```python
# Validate
if results_df.empty:
    raise ValueError("Cannot save empty results!")

# Create backup
backup_table = f"{table_name}_backup_{timestamp}"
cursor.execute(f"CREATE TABLE {backup_table} AS SELECT * FROM {table_name}")

# Transaction
conn.execute("BEGIN TRANSACTION")
try:
    results_df.to_sql(table_name, conn, if_exists='replace', index=False)
    # Verify
    verify_count = cursor.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    if verify_count != len(results_df):
        raise ValueError("Row count mismatch!")
    conn.commit()
    # Drop backup
    cursor.execute(f"DROP TABLE {backup_table}")
except Exception as e:
    conn.rollback()
    # Restore from backup
    cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
    cursor.execute(f"ALTER TABLE {backup_table} RENAME TO {table_name}")
    raise
```

### Fix 2: Table Creation in Import Function (Lines 21263-21358)

**Location**: `import_excel_counselling()` function

**Changes**:
1. **Table Existence Check**:
   - Check if `counselling_records` table exists before inserting
   - Create table if missing

2. **Full Schema Creation**:
   - Create table with all required columns
   - Match schema from DATABASE_SCHEMAS.md
   - Include all fields used in INSERT statements

3. **Index Creation**:
   - Create standard indexes (partition, year, college, course, matched)
   - Create partial indexes for unmatched records
   - Handle index creation errors gracefully

**Code Pattern**:
```python
# Check if table exists
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='counselling_records'")
if not cursor.fetchone():
    # Create table with full schema
    cursor.execute("CREATE TABLE counselling_records (...)")
    # Create indexes
    cursor.execute("CREATE INDEX ...")
    conn.commit()
```

## Testing Checklist

- [x] Fix 1: Safe table replacement implemented
- [x] Fix 2: Table creation in import implemented
- [ ] Test normal matching flow (table should persist)
- [ ] Test with empty DataFrame (should error gracefully, not delete table)
- [ ] Test with missing columns (should error gracefully)
- [ ] Test with database error (should restore from backup)
- [ ] Test import when table doesn't exist (should create table)
- [ ] Test import when table exists (should work normally)
- [ ] Verify manual mappings are preserved
- [ ] Verify matched records are saved correctly

## Expected Behavior After Fix

### Scenario 1: Normal Matching
1. Matching runs successfully
2. Backup table created
3. Results saved to `counselling_records`
4. Backup table dropped
5. Table persists with all data

### Scenario 2: Matching Error
1. Matching runs
2. Backup table created
3. Save operation fails
4. Transaction rolled back
5. Table restored from backup
6. User sees error message
7. Table persists with original data

### Scenario 3: Import After Table Deletion
1. Table was deleted (edge case)
2. Import function called
3. Table existence checked
4. Table created if missing
5. Records imported successfully

## Files Modified

1. **recent3.py**:
   - Lines 16852-16926: PASS 1 safe save
   - Lines 17097-17167: PASS 2 safe save
   - Lines 21263-21358: Table creation in import

## Related Documentation

- `COUNSELLING_TABLE_DELETION_FIX.md` - Initial analysis
- `DATABASE_SCHEMAS.md` - Table schema reference
- `RECENT3_PY_COMPREHENSIVE_ANALYSIS.md` - Overall codebase analysis

## Status

✅ **FIXES IMPLEMENTED** - Ready for testing

Both fixes are in place:
1. Safe table replacement with backup/restore
2. Table creation in import function

The code should now:
- Never lose data due to failed saves
- Automatically recreate table if missing
- Provide clear error messages
- Maintain data integrity

