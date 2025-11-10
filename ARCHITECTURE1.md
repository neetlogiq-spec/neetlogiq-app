# PostgreSQL Matching System - Modular Architecture

## Overview
Clean, maintainable Python implementation for college matching on PostgreSQL with 3-stage cascading approach.

## Directory Structure

```
neetlogiq/
├── lib/                          # Core library modules
│   ├── database/
│   │   ├── __init__.py
│   │   ├── postgres_manager.py   # Connection pooling, query execution
│   │   ├── migrations.py         # Schema creation, DDL
│   │   └── validators.py         # Database-level validation
│   │
│   ├── matching/
│   │   ├── __init__.py
│   │   ├── base_matcher.py       # Abstract base class
│   │   ├── stage1_hierarchical.py # Pure SQL hierarchical matching
│   │   ├── stage2_fuzzy.py       # RapidFuzz fallback matching
│   │   ├── stage3_transformer.py # Semantic/transformer matching (optional)
│   │   └── matcher_pipeline.py   # Orchestrates all stages
│   │
│   ├── normalization/
│   │   ├── __init__.py
│   │   ├── string_normalizer.py  # College/address normalization
│   │   └── data_validator.py     # Data quality validation
│   │
│   └── utils/
│       ├── __init__.py
│       ├── config_loader.py      # Load config.yaml
│       ├── logger.py             # Structured logging
│       └── constants.py          # Shared constants
│
├── scripts/                      # Executable scripts
│   ├── reimport_data.py         # SQLite → PostgreSQL migration
│   ├── match_and_link.py        # Main matching pipeline
│   ├── validate_data.py         # Data quality checks
│   └── generate_report.py       # Match statistics
│
├── tests/                       # Unit and integration tests
│   ├── test_normalization.py
│   ├── test_stage1_matcher.py
│   └── test_matching_pipeline.py
│
├── config.yaml                 # Configuration (existing)
└── README.md                   # User documentation
```

## Module Responsibilities

### lib/database/postgres_manager.py
- Connection pooling with psycopg2
- Query execution with error handling
- Transaction management
- Logging of all database operations

### lib/matching/stage1_hierarchical.py
- Pure PostgreSQL SQL matching
- Uses JOINs with DISTINCT ON for hierarchical filtering
- Returns matched college IDs
- Falls through to Stage 2 for unmatched records

### lib/matching/stage2_fuzzy.py
- RapidFuzz fuzzy name/address matching
- For records unmatched in Stage 1
- Name threshold: 80% (token_set_ratio)
- Address threshold: 75%
- Cross-database data loading

### lib/matching/matcher_pipeline.py
- Orchestrates all 3 stages
- Manages record state (matched/unmatched)
- Validation layer (prevents false matches)
- Generates summary statistics

### lib/normalization/string_normalizer.py
- Reuses existing normalization logic
- College name normalization
- Address normalization
- State mapping

## Key Design Principles

1. **Separation of Concerns**: Each module has single responsibility
2. **Modularity**: Easy to add new matchers without touching existing code
3. **Testability**: Each component can be tested independently
4. **Configurability**: All thresholds via config.yaml
5. **Logging**: Comprehensive logging for debugging
6. **Type Hints**: Clear function signatures

## Data Flow

```
SQLite Data
    ↓
[Reimport Script] → PostgreSQL Database
    ↓
[Match & Link Script]
    ├─→ [Stage 1: Hierarchical SQL] (53-70%)
    ├─→ [Stage 2: Fuzzy Matching] (+15-25%)
    ├─→ [Stage 3: Transformer] (optional +2-5%)
    └─→ [Validation Layer] → Remove false matches
    ↓
PostgreSQL Results Table
    ↓
[Report Generation]
```

## Configuration via config.yaml

```yaml
matching:
  stage1:
    enabled: true
    address_filter: true
  stage2:
    enabled: true
    name_threshold: 80
    address_threshold: 75
  stage3:
    enabled: false  # Optional semantic matching
    name_threshold: 70

database:
  use_postgresql: true
  postgresql_urls:
    seat_data: "postgresql://..."
    master_data: "postgresql://..."
```

## Usage Examples

```bash
# 1. Reimport data from SQLite
python3 scripts/reimport_data.py --source sqlite --target postgresql

# 2. Run matching pipeline
python3 scripts/match_and_link.py --table seat_data --validate

# 3. Validate data integrity
python3 scripts/validate_data.py --table seat_data

# 4. Generate report
python3 scripts/generate_report.py --table seat_data
```

## Testing

```bash
# Run all tests
python3 -m pytest tests/ -v

# Run specific test
python3 -m pytest tests/test_stage1_matcher.py -v

# Run with coverage
python3 -m pytest tests/ --cov=lib
```

## Benefits of Modular Approach

1. **Easier Maintenance**: Changes to one module don't affect others
2. **Easier Testing**: Each component can be unit tested
3. **Easier Extension**: Add new matchers without rewriting core logic
4. **Easier Debugging**: Isolated modules easier to debug
5. **Team Collaboration**: Multiple developers can work on different modules
6. **Version Control**: Smaller commits with clear purposes
7. **Code Reuse**: Modules can be used in other projects

## Next Steps

1. Create `lib/database/postgres_manager.py`
2. Create `lib/matching/stage1_hierarchical.py`
3. Create `lib/matching/stage2_fuzzy.py`
4. Create `lib/matching/matcher_pipeline.py`
5. Create `scripts/match_and_link.py`
6. Create `scripts/reimport_data.py`
