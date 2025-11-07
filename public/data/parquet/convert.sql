
-- Connect to SQLite database
ATTACH '/Users/kashyapanand/Public/New/data/sqlite/seat_data.db' AS sqlite_db;

-- Get all tables
.tables

-- Convert each table to Parquet
-- Colleges table
COPY (SELECT * FROM sqlite_db.medical_colleges) TO '/Users/kashyapanand/Public/New/public/data/parquet/seat_data/colleges.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- Courses table  
COPY (SELECT * FROM sqlite_db.courses) TO '/Users/kashyapanand/Public/New/public/data/parquet/seat_data/courses.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- Cutoffs table (if exists)
COPY (SELECT * FROM sqlite_db.counselling_data_partitioned) TO '/Users/kashyapanand/Public/New/public/data/parquet/seat_data/cutoffs.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- Seat data table (if exists)
COPY (SELECT * FROM sqlite_db.seat_data) TO '/Users/kashyapanand/Public/New/public/data/parquet/seat_data/seat_data.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- Detach database
DETACH sqlite_db;
