# Database Schemas Documentation

**Generated:** Current Date  
**Database Location:** `/Users/kashyapanand/Public/New/data/sqlite`

---

## 📊 Table of Contents

1. [Master Database (master_data.db)](#master-database-master_datadb)
2. [Seat Data Database (seat_data.db)](#seat-data-database-seat_datadb)
3. [Counselling Data Database (counselling_data_partitioned.db)](#counselling-data-database-counselling_data_partitioneddb)

---

## 🗄️ Master Database (master_data.db)

### Core College Tables

#### `medical_colleges`
```sql
CREATE TABLE IF NOT EXISTS "medical_colleges" (
    "state" TEXT,
    "name" TEXT,
    "address" TEXT,
    "college_type" TEXT,
    "id" TEXT,
    "normalized_name" TEXT,
    "normalized_state" TEXT,
    "tfidf_vector" TEXT,
    "normalized_address" TEXT,
    "composite_college_key" TEXT
);
```

**Columns:**
- `id` - College ID (e.g., MED0001)
- `name` - College name (raw)
- `state` - State name (raw)
- `address` - College address (raw)
- `college_type` - Type of college (GOVERNMENT, PRIVATE, etc.)
- `normalized_name` - Normalized college name
- `normalized_state` - Normalized state name
- `normalized_address` - Normalized address
- `composite_college_key` - Composite key for matching
- `tfidf_vector` - TF-IDF vector for similarity matching

**Indexes:**
- `idx_medical_state_type` ON `medical_colleges(state, college_type)`

---

#### `dental_colleges`
```sql
CREATE TABLE IF NOT EXISTS "dental_colleges" (
    "state" TEXT,
    "name" TEXT,
    "address" TEXT,
    "college_type" TEXT,
    "id" TEXT,
    "normalized_name" TEXT,
    "normalized_state" TEXT,
    "tfidf_vector" TEXT,
    "normalized_address" TEXT,
    "composite_college_key" TEXT
);
```

**Columns:** Same as `medical_colleges`

**Indexes:**
- `idx_dental_state_type` ON `dental_colleges(state, college_type)`

---

#### `dnb_colleges`
```sql
CREATE TABLE IF NOT EXISTS "dnb_colleges" (
    "state" TEXT,
    "name" TEXT,
    "address" TEXT,
    "college_type" TEXT,
    "id" TEXT,
    "normalized_name" TEXT,
    "normalized_state" TEXT,
    "tfidf_vector" TEXT,
    "normalized_address" TEXT,
    "composite_college_key" TEXT
);
```

**Columns:** Same as `medical_colleges`

**Indexes:**
- `idx_dnb_state_type` ON `dnb_colleges(state, college_type)`

---

#### `colleges` (VIEW)
```sql
CREATE VIEW colleges AS
    SELECT
        id,
        name,
        state,
        address,
        college_type,
        normalized_name,
        normalized_state,
        composite_college_key,
        'MEDICAL' as source_table
    FROM medical_colleges

    UNION ALL

    SELECT
        id,
        name,
        state,
        address,
        college_type,
        normalized_name,
        normalized_state,
        composite_college_key,
        'DENTAL' as source_table
    FROM dental_colleges

    UNION ALL

    SELECT
        id,
        name,
        state,
        address,
        college_type,
        normalized_name,
        normalized_state,
        composite_college_key,
        'DNB' as source_table
    FROM dnb_colleges;
```

**Purpose:** Unified view of all college types (MEDICAL, DENTAL, DNB)

---

### Reference Tables

#### `states`
```sql
CREATE TABLE states (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    normalized_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id` - State ID (e.g., ST001)
- `name` - State name (raw)
- `normalized_name` - Normalized state name
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

**Indexes:**
- `idx_states_name` ON `states(name)`
- `idx_states_normalized` ON `states(normalized_name)`
- `idx_states_normalized_name` ON `states(normalized_name)`

---

#### `categories`
```sql
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    normalized_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id` - Category ID
- `name` - Category name (raw)
- `normalized_name` - Normalized category name
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

**Indexes:**
- `idx_categories_name` ON `categories(name)`
- `idx_categories_normalized` ON `categories(normalized_name)`

---

#### `quotas`
```sql
CREATE TABLE quotas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    normalized_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id` - Quota ID
- `name` - Quota name (raw)
- `normalized_name` - Normalized quota name
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

**Indexes:**
- `idx_quotas_name` ON `quotas(name)`
- `idx_quotas_normalized` ON `quotas(normalized_name)`

---

#### `courses`
```sql
CREATE TABLE IF NOT EXISTS "courses" (
    "name" TEXT,
    "id" TEXT,
    "normalized_name" TEXT,
    "tfidf_vector" TEXT
);
```

**Columns:**
- `id` - Course ID (e.g., CRS0001)
- `name` - Course name (raw)
- `normalized_name` - Normalized course name
- `tfidf_vector` - TF-IDF vector for similarity matching

**Indexes:**
- `idx_courses_normalized_name` ON `courses(normalized_name)`
- `idx_courses_normalized_covering` ON `courses(normalized_name, name, id)`

---

#### `Sources`
```sql
CREATE TABLE Sources (
    id TEXT PRIMARY KEY,
    Source TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Tracks data sources (AIQ, KEA, STATE, etc.)

---

#### `Levels`
```sql
CREATE TABLE Levels (
    id TEXT PRIMARY KEY,
    Level TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Tracks education levels (UG, PG, DEN, etc.)

---

### Alias Tables

#### `college_aliases`
```sql
CREATE TABLE college_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL,
    alias_name TEXT NOT NULL,
    master_college_id TEXT,
    state_normalized TEXT,
    address_normalized TEXT,
    confidence REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (master_college_id) REFERENCES medical_colleges(id)
);
```

**Indexes:**
- `idx_college_aliases_original` ON `college_aliases(original_name)`

---

#### `course_aliases`
```sql
CREATE TABLE course_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL,
    alias_name TEXT NOT NULL,
    course_id TEXT,
    confidence REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id)
);
```

**Indexes:**
- `idx_course_aliases_original` ON `course_aliases(original_name)`

---

#### `state_aliases`
```sql
CREATE TABLE state_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL UNIQUE,
    alias_name TEXT NOT NULL,
    state_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_state_aliases_original` ON `state_aliases(original_name)`
- `idx_state_aliases_state_id` ON `state_aliases(state_id)`

---

#### `category_aliases`
```sql
CREATE TABLE category_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL,
    alias_name TEXT NOT NULL,
    category_id TEXT,
    confidence REAL DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

---

#### `quota_aliases`
```sql
CREATE TABLE quota_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL,
    alias_name TEXT NOT NULL,
    quota_id TEXT,
    confidence REAL DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quota_id) REFERENCES quotas(id)
);
```

---

### Link Tables

#### `state_college_link`
```sql
CREATE TABLE state_college_link (
    college_name TEXT NOT NULL,
    address TEXT,
    state TEXT NOT NULL,
    college_id TEXT NOT NULL,
    state_id TEXT NOT NULL,
    composite_college_key TEXT,
    FOREIGN KEY (state_id) REFERENCES states(id),
    PRIMARY KEY (college_id, state_id)
);
```

**Purpose:** Links colleges to states with composite keys

**Indexes:**
- `idx_state_college_link_state_id` ON `state_college_link(state_id)`
- `idx_state_college_link_college_id` ON `state_college_link(college_id)`
- `idx_state_college_link_state_college` ON `state_college_link(state_id, college_id)`
- `idx_scl_state` ON `state_college_link(state_id)`
- `idx_scl_college` ON `state_college_link(college_id)`
- `idx_scl_state_college` ON `state_college_link(state_id, college_id)`
- `idx_scl_composite_key` ON `state_college_link(composite_college_key)`

---

#### `state_course_college_link`
```sql
CREATE TABLE state_course_college_link (
    state_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    college_id TEXT NOT NULL,
    stream TEXT,
    master_address TEXT,
    seat_address_normalized TEXT,
    occurrences INTEGER,
    last_seen_ts TEXT,
    PRIMARY KEY (state_id, course_id, college_id)
);
```

**Purpose:** Links state-course-college combinations with occurrence tracking

**Indexes:**
- `idx_ms_sccl_state` ON `state_course_college_link(state_id)`
- `idx_ms_sccl_course` ON `state_course_college_link(course_id)`
- `idx_ms_sccl_state_course` ON `state_course_college_link(state_id, course_id)`
- `idx_ms_sccl_college` ON `state_course_college_link(college_id)`
- `idx_sccl_state` ON `state_course_college_link(state_id)`
- `idx_sccl_course` ON `state_course_college_link(course_id)`
- `idx_sccl_college` ON `state_course_college_link(college_id)`
- `idx_sccl_state_course` ON `state_course_college_link(state_id, course_id)`
- `idx_sccl_state_course_college` ON `state_course_college_link(state_id, course_id, college_id)`

---

#### `state_mappings`
```sql
CREATE TABLE state_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_state TEXT UNIQUE NOT NULL,
    normalized_state TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Maps raw state names to normalized state names

**Indexes:**
- `idx_state_mappings_raw` ON `state_mappings(raw_state)`

---

## 🪑 Seat Data Database (seat_data.db)

### `seat_data` Table

```sql
CREATE TABLE IF NOT EXISTS "seat_data" (
    "id" TEXT,
    "college_name" TEXT,
    "course_name" TEXT,
    "seats" INTEGER,
    "state" TEXT,
    "address" TEXT,
    "management" TEXT,
    "university_affiliation" TEXT,
    "normalized_college_name" TEXT,
    "normalized_course_name" TEXT,
    "normalized_state" TEXT,
    "normalized_address" TEXT,
    "course_type" TEXT,
    "source_file" TEXT,
    "created_at" TEXT,
    "updated_at" TEXT,
    "master_college_id" TEXT,
    "master_course_id" TEXT,
    "master_state_id" TEXT,
    "college_match_score" REAL,
    "course_match_score" REAL,
    "college_match_method" TEXT,
    "course_match_method" TEXT,
    "is_linked" INTEGER,
    "state_id" TEXT,
    "college_id" TEXT,
    "course_id" TEXT,
    "record_hash" TEXT,
    "validation_status" TEXT,
    "validation_errors" TEXT
);
```

### Column Details

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Record ID |
| `college_name` | TEXT | Raw college name from source |
| `course_name` | TEXT | Raw course name from source |
| `seats` | INTEGER | Number of seats available |
| `state` | TEXT | Raw state name |
| `address` | TEXT | Raw college address |
| `management` | TEXT | Management type (GOVERNMENT, PRIVATE, etc.) |
| `university_affiliation` | TEXT | University affiliation |
| `normalized_college_name` | TEXT | Normalized college name |
| `normalized_course_name` | TEXT | Normalized course name |
| `normalized_state` | TEXT | Normalized state name |
| `normalized_address` | TEXT | Normalized address |
| `course_type` | TEXT | Course type (MBBS, BDS, MD, MS, MDS, DIPLOMA, DNB) |
| `source_file` | TEXT | Source file name |
| `created_at` | TEXT | Creation timestamp |
| `updated_at` | TEXT | Last update timestamp |
| `master_college_id` | TEXT | Linked master college ID |
| `master_course_id` | TEXT | Linked master course ID |
| `master_state_id` | TEXT | Linked master state ID |
| `college_match_score` | REAL | College matching confidence score (0.0-1.0) |
| `course_match_score` | REAL | Course matching confidence score (0.0-1.0) |
| `college_match_method` | TEXT | Method used for college matching |
| `course_match_method` | TEXT | Method used for course matching |
| `is_linked` | INTEGER | Boolean flag (0/1) indicating if linked to master data |
| `state_id` | TEXT | State ID reference |
| `college_id` | TEXT | College ID reference |
| `course_id` | TEXT | Course ID reference |
| `record_hash` | TEXT | Hash of record for deduplication |
| `validation_status` | TEXT | Validation status |
| `validation_errors` | TEXT | Validation error messages |

---

## 📋 Counselling Data Database (counselling_data_partitioned.db)

### `counselling_records` Table

```sql
CREATE TABLE counselling_records (
    id TEXT PRIMARY KEY,  -- {SOURCE}-{LEVEL}-{YEAR}-{RANK}-{ROUND}
    
    -- Raw data from Excel
    all_india_rank INTEGER NOT NULL,
    quota TEXT,
    college_institute_raw TEXT NOT NULL,
    state_raw TEXT,
    course_raw TEXT NOT NULL,
    category TEXT,
    round_raw TEXT NOT NULL,
    year INTEGER NOT NULL,
    
    -- Normalized data
    college_institute_normalized TEXT,
    state_normalized TEXT,
    course_normalized TEXT,
    source_normalized TEXT,  -- AIQ, KEA, STATE, etc.
    level_normalized TEXT,   -- UG, PG, DEN
    round_normalized INTEGER, -- 1, 2, 3, etc.
    
    -- Linked to master data
    master_college_id TEXT,  -- MED0001, DEN0001, DNB0001
    master_course_id TEXT,   -- CRS0001, CRS0002, etc.
    master_state_id TEXT,
    master_quota_id TEXT,
    master_category_id TEXT,
    master_source_id TEXT,
    master_level_id TEXT,
    
    -- Match metadata
    college_match_score REAL,
    college_match_method TEXT,
    course_match_score REAL,
    course_match_method TEXT,
    
    -- Status
    is_matched BOOLEAN DEFAULT FALSE,
    needs_manual_review BOOLEAN DEFAULT FALSE,
    
    -- Partition info
    partition_key TEXT NOT NULL,  -- AIQ-PG-2024, KEA-UG-2024, etc.
    
    -- Additional fields
    address TEXT,
    Source TEXT,
    Level TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Column Details

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Composite ID: {SOURCE}-{LEVEL}-{YEAR}-{RANK}-{ROUND} |
| `all_india_rank` | INTEGER | NOT NULL | All India rank |
| `quota` | TEXT | | Quota type |
| `college_institute_raw` | TEXT | NOT NULL | Raw college name from source |
| `state_raw` | TEXT | | Raw state name |
| `course_raw` | TEXT | NOT NULL | Raw course name |
| `category` | TEXT | | Category (GEN, OBC, SC, ST, etc.) |
| `round_raw` | TEXT | NOT NULL | Raw round number |
| `year` | INTEGER | NOT NULL | Year |
| `college_institute_normalized` | TEXT | | Normalized college name |
| `state_normalized` | TEXT | | Normalized state name |
| `course_normalized` | TEXT | | Normalized course name |
| `source_normalized` | TEXT | | Normalized source (AIQ, KEA, STATE) |
| `level_normalized` | TEXT | | Normalized level (UG, PG, DEN) |
| `round_normalized` | INTEGER | | Normalized round number |
| `master_college_id` | TEXT | | Linked master college ID |
| `master_course_id` | TEXT | | Linked master course ID |
| `master_state_id` | TEXT | | Linked master state ID |
| `master_quota_id` | TEXT | | Linked master quota ID |
| `master_category_id` | TEXT | | Linked master category ID |
| `master_source_id` | TEXT | | Linked master source ID |
| `master_level_id` | TEXT | | Linked master level ID |
| `college_match_score` | REAL | | College matching confidence (0.0-1.0) |
| `college_match_method` | TEXT | | Method used for college matching |
| `course_match_score` | REAL | | Course matching confidence (0.0-1.0) |
| `course_match_method` | TEXT | | Method used for course matching |
| `is_matched` | BOOLEAN | DEFAULT FALSE | Whether record is matched to master data |
| `needs_manual_review` | BOOLEAN | DEFAULT FALSE | Whether record needs manual review |
| `partition_key` | TEXT | NOT NULL | Partition key: {SOURCE}-{LEVEL}-{YEAR} |
| `address` | TEXT | | College address |
| `Source` | TEXT | | Source identifier |
| `Level` | TEXT | | Education level |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

### Indexes

```sql
CREATE INDEX idx_counselling_partition ON counselling_records(partition_key);
CREATE INDEX idx_counselling_rank ON counselling_records(all_india_rank);
CREATE INDEX idx_counselling_college ON counselling_records(master_college_id);
CREATE INDEX idx_counselling_course ON counselling_records(master_course_id);
CREATE INDEX idx_counselling_state ON counselling_records(state_normalized);
CREATE INDEX idx_counselling_category ON counselling_records(category);
CREATE INDEX idx_counselling_year ON counselling_records(year);
CREATE INDEX idx_counselling_matched ON counselling_records(is_matched);
CREATE INDEX idx_counselling_partition_rank ON counselling_records(partition_key, all_india_rank);
CREATE INDEX idx_counselling_college_course ON counselling_records(master_college_id, master_course_id);
CREATE INDEX idx_counselling_year_source ON counselling_records(year, source_normalized);
CREATE INDEX idx_counselling_address ON counselling_records(address);
```

### Triggers

#### `update_partition_stats_insert`
```sql
CREATE TRIGGER update_partition_stats_insert
    AFTER INSERT ON counselling_records
    BEGIN
        UPDATE partition_metadata 
        SET 
            total_records = total_records + 1,
            matched_records = matched_records + CASE WHEN NEW.is_matched THEN 1 ELSE 0 END,
            unmatched_records = unmatched_records + CASE WHEN NOT NEW.is_matched THEN 1 ELSE 0 END,
            needs_review_records = needs_review_records + CASE WHEN NEW.needs_manual_review THEN 1 ELSE 0 END,
            last_updated = CURRENT_TIMESTAMP
        WHERE partition_key = NEW.partition_key;
    END;
```

#### `update_partition_stats_update`
```sql
CREATE TRIGGER update_partition_stats_update
    AFTER UPDATE ON counselling_records
    BEGIN
        UPDATE partition_metadata 
        SET 
            matched_records = matched_records + 
                CASE WHEN NEW.is_matched AND NOT OLD.is_matched THEN 1
                     WHEN NOT NEW.is_matched AND OLD.is_matched THEN -1
                     ELSE 0 END,
            unmatched_records = unmatched_records + 
                CASE WHEN NOT NEW.is_matched AND OLD.is_matched THEN 1
                     WHEN NEW.is_matched AND NOT OLD.is_matched THEN -1
                     ELSE 0 END,
            needs_review_records = needs_review_records + 
                CASE WHEN NEW.needs_manual_review AND NOT OLD.needs_manual_review THEN 1
                     WHEN NOT NEW.needs_manual_review AND OLD.needs_manual_review THEN -1
                     ELSE 0 END,
            last_updated = CURRENT_TIMESTAMP
        WHERE partition_key = NEW.partition_key;
    END;
```

---

## 🔗 Relationships

### Master Database Relationships

1. **Colleges → States**
   - `medical_colleges`, `dental_colleges`, `dnb_colleges` → `state_college_link` → `states`

2. **Colleges → Courses**
   - `medical_colleges`, `dental_colleges`, `dnb_colleges` → `state_course_college_link` → `courses`

3. **Aliases**
   - `college_aliases` → `medical_colleges` (via `master_college_id`)
   - `course_aliases` → `courses` (via `course_id`)
   - `state_aliases` → `states` (via `state_id`)
   - `category_aliases` → `categories` (via `category_id`)
   - `quota_aliases` → `quotas` (via `quota_id`)

### Seat Data Relationships

1. **Seat Data → Master Data**
   - `seat_data.master_college_id` → `medical_colleges.id` / `dental_colleges.id` / `dnb_colleges.id`
   - `seat_data.master_course_id` → `courses.id`
   - `seat_data.master_state_id` → `states.id`

### Counselling Data Relationships

1. **Counselling Records → Master Data**
   - `counselling_records.master_college_id` → `medical_colleges.id` / `dental_colleges.id` / `dnb_colleges.id`
   - `counselling_records.master_course_id` → `courses.id`
   - `counselling_records.master_state_id` → `states.id`
   - `counselling_records.master_quota_id` → `quotas.id`
   - `counselling_records.master_category_id` → `categories.id`
   - `counselling_records.master_source_id` → `Sources.id`
   - `counselling_records.master_level_id` → `Levels.id`

---

## 📝 Notes

1. **Composite Keys**: Used extensively for matching colleges across different data sources
   - Format: `{normalized_name}_{normalized_state}_{normalized_address}`

2. **Normalization**: All tables have normalized versions of text fields for consistent matching

3. **TF-IDF Vectors**: Stored as TEXT (JSON serialized) for similarity matching

4. **Partitioning**: Counselling data is partitioned by `partition_key` for efficient querying

5. **Match Tracking**: Both `seat_data` and `counselling_records` track match scores and methods for audit purposes

6. **Validation**: `seat_data` includes validation status and error tracking

7. **Triggers**: Counselling records have triggers to maintain partition statistics automatically

---

**Last Updated:** Current Date  
**Database Version:** SQLite 3.x

