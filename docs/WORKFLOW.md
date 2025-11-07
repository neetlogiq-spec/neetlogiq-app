# Complete Workflow Documentation: Match and Link SQLite Seat Data System

## Table of Contents
1. [System Overview](#system-overview)
2. [Data Flow Architecture](#data-flow-architecture)
3. [Matching Workflow](#matching-workflow)
4. [Database Schema & Link Tables](#database-schema--link-tables)
5. [Caching System](#caching-system)
6. [Validation System](#validation-system)
7. [Performance Optimizations](#performance-optimizations)
8. [Complete Processing Flow](#complete-processing-flow)

---

## System Overview

The system matches and links raw seat/counselling data with master data (colleges, courses, states) using a multi-stage filtering and validation approach.

### Key Components
- **Master Database** (`master_data.db`): Contains colleges, courses, states, and link tables
- **Seat Database** (`seat_data.db`): Contains raw seat data and auto-updated link tables
- **Matching Engine**: Multi-pass hierarchical matching with fuzzy logic
- **Validation System**: State-college, course-college, and address validation
- **Caching Layer**: LRU caches with size limits for performance
- **Link Tables**: Auto-maintained relationships between entities

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INPUT DATA FLOW                           │
└─────────────────────────────────────────────────────────────────┘

Raw Seat Data (CSV/Excel/DB)
         │
         ▼
┌────────────────────────┐
│  Data Normalization    │  ← normalize_text(), normalize_state()
│  - Text cleaning       │     normalize_address()
│  - Abbreviation expand │
│  - Special char remove │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│  Pre-processing        │
│  - Course type detect  │  ← detect_course_type()
│  - Stream detection    │     get_stream_from_course_name()
│  - State mapping       │     normalize_state()
└────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MATCHING WORKFLOW                              │
└─────────────────────────────────────────────────────────────────┘
         │
         ├──► State Filtering
         ├──► Stream Filtering
         ├──► Course Filtering
         ├──► College Name Matching
         ├──► Address Disambiguation
         └──► Validation
         │
         ▼
┌────────────────────────┐
│  Linked Output         │
│  - master_college_id   │
│  - master_course_id    │
│  - Match scores        │
│  - Match methods       │
└────────────────────────┘
```

---

## Matching Workflow

### State → Course → College → Address Filtering

```
┌──────────────────────────────────────────────────────────────────┐
│              MATCHING WORKFLOW (match_college_ultra_optimized)   │
└──────────────────────────────────────────────────────────────────┘

INPUT: Record with {college_name, state, course_name, address}
         │
         ▼
┌────────────────────────┐
│ STEP 1: Normalization  │
│  - Normalize all fields │  ← Uses pre-computed normalized_* columns
│  - Extract course_id   │     get_course_id_by_name() [CACHED]
│  - Extract state       │
└────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2: State-Based Filtering                                    │
│  get_college_pool_ultra_optimized()                               │
│                                                                   │
│  SQL Query:                                                      │
│  SELECT c.* FROM colleges c                                     │
│  INNER JOIN state_college_link scl ON c.id = scl.college_id    │
│  INNER JOIN states s ON scl.state_id = s.id                     │
│  WHERE s.normalized_name = ? [normalized_state]                 │
│    AND c.source_table IN (?) [stream: medical/dental/dnb]      │
│  LIMIT 200                                                        │
│                                                                   │
│  Result: ~10-50 candidates (down from 2440+ colleges)         │
│  Cache: (state, course_type, limit) → [candidates]            │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 3: Course-Based Evidence Filtering (if strict/moderate)    │
│  get_college_ids_from_seat_link(normalized_state, course_id)    │
│                                                                   │
│  SQL Query:                                                      │
│  SELECT college_id FROM state_course_college_link_text         │
│  WHERE normalized_state = ? AND course_id = ?                   │
│                                                                   │
│  Result: ~1-5 candidates (down from 10-50)                       │
│  Cache: (normalized_state, course_id) → [college_ids]            │
│                                                                   │
│  Validation Strictness:                                          │
│  - strict:   Only keep colleges with seat evidence              │
│  - moderate: Prefer colleges with evidence, but allow all     │
│  - lenient:  Use all state-filtered candidates                  │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 4: College Name Matching (Early Exit Strategies)           │
│                                                                   │
│  4.1 Exact Match (100% score)                                    │
│      normalized_college == candidate.normalized_name            │
│      └─► Return immediately if found                            │
│                                                                   │
│  4.2 Primary Name Match (98% score)                             │
│      normalized_college == normalize_text(extract_primary())    │
│      └─► Return immediately if found                            │
│                                                                   │
│  4.3 Prefix Match (60-90% score)                                │
│      candidate.normalized_name.startswith(normalized_college)   │
│      └─► Address keyword boost if available (+20%)              │
│                                                                   │
│  4.4 Fuzzy Match (50-95% score)                                 │
│      Only if candidate pool <= 100                             │
│      fuzz.ratio(normalized_college, candidate.normalized_name) │
│                                                                   │
│  All matches validated via:                                     │
│  validate_state_college_link(state, college_id) [CACHED]       │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 5: Address Disambiguation (for tie-breaking)              │
│                                                                   │
│  If multiple candidates or low confidence:                       │
│  - Extract address keywords (city, district)                   │
│  - Calculate keyword overlap (Jaccard similarity)              │
│  - Apply boost (+20% max) for address match                     │
│  - For generic names (e.g., "Government Medical College"):     │
│    Require stronger address overlap                             │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ OUTPUT:                │
│  - Best college match  │
│  - Match score (0-1)   │
│  - Match method        │
│  - Validation status   │
└────────────────────────┘
```

---

## Database Schema & Link Tables

### Master Database (`master_data.db`)

```
┌─────────────────────────────────────────────────────────────────┐
│                        MASTER DATABASE                            │
└─────────────────────────────────────────────────────────────────┘

Tables:
├── medical_colleges (886 records)
├── dental_colleges (331 records)
├── dnb_colleges (1223 records)
├── courses (multiple records)
├── states (205 records)
│
└── Link Tables (Auto-maintained via triggers):
    ├── state_college_link (2440 records)
    │   └─► Links states → colleges (many-to-many)
    │       Updated via triggers on INSERT/UPDATE/DELETE
    │
    └── state_course_college_link (15,249 records)
        ├─► state_id → course_id → college_id (canonical)
        ├─► Enriched with: stream, master_address, seat_address_normalized
        ├─► Aggregated occurrences and last_seen_ts
        └─► Synced from seat database via sync_state_course_college_links()
```

### Seat Database (`seat_data.db`)

```
┌─────────────────────────────────────────────────────────────────┐
│                        SEAT DATABASE                              │
└─────────────────────────────────────────────────────────────────┘

Tables:
├── seat_data (16,280 records)
│   ├─► Raw seat/counselling records
│   ├─► Has normalized_* columns (pre-processed)
│   └─► master_college_id, master_course_id (linked)
│
└── Link Tables (Auto-maintained via triggers):
    ├── college_course_link (15,241 records)
    │   └─► college_id → course_id → occurrences, last_seen_ts
    │       Updated via triggers on seat_data INSERT/UPDATE
    │
    └── state_course_college_link_text (15,250 records)
        ├─► normalized_state (TEXT) → course_id → college_id
        ├─► seat_address_normalized (evidence)
        ├─► occurrences, last_seen_ts
        └─► Updated via triggers on seat_data INSERT/UPDATE
```

### Link Table Update Flow

```
┌──────────────────────────────────────────────────────────────────┐
│              AUTO-TRIGGERED LINK TABLE UPDATES                    │
└──────────────────────────────────────────────────────────────────┘

MASTER DATABASE (master_data.db):
┌─────────────────────────────┐
│ state_college_link          │
│                             │
│ Triggers on:                │
│ - medical_colleges          │
│ - dental_colleges           │
│ - dnb_colleges              │
│                             │
│ On INSERT/UPDATE/DELETE:   │
│ └─► Auto-upsert into       │
│     state_college_link      │
│     (state_id, college_id)  │
└─────────────────────────────┘

SEAT DATABASE (seat_data.db):
┌─────────────────────────────┐
│ college_course_link          │
│ state_course_college_link_  │
│   text                       │
│                             │
│ Triggers on: seat_data      │
│                             │
│ On INSERT/UPDATE:           │
│ ├─► IF master_college_id   │
│ │   AND master_course_id   │
│ │   AND normalized_state:  │
│ │   └─► UPSERT into        │
│ │       college_course_link│
│ │   └─► UPSERT into        │
│ │       state_course_      │
│ │         college_link_text│
│ │   └─► Increment          │
│ │       occurrences        │
│ │   └─► Update last_seen_ts│
└─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│              MANUAL SYNC (sync_state_course_college_links)      │
│                                                                   │
│  Steps:                                                          │
│  1. ATTACH seat_data.db AS seatdb                                │
│  2. JOIN seatdb.state_course_college_link_text                   │
│     WITH masterdb.states (via normalized_name)                   │
│  3. LEFT JOIN masterdb.state_mappings (for aliases)              │
│  4. LEFT JOIN masterdb.colleges (for stream, master_address)     │
│  5. UPSERT into masterdb.state_course_college_link               │
│     - Resolve state_id from states                               │
│     - Aggregate occurrences (SUM)                               │
│     - Update last_seen_ts (MAX)                                  │
│                                                                   │
│  Result: Master link table synced with seat evidence            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Caching System

### Cache Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                      CACHE ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────┘

L1: In-Memory Caches (Fastest, LRU with size limits)
├── _normalize_cache (max: 10,000)
│   └─► text → normalized_text
│       Hit rate: ~80-90%
│
├── _pool_cache (max: 1,000)
│   └─► (state, course_type, limit) → [candidates]
│       Hit rate: ~60-70%
│
├── _seat_link_cache (max: 1,000)
│   └─► (normalized_state, course_id) → [college_ids]
│       Hit rate: ~50-60%
│
├── _course_id_cache (max: 500)
│   └─► normalized_course_name → course_id
│       Hit rate: ~70-80%
│
├── _state_id_cache (max: 100)
│   └─► normalized_state → state_id
│       Hit rate: ~90-95%
│
└── _match_cache (max: 5,000)
    └─► (norm_college, state, course_type) → (candidate, score, method)
        Hit rate: ~40-50%

L2: Database Indexes (Fast, persistent)
├── state_college_link: INDEX(state_id, college_id)
├── state_course_college_link_text: INDEX(normalized_state, course_id)
└── colleges: INDEX(normalized_name, source_table)
```

### Cache Eviction Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                   FIFO EVICTION POLICY                           │
└─────────────────────────────────────────────────────────────────┘

When cache size >= max_size:
1. Identify oldest entry (first key in dict)
2. Remove oldest entry
3. Log eviction for monitoring
4. Add new entry

Python dict maintains insertion order (3.7+), so:
  oldest_key = next(iter(cache))
  del cache[oldest_key]
```

### Cache Monitoring

```
┌─────────────────────────────────────────────────────────────────┐
│                    CACHE STATISTICS                               │
└─────────────────────────────────────────────────────────────────┘

Stats Tracked:
├── Hits: per-cache-type count
├── Misses: per-cache-type count
├── Hit Rates: (hits / total) * 100%
├── Sizes: current entries vs max_size
└── Utilization: (current / max) * 100%

API:
├── get_cache_stats() → returns all statistics
└── log_cache_stats(level='info') → logs to logger
```

---

## Validation System

### Validation Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                  VALIDATION WORKFLOW                              │
└─────────────────────────────────────────────────────────────────┘

Level 1: State-College Validation (Mandatory)
┌────────────────────────────────────────┐
│ validate_state_college_link()         │
│                                        │
│ Steps:                                 │
│ 1. Normalize state                    │
│ 2. Resolve state_id (from cache/DB)    │
│ 3. Query state_college_link:          │
│    WHERE state_id = ?                 │
│      AND college_id = ?               │
│ 4. Return (is_valid, error_message)   │
│                                        │
│ Cached: state_id lookup               │
│ Batch: validate_state_college_links_  │
│        batch() for multiple pairs     │
└────────────────────────────────────────┘

Level 2: Course-College Validation (Conditional)
┌────────────────────────────────────────┐
│ validate_college_course_stream_match() │
│                                        │
│ Checks:                                │
│ - Course stream matches college type   │
│ - DIPLOMA overlap handling             │
│ - DNB-only course restrictions         │
└────────────────────────────────────────┘

Level 3: Address Validation (Tie-breaker)
┌────────────────────────────────────────┐
│ Address keyword matching               │
│                                        │
│ For:                                   │
│ - Generic college names                │
│ - Multiple candidates                  │
│ - Low confidence matches               │
└────────────────────────────────────────┘

Level 4: Strictness Enforcement
┌────────────────────────────────────────┐
│ Based on config['validation']          │
│   ['strictness']                        │
│                                        │
│ strict:                                │
│ └─► Require BOTH:                     │
│     - state_college_link ✓            │
│     - state_course_college_link_text ✓ │
│                                        │
│ moderate:                              │
│ └─► Require:                          │
│     - state_college_link ✓            │
│     - Prefer seat evidence             │
│                                        │
│ lenient:                               │
│ └─► Require:                          │
│     - state_college_link ✓            │
└────────────────────────────────────────┘
```

### Batch Validation Flow

```
┌──────────────────────────────────────────────────────────────────┐
│            BATCH VALIDATION (validate_state_college_links_batch)  │
└──────────────────────────────────────────────────────────────────┘

Input: List of (state, college_id) tuples
         │
         ▼
┌────────────────────────┐
│ Group by State         │  ← Reduces state lookups
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Resolve state_ids       │  ← Uses cache + master data
│ (for all unique states) │
└────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ Build Batch SQL Query                                             │
│                                                                   │
│ SELECT state_id, college_id                                       │
│ FROM state_college_link                                           │
│ WHERE (state_id=? AND college_id=?) OR                           │
│       (state_id=? AND college_id=?) OR ...                       │
│                                                                   │
│ Single query validates all pairs at once                        │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Return Results Map     │  ← {(state, college_id): (is_valid, error)}
└────────────────────────┘
```

---

## Performance Optimizations

### Optimization Strategies

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPTIMIZATION TECHNIQUES                         │
└─────────────────────────────────────────────────────────────────┘

1. Pre-filtering (State → Stream → Course)
   └─► Reduces candidate pool from 2440+ to 1-50

2. Database-Level Filtering
   └─► Uses SQL JOINs instead of Python filtering

3. Caching
   ├─► Normalized text: 10K entries
   ├─► College pools: 1K entries
   ├─► Seat links: 1K entries
   └─► Course IDs: 500 entries

4. Early Exit Strategies
   ├─► Exact match → immediate return
   ├─► Primary name match → immediate return
   └─► Fuzzy only if pool <= 100

5. Batch Operations
   ├─► Batch validation for multiple pairs
   └─► Bulk SQL updates for exact matches

6. Streaming Processing
   └─► Process data in chunks to reduce memory

7. Connection Pooling
   └─► Reuse connections, explicit cleanup
```

### Query Optimization Flow

```
┌──────────────────────────────────────────────────────────────────┐
│              QUERY OPTIMIZATION EXAMPLE                           │
└──────────────────────────────────────────────────────────────────┘

Traditional Approach:
┌────────────────────────────────┐
│ 1. Load ALL colleges (2440+)   │  ← Memory: ~10MB
│ 2. Filter by state (Python)    │  ← Time: ~50ms
│ 3. Filter by stream (Python)   │  ← Time: ~30ms
│ 4. Filter by course (Python)   │  ← Time: ~40ms
│ 5. Match names                 │  ← Time: ~100ms
│                                │
│ Total: ~220ms per record       │
└────────────────────────────────┘

Optimized Approach:
┌────────────────────────────────┐
│ 1. Query with JOINs (SQL)      │  ← Database indexes
│    Result: 10-50 candidates    │  ← Memory: ~200KB
│ 2. Course evidence filter      │  ← Cache lookup
│    Result: 1-5 candidates      │  ← Memory: ~50KB
│ 3. Early exit matching         │  ← Time: ~5ms
│                                │
│ Total: ~15ms per record        │
│ Speedup: ~15x faster            │
└────────────────────────────────┘
```

---

## Complete Processing Flow

### End-to-End Processing Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│              COMPLETE PROCESSING PIPELINE                          │
└──────────────────────────────────────────────────────────────────┘

1. INITIALIZATION
┌────────────────────────────────────────┐
│ AdvancedSQLiteMatcher.__init__()       │
│                                        │
│ - Load config.yaml                     │
│ - Connect to databases                 │
│ - Load master data into memory         │
│ - Load state mappings                  │
│ - Initialize caches                   │
│ - Set validation strictness            │
└────────────────────────────────────────┘

2. DATA PREPROCESSING
┌────────────────────────────────────────┐
│ Input: Raw seat/counselling data       │
│                                        │
│ - Normalize text fields                │
│ - Detect course type/stream            │
│ - Normalize states (with mappings)     │
│ - Extract addresses                    │
│                                        │
│ Output: Pre-normalized records         │
└────────────────────────────────────────┘

3. MATCHING (per record)
┌────────────────────────────────────────┐
│ match_college_ultra_optimized()       │
│                                        │
│ ├─► State filtering                   │
│ ├─► Stream filtering                  │
│ ├─► Course evidence filtering         │
│ ├─► Name matching (early exit)        │
│ ├─► Address disambiguation            │
│ └─► Validation                        │
│                                        │
│ match_course_enhanced()                │
│                                        │
│ └─► Course name matching              │
└────────────────────────────────────────┘

4. VALIDATION
┌────────────────────────────────────────┐
│ validate_linked_record()              │
│                                        │
│ ├─► State-college link                │
│ ├─► Stream-course compatibility       │
│ ├─► Address consistency               │
│ └─► Confidence thresholds             │
└────────────────────────────────────────┘

5. PERSISTENCE
┌────────────────────────────────────────┐
│ - Insert into seat_data_linked         │
│ - Auto-trigger link table updates     │
│   ├─► college_course_link             │
│   └─► state_course_college_link_text   │
└────────────────────────────────────────┘

6. SYNCHRONIZATION (optional)
┌────────────────────────────────────────┐
│ sync_state_course_college_links()      │
│                                        │
│ - ATTACH seat_data.db                  │
│ - JOIN and aggregate                  │
│ - UPSERT into master link table       │
│ - Resolve state mappings              │
└────────────────────────────────────────┘

7. MONITORING
┌────────────────────────────────────────┐
│ - Log cache statistics                │
│ - Track match rates                    │
│ - Monitor validation failures         │
│ - Report performance metrics           │
└────────────────────────────────────────┘
```

### Batch Processing Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                  BATCH PROCESSING WORKFLOW                        │
└──────────────────────────────────────────────────────────────────┘

Input Batch (N records)
         │
         ▼
┌────────────────────────┐
│ ThreadPoolExecutor     │  ← Parallel processing
│ (num_workers cores)    │
└────────────────────────┘
         │
         ├──► Worker 1: Records 1-100
         ├──► Worker 2: Records 101-200
         ├──► Worker 3: Records 201-300
         └──► Worker N: Records ...
         │
         ▼
┌────────────────────────┐
│ process_batch()        │  ← Per-worker batch processing
│                        │
│ For each record:      │
│ 1. Match college       │
│ 2. Match course        │
│ 3. Validate           │
│ 4. Create result      │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Aggregate Results      │  ← Collect from all workers
│ - Match statistics    │
│ - Validation stats    │
│ - Error reports       │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Bulk Insert            │  ← Write to database
│ - seat_data_linked     │
│ - Triggers auto-update │
│   link tables         │
└────────────────────────┘
```

### Streaming Processing Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                  STREAMING PROCESSING WORKFLOW                     │
└──────────────────────────────────────────────────────────────────┘

Large Dataset (e.g., 100K+ records)
         │
         ▼
┌────────────────────────┐
│ Open Database Cursor   │  ← Server-side cursor
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Fetch Batch (1000)     │  ← Read in chunks
│                        │
│ SELECT * FROM table    │
│ LIMIT 1000 OFFSET N    │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Process Batch          │  ← Process in memory
│ - Match                │
│ - Validate             │
│ - Create results       │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Write Batch Results    │  ← Write immediately
│ - Release memory       │
└────────────────────────┘
         │
         └──► Repeat until all records processed
```

---

## State Mapping Resolution

```
┌──────────────────────────────────────────────────────────────────┐
│              STATE MAPPING RESOLUTION                             │
└──────────────────────────────────────────────────────────────────┘

Input: Raw state name (e.g., "ANDAMAN NICOBAR ISLANDS")
         │
         ▼
┌────────────────────────┐
│ normalize_state()      │  ← Normalize to uppercase
└────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ Check state_mappings table                 │
│                                            │
│ SELECT normalized_state                   │
│ FROM state_mappings                       │
│ WHERE raw_state = ? AND is_verified=1     │
└────────────────────────────────────────────┘
         │
         ├─► Found mapping?
         │   └─► Use mapped normalized_state
         │
         └─► Not found?
             └─► Use normalized input
                 │
                 ▼
┌────────────────────────┐
│ Lookup in states table │  ← Direct match
│                        │
│ SELECT id FROM states  │
│ WHERE normalized_name = ? │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Return state_id        │  ← Cache for future use
└────────────────────────┘
```

---

## Error Handling & Resilience

```
┌──────────────────────────────────────────────────────────────────┐
│                  ERROR HANDLING STRATEGY                          │
└──────────────────────────────────────────────────────────────────┘

1. Matching Failures
┌────────────────────────┐
│ - Log with context      │  ← logger.warning() with exc_info=True
│ - Fallback to AI match  │  ← match_college_ai_enhanced()
│ - Return no_match       │  ← (None, 0.0, 'no_match')
└────────────────────────┘

2. Validation Failures
┌────────────────────────┐
│ - Mark as unmatched    │  ← Require manual review
│ - Track in stats       │  ← validation_stats
│ - Log for analysis     │
└────────────────────────┘

3. Database Errors
┌────────────────────────┐
│ - Try-finally blocks   │  ← Ensure connection cleanup
│ - Retry logic          │  ← For transient errors
│ - Graceful degradation │  ← Continue with other records
└────────────────────────┘

4. Cache Errors
┌────────────────────────┐
│ - Evict on full        │  ← FIFO eviction
│ - Fallback to DB       │  ← Direct query if cache miss
│ - Log cache statistics │  ← Monitor performance
└────────────────────────┘
```

---

## Summary

### Key Workflow Principles

1. **Hierarchical Filtering**: State → Stream → Course → College → Address
2. **Early Exit**: Exact matches return immediately
3. **Database-First**: Use SQL JOINs instead of Python filtering
4. **Caching**: LRU caches with size limits for hot paths
5. **Batch Operations**: Aggregate validations and updates
6. **Auto-Maintenance**: Triggers keep link tables consistent
7. **Configurable Strictness**: Adjust validation requirements
8. **Monitoring**: Track performance and cache hit rates

### Performance Characteristics

- **Single Record Processing**: ~15ms (optimized) vs ~220ms (naive)
- **Cache Hit Rates**: 40-95% depending on cache type
- **Candidate Reduction**: 2440+ → 1-50 → 1-5 (with evidence)
- **Database Queries**: Minimized via caching and batch operations
- **Memory Usage**: ~100MB (with caches) vs ~500MB (naive)

This workflow ensures accurate, fast, and scalable matching while maintaining data consistency through auto-maintained link tables.

