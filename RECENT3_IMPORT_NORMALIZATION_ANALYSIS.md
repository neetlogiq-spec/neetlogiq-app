# recent3.py Import Functions - Normalization Analysis

File Location: `/Users/kashyapanand/Public/New/recent3.py`

---

## 1. COUNSELLING DATA IMPORT

### Function: `import_excel_counselling()`
**Location:** Lines 18183-18420
**Database Table:** `counselling_records`

#### How it reads data:
```python
# Line 18223
df = pd.read_excel(excel_path)

# Expected columns (Lines 18228-18229):
# - ALL_INDIA_RANK
# - QUOTA
# - COLLEGE/INSTITUTE (splits into college_name + address)
# - STATE
# - COURSE
# - CATEGORY
# - ROUND (format: SOURCE_LEVEL_R#)
# - YEAR
```

#### How normalized_state is set:
```python
# Line 18256
state_normalized = self.normalize_text(row.STATE)

# Then stored in record (Line 18341)
'state_normalized': state_normalized,

# Inserted into database (Lines 18372-18399):
INSERT OR REPLACE INTO counselling_records (
    ...
    state_normalized,
    ...
) VALUES (?, ?, ?, ...)
```

**Normalization Function Used:** `normalize_text()` (Lines 5272-5456)

#### How normalized_college_name is set:
```python
# Lines 18250-18254
college_name, address = self.split_college_institute(getattr(row, 'COLLEGE_INSTITUTE', ...))
college_normalized = self.normalize_text(college_name)

# Then stored in record (Line 18340)
'college_institute_normalized': college_normalized,

# Inserted into database (same INSERT statement, Line 18389)
college_institute_normalized,
```

**Normalization Function Used:** `normalize_text()` (Lines 5272-5456)

#### Additional normalization (address):
```python
# Line 18257
address_normalized = self.normalize_text(address) if address else ''

# Stored in record (Line 18334)
'address_normalized': address_normalized,
```

**Normalization Function Used:** `normalize_text()`

---

## 2. MASTER DATA IMPORTS

### A. Medical Colleges Import

**Function:** `import_medical_colleges_interactive()`
**Location:** Lines 3603-3768
**Database Table:** `medical_colleges`

#### How it reads data:
```python
# Line 3618
df = pd.read_excel(excel_path)

# Expected columns (Lines 3631-3635):
# - COLLEGE/INSTITUTE → mapped to 'name'
# - STATE → mapped to 'state'
# - ADDRESS → mapped to 'address'
```

#### How normalized_name is set:
```python
# Lines 3708-3714
for idx, name in enumerate(df['name']):
    normalized_names.append(self.normalize_text(name))
df['normalized_name'] = normalized_names

# Inserted into database (Line 3756)
df.to_sql('medical_colleges', conn, if_exists=replace_mode, index=False)
```

**Normalization Function Used:** `normalize_text()` (Lines 5272-5456)
**Line Number:** 3711

#### How normalized_state is set:
```python
# Lines 3717-3724
for idx, state in enumerate(df['state']):
    normalized_states.append(self.normalize_state_name_import(state))
df['normalized_state'] = normalized_states

# Inserted into database (Line 3756)
df.to_sql('medical_colleges', conn, if_exists=replace_mode, index=False)
```

**Normalization Function Used:** `normalize_state_name_import()` (Lines 3541-3579)
**Line Number:** 3721

---

### B. Dental Colleges Import

**Function:** `import_dental_colleges_interactive()`
**Location:** Lines 3770-3932
**Database Table:** `dental_colleges`

#### How it reads data:
```python
# Line 3782
df = pd.read_excel(excel_path)

# Expected columns (same as medical):
# - COLLEGE/INSTITUTE → 'name'
# - STATE → 'state'
# - ADDRESS → 'address'
```

#### How normalized_name is set:
```python
# Lines 3871-3878
for idx, name in enumerate(df['name']):
    normalized_names.append(self.normalize_text(name))
df['normalized_name'] = normalized_names

# Inserted into database (Line 3920)
df.to_sql('dental_colleges', conn, if_exists=replace_mode, index=False)
```

**Normalization Function Used:** `normalize_text()` (Lines 5272-5456)
**Line Number:** 3875

#### How normalized_state is set:
```python
# Lines 3881-3888
for idx, state in enumerate(df['state']):
    normalized_states.append(self.normalize_state_name_import(state))
df['normalized_state'] = normalized_states

# Inserted into database (Line 3920)
df.to_sql('dental_colleges', conn, if_exists=replace_mode, index=False)
```

**Normalization Function Used:** `normalize_state_name_import()` (Lines 3541-3579)
**Line Number:** 3885

---

### C. DNB Colleges Import

**Function:** `import_dnb_colleges_interactive()`
**Location:** Lines 3934-4096
**Database Table:** `dnb_colleges`

#### How it reads data:
```python
# Line 3946
df = pd.read_excel(excel_path)

# Expected columns (same as medical/dental):
# - COLLEGE/INSTITUTE → 'name'
# - STATE → 'state'
# - ADDRESS → 'address'
```

#### How normalized_name is set:
```python
# Lines 4035-4042
for idx, name in enumerate(df['name']):
    normalized_names.append(self.normalize_text(name))
df['normalized_name'] = normalized_names

# Inserted into database (Line 4084)
df.to_sql('dnb_colleges', conn, if_exists=replace_mode, index=False)
```

**Normalization Function Used:** `normalize_text()` (Lines 5272-5456)
**Line Number:** 4039

#### How normalized_state is set:
```python
# Lines 4045-4052
for idx, state in enumerate(df['state']):
    normalized_states.append(self.normalize_state_name_import(state))
df['normalized_state'] = normalized_states

# Inserted into database (Line 4084)
df.to_sql('dnb_colleges', conn, if_exists=replace_mode, index=False)
```

**Normalization Function Used:** `normalize_state_name_import()` (Lines 3541-3579)
**Line Number:** 4049

---

## 3. NORMALIZATION FUNCTIONS REFERENCE

### Function: `normalize_text()`
**Location:** Lines 5272-5456
**Purpose:** Enhanced text normalization with config support and caching

**Key Processing Stages:**
1. **OCR Error Cleanup** (Line 5302): Cleans common OCR errors from PDF-to-Excel conversion
2. **Medical Degrees Normalization** (Lines 5309-5328): Converts M.B.B.S. → MBBS, B.D.S. → BDS, etc.
3. **Smart Character Replacement** (Lines 5332-5334): Replaces special chars per config (& → AND, / → space)
4. **Standard Normalization** (Lines 5339-5351):
   - Convert to uppercase
   - Remove 6-digit numbers (pincodes)
   - Remove dots
   - Expand abbreviations from config
5. **Hyphen Handling** (Lines 5354-5361): Handles compound words
6. **Selective Character Removal** (Lines 5365-5383): Removes special chars, preserves alphanumeric, spaces, commas, parentheses
7. **Punctuation Correction** (Lines 5387-5429):
   - Remove double commas
   - Fix comma spacing
   - Remove leading/trailing punctuation
8. **Whitespace Normalization** (Line 5437): Collapse multiple spaces

### Function: `normalize_state_name_import()`
**Location:** Lines 3541-3579
**Purpose:** Normalize state names for import with canonical mappings

**Key Mappings (Critical Fixes Noted):**
```python
'ANDHRA' → 'ANDHRA PRADESH'
'AP' → 'ANDHRA PRADESH'
'HP' → 'HIMACHAL PRADESH'
'MP' → 'MADHYA PRADESH'
'TN' → 'TAMIL NADU'
'UP' → 'UTTAR PRADESH'
'UK' → 'UTTARAKHAND'
'WB' → 'WEST BENGAL'
'DELHI NCR' → 'DELHI (NCT)'        # FIXED: was 'DELHI', now 'DELHI (NCT)' to match master DB
'NEW DELHI' → 'DELHI (NCT)'         # FIXED: was 'DELHI', now 'DELHI (NCT)' to match master DB
'DELHI' → 'DELHI (NCT)'            # ADDED: canonical mapping
'ORISSA' → 'ODISHA'                # FIXED: canonical name is ODISHA
'TELENGANA' → 'TELANGANA'
'CHATTISGARH' → 'CHHATTISGARH'
'PONDICHERRY' → 'PUDUCHERRY'
'J&K' → 'JAMMU AND KASHMIR'
'A&N ISLANDS' → 'ANDAMAN AND NICOBAR ISLANDS'
'D&N HAVELI' → 'DADRA AND NAGAR HAVELI'
'DAMAN & DIU' → 'DAMAN AND DIU'
```

**Processing:**
1. Convert to uppercase
2. Look up in state_mappings dictionary
3. Return mapped value or original state if not found

### Function: `normalize_state()`
**Location:** Lines 5629-5655
**Purpose:** Normalize state using mapping table with fallback (Alternative, not used in imports)

**Note:** This function is NOT used in the master data imports. The imports use `normalize_state_name_import()` instead.

---

## 4. SUMMARY TABLE

| Component | Function | Normalization | Line Numbers |
|-----------|----------|---|---|
| **Counselling Data** | | | |
| state_normalized | import_excel_counselling() | normalize_text() | 18256, 18341, 18389 |
| college_name | import_excel_counselling() | normalize_text() | 18254, 18340, 18389 |
| address_normalized | import_excel_counselling() | normalize_text() | 18257, 18334 |
| **Medical Colleges** | | | |
| normalized_name | import_medical_colleges_interactive() | normalize_text() | 3711, 3714 |
| normalized_state | import_medical_colleges_interactive() | normalize_state_name_import() | 3721, 3724 |
| **Dental Colleges** | | | |
| normalized_name | import_dental_colleges_interactive() | normalize_text() | 3875, 3878 |
| normalized_state | import_dental_colleges_interactive() | normalize_state_name_import() | 3885, 3888 |
| **DNB Colleges** | | | |
| normalized_name | import_dnb_colleges_interactive() | normalize_text() | 4039, 4042 |
| normalized_state | import_dnb_colleges_interactive() | normalize_state_name_import() | 4049, 4052 |

---

## 5. KEY DIFFERENCES

**Counselling Data vs Master Data Imports:**
- **Counselling:** Uses `normalize_text()` for BOTH state AND college name
- **Master Data:** Uses `normalize_text()` for college names BUT `normalize_state_name_import()` for states

This is a **critical difference** - the state normalization functions are different!
- Counselling treats state as generic text with OCR cleanup, abbreviation expansion, etc.
- Master data imports use specialized state mapping with canonical names

