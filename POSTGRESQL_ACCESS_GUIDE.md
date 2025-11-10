# PostgreSQL Database Access Guide

## Connection String
```
postgresql://kashyapanand@localhost:5432/seat_data
```

## Methods to Access

### 1. Command Line (psql)

**Basic connection:**
```bash
psql -U kashyapanand -d seat_data
```

**With connection string:**
```bash
psql postgresql://kashyapanand@localhost:5432/seat_data
```

**Common psql commands:**
```sql
-- List all tables
\dt

-- Describe a table structure
\d table_name

-- List all databases
\l

-- Switch database
\c database_name

-- Show current database
SELECT current_database();

-- Exit
\q
```

### 2. Python (psycopg2)

**Basic connection:**
```python
import psycopg2

# Using connection string
conn = psycopg2.connect("postgresql://kashyapanand@localhost:5432/seat_data")

# Or using parameters
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    user="kashyapanand",
    database="seat_data"
)

# Execute queries
cursor = conn.cursor()
cursor.execute("SELECT * FROM seat_data LIMIT 10;")
rows = cursor.fetchall()

# Close connection
cursor.close()
conn.close()
```

**Using connection pooling:**
```python
from psycopg2 import pool

connection_pool = psycopg2.pool.SimpleConnectionPool(
    1, 20,
    host="localhost",
    port=5432,
    user="kashyapanand",
    database="seat_data"
)

conn = connection_pool.getconn()
# Use connection...
connection_pool.putconn(conn)
```

### 3. Python (SQLAlchemy)

```python
from sqlalchemy import create_engine

# Create engine
engine = create_engine("postgresql://kashyapanand@localhost:5432/seat_data")

# Execute queries
with engine.connect() as conn:
    result = conn.execute("SELECT * FROM seat_data LIMIT 10;")
    for row in result:
        print(row)

# Using pandas
import pandas as pd
df = pd.read_sql("SELECT * FROM seat_data LIMIT 10;", engine)
```

### 4. Node.js/TypeScript

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'kashyapanand',
  database: 'seat_data',
});

// Query
const result = await pool.query('SELECT * FROM seat_data LIMIT 10;');
console.log(result.rows);
```

### 5. Environment Variables

Create a `.env` file:
```
DATABASE_URL=postgresql://kashyapanand@localhost:5432/seat_data
```

Use in Python:
```python
import os
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
```

### 6. GUI Tools

**pgAdmin:**
- Download: https://www.pgadmin.org/
- Create new server:
  - Host: localhost
  - Port: 5432
  - Username: kashyapanand
  - Database: seat_data

**DBeaver:**
- Download: https://dbeaver.io/
- Create new connection:
  - Database: PostgreSQL
  - Host: localhost
  - Port: 5432
  - Database: seat_data
  - Username: kashyapanand

**TablePlus (macOS):**
- Download: https://tableplus.com/
- Create new connection:
  - Type: PostgreSQL
  - Host: localhost
  - Port: 5432
  - User: kashyapanand
  - Database: seat_data

**VS Code Extension:**
- Install "PostgreSQL" extension
- Connect using connection string

### 7. Quick Test Script

**Python test script:**
```python
#!/usr/bin/env python3
import psycopg2

try:
    conn = psycopg2.connect("postgresql://kashyapanand@localhost:5432/seat_data")
    cursor = conn.cursor()
    
    # List tables
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
    """)
    
    print("Tables in seat_data database:")
    for table in cursor.fetchall():
        print(f"  - {table[0]}")
    
    # Get row count
    cursor.execute("SELECT COUNT(*) FROM seat_data;")
    count = cursor.fetchone()[0]
    print(f"\nTotal rows in seat_data: {count}")
    
    cursor.close()
    conn.close()
    print("\n✓ Connection successful!")
    
except Exception as e:
    print(f"✗ Connection failed: {e}")
```

## All Your Databases

**seat_data:**
```bash
psql postgresql://kashyapanand@localhost:5432/seat_data
```

**master_data:**
```bash
psql postgresql://kashyapanand@localhost:5432/master_data
```

**counselling_data_partitioned:**
```bash
psql postgresql://kashyapanand@localhost:5432/counselling_data_partitioned
```

## Troubleshooting

**Connection refused:**
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Start PostgreSQL (if using Homebrew)
brew services start postgresql@14
```

**Authentication failed:**
- Check if user exists: `psql -U postgres -c "\du"`
- Create user if needed: `CREATE USER kashyapanand;`

**Database doesn't exist:**
- List databases: `psql -U kashyapanand -d postgres -c "\l"`
- Create database: `CREATE DATABASE seat_data;`

## Quick Reference

```bash
# Connect to seat_data
psql -U kashyapanand -d seat_data

# Run a query
psql -U kashyapanand -d seat_data -c "SELECT COUNT(*) FROM seat_data;"

# Export to CSV
psql -U kashyapanand -d seat_data -c "COPY seat_data TO STDOUT WITH CSV HEADER;" > seat_data.csv

# Import from CSV
psql -U kashyapanand -d seat_data -c "COPY seat_data FROM STDIN WITH CSV HEADER;" < seat_data.csv
```


