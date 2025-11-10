# Complete List of All Algorithms in the Codebase

## Overview

This document provides a comprehensive list of all matching algorithms, strategies, and methods used in the codebase.

---

## 1. **College Matching Algorithms**

### 1.1 **4-Pass Hierarchical Matching Algorithm** ✅ PRIMARY
**Location**: `pass3_college_name_matching()` (lines 11705-12041)

**Strategies** (applied in order):
- **Strategy 0: Direct Alias Match** (highest priority)
  - Bypasses all matching if alias exists
  - Validates location if address provided
  
- **Strategy 1: Exact Normalized Match**
  - Exact string match after normalization
  - Score: 1.0
  
- **Strategy 2: Primary Name Match**
  - Extracts primary name (before comma/slash)
  - Matches primary name only
  - Score: 0.98
  
- **Strategy 3: Prefix Match**
  - For names ≥10 characters
  - Checks if candidate name starts with query
  - Score: 0.6-0.9 (based on coverage)
  
- **Strategy 4: Fuzzy Match** (Levenshtein distance)
  - Uses `rapidfuzz.fuzz.ratio()`
  - Score: 0.0-1.0 (normalized to 0-100%)
  - Threshold: 0.5 (50%)
  
- **Strategy 5: Token Set Match**
  - Handles word order differences
  - Uses `fuzz.token_set_ratio()`
  - Score: 0.0-1.0
  
- **Strategy 6: Semantic Match** (Transformer-based)
  - Uses sentence-transformers
  - Cosine similarity on embeddings
  - Score: 0.0-1.0
  
- **Strategy 7: Secondary Name Match**
  - Extracts secondary name (after comma/slash)
  - Matches secondary name only
  - Score: 0.85

### 1.2 **Smart Hybrid Matching** ✅ OPTIMIZED
**Location**: `match_college_smart_hybrid()` (lines 6911-7038)

**Flow**:
1. **Fast Path**: `match_college_enhanced()` (~10-50ms)
   - Quick fuzzy matching
   - Returns if score ≥ threshold (85%)
   
2. **AI Path**: `match_college_ai_enhanced()` (~1-10s)
   - Only if fast path fails
   - Uses transformer/vector search
   - Returns best match

**Performance**: 5-20x faster than always-AI

### 1.3 **Ultra-Optimized Matching** ✅ FAST
**Location**: `match_college_ultra_optimized()` (lines 7587-8010)

**Features**:
- Pre-normalized fields (from database)
- Multi-stage filtering (reduces 200 → 10-20 candidates)
- Advanced blocking (if enabled)
- Domain embeddings (if enabled)
- GNN boost (if enabled)

**Matching Strategies**:
1. Exact normalized name match
2. Primary name exact match
3. Prefix match (for ≥10 chars)
4. Fuzzy match (if pool ≤100)

### 1.4 **AI-Enhanced Matching** ✅ AI/ML
**Location**: `match_college_ai_enhanced()` (lines 18731-18830)

**Methods**:
1. **Transformer Matching**
   - Uses `all-MiniLM-L6-v2` model
   - Semantic similarity via embeddings
   - Threshold: 0.7 (70%)
   
2. **Vector Search**
   - FAISS-based similarity search
   - Hybrid search with state filtering
   - Threshold: 0.7 (70%)
   
3. **Fallback**: Traditional matching

### 1.5 **Regular Course Matching** ✅ STANDARD
**Location**: `match_regular_course()` (lines 7228-7320)

**Flow**:
1. **Pass 1**: State + Course filtering
2. **Pass 2**: Course type filtering (implicit)
3. **Pass 3**: College name matching (with pre-filtering)
4. **Address Validation**: `validate_address_for_matches()`
5. **Pass 4**: Negative matching (`pass4_address_disambiguation()`)

### 1.6 **Diploma Course Matching** ✅ SPECIALIZED
**Location**: 
- `match_overlapping_diploma_course()` (lines 7045-7145)
- `match_medical_only_diploma_course()` (lines 7148-7226)

**Flow**:
1. Try MEDICAL colleges first
2. Try DNB colleges (fallback)
3. Validate course stream
4. **NEW**: Address validation added

### 1.7 **Legacy Matching Functions** ⚠️ DEPRECATED
**Location**:
- `enhanced_college_match_with_phonetics()` (line 9640)
- `ml_enhanced_matching()` (line 10587)
- `context_aware_match()` (line 10756)
- `hybrid_match()` (line 10805)

**Status**: Legacy functions, may not use address parameter

---

## 2. **Address Matching Algorithms**

### 2.1 **Address Pre-Filtering** ✅ CRITICAL
**Location**: `pass3_college_name_matching()` (lines 11722-11822)

**Methods**:
1. **Exact Match** (single-word addresses)
   - "KOTTAYAM" == "KOTTAYAM" ✅
   - "KOTTAYAM" != "TRIVANDRUM" ❌
   
2. **Substring Match** (single-word in multi-word)
   - "KADAPA" in "RIMS, KADAPA" ✅
   - Uses word boundaries (`\b`)
   
3. **Keyword Containment**
   - Extracts keywords from both addresses
   - Checks if shorter keywords are subset of longer
   - Requires ≥1 common keyword

**Purpose**: Prevents false matches before name matching

### 2.2 **Address Validation** ✅ CRITICAL
**Location**: `validate_address_for_matches()` (lines 12115-12240)

**Methods**:
1. **Exact Address Match**
   - Score: 1.0 (perfect match)
   
2. **Single-Word Substring Match**
   - "KADAPA" in "RIMS, KADAPA"
   - Score: 0.9
   
3. **Keyword Overlap**
   - Jaccard similarity on keywords
   - Score: 0.0-1.0
   
4. **Fuzzy Address Similarity**
   - Levenshtein distance
   - Score: 0.0-1.0
   - Threshold: 0.3 (30%)

**Stricter Rules for Generic Colleges**:
- Requires exact match OR ≥2 keywords + score ≥0.7

### 2.3 **Negative Matching** ✅ CRITICAL
**Location**: `pass4_address_disambiguation()` (lines 12315-12455)

**Process**:
1. **Group matches by address**
   - Different addresses = different physical colleges
   
2. **Validate each group**
   - Check if group address matches seat address
   - Reject groups that don't match
   
3. **Prioritize exact matches**
   - Exact address matches preferred
   - For generic colleges: stricter keyword requirements

**Purpose**: Prevents false positives by rejecting entire groups

### 2.4 **Address Keyword Extraction**
**Location**: `extract_address_keywords()` (lines 5992-6040)

**Methods**:
- Removes common stop words
- Extracts city names, landmarks
- Normalizes keywords
- Returns set of keywords

---

## 3. **String Matching Algorithms**

### 3.1 **Fuzzy Matching** (Levenshtein Distance)
**Library**: `rapidfuzz`

**Methods**:
- `fuzz.ratio()` - Simple ratio
- `fuzz.partial_ratio()` - Partial string match
- `fuzz.token_sort_ratio()` - Handles word order
- `fuzz.token_set_ratio()` - Handles word order + duplicates

### 3.2 **Phonetic Matching**
**Location**: `phonetic_match()` (lines 7445-7480)

**Algorithms**:
1. **Soundex**
   - Phonetic coding algorithm
   - Good for English names
   
2. **Metaphone**
   - Improved phonetic algorithm
   - Better accuracy than Soundex
   
3. **NYSIIS**
   - New York State Identification and Intelligence System
   - Handles variations better

**Parallel Processing**: Enabled for 20+ candidates

### 3.3 **TF-IDF Matching**
**Location**: Used in `pass3_college_name_matching()`

**Purpose**: Semantic similarity via TF-IDF vectors

**Status**: Optional feature (can be enabled)

### 3.4 **Soft TF-IDF Matching**
**Location**: `_soft_token_match()` (lines 20764-20830)

**Features**:
- Character n-grams
- Edit distance tolerance
- Better for typos

**Status**: Optional feature (can be enabled)

---

## 4. **AI/ML Algorithms**

### 4.1 **Transformer-Based Matching**
**Model**: `all-MiniLM-L6-v2` (384 dimensions)

**Features**:
- Sentence embeddings
- Cosine similarity
- Fine-tuned on college corpus (if enabled)

### 4.2 **Vector Search** (FAISS)
**Location**: `_vector_engine`

**Index Types**:
- `flat` - Exact search (safer, no segfaults)
- `hnsw` - Approximate search (faster but may crash)

**Status**: Disabled by default (may cause segfaults on macOS)

### 4.3 **Graph Neural Network (GNN)**
**Location**: `GraphEntityMatcher` (lines 1962-2137)

**Features**:
- Graph-based similarity
- Context-aware matching
- Boost score by 5-10%

**Status**: Disabled by default (may cause errors)

### 4.4 **ANN Index** (Approximate Nearest Neighbors)
**Location**: Used in vector search

**Status**: Disabled by default (may cause errors)

### 4.5 **ML Prediction**
**Location**: `ml_predict_match()` (line 10548)

**Features**:
- Trained ML model (if available)
- Confidence scoring
- Boost fuzzy matches

**Status**: Optional feature

---

## 5. **Course Matching Algorithms**

### 5.1 **Enhanced Course Matching**
**Location**: `match_course_enhanced()` (lines 12724-12850)

**Methods**:
1. **Exact Match**
2. **Normalized Match**
3. **Alias Match**
4. **Fuzzy Match**

### 5.2 **Course Normalization**
**Location**: Applied via `normalize_text()`

**Features**:
- Standard course mapping
- Error correction
- Abbreviation expansion

---

## 6. **Validation Algorithms**

### 6.1 **State Validation**
**Location**: `normalize_state()` (lines 5455-5500)

**Features**:
- State alias mapping
- Handles variations (ODISHA/ORISSA, DELHI/NEW DELHI/DELHI (NCT))
- Fuzzy fallback

### 6.2 **Stream Validation**
**Location**: `validate_college_course_stream_match()` (line 7380)

**Purpose**: Ensures course matches college stream (medical/dental/dnb)

### 6.3 **City/District Validation**
**Location**: `validate_city_district_match()` (line 11517)

**Methods**:
1. Exact city match
2. Exact district match
3. Fuzzy city match (≥90%)
4. Fuzzy district match (≥90%)
5. City in address
6. Address similarity

---

## 7. **Ensemble Algorithms**

### 7.1 **Ensemble Matcher**
**Location**: `EnsembleMatcher` (lines 21269-21361)

**Methods**:
- Combines multiple matchers
- Weighted voting
- Uncertainty quantification

**Status**: Optional feature

### 7.2 **Explainable AI**
**Location**: `ExplainableMatch` (lines 20841-21115)

**Features**:
- Human-readable explanations
- Component breakdown
- Match reasoning

**Status**: Optional feature

---

## 8. **Performance Optimizations**

### 8.1 **Caching**
- **Redis Cache**: Disabled for address matching (causes stale results)
- **LRU Cache**: Normalization caching
- **Mmap Cache**: Master data caching

### 8.2 **Multi-Stage Filtering**
**Location**: `multi_stage_filter`

**Purpose**: Reduces candidate pool (200 → 10-20)

### 8.3 **Advanced Blocking**
**Location**: `_advanced_blocker`

**Purpose**: Pre-filters candidates using blocking keys

### 8.4 **Parallel Processing**
**Location**: Used in batch processing

**Features**:
- Multi-threaded matching
- Parallel phonetic matching
- Batch processing

---

## 9. **Algorithm Flow Summary**

### **Primary Flow** (Regular Courses):
```
State → Course → College Name → Address Pre-filtering → 
Name Matching (7 strategies) → Address Validation → 
Negative Matching (Pass 4) → Assign college_id
```

### **Optimized Flow** (Fast Path):
```
Pre-normalized fields → Multi-stage filtering → 
Address Pre-filtering → Fast matching → Return
```

### **AI Flow** (High Confidence):
```
Address Pre-filtering → Transformer Matching → 
Vector Search → Fallback to Traditional
```

---

## 10. **Algorithm Status**

### ✅ **Active & Working**:
- 4-Pass Hierarchical Matching
- Address Pre-filtering
- Address Validation
- Negative Matching
- Smart Hybrid Matching
- Ultra-Optimized Matching
- Regular Course Matching
- Diploma Course Matching (with address validation)

### ⚠️ **Disabled/Optional**:
- Vector Search (FAISS) - may crash
- GNN Matching - may error
- ANN Index - may error
- ML Prediction - requires trained model
- Redis Cache - disabled for address matching

### ⚠️ **Legacy/Deprecated**:
- `enhanced_college_match_with_phonetics()` - doesn't use address
- `ml_enhanced_matching()` - may not use address
- `context_aware_match()` - may not use address
- `hybrid_match()` - may not use address

---

## 11. **Key Principles**

1. **`college_id = college name + address`**
   - All algorithms must respect this
   - Address pre-filtering is mandatory
   - Address validation is mandatory

2. **Pre-filtering Before Matching**
   - Filter by address FIRST
   - Then match names within filtered candidates

3. **Negative Matching**
   - Group by address
   - Reject groups that don't match
   - Prevents false positives

4. **Hierarchical Strategies**
   - Try exact matches first
   - Fall back to fuzzy/semantic
   - Use AI only if needed

---

## Summary

The codebase contains **15+ different matching algorithms** organized into:
- **6 primary college matching paths**
- **4 address matching/validation methods**
- **4 string matching algorithms**
- **5 AI/ML algorithms**
- **3 validation algorithms**
- **Multiple optimization strategies**

All active algorithms now respect the `college_id = name + address` principle.


