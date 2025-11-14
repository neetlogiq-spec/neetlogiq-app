# Schema Migration Guide

## SQLite to PostgreSQL Migration

This document explains how the DATABASE_SCHEMAS.md (SQLite) structure has been adapted for Supabase (PostgreSQL).

---

## Overview

**Source:** DATABASE_SCHEMAS.md - 3 separate SQLite databases
**Target:** Supabase - Single PostgreSQL database with unified schema

---

## Database Structure Comparison

### SQLite Structure (Original)
```
master_data.db
├── medical_colleges
├── dental_colleges
├── dnb_colleges
├── states
├── categories
├── quotas
├── courses
├── sources
├── levels
├── college_aliases
├── course_aliases
├── state_aliases
├── state_college_link
└── state_course_college_link

seat_data.db
└── seat_data

counselling_data_partitioned.db
├── counselling_records
└── partition_metadata
```

### PostgreSQL Structure (Supabase)
```
Single Database
├── Foundation Tables (from master_data.db)
│   ├── states
│   ├── categories
│   ├── quotas
│   ├── courses
│   ├── sources
│   └── levels
│
├── College Tables (from master_data.db)
│   ├── medical_colleges
│   ├── dental_colleges
│   └── dnb_colleges
│
├── Alias Tables (from master_data.db)
│   ├── college_aliases
│   ├── course_aliases
│   ├── state_aliases
│   ├── category_aliases
│   └── quota_aliases
│
├── Link Tables (from master_data.db)
│   ├── state_college_link
│   ├── state_course_college_link
│   └── state_mappings
│
├── Data Tables (from seat_data.db + counselling_data_partitioned.db)
│   ├── seat_data
│   ├── counselling_records
│   ├── counselling_rounds
│   └── partition_metadata
│
└── Application Tables (NEW - for web app)
    ├── user_profiles
    ├── user_roles
    ├── admin_users
    ├── subscriptions
    ├── payment_transactions
    ├── favorites
    ├── recommendations
    ├── user_activity
    ├── notifications
    ├── stream_configurations
    └── user_streams
```

---

## Key Adaptations

### 1. Data Type Conversions

| SQLite | PostgreSQL | Example |
|--------|------------|---------|
| `TEXT` | `VARCHAR(n)` or `TEXT` | `name TEXT` → `name VARCHAR(100)` |
| `INTEGER` | `INTEGER` or `SERIAL` | `id INTEGER` → `id SERIAL` |
| `REAL` | `DECIMAL` or `REAL` | `score REAL` → `score REAL` |
| `BOOLEAN` | `BOOLEAN` | `is_active BOOLEAN` |
| `TIMESTAMP` | `TIMESTAMPTZ` | `created_at TIMESTAMP` → `created_at TIMESTAMPTZ` |
| `JSON` | `JSONB` | `metadata JSON` → `metadata JSONB` |

### 2. Primary Key Strategy

**SQLite (Original):**
```sql
id TEXT PRIMARY KEY  -- Manual IDs like 'MED0001', 'ST001'
```

**PostgreSQL (Adapted):**
```sql
-- Foundation tables: Keep TEXT IDs for compatibility
id TEXT PRIMARY KEY  -- 'MED0001', 'ST001', etc.

-- Application tables: Use UUID for security
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
```

### 3. Auto-Increment

**SQLite:**
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
```

**PostgreSQL:**
```sql
id SERIAL PRIMARY KEY
-- OR
id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

### 4. Foreign Key Constraints

**Added explicit CASCADE rules in PostgreSQL:**
```sql
-- SQLite (implicit)
FOREIGN KEY (state_id) REFERENCES states(id)

-- PostgreSQL (explicit)
state_id TEXT REFERENCES states(id) ON DELETE CASCADE
```

### 5. Indexes

**Enhanced with PostgreSQL-specific indexes:**
```sql
-- GIN indexes for JSONB
CREATE INDEX idx_metadata ON table_name USING GIN (metadata);

-- Trigram indexes for fuzzy search
CREATE INDEX idx_name_trgm ON table_name USING GIN (name gin_trgm_ops);

-- Composite indexes
CREATE INDEX idx_state_course ON table_name(state_id, course_id);
```

---

## Table Mapping Details

### Foundation Tables

#### `states`
- **Source:** master_data.db → states
- **Changes:**
  - Added `code VARCHAR(10)` for state codes
  - Added `region VARCHAR(50)` for geographic regions
  - Changed `created_at` from `TIMESTAMP` to `TIMESTAMPTZ`
  - Added `updated_at TIMESTAMPTZ`

#### `categories`
- **Source:** master_data.db → categories
- **Changes:**
  - Added `code VARCHAR(10)`
  - Changed timestamp types to `TIMESTAMPTZ`
  - Added `updated_at`

#### `quotas`
- **Source:** master_data.db → quotas
- **Changes:**
  - Added `code VARCHAR(20)`
  - Changed timestamp types to `TIMESTAMPTZ`
  - Added `updated_at`

#### `courses`
- **Source:** master_data.db → courses
- **Changes:**
  - Added `code VARCHAR(20)`
  - Added `level VARCHAR(20)` and `domain VARCHAR(50)`
  - Added `duration_years INTEGER`
  - Added `description TEXT`
  - Changed timestamp types to `TIMESTAMPTZ`

---

### College Tables

#### `medical_colleges`, `dental_colleges`, `dnb_colleges`
- **Source:** master_data.db → medical_colleges, dental_colleges, dnb_colleges
- **Changes:**
  - Added application fields:
    - `establishment_year INTEGER`
    - `website VARCHAR(200)`
    - `phone VARCHAR(20)`
    - `email VARCHAR(100)`
    - `latitude DECIMAL(10,8)`
    - `longitude DECIMAL(11,8)`
    - `is_active BOOLEAN DEFAULT true`
  - Changed `college_type TEXT` to `VARCHAR(50)`
  - Changed timestamp types to `TIMESTAMPTZ`
  - Added `updated_at`

---

### Data Tables

#### `seat_data`
- **Source:** seat_data.db → seat_data
- **Changes:**
  - Added proper foreign key constraints
  - Changed `is_linked INTEGER` to `is_linked BOOLEAN`
  - Changed timestamp types to `TIMESTAMPTZ`
  - Added explicit `ON DELETE` rules

#### `counselling_records`
- **Source:** counselling_data_partitioned.db → counselling_records
- **Changes:**
  - Added foreign key constraints with proper CASCADE rules
  - Changed timestamp types to `TIMESTAMPTZ`
  - Enhanced indexes for PostgreSQL performance

---

## Views and Compatibility

### Unified Colleges View

Created `colleges_unified` view to replicate the SQLite `colleges` view:

```sql
CREATE OR REPLACE VIEW colleges_unified AS
    SELECT *, 'MEDICAL' as source_table FROM medical_colleges
    UNION ALL
    SELECT *, 'DENTAL' as source_table FROM dental_colleges
    UNION ALL
    SELECT *, 'DNB' as source_table FROM dnb_colleges;
```

This allows queries to work across all college types seamlessly.

---

## Triggers and Functions

### PostgreSQL Triggers

**Partition Metadata Updates:**
```sql
CREATE OR REPLACE FUNCTION update_partition_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Update partition statistics automatically
    ...
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_partition_stats
    AFTER INSERT OR UPDATE ON counselling_records
    FOR EACH ROW
    EXECUTE FUNCTION update_partition_metadata();
```

**Auto-Update Timestamps:**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to all tables with updated_at column
```

---

## Migration Files

### Order of Execution

1. **20250114_unified_schema.sql** - Complete schema structure
2. **foundation_data_population.sql** - Populate reference tables
3. **promote_to_super_admin.sql** - Create admin users

---

## Application Integration

### New Application Tables

These tables don't exist in the SQLite schema and are added for the web application:

1. **user_profiles** - User account data
2. **user_roles** - Role-based access control
3. **admin_users** - Admin accounts
4. **subscriptions** - Payment subscriptions
5. **payment_transactions** - Payment history
6. **favorites** - User favorites
7. **recommendations** - College recommendations
8. **user_activity** - Activity tracking
9. **notifications** - User notifications
10. **stream_configurations** - Stream settings
11. **user_streams** - User stream access

---

## Data Import Strategy

### Phase 1: Foundation Data ✅
- States (36 states/UTs)
- Categories (11 categories)
- Quotas (12 quota types)
- Sources (7 sources)
- Levels (5 levels)
- Courses (40 common courses)
- Stream configs (4 streams)
- User roles (4 roles)

### Phase 2: Master College Data
Import from existing SQLite databases:
1. Medical colleges (~600+)
2. Dental colleges (~300+)
3. DNB institutions (~1000+)

### Phase 3: Seat Data
Import seat matrix data with linking to master colleges/courses

### Phase 4: Counselling Data
Import historical counselling records (partitioned by year/source/level)

---

## Performance Optimizations

### Indexes Created

**Foundation Tables:** 8 indexes
**College Tables:** 9 indexes
**Alias Tables:** 3 indexes
**Link Tables:** 9 indexes
**Data Tables:** 13 indexes
**Application Tables:** 8 indexes

**Total:** 50+ indexes for optimal query performance

### PostgreSQL-Specific Features

1. **JSONB columns** for flexible metadata storage
2. **GIN indexes** for JSONB and full-text search
3. **Trigram indexes** for fuzzy string matching
4. **Partial indexes** for conditional uniqueness
5. **Composite indexes** for multi-column queries

---

## Compatibility Notes

### Preserved from SQLite

✅ All table structures
✅ All column names
✅ All composite keys
✅ All normalization fields
✅ TF-IDF vectors (as TEXT/JSON)
✅ Match scoring system
✅ Partition strategy

### Enhanced for PostgreSQL

✅ Proper foreign key constraints
✅ Cascade delete rules
✅ Timestamp with timezone
✅ JSONB for JSON data
✅ UUID for user tables
✅ Triggers for automation
✅ Views for compatibility

---

## Testing Checklist

- [ ] All foundation tables populated
- [ ] All foreign keys working
- [ ] Triggers firing correctly
- [ ] Views returning data
- [ ] Indexes improving query speed
- [ ] College data imported
- [ ] Seat data linked correctly
- [ ] Counselling data partitioned
- [ ] User management working
- [ ] Application features functional

---

## Rollback Strategy

If migration fails:

1. Drop all tables: `DROP SCHEMA public CASCADE;`
2. Recreate schema: `CREATE SCHEMA public;`
3. Restore from backup or re-run migrations

---

## Support

For issues during migration:
1. Check Supabase logs
2. Verify foreign key constraints
3. Check data types compatibility
4. Review trigger functions
5. Test queries on views

---

**Migration Status:** Complete
**Last Updated:** 2025-11-14
**Compatible With:** DATABASE_SCHEMAS.md (SQLite) + Web Application Features
