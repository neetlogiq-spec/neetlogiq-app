# Counselling Data Importer - Column Mapping Analysis

## Excel File Expected Columns

The importer expects these **8 columns** in the Excel file:

1. **ALL_INDIA_RANK** - Integer rank
2. **QUOTA** - Quota type (e.g., "STATE", "ALL INDIA")
3. **COLLEGE/INSTITUTE** or **COLLEGE_INSTITUTE** - College name with address (comma-separated)
4. **STATE** - State name
5. **COURSE** - Course name
6. **CATEGORY** - Category (e.g., "GEN", "OBC", "SC", "ST")
7. **ROUND** - Round format: `SOURCE_LEVEL_R#` (e.g., "AIQ_UG_R1", "KEA_PG_R2")
8. **YEAR** - Year (integer)

**Location**: Lines 21117-21118

---

## Database Columns - RAW Data Storage

The following columns store **RAW (unprocessed) data** directly from Excel:

| Database Column | Excel Source | Processing | Notes |
|----------------|--------------|------------|-------|
| `college_institute_raw` | `COLLEGE/INSTITUTE` or `COLLEGE_INSTITUTE` | None - stored as-is | Full value from Excel (may contain address) |
| `state_raw` | `STATE` | None - stored as-is | Raw state name from Excel |
| `course_raw` | `COURSE` | None - stored as-is | Raw course name from Excel |
| `address` | Extracted from `COLLEGE/INSTITUTE` | Split by comma (after first comma) | Extracted address part |
| `all_india_rank` | `ALL_INDIA_RANK` | None - stored as-is | Integer rank |
| `quota` | `QUOTA` | None - stored as-is | Raw quota value |
| `category` | `CATEGORY` | None - stored as-is | Raw category value |
| `round_raw` | `ROUND` | None - stored as-is | Raw round field (e.g., "AIQ_UG_R1") |
| `year` | `YEAR` | None - stored as-is | Integer year |

**Location**: Lines 21220-21247 (record creation), Lines 21387-21407 (INSERT statement)

---

## Database Columns - NORMALIZED Data Storage

The following columns store **NORMALIZED (processed) data**:

| Database Column | Excel Source | Normalization Function | Notes |
|----------------|--------------|------------------------|-------|
| `college_institute_normalized` | `COLLEGE/INSTITUTE` → Split → `college_name` | `normalize_text(college_name)` | College name after split, then normalized |
| `state_normalized` | `STATE` | `normalize_state_name_import(row.STATE)` | State name normalized (DELHI → DELHI (NCT)) |
| `course_normalized` | `COURSE` | `normalize_text(row.COURSE, preserve_slash=True)` | Course name normalized |
| `address_normalized` | Extracted `address` | `normalize_text(address)` | Address part normalized |
| `source_normalized` | Parsed from `ROUND` | `parse_round_field()` → `source` | Source extracted (AIQ, KEA, STATE) |
| `level_normalized` | Parsed from `ROUND` | `parse_round_field()` → `level` | Level extracted (UG, PG, DEN) |
| `round_normalized` | Parsed from `ROUND` | `parse_round_field()` → `round_num` | Round number extracted (1, 2, 3, etc.) |

**Location**: Lines 21139-21149 (normalization), Lines 21249-21256 (record creation), Lines 21390-21412 (INSERT statement)

---

## Database Columns - Master Data Links

These columns store **master data IDs** after matching:

| Database Column | Source | Matching Function | Notes |
|----------------|--------|-------------------|-------|
| `master_college_id` | `college_name` + `state` + `address` | `match_college_ai_enhanced()` | College ID from master database |
| `master_course_id` | `COURSE` | `match_course_enhanced()` | Course ID from master database |
| `master_state_id` | `state_normalized` | Exact match from `master_data['states']` | State ID from master database |
| `master_quota_id` | `QUOTA` | `exact_match_quota_category()` | Quota ID from master database |
| `master_category_id` | `CATEGORY` | `exact_match_quota_category()` | Category ID from master database |
| `master_source_id` | `source` (from ROUND) | `match_source()` | Source ID from master database |
| `master_level_id` | `level` (from ROUND) | `match_level()` | Level ID from master database |

**Location**: Lines 21154-21183 (matching), Lines 21258-21265 (record creation), Lines 21392-21400 (INSERT statement)

---

## Database Columns - Match Metadata

These columns store **matching results and scores**:

| Database Column | Source | Notes |
|----------------|--------|-------|
| `college_match_score` | `college_score` from matching | Confidence score (0.0-1.0) |
| `college_match_method` | `college_method` from matching | Method used (e.g., "exact", "fuzzy", "ai_enhanced") |
| `course_match_score` | `course_score` from matching | Confidence score (0.0-1.0) |
| `course_match_method` | `course_method` from matching | Method used |
| `is_matched` | Calculated boolean | True if ALL master IDs are present |

**Location**: Lines 21191-21201 (is_matched calculation), Lines 21267-21271 (record creation), Lines 21395-21403 (INSERT statement)

---

## Database Columns - System Fields

| Database Column | Source | Notes |
|----------------|--------|-------|
| `id` | Generated | Format: `{source}-{level}-{year}-{rank}-{round}` |
| `partition_key` | Generated | Format: `{source}-{level}-{year}` |
| `created_at` | Auto | Timestamp (default: CURRENT_TIMESTAMP) |
| `updated_at` | Auto | Timestamp (default: CURRENT_TIMESTAMP) |
| `needs_manual_review` | Not set during import | Boolean (default: FALSE) |

**Location**: Lines 21185-21189 (ID and partition_key generation), Lines 21235-21236, 21274 (record creation)

---

## Complete INSERT Statement Column Order

**Location**: Lines 21387-21415

```sql
INSERT OR REPLACE INTO counselling_records (
    -- Primary key
    id,
    
    -- RAW VALUES (from Excel, unprocessed)
    all_india_rank,
    quota,
    college_institute_raw,      -- RAW: Full value from Excel
    address,                     -- RAW: Extracted address part
    address_normalized,          -- NORMALIZED: Normalized address
    state_raw,                   -- RAW: Raw state from Excel
    course_raw,                  -- RAW: Raw course from Excel
    category,
    round_raw,
    year,
    
    -- NORMALIZED VALUES (processed/normalized)
    college_institute_normalized, -- NORMALIZED: Normalized college name
    state_normalized,             -- NORMALIZED: Normalized state
    course_normalized,            -- NORMALIZED: Normalized course
    source_normalized,
    level_normalized,
    round_normalized,
    
    -- Master data links
    master_college_id,
    master_course_id,
    master_state_id,
    master_quota_id,
    master_category_id,
    master_source_id,
    master_level_id,
    
    -- Match metadata
    college_match_score,
    college_match_method,
    course_match_score,
    course_match_method,
    
    -- Status
    partition_key,
    is_matched
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

**Total: 30 columns, 30 placeholders**

---

## Data Flow Summary

### Step 1: Read Excel (Line 21112)
- Reads Excel file with pandas
- Validates 8 required columns exist

### Step 2: Process Each Row (Lines 21130-21278)
1. **Parse ROUND field** → Extract `source`, `level`, `round_num`
2. **Split COLLEGE/INSTITUTE** → Extract `college_name`, `address`
3. **Normalize fields**:
   - `college_normalized` = normalize_text(college_name)
   - `course_normalized` = normalize_text(COURSE, preserve_slash=True)
   - `state_normalized` = normalize_state_name_import(STATE)
   - `address_normalized` = normalize_text(address)
4. **Match to master data** → Get master IDs
5. **Create record dictionary** with RAW and NORMALIZED values

### Step 3: Insert to Database (Lines 21385-21415)
- Inserts records with proper RAW/NORMALIZED column mapping
- Uses `INSERT OR REPLACE` to handle duplicates

---

## Key Points

1. **RAW columns** store unprocessed Excel values:
   - `college_institute_raw` = Full Excel value (may include address)
   - `state_raw` = Raw state from Excel
   - `course_raw` = Raw course from Excel
   - `address` = Extracted address part (after split)

2. **NORMALIZED columns** store processed values:
   - `college_institute_normalized` = Normalized college name (after split)
   - `state_normalized` = Normalized state (canonical form)
   - `course_normalized` = Normalized course
   - `address_normalized` = Normalized address

3. **COLLEGE/INSTITUTE field** is special:
   - Contains both college name AND address (comma-separated)
   - Split into: `college_name` (before comma) and `address` (after comma)
   - `college_institute_raw` stores the FULL original value
   - `college_institute_normalized` stores normalized college name only
   - `address` stores extracted address part
   - `address_normalized` stores normalized address

4. **ROUND field** is parsed:
   - Format: `SOURCE_LEVEL_R#` (e.g., "AIQ_UG_R1")
   - Parsed into: `source` (AIQ), `level` (UG), `round_num` (1)
   - Stored in: `source_normalized`, `level_normalized`, `round_normalized`

---

## Potential Issues

1. **Missing columns**: If Excel doesn't have required columns, import fails
2. **Column name mismatch**: Code checks for both `COLLEGE/INSTITUTE` and `COLLEGE_INSTITUTE`
3. **ROUND parsing failure**: If ROUND format is invalid, record is skipped
4. **Empty values**: Validation warns but doesn't stop import

---

## File Locations

- **Import function**: `import_excel_counselling()` - Line 21072
- **Column validation**: Lines 21116-21123
- **Data processing**: Lines 21130-21278
- **Record creation**: Lines 21220-21276
- **Database insert**: Lines 21385-21415
- **Table creation**: Lines 21280-21382

