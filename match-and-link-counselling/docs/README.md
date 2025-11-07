# Counselling Data Matching and Linking System

## 📋 Overview

A comprehensive Python-based system for matching and linking medical/dental/DNB counselling data with master institutional data. The system uses advanced fuzzy matching, state normalization, and course classification to achieve high match rates with interactive review capabilities.

## 🎯 Key Features

### 1. **4-Pass College Matching Algorithm**
- **Pass 1**: State-based filtering for efficiency
- **Pass 2**: Course type detection (Medical/Dental/DNB)
- **Pass 3**: Hierarchical college name matching
- **Pass 4**: Address-based disambiguation

### 2. **DIPLOMA Course Fallback Logic**
Special handling for overlapping DIPLOMA courses:
- DIPLOMA IN ANAESTHESIOLOGY
- DIPLOMA IN OBSTETRICS AND GYNAECOLOGY
- DIPLOMA IN PAEDIATRICS
- DIPLOMA IN OPHTHALMOLOGY

These courses try MEDICAL colleges first, then fall back to DNB if no match is found.

### 3. **Course Normalization**
- Standard course mapping from master lists
- Error correction using known corrections file
- Automatic abbreviation expansion
- Type detection (Medical/Dental/DNB)

### 4. **State Mapping Integration**
- Handles messy state names with pin codes
- Maps variations to canonical names
- Supports manual review for ambiguous cases

### 5. **Interactive Review System**
- Rich terminal UI with color coding
- Top 5 suggestions shown upfront
- Alias creation and persistence
- Progress tracking with statistics

### 6. **Validation & Quality Control**
- Duplicate detection (YEAR + ROUND)
- Category validation (OPEN, OBC, SC, ST, EWS)
- Quota validation (AIQ, DNB, IP, OP, MANAGEMENT)
- Course stream validation

### 7. **Performance Optimization**
- Parallel processing support
- LRU caching for normalization
- Memoization for fuzzy matching
- Batch processing capabilities

## 📁 System Architecture

```
match-and-link-counselling/
├── match_and_link_counselling_data.py  # Main script
├── scripts/
│   └── create_state_mapping.py         # State normalization utility
├── config/
│   └── config.yaml                     # Configuration settings
├── docs/
│   ├── README.md                       # This file
│   ├── USAGE_GUIDE.md                  # Detailed usage instructions
│   ├── ALGORITHM_DETAILS.md            # Technical algorithm documentation
│   └── API_REFERENCE.md                # Function/class reference
└── logs/
    └── counselling_matching.log        # Execution logs
```

## 🚀 Quick Start

### Prerequisites

```bash
pip install pandas numpy sqlite3 rapidfuzz pyyaml rich tqdm
```

### Basic Usage

```bash
python match_and_link_counselling_data.py
```

### With Custom Configuration

```python
from match_and_link_counselling_data import CounsellingDataMatcher

# Initialize matcher
matcher = CounsellingDataMatcher(
    config_path='config/config.yaml',
    enable_parallel=True,
    num_workers=4
)

# Load master data
matcher.load_master_data()

# Process partitions
partitions = ['AIQ-2024', 'KEA-2024', 'KEA-DENTAL-2024']
for partition in partitions:
    matcher.process_partition(partition)

# Interactive review
matcher.interactive_review(limit=50)

# Generate report
matcher.generate_final_report()
```

## 📊 Match Rate Statistics

Typical match rates achieved:

| Category | Match Rate |
|----------|-----------|
| Colleges | 92-96% |
| Courses  | 95-98% |
| Cutoffs  | 88-94% |

## 🔧 Configuration

Key configuration sections in `config.yaml`:

### Normalization
```yaml
normalization:
  to_uppercase: true
  handle_hyphens_dots: true
  remove_special_chars: true
  normalize_whitespace: true
```

### Matching Thresholds
```yaml
matching:
  thresholds:
    exact: 100
    high_confidence: 90
    medium_confidence: 80
    low_confidence: 75
```

### Course Classification
```yaml
course_classification:
  medical_patterns: ['MD', 'MS', 'DM', 'MCH', 'DIPLOMA']
  dental_patterns: ['MDS', 'PG DIPLOMA']
  dnb_patterns: ['DNB', 'DNB-']
```

### DIPLOMA Courses
```yaml
diploma_courses:
  overlapping:
    - DIPLOMA IN ANAESTHESIOLOGY
    - DIPLOMA IN OBSTETRICS AND GYNAECOLOGY
    - DIPLOMA IN PAEDIATRICS
    - DIPLOMA IN OPHTHALMOLOGY
  dnb_only:
    - DIPLOMA IN FAMILY MEDICINE
```

## 📖 Core Algorithms

### College Matching Flow

```
Input: College Name, State, Course, Quota
  ↓
Preprocess: Extract clean name, normalize
  ↓
Detect Course Type → Medical/Dental/DNB/DIPLOMA
  ↓
Overlapping DIPLOMA? → Yes → Try Medical → Try DNB
  ↓                      No
Regular Course → Filter by State → Filter by Type
  ↓
Match College Name (Exact → Primary → Fuzzy)
  ↓
Multiple Matches? → Address Disambiguation
  ↓
Validate Course Stream
  ↓
Return Match Result
```

### Course Matching Flow

```
Input: Course Name
  ↓
Apply Aliases
  ↓
Normalize Text
  ↓
Apply Error Corrections
  ↓
Match to Standard Course
  ↓
Detect Course Type
  ↓
Return Course ID
```

### State Normalization Flow

```
Input: Raw State Name (may have pin code, address)
  ↓
Remove Pin Codes (6 digits)
  ↓
Check State Mapping Table
  ↓
Found? → Return Normalized State
  ↓
Not Found? → Fuzzy Match Canonical States
  ↓
Still Not Found? → Flag for Manual Review
```

## 🎨 Interactive Review Features

### 1. **Failure Reason Display**
Each unmatched record shows WHY it failed:
- 🔍 Low Similarity
- ❓ Not Found
- 🏥 College Unmatched Only
- 📚 Course Unmatched Only

### 2. **Top 5 Suggestions**
Automatically displays best matches with:
- Similarity score (color-coded)
- College/Course ID
- State
- Type (Medical/Dental/DNB)

### 3. **Action Options**
- [1] Quick match from top 5
- [2] Browse all colleges
- [3] Browse all courses
- [4] Create alias
- [5] Skip record
- [6] Skip remaining
- [7] Mark for manual review
- [8] Export unmatched

### 4. **Real-time Statistics**
- Match rates by type
- Records processed
- Aliases created
- Validation issues

## 📝 Database Schema

### Counselling Data (Partitioned)
```sql
CREATE TABLE counselling_{partition} (
    id INTEGER PRIMARY KEY,
    partition TEXT,
    college_institute_raw TEXT,
    college_id INTEGER,
    college_name TEXT,
    course_raw TEXT,
    course_id INTEGER,
    course_name TEXT,
    state_raw TEXT,
    state_normalized TEXT,
    year INTEGER,
    round INTEGER,
    quota TEXT,
    category TEXT,
    opening_rank INTEGER,
    closing_rank INTEGER,
    match_confidence REAL,
    match_method TEXT,
    is_matched BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Master Data
```sql
-- Medical Colleges
CREATE TABLE medical_colleges (
    id INTEGER PRIMARY KEY,
    name TEXT,
    state TEXT,
    type TEXT DEFAULT 'MEDICAL'
);

-- Dental Colleges
CREATE TABLE dental_colleges (
    id INTEGER PRIMARY KEY,
    name TEXT,
    state TEXT,
    type TEXT DEFAULT 'DENTAL'
);

-- DNB Colleges
CREATE TABLE dnb_colleges (
    id INTEGER PRIMARY KEY,
    name TEXT,
    state TEXT,
    type TEXT DEFAULT 'DNB'
);

-- Courses
CREATE TABLE courses (
    id INTEGER PRIMARY KEY,
    name TEXT,
    code TEXT,
    type TEXT  -- MEDICAL/DENTAL/DNB
);

-- Aliases
CREATE TABLE college_aliases (
    id INTEGER PRIMARY KEY,
    alias_name TEXT UNIQUE,
    original_name TEXT,
    college_id INTEGER
);

CREATE TABLE course_aliases (
    id INTEGER PRIMARY KEY,
    alias_name TEXT UNIQUE,
    original_name TEXT,
    course_id INTEGER
);

-- State Mappings
CREATE TABLE state_mappings (
    id INTEGER PRIMARY KEY,
    raw_state TEXT UNIQUE,
    normalized_state TEXT,
    is_verified BOOLEAN,
    notes TEXT
);
```

## 🔍 Validation Rules

### College Validation
- Must have non-empty name
- Must match course type (Medical/Dental/DNB)
- State should be valid if provided
- Course stream must be compatible

### Course Validation
- Must exist in master course list
- Type must match college type
- Standard abbreviations must be expanded

### Cutoff Validation
- Opening rank ≤ Closing rank
- Year must be valid (2020-2025)
- Round must be valid (1-4)
- Category must be in valid list
- Quota must be in valid list
- No duplicate (YEAR + ROUND + COLLEGE + COURSE)

## 📈 Performance Metrics

### Processing Speed
- **Small partitions** (<5000 records): ~2-5 minutes
- **Medium partitions** (5000-20000 records): ~10-20 minutes
- **Large partitions** (>20000 records): ~30-60 minutes

### Memory Usage
- Base: ~200-500 MB
- With parallel processing: ~500-1000 MB per worker
- Cache sizes: Configurable via LRU maxsize

### Optimization Tips
1. Enable parallel processing for large datasets
2. Adjust worker count based on CPU cores
3. Use caching for repeated normalizations
4. Process partitions sequentially to avoid memory issues

## 🐛 Troubleshooting

### Common Issues

**Issue: Low match rate (<80%)**
- Check if master data is up to date
- Verify state mappings are complete
- Review alias tables for missing entries
- Run interactive review to create aliases

**Issue: Slow processing**
- Enable parallel processing
- Increase worker count
- Check database indexes
- Reduce cache sizes if memory constrained

**Issue: Duplicate detection errors**
- Verify YEAR and ROUND fields are populated
- Check for data quality issues
- Review source Excel files for duplicates

**Issue: State normalization failures**
- Update state_mappings table
- Add missing variations
- Check for pin codes in state names
- Review manual review flagged states

## 📚 Additional Resources

- [USAGE_GUIDE.md](USAGE_GUIDE.md) - Detailed step-by-step guide
- [ALGORITHM_DETAILS.md](ALGORITHM_DETAILS.md) - Technical deep dive
- [API_REFERENCE.md](API_REFERENCE.md) - Complete API documentation

## 🤝 Contributing

This is an internal tool. For improvements:
1. Document changes in this README
2. Update relevant documentation files
3. Test with sample data
4. Update version in main script

## 📄 License

Internal use only - Medical Counselling Data Processing System

## 📞 Support

For issues or questions, contact the data team.

---

**Last Updated**: October 2025
**Version**: 3.0
**Status**: Production
