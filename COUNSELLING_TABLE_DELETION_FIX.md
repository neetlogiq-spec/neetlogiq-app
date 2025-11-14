# Fix: Counselling Table Getting Deleted After Matching

## Problem

After running counselling data matching, the `counselling_records` table is getting deleted. This is happening because of unsafe table replacement operations.

## Root Cause

**Location**: `recent3.py`, Lines 16853 and 17032

The code uses `to_sql()` with `if_exists='replace'` which:
1. **DROPS the entire table** first
2. Then recreates it with new data

**Problem**: If there's ANY error during the save operation (missing columns, data type mismatch, exception, empty DataFrame), the table gets dropped but may not be recreated properly, resulting in data loss.

### Code Locations

```python
# Line 16853 - PASS 1 Results
results_df.to_sql(table_name, conn, if_exists='replace', index=False)

# Line 17032 - PASS 2 Results  
results_df.to_sql(table_name, conn, if_exists='replace', index=False)
```

## Why This Happens

1. **No Transaction Wrapper**: The operation isn't wrapped in a transaction, so if it fails mid-way, the table is already dropped
2. **No Error Handling**: No try-except around the `to_sql()` call
3. **No Validation**: No check to ensure `results_df` has data before replacing
4. **No Backup**: No backup of original table before replacement

## Fix Strategy

### Option 1: Use Transactions + Error Handling (RECOMMENDED)

Wrap the save operation in a transaction and add proper error handling:

```python
# Around Line 16853
try:
    # Start transaction
    conn.execute("BEGIN TRANSACTION")
    
    # Validate data before replacing
    if results_df.empty:
        raise ValueError(f"Cannot replace {table_name} with empty DataFrame!")
    
    # Check required columns exist
    required_cols = ['id', 'all_india_rank', 'college_institute_raw', ...]
    missing_cols = [col for col in required_cols if col not in results_df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")
    
    # Replace table
    results_df.to_sql(table_name, conn, if_exists='replace', index=False)
    
    # Commit transaction
    conn.commit()
    
    console.print(f"[green]✅ PASS 1 Results saved to {table_name}:[/green]")
    # ... rest of success message
    
except Exception as e:
    # Rollback transaction (restores table if it was dropped)
    conn.rollback()
    console.print(f"[red]❌ Error saving results: {e}[/red]")
    logger.error(f"Error saving {table_name}: {e}", exc_info=True)
    raise  # Re-raise to stop execution
```

### Option 2: Use Append + Upsert Logic (SAFER)

Instead of replacing, use append with proper upsert:

```python
# Create temporary table
temp_table = f"{table_name}_temp_{int(time.time())}"
results_df.to_sql(temp_table, conn, if_exists='replace', index=False)

# Use UPSERT logic
conn.execute(f"""
    INSERT OR REPLACE INTO {table_name}
    SELECT * FROM {temp_table}
""")

# Drop temp table
conn.execute(f"DROP TABLE IF EXISTS {temp_table}")
conn.commit()
```

### Option 3: Backup Before Replace (DEFENSIVE)

Create a backup before replacing:

```python
# Create backup
backup_table = f"{table_name}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
conn.execute(f"CREATE TABLE {backup_table} AS SELECT * FROM {table_name}")

try:
    # Replace table
    results_df.to_sql(table_name, conn, if_exists='replace', index=False)
    conn.commit()
    
    # Drop backup after successful save
    conn.execute(f"DROP TABLE {backup_table}")
    
except Exception as e:
    # Restore from backup
    conn.execute(f"DROP TABLE IF EXISTS {table_name}")
    conn.execute(f"ALTER TABLE {backup_table} RENAME TO {table_name}")
    conn.commit()
    raise
```

## Recommended Fix (Combined Approach)

Use **Option 1** (Transactions + Error Handling) with **Option 3** (Backup) for maximum safety:

```python
# Around Line 16850-16860
try:
    # Validate before proceeding
    if results_df.empty:
        raise ValueError(f"Cannot save empty results to {table_name}!")
    
    # Check critical columns
    if 'id' not in results_df.columns:
        raise ValueError(f"Missing 'id' column in results_df!")
    
    # Create backup
    backup_table = f"{table_name}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    cursor.execute(f"CREATE TABLE IF NOT EXISTS {backup_table} AS SELECT * FROM {table_name}")
    logger.info(f"Created backup table: {backup_table}")
    
    # Start transaction
    conn.execute("BEGIN TRANSACTION")
    
    try:
        # Replace table
        results_df.to_sql(table_name, conn, if_exists='replace', index=False)
        
        # Verify save succeeded
        verify_count = cursor.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
        if verify_count != len(results_df):
            raise ValueError(f"Row count mismatch: expected {len(results_df)}, got {verify_count}")
        
        # Commit transaction
        conn.commit()
        
        # Drop backup after successful save
        cursor.execute(f"DROP TABLE IF EXISTS {backup_table}")
        conn.commit()
        
        console.print(f"[green]✅ PASS 1 Results saved to {table_name}:[/green]")
        console.print(f"[green]   • {preserved_college_count:,} manual college mappings preserved[/green]")
        console.print(f"[green]   • {preserved_course_count:,} manual course mappings preserved[/green]")
        console.print(f"[green]   • {new_matches_count:,} new automatic matches found[/green]")
        
    except Exception as e:
        # Rollback transaction
        conn.rollback()
        
        # Restore from backup
        logger.warning(f"Error saving {table_name}, restoring from backup...")
        cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
        cursor.execute(f"ALTER TABLE {backup_table} RENAME TO {table_name}")
        conn.commit()
        
        raise ValueError(f"Failed to save {table_name}: {e}. Table restored from backup.") from e
        
except Exception as e:
    console.print(f"[red]❌ Critical error saving {table_name}: {e}[/red]")
    logger.error(f"Critical error saving {table_name}: {e}", exc_info=True)
    raise
```

## Implementation Steps

1. **Fix Line 16853** (PASS 1 save):
   - Add transaction wrapper
   - Add validation checks
   - Add backup/restore logic
   - Add error handling

2. **Fix Line 17032** (PASS 2 save):
   - Same changes as PASS 1

3. **Test**:
   - Run matching on test data
   - Verify table persists after matching
   - Test error scenarios (empty DataFrame, missing columns)

## Additional Safety Measures

1. **Add Validation Function**:
```python
def _validate_results_df(self, results_df, table_name):
    """Validate results_df before saving"""
    if results_df.empty:
        raise ValueError(f"Cannot save empty DataFrame to {table_name}")
    
    # Check required columns based on table_name
    if table_name == 'counselling_records':
        required = ['id', 'all_india_rank', 'college_institute_raw', 'state_raw', 'course_raw']
    elif table_name == 'seat_data':
        required = ['id', 'college_name', 'course_name', 'state']
    else:
        required = ['id']  # Minimum requirement
    
    missing = [col for col in required if col not in results_df.columns]
    if missing:
        raise ValueError(f"Missing required columns in {table_name}: {missing}")
    
    return True
```

2. **Add Pre-Save Checks**:
```python
# Before line 16853
self._validate_results_df(results_df, table_name)

# Check row count matches expectations
if len(results_df) == 0:
    logger.warning(f"⚠️  results_df is empty - skipping save to prevent data loss")
    return
```

## Testing Checklist

- [ ] Test normal matching flow (table should persist)
- [ ] Test with empty DataFrame (should error gracefully, not delete table)
- [ ] Test with missing columns (should error gracefully)
- [ ] Test with database error (should restore from backup)
- [ ] Test PASS 1 and PASS 2 separately
- [ ] Verify manual mappings are preserved
- [ ] Verify matched records are saved correctly

## Related Code Locations

- **Line 16853**: PASS 1 save operation
- **Line 17032**: PASS 2 save operation  
- **Line 16443**: Table existence check (good - already there)
- **Line 16455**: Row count check (good - already there)

## Priority

**P0 - CRITICAL**: This causes data loss and must be fixed immediately.

## Status

- [ ] Fix implemented
- [ ] Tests passing
- [ ] Deployed to production

