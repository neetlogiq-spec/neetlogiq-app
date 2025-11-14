# Counselling Records Table - Schema vs Importer Analysis

## Table Schema (Actual Database)

**Location**: Lines 21306-21340 in `recent3.py`

### Complete Column List (30 columns)

| # | Column Name | Type | Constraints | Category |
|---|-------------|------|-------------|----------|
| 1 | `id` | TEXT | PRIMARY KEY | System |
| 2 | `all_india_rank` | INTEGER | NOT NULL | RAW |
| 3 | `quota` | TEXT | | RAW |
| 4 | `college_institute_raw` | TEXT | NOT NULL | RAW |
| 5 | `address` | TEXT | | RAW |
| 6 | `address_normalized` | TEXT | | NORMALIZED |
| 7 | `state_raw` | TEXT | | RAW |
| 8 | `course_raw` | TEXT | NOT NULL | RAW |
| 9 | `category` | TEXT | | RAW |
| 10 | `round_raw` | TEXT | NOT NULL | RAW |
| 11 | `year` | INTEGER | NOT NULL | RAW |
| 12 | `college_institute_normalized` | TEXT | | NORMALIZED |
| 13 | `state_normalized` | TEXT | | NORMALIZED |
| 14 | `course_normalized` | TEXT | | NORMALIZED |
| 15 | `source_normalized` | TEXT | | NORMALIZED |
| 16 | `level_normalized` | TEXT | | NORMALIZED |
| 17 | `round_normalized` | INTEGER | | NORMALIZED |
| 18 | `master_college_id` | TEXT | | Master Link |
| 19 | `master_course_id` | TEXT | | Master Link |
| 20 | `master_state_id` | TEXT | | Master Link |
| 21 | `master_quota_id` | TEXT | | Master Link |
| 22 | `master_category_id` | TEXT | | Master Link |
| 23 | `master_source_id` | TEXT | | Master Link |
| 24 | `master_level_id` | TEXT | | Master Link |
| 25 | `college_match_score` | REAL | | Match Metadata |
| 26 | `college_match_method` | TEXT | | Match Metadata |
| 27 | `course_match_score` | REAL | | Match Metadata |
| 28 | `course_match_method` | TEXT | | Match Metadata |
| 29 | `is_matched` | BOOLEAN | DEFAULT FALSE | Status |
| 30 | `needs_manual_review` | BOOLEAN | DEFAULT FALSE | Status |
| 31 | `partition_key` | TEXT | NOT NULL | System |
| 32 | `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | System |
| 33 | `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | System |

**Total: 33 columns in schema**

---

## INSERT Statement (What Importer Tries to Insert)

**Location**: Lines 21387-21415 in `recent3.py`

### Columns in INSERT Statement (30 columns)

| # | Column Name | Value Source | Category |
|---|-------------|--------------|----------|
| 1 | `id` | `record['id']` | System |
| 2 | `all_india_rank` | `record['all_india_rank']` | RAW |
| 3 | `quota` | `record['quota']` | RAW |
| 4 | `college_institute_raw` | `record['college_institute_raw']` | RAW |
| 5 | `address` | `record.get('address', '')` | RAW |
| 6 | `address_normalized` | `record.get('address_normalized', '')` | NORMALIZED |
| 7 | `state_raw` | `record['state_raw']` | RAW |
| 8 | `course_raw` | `record['course_raw']` | RAW |
| 9 | `category` | `record['category']` | RAW |
| 10 | `round_raw` | `record['round_raw']` | RAW |
| 11 | `year` | `record['year']` | RAW |
| 12 | `college_institute_normalized` | `record['college_institute_normalized']` | NORMALIZED |
| 13 | `state_normalized` | `record['state_normalized']` | NORMALIZED |
| 14 | `course_normalized` | `record['course_normalized']` | NORMALIZED |
| 15 | `source_normalized` | `record['source_normalized']` | NORMALIZED |
| 16 | `level_normalized` | `record['level_normalized']` | NORMALIZED |
| 17 | `round_normalized` | `record['round_normalized']` | NORMALIZED |
| 18 | `master_college_id` | `record.get('master_college_id')` | Master Link |
| 19 | `master_course_id` | `record.get('master_course_id')` | Master Link |
| 20 | `master_state_id` | `record.get('master_state_id')` | Master Link |
| 21 | `master_quota_id` | `record.get('master_quota_id')` | Master Link |
| 22 | `master_category_id` | `record.get('master_category_id')` | Master Link |
| 23 | `master_source_id` | `record.get('master_source_id')` | Master Link |
| 24 | `master_level_id` | `record.get('master_level_id')` | Master Link |
| 25 | `college_match_score` | `record.get('college_match_score')` | Match Metadata |
| 26 | `college_match_method` | `record.get('college_match_method')` | Match Metadata |
| 27 | `course_match_score` | `record.get('course_match_score')` | Match Metadata |
| 28 | `course_match_method` | `record.get('course_match_method')` | Match Metadata |
| 29 | `partition_key` | `record['partition_key']` | System |
| 30 | `is_matched` | `record['is_matched']` | Status |

**Total: 30 columns in INSERT statement**

---

## Comparison: Schema vs INSERT Statement

### ✅ Columns Present in BOTH Schema and INSERT (30 columns)

All 30 columns in the INSERT statement exist in the schema. ✅

### ❌ Columns in Schema but NOT in INSERT (3 columns)

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `needs_manual_review` | BOOLEAN | FALSE | Not set during import |
| `created_at` | TIMESTAMP | CURRENT_TIMESTAMP | Auto-set by database |
| `updated_at` | TIMESTAMP | CURRENT_TIMESTAMP | Auto-set by database |

**Note**: These are acceptable - `needs_manual_review` is set later, and timestamps are auto-generated.

---

## Data Mapping: Excel → Database

### RAW Data Columns (Stored As-Is from Excel)

| Database Column | Excel Source | Processing | Status |
|----------------|--------------|------------|--------|
| `college_institute_raw` | `COLLEGE/INSTITUTE` | None - stored as-is | ✅ |
| `state_raw` | `STATE` | None - stored as-is | ✅ |
| `course_raw` | `COURSE` | None - stored as-is | ✅ |
| `address` | Extracted from `COLLEGE/INSTITUTE` | Split by comma | ✅ |
| `all_india_rank` | `ALL_INDIA_RANK` | None - stored as-is | ✅ |
| `quota` | `QUOTA` | None - stored as-is | ✅ |
| `category` | `CATEGORY` | None - stored as-is | ✅ |
| `round_raw` | `ROUND` | None - stored as-is | ✅ |
| `year` | `YEAR` | None - stored as-is | ✅ |

### NORMALIZED Data Columns (Processed/Normalized)

| Database Column | Excel Source | Normalization Function | Status |
|----------------|--------------|------------------------|--------|
| `college_institute_normalized` | `COLLEGE/INSTITUTE` → Split → `college_name` | `normalize_text(college_name)` | ✅ |
| `state_normalized` | `STATE` | `normalize_state_name_import(row.STATE)` | ✅ |
| `course_normalized` | `COURSE` | `normalize_text(row.COURSE, preserve_slash=True)` | ✅ |
| `address_normalized` | Extracted `address` | `normalize_text(address)` | ✅ |
| `source_normalized` | Parsed from `ROUND` | `parse_round_field()` → `source` | ✅ |
| `level_normalized` | Parsed from `ROUND` | `parse_round_field()` → `level` | ✅ |
| `round_normalized` | Parsed from `ROUND` | `parse_round_field()` → `round_num` | ✅ |

### Master Data Link Columns (After Matching)

| Database Column | Source | Matching Function | Status |
|----------------|--------|-------------------|--------|
| `master_college_id` | `college_name` + `state` + `address` | `match_college_ai_enhanced()` | ✅ |
| `master_course_id` | `COURSE` | `match_course_enhanced()` | ✅ |
| `master_state_id` | `state_normalized` | Exact match from `master_data['states']` | ✅ |
| `master_quota_id` | `QUOTA` | `exact_match_quota_category()` | ✅ |
| `master_category_id` | `CATEGORY` | `exact_match_quota_category()` | ✅ |
| `master_source_id` | `source` (from ROUND) | `match_source()` | ✅ |
| `master_level_id` | `level` (from ROUND) | `match_level()` | ✅ |

### Match Metadata Columns

| Database Column | Source | Status |
|----------------|--------|--------|
| `college_match_score` | `college_score` from matching | ✅ |
| `college_match_method` | `college_method` from matching | ✅ |
| `course_match_score` | `course_score` from matching | ✅ |
| `course_match_method` | `course_method` from matching | ✅ |

### System Columns

| Database Column | Source | Status |
|----------------|--------|--------|
| `id` | Generated: `{source}-{level}-{year}-{rank}-{round}` | ✅ |
| `partition_key` | Generated: `{source}-{level}-{year}` | ✅ |
| `is_matched` | Calculated: All master IDs present | ✅ |

---

## Issues Found

### ✅ No Critical Issues

1. **All INSERT columns exist in schema** - No missing columns
2. **All required columns are being inserted** - No missing data
3. **RAW columns get raw data** - Correct mapping
4. **NORMALIZED columns get normalized data** - Correct mapping

### ⚠️ Minor Observations

1. **`needs_manual_review` not set during import** - This is intentional, set later during review
2. **`created_at` and `updated_at` auto-generated** - This is correct, handled by database
3. **`address_normalized` was missing initially** - Already fixed in previous update

---

## Column Count Verification

- **Schema columns**: 33 total
- **INSERT columns**: 30 total
- **Difference**: 3 columns (all auto-generated or set later)
- **Match**: ✅ Perfect match for all imported columns

---

## Summary

### ✅ What's Working

1. **Schema matches INSERT statement** - All 30 imported columns exist in schema
2. **RAW data goes to RAW columns** - Correct mapping
3. **NORMALIZED data goes to NORMALIZED columns** - Correct mapping
4. **All required fields are populated** - No missing critical data

### 📊 Column Breakdown

- **RAW columns**: 9 columns (store unprocessed Excel data)
- **NORMALIZED columns**: 7 columns (store processed/normalized data)
- **Master link columns**: 7 columns (store master data IDs)
- **Match metadata columns**: 4 columns (store matching scores/methods)
- **System columns**: 3 columns (id, partition_key, is_matched)
- **Auto-generated columns**: 3 columns (needs_manual_review, created_at, updated_at)

### ✅ Conclusion

The importer correctly maps data to the appropriate columns:
- **RAW columns** receive unprocessed Excel values
- **NORMALIZED columns** receive processed/normalized values
- **All columns in INSERT statement exist in schema**
- **No data loss or misplacement**

The schema and importer are properly aligned! ✅

