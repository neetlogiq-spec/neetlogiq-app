# Complete Flow of All Matching Paths in recent2.py

## Overview

This document provides a comprehensive flow diagram of **all matching paths** in `recent2.py`. The system uses a **multi-path matching architecture** with different strategies for different use cases.

**File**: `recent2.py` (23,241 lines)  
**Last Updated**: November 7, 2025

---

## Entry Points (Primary Matching Methods)

### 1. **`match_college_smart_hybrid()`** ✅ PRIMARY RECOMMENDED
**Location**: Line 7028  
**Purpose**: Fast path first, AI fallback for difficult cases  
**Performance**: ~100-200ms average (100-200x faster than always-AI)

**Complete Flow**:
```
match_college_smart_hybrid(college_name, state, course_type, address, course_name)
│
├─ [1] Get fast_threshold from config (default: 85.0)
│
├─ [2] FAST PATH: Try match_college_enhanced() (~10-50ms)
│   │
│   └─ Returns: (match, score, method)
│
├─ [3] Check if fast match score ≥ fast_threshold
│   │
│   ├─ ✅ YES (85%+ of cases):
│   │   └─ Return: (match, score, 'hybrid_fast_{method}')
│   │
│   └─ ❌ NO (15% difficult cases):
│       │
│       ├─ [4] AI PATH: Try match_college_ai_enhanced() (~1-10s)
│       │   │
│       │   ├─ ✅ AI match found AND score > fast_score:
│       │   │   └─ Return: (ai_match, ai_score, 'hybrid_ai_{method}')
│       │   │
│       │   └─ ❌ AI match failed OR score ≤ fast_score:
│       │       └─ Continue to fallback
│       │
│       └─ [5] FALLBACK: Return best available result
│           │
│           ├─ If fast_match exists:
│           │   └─ Return: (fast_match, fast_score, 'hybrid_fast_low_{method}')
│           │
│           └─ If no match:
│               └─ Return: (None, 0, 'hybrid_no_match')
```

**Called From**:
- `process_batch()` - Batch processing
- `process_batch_with_aliases()` - Batch processing with alias support
- Direct calls for individual record matching

---

### 2. **`match_college_enhanced()`** ✅ STANDARD ROUTER
**Location**: Line 6960  
**Purpose**: Core matching function with 4-pass mechanism and DIPLOMA fallback logic  
**Performance**: ~10-50ms (with Redis cache)

**Complete Flow**:
```
match_college_enhanced(college_name, state, course_type, address, course_name)
│
├─ [1] REDIS CACHE CHECK
│   │
│   ├─ ✅ Cache HIT:
│   │   └─ Return: cached_result (100x faster)
│   │
│   └─ ❌ Cache MISS:
│       └─ Continue to matching
│
├─ [2] ENHANCEMENT #1 & #3: Parse combined college field
│   │
│   ├─ If ',' in college_name:
│   │   ├─ Parse: (parsed_name, parsed_address, parsed_state)
│   │   │
│   │   ├─ If parsed_name: Update college_name
│   │   │
│   │   ├─ If parsed_address: Update address
│   │   │
│   │   └─ ENHANCEMENT #7: Validate and correct state
│   │       └─ If state corrected: Update state
│   │
│   └─ Continue to matching
│
├─ [3] Apply aliases with location context
│   │
│   └─ college_name = apply_aliases(college_name, 'college', state, address)
│
├─ [4] Normalize inputs
│   │
│   ├─ normalized_college = normalize_text(college_name)
│   ├─ normalized_state = normalize_text(state)
│   └─ normalized_address = normalize_text(address)
│
├─ [5] Route by course type:
│   │
│   ├─ If course_type == 'diploma' AND course_name in overlapping:
│   │   └─ match_overlapping_diploma_course()
│   │
│   ├─ Else if course_type == 'diploma':
│   │   └─ match_medical_only_diploma_course()
│   │
│   └─ Else:
│       └─ match_regular_course()
│
└─ [6] REDIS CACHE STORE
    │
    └─ Store result in cache (TTL: 3600 seconds)
```

**Called From**:
- `match_college_smart_hybrid()` - Fast path
- `match_college_ai_enhanced()` - Fallback
- Direct calls for standard matching

---

### 3. **`match_college_ultra_optimized()`** ✅ FAST PATH
**Location**: Line 7645  
**Purpose**: Fastest path for pre-normalized data with multi-stage filtering  
**Performance**: ~5-20ms (with pre-normalized data)

**Complete Flow**:
```
match_college_ultra_optimized(record)
│
├─ [1] Extract normalized fields from record
│   │
│   ├─ normalized_college = record.get('normalized_college_name')
│   ├─ normalized_state = record.get('normalized_state')
│   ├─ normalized_address = record.get('normalized_address')
│   ├─ course_type = record.get('course_type')
│   └─ course_name = record.get('normalized_course_name')
│
├─ [2] Resolve course_id (cached)
│   │
│   └─ course_id = get_course_id_by_name(course_name)
│
├─ [3] Get candidates (PHASE 1: Advanced Blocking)
│   │
│   ├─ If advanced_blocking enabled:
│   │   └─ candidates = advanced_blocker.get_candidates(record)
│   │       └─ Reduces: 200 → 5-10 candidates
│   │
│   └─ Else:
│       └─ candidates = get_college_pool_ultra_optimized()
│           └─ Returns: ~200 candidates
│
├─ [4] PHASE 2: Multi-Stage Filter (if enabled)
│   │
│   ├─ If multi_stage_filter enabled AND len(candidates) > 10:
│   │   └─ candidates = multi_stage_filter.stage2_blocking()
│   │       └─ Reduces: 200 → 10-20 candidates
│   │
│   └─ Continue to matching
│
├─ [5] Validation strictness filter
│   │
│   ├─ If strictness == 'strict':
│   │   └─ Filter candidates by seat evidence only
│   │
│   ├─ Else if strictness == 'moderate':
│   │   └─ Reorder: seat evidence first
│   │
│   └─ Else (lenient):
│       └─ Use all candidates
│
├─ [6] SHORTLIST 2: College name filtering
│   │
│   ├─ Filter candidates by college name:
│   │   ├─ Strategy 1: Exact match
│   │   ├─ Strategy 2: Primary name match
│   │   └─ Strategy 3: Fuzzy match (≥85% with 50% word overlap)
│   │
│   └─ Reduces: 10-20 → 1-5 candidates
│
├─ [7] ADDRESS PRE-FILTERING (Safety)
│   │
│   ├─ If normalized_address exists:
│   │   ├─ Extract address keywords
│   │   ├─ Filter by address keyword overlap
│   │   │   ├─ Generic names: ≥0.6 overlap AND ≥2 keywords
│   │   │   └─ Specific names: ≥0.2 overlap OR ≥1 keyword
│   │   │
│   │   └─ Reduces: 1-5 → 1-2 candidates
│   │
│   └─ Continue to matching
│
├─ [8] COMPOSITE KEY VALIDATION
│   │
│   ├─ If address validation enabled:
│   │   └─ validated_matches = validate_address_for_matches()
│   │       └─ Validates: college = name + address
│   │
│   └─ Continue to matching
│
├─ [9] Return best match
│   │
│   ├─ If single match:
│   │   └─ Return: (match, combined_score, 'ultra_optimized_address_validated')
│   │
│   ├─ If multiple matches:
│   │   └─ Return: (best_match, best_score, 'ultra_optimized_address_validated')
│   │
│   └─ If no match:
│       └─ Return: (None, 0, 'ultra_optimized_no_match')
```

**Called From**:
- `match_and_link_database_driven()` - Tier 3 fallback
- Direct calls for pre-normalized data

---

### 4. **`match_college_ai_enhanced()`** ✅ AI PATH
**Location**: Line 19632  
**Purpose**: AI-enhanced matching using Transformers, Vector Search, Multi-field  
**Performance**: ~1-10s (AI path), ~10-50ms (fallback)

**Complete Flow**:
```
match_college_ai_enhanced(college_name, state, course_type, address, course_name)
│
├─ [1] Check if AI features enabled
│   │
│   ├─ ❌ If not enabled:
│   │   └─ Fallback: match_college_enhanced()
│   │
│   └─ ✅ If enabled:
│       └─ Continue to AI matching
│
├─ [2] Normalize inputs
│   │
│   ├─ college_name_normalized = normalize_text(college_name)
│   └─ normalized_address = normalize_text(address)
│
├─ [3] Get candidates
│   │
│   └─ candidates = get_college_pool(course_type, state)
│
├─ [4] CRITICAL: ADDRESS PRE-FILTERING (BEFORE AI MATCHING)
│   │
│   ├─ If normalized_address exists:
│   │   ├─ Extract address keywords
│   │   ├─ Filter candidates by address:
│   │   │   ├─ Generic names: ≥0.6 overlap AND ≥2 keywords
│   │   │   └─ Specific names: ≥0.2 overlap OR ≥1 keyword
│   │   │
│   │   └─ Reduces: ~200 → ~20-50 candidates
│   │
│   └─ Continue to AI matching
│
├─ [5] Try Transformer matching (with address-filtered candidates)
│   │
│   ├─ ✅ Match found AND score ≥ threshold:
│   │   ├─ Validate address match
│   │   │   ├─ ✅ Address valid:
│   │   │   │   └─ Return: (match, score, 'ai_transformer_{method}_address_validated')
│   │   │   │
│   │   │   └─ ❌ Address invalid:
│   │   │       └─ Reject match, continue to next method
│   │   │
│   │   └─ Continue to next method if rejected
│   │
│   └─ ❌ Match failed OR score < threshold:
│       └─ Continue to next method
│
├─ [6] Try Vector search (with address-filtered candidates)
│   │
│   ├─ ✅ Match found AND score ≥ threshold:
│   │   ├─ Validate address match
│   │   │   ├─ ✅ Address valid:
│   │   │   │   └─ Return: (match, score, 'ai_vector_{details}_address_validated')
│   │   │   │
│   │   │   └─ ❌ Address invalid:
│   │   │       └─ Reject match, continue to fallback
│   │   │
│   │   └─ Continue to fallback if rejected
│   │
│   └─ ❌ Match failed OR score < threshold:
│       └─ Continue to fallback
│
└─ [7] Fallback to traditional matching
    │
    └─ match, score, method = match_college_enhanced()
        │
        ├─ If fuzzy match:
        │   ├─ Additional validation: token overlap check
        │   │   ├─ Require: ≥40% token overlap OR ≥85% fuzzy score
        │   │   │
        │   │   ├─ ✅ Passes:
        │   │   │   └─ Return: (match, score, method)
        │   │   │
        │   │   └─ ❌ Fails:
        │   │       └─ Return: (None, 0, 'ai_fallback_validation_failed')
        │   │
        │   └─ Return: (match, score, method)
        │
        └─ Return: (match, score, method)
```

**Called From**:
- `match_college_smart_hybrid()` - AI fallback path
- Direct calls for AI-enhanced matching

---

## Course-Specific Matching Paths

### 5. **`match_regular_course()`** ✅ REGULAR COURSES
**Location**: Line 7294  
**Purpose**: Match regular courses (medical/dental/dnb) with HYBRID hierarchical filtering  
**Performance**: ~10-50ms

**Complete Flow**:
```
match_regular_course(college_name, state, course_type, address, course_name)
│
├─ [1] Normalize inputs
│   │
│   ├─ normalized_college = normalize_text(college_name)
│   ├─ normalized_state = normalize_text(state)
│   └─ normalized_address = normalize_text(address)
│
├─ [2] SHORTLIST 1: STATE + COURSE filtering
│   │
│   ├─ candidates = get_college_pool(state, course_type, course_name)
│   │   └─ Auto-detects stream from course_name using config.yaml
│   │
│   ├─ If no candidates:
│   │   └─ Fallback: get_college_pool(course_type, course_name)
│   │
│   └─ If still no candidates:
│       └─ Return: (None, 0, 'invalid_course_type')
│
├─ [3] SHORTLIST 2: PARALLEL FILTERING (via pass3_college_name_matching)
│   │
│   └─ college_matches = pass3_college_name_matching()
│       │
│       ├─ [3a] COLLEGE NAME Filtering (parallel)
│       │   ├─ Strategy 1: Exact match
│       │   ├─ Strategy 2: Primary name match
│       │   ├─ Strategy 3: Fuzzy match (≥85% with 50% word overlap)
│       │   └─ Strategy 4: Prefix match
│       │
│       ├─ [3b] ADDRESS Filtering (parallel)
│       │   ├─ Extract address keywords
│       │   ├─ Calculate keyword overlap
│       │   └─ Filter by overlap threshold
│       │
│       └─ [3c] INTERSECTION
│           └─ Find common colleges from both filters
│
├─ [4] COMPOSITE KEY VALIDATION
│   │
│   ├─ If address validation enabled:
│   │   └─ validated_matches = validate_address_for_matches()
│   │       │
│   │       ├─ ✅ Matches passed validation:
│   │       │   └─ Use validated_matches
│   │       │
│   │       └─ ❌ No matches passed validation:
│   │           └─ Return: (None, 0, 'address_validation_failed')
│   │
│   └─ Continue to matching
│
├─ [5] Return match
│   │
│   ├─ If single match:
│   │   └─ Return: (match, combined_score, '{method}_address_validated')
│   │
│   ├─ If multiple matches:
│   │   ├─ Try PASS 4: Address disambiguation
│   │   │   └─ disambiguated = pass4_address_disambiguation()
│   │   │       ├─ ✅ Disambiguation successful:
│   │   │       │   └─ Return: (disambiguated, score, method)
│   │   │       │
│   │   │       └─ ❌ Disambiguation failed:
│   │   │           └─ Continue to best match
│   │   │
│   │   └─ Return: (best_match, best_score, '{method}_address_validated')
│   │
│   └─ If no match:
│       └─ Return: (None, 0, 'no_match')
```

**Called From**:
- `match_college_enhanced()` - Regular courses (non-diploma)

---

### 6. **`match_overlapping_diploma_course()`** ✅ OVERLAPPING DIPLOMA
**Location**: Line 7157  
**Purpose**: Match overlapping DIPLOMA courses with MEDICAL→DNB fallback  
**Performance**: ~20-100ms

**Complete Flow**:
```
match_overlapping_diploma_course(college_name, state, address, course_name)
│
├─ [1] Normalize inputs
│   │
│   ├─ normalized_college = normalize_text(college_name)
│   ├─ normalized_state = normalize_text(state)
│   └─ normalized_address = normalize_text(address)
│
├─ [2] Try MEDICAL first (24 colleges)
│   │
│   ├─ [2a] SHORTLIST 1: Get MEDICAL candidates
│   │   │
│   │   ├─ medical_candidates = get_college_pool(course_type='medical', state=state)
│   │   │
│   │   └─ If no candidates:
│   │       └─ Fallback: get_college_pool(course_type='medical')
│   │
│   ├─ [2b] SHORTLIST 2: PARALLEL FILTERING
│   │   │
│   │   └─ medical_matches = pass3_college_name_matching()
│   │       └─ Returns: List of matches with scores
│   │
│   └─ [2c] Validate each MEDICAL match
│       │
│       ├─ For each match:
│       │   ├─ college_stream = get_college_stream(match['candidate']['id'])
│       │   │
│       │   └─ If validate_college_course_stream_match(match, 'diploma', course_name):
│       │       └─ Return: (match['candidate'], combined_score, match['method'])
│       │
│       └─ If no valid MEDICAL match:
│           └─ Continue to DNB fallback
│
├─ [3] Try DNB fallback
│   │
│   ├─ [3a] SHORTLIST 1: Get DNB candidates
│   │   │
│   │   ├─ dnb_candidates = get_college_pool(course_type='dnb', state=state)
│   │   │
│   │   └─ If no candidates:
│   │       └─ Fallback: get_college_pool(course_type='dnb')
│   │
│   ├─ [3b] SHORTLIST 2: PARALLEL FILTERING
│   │   │
│   │   └─ dnb_matches = pass3_college_name_matching()
│   │       └─ Returns: List of matches with scores
│   │
│   └─ [3c] Validate each DNB match
│       │
│       ├─ For each match:
│       │   ├─ college_stream = get_college_stream(match['candidate']['id'])
│       │   │
│       │   └─ If validate_college_course_stream_match(match, 'diploma', course_name):
│       │       └─ Return: (match['candidate'], combined_score, match['method'])
│       │
│       └─ If no valid DNB match:
│           └─ Continue to manual review
│
└─ [4] Manual review required
    │
    └─ Return: (None, 0, 'manual_review_required')
```

**Called From**:
- `match_college_enhanced()` - Overlapping diploma courses

---

### 7. **`match_medical_only_diploma_course()`** ✅ MEDICAL-ONLY DIPLOMA
**Location**: Line 7237  
**Purpose**: Match medical-only DIPLOMA courses with DNB fallback  
**Performance**: ~20-100ms

**Complete Flow**:
```
match_medical_only_diploma_course(college_name, state, address, course_name)
│
├─ [1] Normalize inputs
│   │
│   ├─ normalized_college = normalize_text(college_name)
│   ├─ normalized_state = normalize_text(state)
│   └─ normalized_address = normalize_text(address)
│
├─ [2] Try MEDICAL first
│   │
│   ├─ [2a] SHORTLIST 1: Get MEDICAL candidates
│   │   │
│   │   ├─ medical_candidates = get_college_pool(course_type='medical', state=state)
│   │   │
│   │   └─ If no candidates:
│   │       └─ Fallback: get_college_pool(course_type='medical')
│   │
│   ├─ [2b] SHORTLIST 2: PARALLEL FILTERING
│   │   │
│   │   └─ medical_matches = pass3_college_name_matching()
│   │       └─ Returns: List of matches with scores
│   │
│   └─ [2c] Validate each MEDICAL match
│       │
│       ├─ For each match:
│       │   └─ If validate_college_course_stream_match(match, 'medical', course_name):
│       │       └─ Return: (match['candidate'], combined_score, match['method'])
│       │
│       └─ If no valid MEDICAL match:
│           └─ Continue to DNB fallback
│
├─ [3] Fallback to DNB (only after ALL MEDICAL strategies fail)
│   │
│   ├─ [3a] SHORTLIST 1: Get DNB candidates
│   │   │
│   │   ├─ dnb_candidates = get_college_pool(course_type='dnb', state=state)
│   │   │
│   │   └─ If no candidates:
│   │       └─ Fallback: get_college_pool(course_type='dnb')
│   │
│   ├─ [3b] SHORTLIST 2: PARALLEL FILTERING
│   │   │
│   │   └─ dnb_matches = pass3_college_name_matching()
│   │       └─ Returns: List of matches with scores
│   │
│   └─ [3c] Validate each DNB match
│       │
│       ├─ For each match:
│       │   └─ If validate_college_course_stream_match(match, 'dnb', course_name):
│       │       └─ Return: (match['candidate'], combined_score, match['method'])
│       │
│       └─ If no valid DNB match:
│           └─ Return: (None, 0, 'no_match')
│
└─ [4] Return: (None, 0, 'no_match')
```

**Called From**:
- `match_college_enhanced()` - Medical-only diploma courses

---

## Core Helper Functions

### 8. **`pass3_college_name_matching()`** ✅ PARALLEL FILTERING
**Location**: Line 11968  
**Purpose**: College name matching with PARALLEL filtering approach  
**Performance**: ~5-20ms

**Complete Flow**:
```
pass3_college_name_matching(normalized_college, candidates, normalized_state, normalized_address)
│
├─ [1] Check if generic college name
│   │
│   └─ is_generic = is_generic_college_name(normalized_college)
│
├─ [2] COLLEGE NAME FILTERING (PARALLEL - Part 1)
│   │
│   ├─ For each candidate:
│   │   ├─ Strategy 1: Exact match
│   │   │   └─ normalized_college == candidate_name OR normalized_college == candidate_normalized
│   │   │
│   │   ├─ Strategy 2: Primary name match
│   │   │   └─ Extract primary name, compare
│   │   │
│   │   ├─ Strategy 3: Fuzzy match
│   │   │   ├─ fuzzy_score = fuzz.ratio() / 100.0
│   │   │   ├─ If fuzzy_score ≥ 85%:
│   │   │   │   └─ Check word overlap ≥ 50%
│   │   │   │       └─ If passes: name_matches = True
│   │   │   │
│   │   │   └─ If fails: Continue to next strategy
│   │   │
│   │   └─ Strategy 4: Prefix match
│   │       └─ Check if starts with prefix (10 chars)
│   │
│   └─ name_filtered_candidates = [candidates that match]
│
├─ [3] ADDRESS FILTERING (PARALLEL - Part 2)
│   │
│   ├─ If normalized_address exists:
│   │   ├─ Extract address keywords from seat data
│   │   ├─ For each candidate:
│   │   │   ├─ Extract address keywords from master data
│   │   │   ├─ Calculate keyword overlap
│   │   │   │
│   │   │   ├─ If generic name:
│   │   │   │   └─ Require: ≥1 common keyword OR ≥0.3 overlap
│   │   │   │
│   │   │   └─ If specific name:
│   │   │       └─ Require: ≥1 common keyword OR ≥0.1 overlap
│   │   │
│   │   └─ address_filtered_candidates = [candidates that match]
│   │
│   └─ Else:
│       └─ address_filtered_candidates = [] (no address filtering)
│
├─ [4] INTERSECTION: Find common colleges
│   │
│   ├─ If address filtering exists:
│   │   ├─ name_filtered_ids = {id for id in name_filtered_candidates}
│   │   ├─ address_filtered_ids = {id for id in address_filtered_candidates}
│   │   │
│   │   ├─ common_ids = name_filtered_ids & address_filtered_ids
│   │   │
│   │   ├─ common_candidates = [c for c in name_filtered_candidates if c.id in common_ids]
│   │   │
│   │   └─ If intersection_count == 0:
│   │       ├─ Fallback: Use name_filtered_candidates (address validation later)
│   │       └─ If name_filtered_count == 0:
│   │           └─ Return: []
│   │
│   └─ Else:
│       └─ common_candidates = name_filtered_candidates
│
├─ [5] DIRECT ALIAS MATCH (highest priority)
│   │
│   ├─ For each alias in college_aliases:
│   │   ├─ If alias_original == normalized_college.upper():
│   │   │   ├─ Get college_id from alias
│   │   │   │
│   │   │   ├─ If location validation (state/address):
│   │   │   │   └─ Validate location matches
│   │   │   │       ├─ ✅ Valid:
│   │   │   │       │   └─ Return: (college, 1.0, 'direct_alias_match')
│   │   │   │       │
│   │   │   │       └─ ❌ Invalid:
│   │   │   │           └─ Continue to matching
│   │   │   │
│   │   │   └─ Return: (college, 1.0, 'direct_alias_match')
│   │   │
│   │   └─ Continue to matching
│   │
│   └─ Continue to matching
│
├─ [6] Calculate match scores for common candidates
│   │
│   ├─ For each candidate in common_candidates:
│   │   ├─ Calculate name score (exact=1.0, primary=0.98, fuzzy=score, prefix=0.95)
│   │   ├─ Calculate address score (if address exists)
│   │   │
│   │   └─ combined_score = calculate_combined_score(name_score, address_score)
│   │
│   └─ matches = [(candidate, score, method) for each match]
│
└─ [7] Return matches sorted by combined_score (descending)
```

**Called From**:
- `match_regular_course()` - Regular courses
- `match_overlapping_diploma_course()` - Overlapping diploma
- `match_medical_only_diploma_course()` - Medical-only diploma
- `match_college_ultra_optimized()` - Ultra-optimized path

---

### 9. **`pass4_address_disambiguation()`** ✅ ADDRESS DISAMBIGUATION
**Location**: Line 12958  
**Purpose**: Address-based disambiguation for multiple validated matches  
**Performance**: ~1-5ms

**Complete Flow**:
```
pass4_address_disambiguation(college_matches, normalized_address, normalized_college)
│
├─ [1] Extract address keywords from seat data
│   │
│   └─ seat_keywords = extract_address_keywords(normalized_address)
│
├─ [2] For each match in college_matches:
│   │
│   ├─ [2a] Extract address keywords from master data
│   │   │
│   │   └─ master_keywords = extract_address_keywords(match['candidate']['address'])
│   │
│   ├─ [2b] Calculate keyword overlap
│   │   │
│   │   ├─ common_keywords = seat_keywords & master_keywords
│   │   ├─ keyword_overlap = len(common_keywords) / len(seat_keywords | master_keywords)
│   │   │
│   │   └─ address_score = keyword_overlap
│   │
│   └─ [2c] Calculate combined score
│       │
│       └─ combined_score = calculate_combined_score(name_score, address_score)
│
├─ [3] Sort matches by combined_score (descending)
│
└─ [4] Return best match
    │
    └─ Return: (best_match['candidate'], best_score, 'pass4_disambiguated')
```

**Called From**:
- `match_regular_course()` - Multiple validated matches

---

## Batch Processing Paths

### 10. **`match_and_link_database_driven()`** ✅ BATCH PROCESSING
**Location**: Line 8558  
**Purpose**: 3-Tier Hybrid Database-Driven Matching Strategy  
**Performance**: ~5-10 minutes for 57K records

**Complete Flow**:
```
match_and_link_database_driven(table_name='seat_data')
│
├─ [1] Connect to databases
│   │
│   ├─ db_path = seat_data.db
│   ├─ master_path = master_data.db
│   │
│   └─ ATTACH masterdb to seat connection
│
├─ [2] PASS 1: Match WITHOUT aliases (identify truly matched records)
│   │
│   ├─ [2a] TIER 1: SQL-Only Fast Path (Exact Matches)
│   │   │
│   │   ├─ Create temp_tier1_exact_matches (SQL-only)
│   │   │   └─ Exact name matches (score: 1.0)
│   │   │
│   │   ├─ Create temp_tier1_primary_matches (SQL-only)
│   │   │   └─ Primary name matches (score: 0.98)
│   │   │
│   │   ├─ Update table with Tier 1 matches
│   │   │   └─ Sets: master_college_id, master_course_id, is_linked=1
│   │   │
│   │   └─ tier1_matched_ids = [ids matched in Tier 1]
│   │
│   ├─ [2b] TIER 2: Hybrid SQL + Python (Prefix/Fuzzy)
│   │   │
│   │   ├─ Create temp_tier2_candidate_matches (SQL pre-filtering)
│   │   │   └─ Excludes Tier 1 matches
│   │   │
│   │   ├─ For each candidate match (Python):
│   │   │   ├─ Calculate fuzzy score
│   │   │   ├─ Calculate prefix score
│   │   │   │
│   │   │   ├─ If score ≥ threshold:
│   │   │   │   ├─ Validate address (if exists)
│   │   │   │   │   ├─ ✅ Valid:
│   │   │   │   │   │   └─ Update table with match
│   │   │   │   │   │
│   │   │   │   │   └─ ❌ Invalid:
│   │   │   │   │       └─ Skip match
│   │   │   │   │
│   │   │   │   └─ Update table with match
│   │   │   │
│   │   │   └─ If score < threshold:
│   │   │       └─ Skip match
│   │   │
│   │   └─ tier2_matched_ids = [ids matched in Tier 2]
│   │
│   └─ [2c] TIER 3: Fallback to ultra_optimized (Complex Cases)
│       │
│       ├─ Get unmatched records (exclude Tier 1 & 2)
│       │
│       ├─ For each unmatched record:
│       │   └─ match, score, method = match_college_ultra_optimized(record)
│       │       │
│       │       ├─ ✅ Match found:
│       │       │   └─ Update table with match
│       │       │
│       │       └─ ❌ No match:
│       │           └─ Mark as unmatched
│       │
│       └─ tier3_matched_ids = [ids matched in Tier 3]
│
├─ [3] PASS 2: Match WITH aliases (for unmatched records)
│   │
│   ├─ Get unmatched records from PASS 1
│   │
│   ├─ For each unmatched record:
│   │   ├─ Apply aliases to college_name
│   │   │   └─ college_name = apply_aliases(college_name, 'college', state, address)
│   │   │
│   │   └─ Try matching again:
│   │       ├─ match, score, method = match_college_ultra_optimized(record)
│   │       │
│   │       ├─ ✅ Match found:
│   │       │   └─ Update table with match
│   │       │
│   │       └─ ❌ No match:
│   │           └─ Mark as unmatched
│   │
│   └─ pass2_matched_ids = [ids matched in PASS 2]
│
├─ [4] Generate statistics
│   │
│   ├─ total_matched = tier1 + tier2 + tier3 + pass2
│   ├─ total_unmatched = total - total_matched
│   │
│   └─ Print statistics
│
└─ [5] Return results
    │
    └─ Return: {
        'total': total_records,
        'matched': total_matched,
        'unmatched': total_unmatched,
        'tier1': tier1_count,
        'tier2': tier2_count,
        'tier3': tier3_count,
        'pass2': pass2_count
    }
```

**Called From**:
- Main entry point for batch processing
- CLI commands

---

## Path Selection Logic

### Decision Tree

```
User calls matching function
│
├─ [1] Is data pre-normalized?
│   │
│   ├─ ✅ YES:
│   │   └─ Use: match_college_ultra_optimized()
│   │
│   └─ ❌ NO:
│       └─ Continue to [2]
│
├─ [2] Is batch processing?
│   │
│   ├─ ✅ YES:
│   │   └─ Use: match_and_link_database_driven()
│   │       └─ Uses 3-tier strategy (SQL → Hybrid → Ultra-optimized)
│   │
│   └─ ❌ NO (individual record):
│       └─ Continue to [3]
│
├─ [3] Need AI-enhanced matching?
│   │
│   ├─ ✅ YES:
│   │   └─ Use: match_college_smart_hybrid()
│   │       └─ Fast path first, AI fallback if needed
│   │
│   └─ ❌ NO:
│       └─ Use: match_college_enhanced()
│           └─ Routes to course-specific matchers
│
└─ [4] Course type routing (within match_college_enhanced):
    │
    ├─ If diploma + overlapping:
    │   └─ match_overlapping_diploma_course()
    │
    ├─ Else if diploma:
    │   └─ match_medical_only_diploma_course()
    │
    └─ Else:
        └─ match_regular_course()
```

---

## Performance Summary

| Path | Use Case | Performance | Accuracy |
|------|----------|-------------|----------|
| `match_college_smart_hybrid()` | Individual records (recommended) | ~100-200ms | High |
| `match_college_enhanced()` | Individual records (standard) | ~10-50ms | High |
| `match_college_ultra_optimized()` | Pre-normalized data | ~5-20ms | High |
| `match_college_ai_enhanced()` | Difficult cases | ~1-10s | Very High |
| `match_regular_course()` | Regular courses | ~10-50ms | High |
| `match_overlapping_diploma_course()` | Overlapping diploma | ~20-100ms | High |
| `match_medical_only_diploma_course()` | Medical-only diploma | ~20-100ms | High |
| `match_and_link_database_driven()` | Batch processing | ~5-10 min (57K) | High |

---

## Key Features

### 1. **Parallel Filtering**
- Name filtering and address filtering run in **parallel**
- Then find **intersection** to get common colleges
- Makes composite key explicit: college = name + address

### 2. **Composite Key Validation**
- Validates: college = college name + address
- Prevents false matches where different addresses match to same ID
- Example: "GOVERNMENT DENTAL COLLEGE" in ALAPPUZHA vs KOTTAYAM

### 3. **3-Tier Batch Processing**
- **Tier 1**: SQL-only fast path (exact matches) - 60-70% of records
- **Tier 2**: Hybrid SQL + Python (prefix/fuzzy) - 20-30% of records
- **Tier 3**: Ultra-optimized fallback - 5-10% of records

### 4. **Smart Hybrid Strategy**
- **Fast path** (85%+ cases): ~10-50ms
- **AI path** (15% difficult cases): ~1-10s
- **Average**: ~100-200ms (100-200x faster than always-AI)

### 5. **Address Pre-Filtering**
- Filters candidates by address **BEFORE** matching
- Prevents false matches where different addresses match to same ID
- Critical for generic college names

### 6. **Multi-Stage Filtering**
- **SHORTLIST 1**: STATE + COURSE filtering (reduces: 200 → 50-100)
- **SHORTLIST 2**: PARALLEL filtering (reduces: 50-100 → 1-5)
- **ADDRESS PRE-FILTERING**: Safety check (reduces: 1-5 → 1-2)
- **COMPOSITE KEY VALIDATION**: Final check

---

## Generated: 2025-01-XX
**Analysis Date**: Current
**File Analyzed**: recent2.py (23,241 lines)
**Total Paths Documented**: 10 primary paths + helper functions

