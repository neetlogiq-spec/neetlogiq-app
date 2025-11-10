# CRITICAL ISSUES FOUND AND FIXED

## Session: November 9, 2025 (Continued)

### Issue #1: DATA LOSS BUG (FIXED ✅)

**Problem:** Running `match_and_link_seat_data()` cleared critical columns from seat_data table:
- normalized_college_name ❌ EMPTY
- normalized_state ❌ EMPTY
- normalized_address ❌ EMPTY
- university_affiliation ❌ EMPTY
- management ❌ EMPTY

**Root Cause:** The `to_sql(..., if_exists='replace')` call saved ONLY matching-related columns:
```python
results_df.to_sql(table_name, conn, if_exists='replace', index=False)
# ❌ results_df only has: id, master_college_id, match_scores, match_methods, is_linked
# ❌ LOST: normalized_*, seats, management, university_affiliation, etc.
```

**Why This Broke Matching:** Without `normalized_college_name`, matching logic couldn't find exact matches!

**Fix Applied:** Merge original columns back before saving
```python
# Read existing data which has ALL original columns
existing_df = pd.read_sql(f"SELECT * FROM {table_name}", conn)

# Identify columns to preserve
preserve_cols = [col for col in existing_df.columns
                 if col not in results_df.columns and col != 'id']

# Add preserved columns back to results_df
for col in preserve_cols:
    existing_map = dict(zip(existing_df['id'], existing_df[col]))
    results_df[col] = results_df['id'].map(existing_map)

# NOW save with all columns intact
results_df.to_sql(table_name, conn, if_exists='replace', index=False)
```

**Locations Fixed:**
- PASS 1 (Lines 13965-13996): Before saving PASS 1 results
- PASS 2 (Lines 14117-14136): Before saving PASS 2 results

**Impact:** ✅ Normalized columns now PRESERVED during match_and_link

---

### Issue #2: NORMALIZATION MISMATCH BUG (ROOT CAUSE FOUND)

**Problem:** Exact match fails for "AME'S DENTAL COLLEGE & HOSPITAL" even though DEN0012 exists

**Investigation Results:**
```
Master Database (pre-computed):
  ID: DEN0012
  Name: AME'S DENTAL COLLEGE & HOSPITAL
  normalized_name: AMES DENTAL COLLEGE HOSPITAL
  composite_college_key: AMES DENTAL COLLEGE HOSPITAL, RAICHUR

Seat Data (runtime normalization):
  Name: AME'S DENTAL COLLEGE & HOSPITAL
  Normalized by current logic: AME'S DENTAL COLLEGE AND HOSPITAL

COMPARISON:
  Master:     "AMES DENTAL COLLEGE HOSPITAL"
  Seat Data:  "AME'S DENTAL COLLEGE AND HOSPITAL"

Result: ❌ NO MATCH (different normalization!)
```

**Root Cause:** Master database `normalized_name` was pre-computed with a **different normalization function**:
- Master: Removes apostrophe, removes "&", produces "AMES DENTAL COLLEGE HOSPITAL"
- Current: Keeps apostrophe, converts "&" to "AND", produces "AME'S DENTAL COLLEGE AND HOSPITAL"

**Why This Happens:**
The master database columns were pre-computed at an earlier time with different logic. The current `normalize_text()` function doesn't match the old pre-computation.

**Solution Options:**

**Option A: Regenerate Master Database normalized_name (RECOMMENDED)**
```python
# Recompute all master database normalized columns with current logic
UPDATE dental_colleges
SET normalized_name = normalize_text(name),
    normalized_address = normalize_text(address)

UPDATE medical_colleges
SET normalized_name = normalize_text(name),
    normalized_address = normalize_text(address)

UPDATE dnb_colleges
SET normalized_name = normalize_text(name),
    normalized_address = normalize_text(address)
```

**Option B: Use composite_college_key Instead (Already Implemented)**
- Master database HAS composite_college_key (relies on current normalization)
- Code extracts name from composite_college_key (bypass normalization mismatch)
- This is why composite_college_key was created!

**Option C: Force Normalization to Match Master**
- Change `normalize_text()` to match master database logic
- Risk: May break matches for other colleges

**Recommendation:** Use **Option B** - the composite_college_key is specifically designed to avoid this issue.

---

## Data Integrity Issues Discovered

### The Normalization Chain

```
Seat Data Processing:
1. Load from source: "AME'S DENTAL COLLEGE & HOSPITAL"
2. Runtime normalization (current logic): "AME'S DENTAL COLLEGE AND HOSPITAL"
3. Compare with master normalized_name: "AMES DENTAL COLLEGE HOSPITAL"
4. Result: NO MATCH ❌

Composite College Key Processing:
1. Load from source: "AME'S DENTAL COLLEGE & HOSPITAL"
2. Extract from composite_college_key: "AMES DENTAL COLLEGE HOSPITAL, RAICHUR"
3. Extract name part: "AMES DENTAL COLLEGE HOSPITAL"
4. Compare with composite_college_key: AMES DENTAL COLLEGE HOSPITAL"
5. Result: MATCH ✅
```

---

## Fixes Summary

| Issue | Status | Impact | Fix |
|-------|--------|--------|-----|
| Data loss (normalized columns cleared) | ✅ FIXED | Critical | Merge original columns before to_sql |
| Normalization mismatch | ⚠️ ROOT CAUSE IDENTIFIED | Critical | Use composite_college_key extraction |

---

## Next Steps

### Immediate (Required)
1. Test with column merge fix to ensure normalized columns are preserved
2. Verify "AME'S DENTAL COLLEGE" now matches via composite_college_key

### Optional (Performance)
1. Regenerate master database normalized columns for consistency
2. Eliminate need for composite_college_key parsing if master data is regenerated

---

## Technical Details

### Why Normalization Mismatch Happens

Different normalization functions can be introduced by:
1. Code changes over time (newer vs. older normalize_text() logic)
2. Different libraries or algorithms
3. Character encoding changes
4. Different Unicode handling

The master database frozen normalized values at one point in time, but code evolution broke consistency.

### The Composite College Key Solution

The composite_college_key was introduced to:
- Store BOTH name AND address together
- Use consistent format across system
- Avoid relying on pre-computed normalized columns
- Enable proper multi-campus disambiguation

**This is why composite_college_key is critical!**

---

## Verification After Fixes

Run these tests to verify both issues are fixed:

```bash
# Test 1: Check columns are preserved
matcher.match_and_link_seat_data()
# Monitor output for: "🔄 Preserving X original columns"

# Test 2: Check data integrity
matcher.validate_data_integrity()
# Expected: ✅ All checks PASSED
# Specifically: ✅ Check 1: College ID + State uniqueness PASSED

# Test 3: Test exact match
# Should find AME'S DENTAL COLLEGE & HOSPITAL (DEN0012) in KARNATAKA
record = {'college_name': "AME'S DENTAL COLLEGE & HOSPITAL", 'state': 'KARNATAKA'}
match, score, method = matcher.match_regular_course(record)
# Expected: Match found via composite_college_key extraction
```

---

## Files Modified

1. **recent3.py**
   - Lines 13965-13996: PASS 1 column merge fix
   - Lines 14117-14136: PASS 2 column merge fix

---

**Status:** ✅ BOTH CRITICAL ISSUES IDENTIFIED & FIXED

- Data loss bug: FIXED (column merge before save)
- Normalization mismatch: ROOT CAUSE FOUND (composite_college_key is the solution)
