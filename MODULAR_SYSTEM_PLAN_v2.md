# 🎯 MODULAR SYSTEM PLAN v2 - Based on CASCADING_HIERARCHICAL_ENSEMBLE_ARCHITECTURE

## The Real Architecture (From CASCADING_HIERARCHICAL_ENSEMBLE_ARCHITECTURE.md)

### What Was Missing in v1

❌ v1 had pure SQL matching (wrong approach!)
❌ v1 didn't implement true hierarchical narrowing
❌ v1 didn't have composite key (Name + Address) matching
❌ v1 didn't have fallback integration within filters
❌ v1 didn't have STREAM/COURSE filtering
❌ v1 didn't have import/reimport functions

### The Correct Architecture

```
PROPER HIERARCHY:
  STATE (2,443 → ~240)
    ↓
  STREAM/COURSE (240 → ~47)
    ↓
  COLLEGE NAME + ADDRESS (composite key)
    ├─ Exact match
    ├─ Fuzzy match (85%+)
    ├─ RapidFuzz fallback (80%+)
    └─ Transformer fallback (70%+)
```

## What Each Stage Actually Does

### STAGE 1: Pure Hierarchical (97.80% accuracy)
```python
def stage1_filter(record):
    """
    No fallbacks - pure hierarchical
    """
    # 1. STATE filter → Find colleges in this state
    state_colleges = get_colleges_in_state(record['state'])

    # 2. STREAM filter → Filter by medical/dental/dnb
    stream_colleges = state_colleges[
        state_colleges['stream'] == record['stream']
    ]

    # 3. COURSE filter → Verify course offered in state+stream+college
    course_colleges = filter_by_course_available(
        stream_colleges, record['course']
    )

    # 4. COLLEGE NAME filter → Exact match only
    name_colleges = course_colleges[
        course_colleges['normalized_name'] == record['normalized_name']
    ]

    # 5. ADDRESS filter → Keyword containment only
    if name_colleges:
        address_colleges = filter_by_address_keyword(
            name_colleges, record['address']
        )
        return address_colleges[0] if address_colleges else None

    return None  # No match in Stage 1
```

### STAGE 2: Hierarchical + RapidFuzz (98.58% accuracy)
```python
def stage2_filter(record):
    """
    Same hierarchy, but with RapidFuzz fallbacks
    """
    # 1-3: Same STATE → STREAM → COURSE filtering
    course_colleges = hierarchical_filter_by_state_stream_course(record)

    # 4. COLLEGE NAME filter with fallback
    name_colleges = filter_by_name_with_rapidfuzz(
        course_colleges,
        record['name'],
        threshold=80  # 80%+ match
    )

    # 5. ADDRESS filter with fallback
    if name_colleges:
        address_colleges = filter_by_address_with_rapidfuzz(
            name_colleges,
            record['address'],
            threshold=75  # 75%+ match
        )
        return address_colleges[0] if address_colleges else None

    return None  # No match in Stage 2
```

### STAGE 3: Hierarchical + Full Ensemble (98.99% accuracy)
```python
def stage3_filter(record):
    """
    Same hierarchy, but with Transformer fallbacks
    """
    # 1-3: Same STATE → STREAM → COURSE filtering
    course_colleges = hierarchical_filter_by_state_stream_course(record)

    # 4. COLLEGE NAME filter with ensemble fallback
    name_colleges = filter_by_name_with_ensemble(
        course_colleges,
        record['name'],
        fallback_methods=['fuzzy', 'rapidfuzz', 'transformer']
    )

    # 5. ADDRESS filter with ensemble fallback
    if name_colleges:
        address_colleges = filter_by_address_with_ensemble(
            name_colleges,
            record['address'],
            fallback_methods=['rapidfuzz', 'tfidf']
        )
        return address_colleges[0] if address_colleges else None

    return None  # No match in Stage 3
```

## What We Need to Build

### Core Modules (Modular System)

```
lib/
├── database/
│   ├── postgres_manager.py          ✅ DONE
│   ├── migrations.py                ✅ DONE
│   └── data_loader.py               ❌ NEED - Load data from both DBs
│
├── matching/
│   ├── base_matcher.py              ✅ DONE
│   ├── hierarchical_filters.py      ❌ NEED - STATE/STREAM/COURSE/NAME/ADDRESS filters
│   ├── fallback_matchers.py         ❌ NEED - Exact/Fuzzy/RapidFuzz/Transformer
│   ├── stage1_pure_hierarchical.py  ❌ NEED - Pure hierarchical (no fallbacks)
│   ├── stage2_hierarchical_rapidfuzz.py ❌ NEED - Hierarchical + RapidFuzz
│   ├── stage3_hierarchical_ensemble.py  ❌ NEED - Hierarchical + Full Ensemble
│   └── cascading_pipeline.py        ❌ NEED - Orchestrates all 3 stages
│
├── import/
│   ├── excel_importer.py            ❌ NEED - Read Excel files
│   └── postgres_inserter.py         ❌ NEED - Insert into PostgreSQL
│
└── utils/
    ├── data_normalizer.py           ❌ NEED - Normalization (from recent.py)
    ├── validators.py                ❌ NEED - Data validation
    └── config_loader.py             ⚠️ PARTIAL - Load config.yaml
```

### Scripts

```
scripts/
├── match_and_link.py                ⚠️ PARTIAL - Needs to use cascading pipeline
├── import_from_excel.py             ❌ NEED - Import Excel to PostgreSQL
├── clear_and_reimport.py            ❌ NEED - Drop tables and reimport from SQLite
└── validate_data.py                 ❌ NEED - Data quality checks
```

## Implementation Plan

### Phase 1: Core Hierarchical Filtering (PRIORITY)

```python
# lib/matching/hierarchical_filters.py
class HierarchicalFilters:

    def filter_by_state(colleges_df, state_id):
        """STATE filter: 2,443 → ~240 candidates"""
        return colleges_df[colleges_df['state_id'] == state_id]

    def filter_by_stream(colleges_df, stream):
        """STREAM filter: ~240 → ~47 candidates"""
        return colleges_df[colleges_df['stream'] == stream]

    def filter_by_course(colleges_df, state_id, course_id):
        """COURSE filter: Verify offered in state+stream+college"""
        return colleges_df[
            colleges_df.index.isin(get_available_course_colleges(
                state_id, course_id
            ))
        ]

    def filter_by_college_name(colleges_df, input_name, fallback_method=None):
        """
        NAME filter: ~47 → ~4 candidates

        Attempts (in order):
        1. Exact match (Stage 1)
        2. Fuzzy 85%+ (Stage 1 fallback)
        3. RapidFuzz 80%+ (Stage 2 fallback)
        4. Transformer 70%+ (Stage 3 fallback)
        """
        # Try exact match
        exact = colleges_df[colleges_df['normalized_name'] == input_name]
        if not exact.empty:
            return exact

        # Try fuzzy
        fuzzy = colleges_df[
            colleges_df['normalized_name'].apply(
                lambda x: fuzz.ratio(input_name, x) >= 85
            )
        ]
        if not fuzzy.empty:
            return fuzzy

        if fallback_method == 'rapidfuzz':
            # Try RapidFuzz
            rapidfuzz_matches = use_rapidfuzz(colleges_df, input_name, 80)
            if not rapidfuzz_matches.empty:
                return rapidfuzz_matches

        if fallback_method == 'ensemble':
            # Try Transformer
            transformer_matches = use_transformer(colleges_df, input_name, 70)
            if not transformer_matches.empty:
                return transformer_matches

        return colleges_df.iloc[:0]  # Empty

    def filter_by_address(colleges_df, input_address, fallback_method=None):
        """
        ADDRESS filter: ~4 → 1 candidate (composite key with name)

        Attempts:
        1. Keyword containment (Stage 1)
        2. RapidFuzz 75%+ (Stage 2)
        3. TF-IDF (Stage 3)
        """
        # Try keyword
        keyword = colleges_df[
            colleges_df['address'].apply(
                lambda x: input_address.lower() in x.lower()
            )
        ]
        if not keyword.empty:
            return keyword

        if fallback_method == 'rapidfuzz':
            # Try RapidFuzz
            rapidfuzz = colleges_df[
                colleges_df['address'].apply(
                    lambda x: fuzz.token_set_ratio(input_address, x) >= 75
                )
            ]
            if not rapidfuzz.empty:
                return rapidfuzz

        if fallback_method == 'ensemble':
            # Try TF-IDF
            tfidf_matches = use_tfidf(colleges_df, input_address, 60)
            if not tfidf_matches.empty:
                return tfidf_matches

        return colleges_df.iloc[:0]  # Empty
```

### Phase 2: Cascading Pipeline

```python
# lib/matching/cascading_pipeline.py
class CascadingHierarchicalEnsemblePipeline:
    """
    Cascading approach:
    - Stage 1: Run all records through pure hierarchical
    - Stage 2: Run ONLY unmatched from Stage 1 through hierarchical+rapidfuzz
    - Stage 3: Run ONLY unmatched from Stage 2 through hierarchical+ensemble
    """

    def __init__(self, seat_db, master_db, config):
        self.seat_db = seat_db
        self.master_db = master_db
        self.filters = HierarchicalFilters()
        self.stage1_results = {}
        self.stage2_results = {}
        self.stage3_results = {}

    def run(self, table_name='seat_data'):
        """Execute complete cascading pipeline"""

        # STAGE 1: Pure Hierarchical
        logger.info("STAGE 1: Pure Hierarchical Matching")
        self.stage1_results = self._run_stage1(table_name)
        stage1_matched = len(self.stage1_results)

        # STAGE 2: Only on unmatched from Stage 1
        logger.info("STAGE 2: Hierarchical + RapidFuzz")
        unmatched_from_stage1 = self._get_unmatched(table_name, stage1_matched)
        self.stage2_results = self._run_stage2(table_name, unmatched_from_stage1)
        stage2_matched = len(self.stage2_results)

        # STAGE 3: Only on unmatched from Stage 2
        logger.info("STAGE 3: Hierarchical + Full Ensemble")
        unmatched_from_stage2 = self._get_unmatched(
            table_name,
            stage1_matched + stage2_matched
        )
        self.stage3_results = self._run_stage3(table_name, unmatched_from_stage2)
        stage3_matched = len(self.stage3_results)

        # Final statistics
        total_matched = stage1_matched + stage2_matched + stage3_matched
        return {
            'stage1': stage1_matched,
            'stage2': stage2_matched,
            'stage3': stage3_matched,
            'total_matched': total_matched,
            'accuracy': (total_matched / total_records) * 100
        }

    def _run_stage1(self, table_name):
        """Run Stage 1 with NO fallbacks"""
        records = self.seat_db.fetch_all(f"SELECT * FROM {table_name}")
        matched = {}

        for record in records:
            result = self._match_record_stage1(record)
            if result:
                matched[record['id']] = result
                self._update_record(table_name, record['id'], result)

        return matched

    def _run_stage2(self, table_name, unmatched_records):
        """Run Stage 2 with RapidFuzz fallback"""
        matched = {}

        for record in unmatched_records:
            result = self._match_record_stage2(record)
            if result:
                matched[record['id']] = result
                self._update_record(table_name, record['id'], result)

        return matched

    def _run_stage3(self, table_name, unmatched_records):
        """Run Stage 3 with Full Ensemble fallback"""
        matched = {}

        for record in unmatched_records:
            result = self._match_record_stage3(record)
            if result:
                matched[record['id']] = result
                self._update_record(table_name, record['id'], result)

        return matched

    def _match_record_stage1(self, record):
        """Match single record in Stage 1 (pure hierarchical)"""
        # 1. STATE filter
        state_colleges = self.filters.filter_by_state(
            self.master_colleges, record['state_id']
        )
        if state_colleges.empty:
            return None

        # 2. STREAM filter
        stream_colleges = self.filters.filter_by_stream(
            state_colleges, record['stream']
        )
        if stream_colleges.empty:
            return None

        # 3. COURSE filter
        course_colleges = self.filters.filter_by_course(
            stream_colleges, record['state_id'], record['course_id']
        )
        if course_colleges.empty:
            return None

        # 4. NAME filter (exact only)
        name_colleges = self.filters.filter_by_college_name(
            course_colleges, record['college_name'], fallback_method=None
        )
        if name_colleges.empty:
            return None

        # 5. ADDRESS filter (keyword only)
        address_colleges = self.filters.filter_by_address(
            name_colleges, record['address'], fallback_method=None
        )

        return address_colleges.iloc[0] if not address_colleges.empty else None

    def _match_record_stage2(self, record):
        """Match single record in Stage 2 (hierarchical + RapidFuzz)"""
        # Same as Stage 1 but with RapidFuzz fallback
        # (detailed implementation similar to _match_record_stage1)
        pass

    def _match_record_stage3(self, record):
        """Match single record in Stage 3 (hierarchical + Full Ensemble)"""
        # Same as Stage 1 but with Transformer fallback
        # (detailed implementation similar to _match_record_stage1)
        pass
```

### Phase 3: Data Import & Reimport

```python
# scripts/import_from_excel.py
"""
Import Excel files to PostgreSQL
"""
def import_excel_to_postgresql(excel_file, table_name, db_manager):
    # Read Excel
    df = pd.read_excel(excel_file)

    # Normalize columns
    df = normalize_dataframe(df)

    # Validate data
    validate_dataframe(df, table_name)

    # Insert to PostgreSQL
    insert_to_postgresql(df, table_name, db_manager)

# scripts/clear_and_reimport.py
"""
Clear existing data and reimport from SQLite or Excel
"""
def clear_and_reimport(source='sqlite', target_db='postgresql'):
    # 1. Drop all tables in target database
    drop_all_tables(target_db)

    # 2. Create fresh schemas
    create_schemas(target_db)

    # 3. Reimport data
    if source == 'sqlite':
        reimport_from_sqlite(target_db)
    elif source == 'excel':
        reimport_from_excel(target_db)

    # 4. Validate row counts
    validate_reimport(target_db)
```

## What's Actually Needed (Checklist)

### Core Matching Logic ❌
- [ ] `hierarchical_filters.py` - STATE/STREAM/COURSE/NAME/ADDRESS filters
- [ ] `fallback_matchers.py` - Exact/Fuzzy/RapidFuzz/Transformer
- [ ] `stage1_pure_hierarchical.py` - Pure hierarchical matcher
- [ ] `stage2_hierarchical_rapidfuzz.py` - Hierarchical + RapidFuzz
- [ ] `stage3_hierarchical_ensemble.py` - Hierarchical + Full Ensemble
- [ ] `cascading_pipeline.py` - Orchestrates all 3 stages

### Data Handling ❌
- [ ] `data_loader.py` - Load from both databases
- [ ] `data_normalizer.py` - Normalize college/address/course names
- [ ] `excel_importer.py` - Import from Excel files
- [ ] `postgres_inserter.py` - Batch insert to PostgreSQL
- [ ] `clear_and_reimport.py` - Drop and reimport data

### Scripts ❌
- [ ] `import_from_excel.py` - CLI for Excel import
- [ ] `clear_and_reimport.py` - CLI for data cleanup
- [ ] `validate_data.py` - Data quality checks
- [ ] Update `match_and_link.py` - Use cascading pipeline

## Expected Outcomes (After Implementation)

| Metric | Value |
|--------|-------|
| Stage 1 Accuracy | 97.80% (3-4 min) |
| Stage 2 Accuracy | 98.58% (1-2 min) |
| Stage 3 Accuracy | 98.99% (2-3 min) |
| **Total Time** | **5-8 minutes** |
| **False Matches** | **0** |

vs Current v1:
- Stage 1: 69.77% (pure SQL, wrong approach)
- Stage 2: 77.40% (SQL + RapidFuzz, still wrong)
- **Total Time**: 19.8 seconds (but wrong accuracy)

## Why This Approach is Better

✅ **Correct hierarchy** - STATE → STREAM → COURSE → NAME → ADDRESS
✅ **Composite key** - College Name + Address together
✅ **Progressive** - Only advanced matchers on 30-50 candidates, not 16K
✅ **99% accuracy** - Matches the architecture from CASCADING_HIERARCHICAL_ENSEMBLE_ARCHITECTURE.md
✅ **Zero false matches** - Hierarchical context prevents drift

---

## Should I Proceed?

This is a MAJOR refactor from v1. Should I:

1. **Keep v1 as-is** and build these new modules alongside?
2. **Replace v1 entirely** with correct implementation?
3. **Hybrid approach** - Reuse v1 database manager, rewrite matching logic?

Which would you prefer?
