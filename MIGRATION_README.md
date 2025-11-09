# SQLite to PostgreSQL Migration Guide

This guide explains how to migrate your SQLite databases to PostgreSQL using the migration script.

## Prerequisites

1. **PostgreSQL installed and running**
   - Make sure PostgreSQL is installed and the server is running
   - Create a database for the migration (e.g., `neetlogiq`)

2. **Python dependencies**
   ```bash
   pip install -r requirements_postgresql.txt
   ```

3. **Configuration**
   - The script reads from `config.yaml` by default
   - Ensure `local_postgresql_url` is set in the config file
   - Or provide the PostgreSQL URL via command line

## Migration Script

The script `migrate_sqlite_to_postgresql.py` migrates all SQLite databases from `data/sqlite/` to PostgreSQL.

### Features

- ✅ Migrates all tables with their schemas
- ✅ Migrates all data (with progress bars)
- ✅ Migrates all indexes
- ✅ Migrates all views
- ✅ Handles data type conversions (SQLite → PostgreSQL)
- ✅ Batch processing for large datasets
- ✅ Error handling and reporting

### Usage

#### Migrate All Databases

```bash
python migrate_sqlite_to_postgresql.py
```

This will:
1. Find all `.db` files in `data/sqlite/`
2. Migrate each database to PostgreSQL
3. Show progress for each table
4. Display a summary at the end

#### Migrate a Specific Database

```bash
python migrate_sqlite_to_postgresql.py --database /path/to/specific.db
```

#### Use Custom PostgreSQL URL

```bash
python migrate_sqlite_to_postgresql.py --postgresql-url "postgresql://user:password@host:port/database"
```

#### Use Custom Config File

```bash
python migrate_sqlite_to_postgresql.py --config /path/to/config.yaml
```

### What Gets Migrated

1. **Tables**: All table structures are converted from SQLite to PostgreSQL
2. **Data**: All rows are migrated with proper data type handling
3. **Indexes**: All indexes are recreated in PostgreSQL
4. **Views**: All views are converted and recreated

### Data Type Conversions

| SQLite Type | PostgreSQL Type |
|------------|-----------------|
| INTEGER    | INTEGER         |
| TEXT       | TEXT            |
| REAL       | REAL            |
| BLOB       | BYTEA           |
| NUMERIC    | NUMERIC         |
| BOOLEAN    | BOOLEAN         |
| DATE       | DATE            |
| DATETIME   | TIMESTAMP       |
| TIMESTAMP  | TIMESTAMP       |

### Important Notes

1. **Existing Data**: The script will **DROP** existing tables/views before creating new ones. Make sure to backup your PostgreSQL database if needed.

2. **Triggers**: SQLite triggers are not automatically migrated due to syntax differences. You may need to recreate them manually in PostgreSQL.

3. **Foreign Keys**: Foreign key constraints are preserved if they exist in the SQLite schema.

4. **Large Databases**: The script uses batch processing (1000 rows per batch) to handle large datasets efficiently.

### Troubleshooting

#### Connection Errors

If you get connection errors:
- Verify PostgreSQL is running: `pg_isready`
- Check connection string format: `postgresql://user:password@host:port/database`
- Ensure the database exists: `createdb neetlogiq`

#### Schema Conversion Errors

If a table fails to migrate:
- Check the error message for specific issues
- Some SQLite-specific features may need manual conversion
- Views with complex SQL may need adjustment

#### Data Migration Errors

If data migration fails:
- Check for data type mismatches
- Verify NULL handling
- Check for constraint violations

### Example Output

```
============================================================
Migrating database: master_data
============================================================
Found 15 tables: Levels, Sources, categories, category_aliases, ...
Found 1 views: colleges

Processing table: medical_colleges
  Creating table structure...
  Table structure created successfully
  Migrating data...
  Migrating medical_colleges: 100%|████████| 5000/5000 [00:05<00:00, 1000rows/s]
  Migrated 5000 rows
  Migrating 3 indexes...
  Migrated 3 indexes

Processing view: colleges
  Creating view...
  View created successfully

============================================================
Migration Summary for master_data:
  Tables migrated: 15
  Views migrated: 1
  Total rows: 50000
============================================================
```

### Post-Migration Steps

1. **Verify Data**: Check row counts match between SQLite and PostgreSQL
2. **Test Queries**: Run some test queries to ensure data integrity
3. **Update Application**: Update your application to use PostgreSQL connection
4. **Backup**: Create a backup of the migrated PostgreSQL database

### Support

If you encounter issues:
1. Check the error messages in the console output
2. Verify your PostgreSQL connection settings
3. Ensure all dependencies are installed
4. Check that SQLite databases are accessible

