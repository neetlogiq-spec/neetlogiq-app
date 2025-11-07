# Complete Flow Diagram: From Import to End

## Overview
This document provides a comprehensive flow diagram showing the complete process from importing Excel files to matching, linking, and final output.

**Last Updated**: Based on `new/recent.py` (22,883 lines)

---

## 📊 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        START: Excel Import                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Import Excel to Database (import_excel_to_db)                 │
│ Location: Line 16785                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ 1.1 Read Excel file (pandas.read_excel)                                │
│ 1.2 Map columns (COLLEGE_NAME → college_name, etc.)                    │
│ 1.3 Generate IDs (generate_record_id)                                  │
│ 1.4 Generate hashes (generate_record_hash)                            │
│ 1.5 Normalize data:                                                    │
│     - normalized_college_name = normalize_text(college_name)           │
│     - normalized_course_name = normalize_text(course_name)             │
│     - normalized_state = normalize_state(state)                        │
│     - normalized_address = normalize_text(address)                     │
│ 1.6 Detect course type (detect_course_type)                            │
│ 1.7 Initialize matching fields (NULL)                                  │
│ 1.8 Save to seat_data table (to_sql with if_exists='append')           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Match and Link (match_and_link_parallel)                       │
│ Location: Line 13446                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ 2.1 Load all records from seat_data table                               │
│ 2.2 Check if table exists and has data                                 │
│ 2.3 Split into batches (default: 1000 records per batch)                │
│ 2.4 Process batches in parallel (ThreadPoolExecutor)                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PASS 1: Initial Matching                             │
│              (process_batch - for each record)                          │
│              Location: Line 13201                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ FOR EACH RECORD:                                                       │
│                                                                         │
│ 3.1 Extract normalized data:                                           │
│     - college_name = normalized_college_name (or college_name)         │
│     - course_name = normalized_course_name (or course_name)             │
│     - state = normalized_state (or state)                              │
│     - address = normalized_address (or address)                         │
│                                                                         │
│ 3.2 Apply aliases to course name (apply_aliases)                      │
│                                                                         │
│ 3.3 Detect course type (detect_course_type)                            │
│                                                                         │
│ 3.4 MATCH COLLEGE (Primary Entry Point):                               │
│     ┌─────────────────────────────────────────────────────────────┐   │
│     │ match_college_smart_hybrid() [Line 7024]                     │   │
│     │ ✅ PRIMARY (Recommended) - Fast path first, AI fallback     │   │
│     │                                                               │   │
│     │ FAST PATH (~10-50ms):                                        │   │
│     │   └─ match_college_enhanced() [Line 6956]                    │   │
│     │       ├─ Check Redis cache (if enabled)                      │   │
│     │       ├─ Parse combined college field (if detected)          │   │
│     │       ├─ Apply aliases (apply_aliases)                      │   │
│     │       ├─ Normalize inputs                                    │   │
│     │       └─ Route by course type:                                │   │
│     │           ├─ If diploma + overlapping:                        │   │
│     │           │   └─ match_overlapping_diploma_course()          │   │
│     │           ├─ If diploma:                                      │   │
│     │           │   └─ match_medical_only_diploma_course()        │   │
│     │           └─ Else:                                            │   │
│     │               └─ match_regular_course() [Line 7272]          │   │
│     │                                                                 │   │
│     │ AI PATH (~1-10s, only if fast path fails):                   │   │
│     │   └─ match_college_ai_enhanced() [Line 19406]                │   │
│     │       ├─ Try Transformer matching                            │   │
│     │       ├─ Try Vector search                                   │   │
│     │       └─ Fallback to match_college_enhanced()                │   │
│     └─────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ 3.5 MATCH COURSE:                                                      │
│     └─ match_course_enhanced() [Line 13109]                           │
│                                                                         │
│ 3.6 Smart retry (if enabled):                                         │
│     └─ _smart_retry_with_phonetic() (if match failed)                 │
│                                                                         │
│ 3.7 Validate stream match:                                            │
│     └─ validate_college_course_stream_match()                         │
│                                                                         │
│ 3.8 Store results:                                                     │
│     - master_college_id                                               │
│     - master_course_id                                                │
│     - college_match_score                                             │
│     - course_match_score                                              │
│     - college_match_method                                            │
│     - course_match_method                                             │
│     - is_linked                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PASS 2: Alias Matching                               │
│              (process_batch_with_aliases - for UNMATCHED only)         │
│              Location: Line 12900+ (after PASS 1)                       │
├─────────────────────────────────────────────────────────────────────────┤
│ FOR EACH UNMATCHED RECORD:                                            │
│                                                                         │
│ 4.1 Apply aliases to college name (apply_aliases)                      │
│                                                                         │
│ 4.2 Re-run matching with aliased college name:                        │
│     └─ match_college_smart_hybrid() (same as PASS 1)                   │
│                                                                         │
│ 4.3 Update results if match found                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SAVE RESULTS                                        │
│              (match_and_link_parallel - after PASS 1 & 2)                │
├─────────────────────────────────────────────────────────────────────────┤
│ 5.1 Merge results with existing data (preserve manual mappings)       │
│ 5.2 Update seat_data table with UPSERT logic                           │
│ 5.3 Log statistics:                                                    │
│     - Preserved manual mappings                                       │
│     - New automatic matches                                            │
│     - Total matched/unmatched                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    REBUILD LINK TABLES                                 │
│              (Optional - if requested)                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ 6.1 rebuild_college_course_link()                                      │
│ 6.2 rebuild_state_course_college_link_text()                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        END: Complete                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Detailed Matching Flow: match_regular_course()

This is the most common matching path for regular courses:

```
match_regular_course() [Line 7272]
    │
    ├─ PASS 1: STATE → COURSE(stream) → COLLEGE filtering
    │   └─ get_college_pool(state, course_type, course_name)
    │       └─ Returns filtered candidates by state + course type
    │
    ├─ PASS 2: Course type filtering (implicit - already filtered)
    │
    ├─ PASS 3: College name matching with hierarchical strategies
    │   └─ pass3_college_name_matching() [Line 11873]
    │       │
    │       ├─ STEP 1: ADDRESS PRE-FILTERING (CRITICAL) ⚠️
    │       │   └─ Filter candidates by address BEFORE name matching
    │       │       ├─ Extract address keywords from seat data
    │       │       ├─ Extract address keywords from master data
    │       │       ├─ Check for exact keyword matches (priority)
    │       │       ├─ Check for keyword overlap (≥0.2)
    │       │       └─ Reject candidates with insufficient address match
    │       │
    │       ├─ STEP 2: EXACT MATCH
    │       │   └─ Check normalized college name exact match
    │       │
    │       ├─ STEP 3: PRIMARY NAME MATCH
    │       │   └─ Extract primary name (before brackets)
    │       │       └─ Check normalized primary name match
    │       │
    │       ├─ STEP 4: ALIAS MATCH
    │       │   └─ Check if college name matches any alias
    │       │
    │       ├─ STEP 5: PREFIX MATCH
    │       │   └─ Check if college name starts with candidate prefix
    │       │
    │       ├─ STEP 6: SOFT TF-IDF MATCH (Advanced)
    │       │   └─ Typo-tolerant matching using Soft TF-IDF
    │       │
    │       ├─ STEP 7: SEMANTIC MATCH (Advanced)
    │       │   └─ Transformer-based semantic similarity
    │       │
    │       ├─ STEP 8: FUZZY MATCH (if pool ≤100)
    │       │   └─ RapidFuzz fuzzy matching
    │       │
    │       ├─ STEP 9: ENSEMBLE VOTING (Advanced)
    │       │   └─ Combine all matching strategies with weighted voting
    │       │
    │       └─ STEP 10: ENSEMBLE VALIDATION
    │           ├─ Calculate address scores for ALL matches
    │           ├─ Calculate state match scores
    │           ├─ Calculate overall word overlap
    │           ├─ Calculate combined_score (ensemble):
    │           │   - name_weight: 0.4
    │           │   - addr_weight: 0.3
    │           │   - state_weight: 0.15
    │           │   - overlap_weight: 0.15
    │           ├─ Apply ensemble validation rules:
    │           │   - Rule 1: High ensemble score (≥0.85)
    │           │   - Rule 2: Good name + state + address
    │           │   - Rule 3: Good name + state + overlap
    │           │   - Rule 4: Good name + address (no state)
    │           │   - Rule 5: Good name + overlap (no address)
    │           ├─ Filter by min_address_score (stricter for generic names)
    │           └─ Sort by combined_score, address_score, name_score
    │
    ├─ PASS 4: Address-based disambiguation (if multiple matches)
    │   └─ pass4_address_disambiguation() [Line 12732]
    │       ├─ Extract address keywords
    │       ├─ Calculate keyword overlap scores
    │       ├─ Calculate address similarity
    │       └─ Select best match based on combined score
    │
    └─ RETURN: Best match with combined_score
```

---

## 🔍 Detailed Matching Flow: pass3_college_name_matching()

This is the core matching function with all advanced features:

```
pass3_college_name_matching() [Line 11873]
    │
    ├─ INPUT: normalized_college, candidates, normalized_state, normalized_address
    │
    ├─ STEP 1: ADDRESS PRE-FILTERING ⚠️ CRITICAL
    │   ├─ Check if address provided
    │   ├─ Extract address keywords from seat data
    │   ├─ For each candidate:
    │   │   ├─ Extract address keywords from master data
    │   │   ├─ Check for exact keyword matches (priority)
    │   │   ├─ Check for keyword overlap (≥0.2)
    │   │   ├─ Check for fuzzy address similarity (≥0.3)
    │   │   └─ Reject if insufficient address match
    │   └─ Result: address_filtered_candidates
    │
    ├─ STEP 2: EXACT MATCH
    │   ├─ Check normalized college name exact match
    │   └─ If found: return immediately (score: 1.0)
    │
    ├─ STEP 3: PRIMARY NAME MATCH
    │   ├─ Extract primary name (before brackets)
    │   ├─ Check normalized primary name match
    │   └─ If found: return (score: 0.95)
    │
    ├─ STEP 4: ALIAS MATCH
    │   ├─ Check if college name matches any alias
    │   └─ If found: return (score: 0.90)
    │
    ├─ STEP 5: PREFIX MATCH
    │   ├─ Check if college name starts with candidate prefix
    │   └─ If found: return (score: 0.85)
    │
    ├─ STEP 6: SOFT TF-IDF MATCH (if enabled)
    │   ├─ Build TF-IDF vectors for all candidates
    │   ├─ Calculate Soft TF-IDF similarity
    │   └─ Add matches with score ≥0.7
    │
    ├─ STEP 7: SEMANTIC MATCH (if enabled)
    │   ├─ Use Transformer model for semantic similarity
    │   ├─ Calculate cosine similarity
    │   └─ Add matches with score ≥0.7
    │
    ├─ STEP 8: FUZZY MATCH (if pool ≤100)
    │   ├─ RapidFuzz ratio matching
    │   └─ Add matches with score ≥70
    │
    ├─ STEP 9: ENSEMBLE VOTING (if enabled)
    │   ├─ Combine all matching strategies
    │   ├─ Weighted voting:
    │   │   - Exact: 1.0
    │   │   - Primary: 0.95
    │   │   - Alias: 0.90
    │   │   - Prefix: 0.85
    │   │   - Soft TF-IDF: 0.80
    │   │   - Semantic: 0.75
    │   │   - Fuzzy: 0.70
    │   └─ Select best match from ensemble
    │
    ├─ STEP 10: ENSEMBLE VALIDATION (for all matches)
    │   ├─ Calculate address scores:
    │   │   ├─ Keyword overlap score
    │   │   ├─ Fuzzy similarity score
    │   │   └─ Location keyword score
    │   ├─ Calculate state match score
    │   ├─ Calculate overall word overlap
    │   ├─ Calculate combined_score (ensemble):
    │   │   combined_score = (
    │   │       (name_score * 0.4) +
    │   │       (address_score * 0.3) +
    │   │       (state_match_score * 0.15) +
    │   │       (overall_word_overlap * 0.15)
    │   │   )
    │   ├─ Apply ensemble validation rules:
    │   │   ├─ Rule 1: combined_score ≥ 0.85 → ACCEPT
    │   │   ├─ Rule 2: name ≥ 0.8 AND state ≥ 0.8 AND address ≥ 0.3 → ACCEPT
    │   │   ├─ Rule 3: name ≥ 0.8 AND state ≥ 0.8 AND overlap ≥ 0.4 → ACCEPT
    │   │   ├─ Rule 4: name ≥ 0.85 AND address ≥ 0.4 → ACCEPT
    │   │   └─ Rule 5: name ≥ 0.85 AND overlap ≥ 0.5 → ACCEPT
    │   ├─ Filter by min_address_score:
    │   │   ├─ Generic names: ≥0.4 (stricter)
    │   │   └─ Specific names: ≥0.2 (lenient)
    │   └─ Sort by: combined_score → address_score → name_score
    │
    └─ RETURN: List of matches with combined_score
```

---

## 📋 Key Functions and Their Roles

### **Import Functions**
- `import_excel_to_db()` [Line 16785]: Main import function
  - Reads Excel file
  - Maps columns
  - Normalizes data
  - Generates IDs and hashes
  - Saves to `seat_data` table

### **Matching Orchestration Functions**
- `match_and_link_parallel()` [Line 13446]: Main matching orchestrator
  - Loads data from database
  - Splits into batches
  - Processes batches in parallel
  - Saves results back to database

### **Batch Processing Functions**
- `process_batch()` [Line 13201]: Pass 1 - Initial matching
  - Processes each record in batch
  - Calls `match_college_smart_hybrid()`
  - Calls `match_course_enhanced()`
  - Validates stream matches
  - Returns results

- `process_batch_with_aliases()` [Line 12900+]: Pass 2 - Alias matching
  - Processes UNMATCHED records only
  - Applies aliases to college names
  - Re-runs matching

### **Primary Matching Functions**
- `match_college_smart_hybrid()` [Line 7024]: ✅ PRIMARY (Recommended)
  - Fast path first (~10-50ms)
  - AI fallback if needed (~1-10s)
  - Returns best match

- `match_college_enhanced()` [Line 6956]: Standard matching
  - 4-pass mechanism
  - Redis caching
  - Routes by course type

- `match_college_ultra_optimized()` [Line 7614]: Optimized matching
  - Pre-normalized fields
  - Multi-stage filtering
  - Address pre-filtering

- `match_college_ai_enhanced()` [Line 19406]: AI-enhanced matching
  - Transformer matching
  - Vector search
  - Fallback to traditional

### **Course-Specific Matching Functions**
- `match_regular_course()` [Line 7272]: Regular course matching
  - STATE → COURSE → COLLEGE → ADDRESS filtering
  - Calls `pass3_college_name_matching()`
  - Calls `validate_address_for_matches()`
  - Calls `pass4_address_disambiguation()`

- `match_medical_only_diploma_course()` [Line 7224]: Medical-only diploma
  - Tries MEDICAL first
  - Falls back to DNB

- `match_overlapping_diploma_course()` [Line 7153]: Overlapping diploma
  - Tries MEDICAL first
  - Falls back to DNB

### **Core Matching Functions**
- `pass3_college_name_matching()` [Line 11873]: College name matching
  - Address pre-filtering
  - Exact match
  - Primary name match
  - Alias match
  - Prefix match
  - Soft TF-IDF match
  - Semantic match
  - Fuzzy match
  - Ensemble voting
  - Ensemble validation

- `pass4_address_disambiguation()` [Line 12732]: Address disambiguation
  - Groups addresses by city/district
  - Validates each group
  - Selects best match

### **Validation Functions**
- `validate_address_for_matches()` [Line 12638]: Address validation
  - Extracts keywords
  - Checks keyword overlap
  - Uses ensemble matching
  - Stricter for generic names

- `validate_college_course_stream_match()`: Stream validation
  - Validates college and course belong to same stream

### **Course Matching Functions**
- `match_course_enhanced()` [Line 13109]: Course matching
  - Exact match
  - Fuzzy match
  - Returns best match

### **Link Table Functions**
- `rebuild_college_course_link()`: Rebuilds college-course link table
- `rebuild_state_course_college_link_text()`: Rebuilds state-course-college link table

---

## 🔄 Data Flow Summary

### **Import Flow**
```
Excel File
  ↓
pandas.read_excel()
  ↓
Column Mapping
  ↓
Normalization (normalize_text, normalize_state)
  ↓
ID Generation
  ↓
Hash Generation
  ↓
seat_data Table (SQLite)
```

### **Matching Flow**
```
seat_data Table
  ↓
Load Records (pandas.read_sql)
  ↓
Split into Batches
  ↓
Parallel Processing (ThreadPoolExecutor)
  ↓
For Each Record:
  ├─ Extract normalized data
  ├─ Match college (match_college_smart_hybrid)
  │   ├─ Fast path (match_college_enhanced)
  │   │   └─ Route by course type
  │   │       ├─ match_regular_course
  │   │       │   └─ pass3_college_name_matching
  │   │       │       ├─ Address pre-filtering
  │   │       │       ├─ Exact/Primary/Alias/Prefix match
  │   │       │       ├─ Soft TF-IDF/Semantic/Fuzzy match
  │   │       │       ├─ Ensemble voting
  │   │       │       └─ Ensemble validation
  │   │       ├─ match_medical_only_diploma_course
  │   │       └─ match_overlapping_diploma_course
  │   └─ AI path (match_college_ai_enhanced) - if fast fails
  ├─ Match course (match_course_enhanced)
  ├─ Validate stream match
  └─ Store results
  ↓
Save Results (UPSERT with manual mapping preservation)
  ↓
PASS 2: Alias Matching (for unmatched only)
  ↓
Final Results in seat_data Table
```

---

## ⚠️ Critical Flow Points

### **1. Address Pre-Filtering (CRITICAL)**
- **Location**: `pass3_college_name_matching()` [Line 11885-11966]
- **Purpose**: Filter candidates by address BEFORE name matching
- **Why**: Prevents false matches where different addresses match to same college ID
- **Flow**: ADDRESS → COLLEGE NAME → ENSEMBLE VALIDATION
- **NOT**: COLLEGE NAME → ADDRESS VALIDATION (this causes false matches)

### **2. Ensemble Validation (CRITICAL)**
- **Location**: `pass3_college_name_matching()` [Line 12333-12435]
- **Purpose**: Multi-dimensional matching (Name + Address + State + Word Overlap)
- **Why**: Handles complex cases where partial matches across multiple fields indicate strong match
- **Flow**: Calculate combined_score → Apply validation rules → Filter by thresholds

### **3. Manual Mapping Preservation**
- **Location**: `match_and_link_parallel()` [Line 13568-13624]
- **Purpose**: Preserve manual mappings during automatic matching
- **Why**: Allows human-in-the-loop corrections without losing manual work
- **Flow**: Check for manual mappings → Preserve if found → Update automatic matches

---

## 📊 Performance Characteristics

### **Fast Path (85%+ of cases)**
- **Time**: ~10-50ms per record
- **Method**: `match_college_enhanced()` → `match_regular_course()` → `pass3_college_name_matching()`
- **Features**: Redis caching, address pre-filtering, exact/primary/alias/prefix matching

### **AI Path (15% difficult cases)**
- **Time**: ~1-10s per record
- **Method**: `match_college_ai_enhanced()` → Transformer/Vector search → Fallback
- **Features**: Transformer matching, Vector search, Semantic similarity

### **Average Performance**
- **Time**: ~100-200ms per record
- **Throughput**: ~5-10 records/second (single-threaded)
- **Parallel**: ~50-100 records/second (with 10 threads)

---

## 🔧 Configuration Points

### **Matching Configuration** (`config.yaml`)
- `matching.use_smart_hybrid`: Enable smart hybrid matching (default: True)
- `matching.hybrid_threshold`: Fast path threshold (default: 85.0)
- `matching.enable_address_validation`: Enable address validation (default: True)
- `matching.min_address_score`: Minimum address score (default: 0.3)
- `validation.address_validation.min_address_similarity_generic`: Stricter threshold for generic names (default: 0.6)
- `validation.address_validation.min_address_similarity_specific`: Lenient threshold for specific names (default: 0.2)

### **Parallel Processing Configuration**
- `parallel.batch_size`: Records per batch (default: 1000)
- `parallel.num_processes`: Number of threads (default: 10)

---

## 📝 Notes

1. **Address Pre-Filtering is CRITICAL**: It prevents false matches by filtering candidates by address BEFORE name matching.

2. **Ensemble Validation is MANDATORY**: All matches must pass ensemble validation rules to ensure accuracy.

3. **Manual Mappings are PRESERVED**: Manual corrections are never overwritten by automatic matching.

4. **Normalized Columns are REQUIRED**: The system relies on normalized columns for fast matching. Use `backfill_normalized_columns()` if missing.

5. **Smart Hybrid is RECOMMENDED**: It provides the best balance of speed and accuracy.

---

**End of Complete Flow Diagram**
