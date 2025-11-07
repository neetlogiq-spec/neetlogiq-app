#!/usr/bin/env python3
"""
DuckDB and Parquet Conversion Utility
Converts all processed counselling data to efficient Parquet format
and creates a unified DuckDB database for analysis
"""

import pandas as pd
import duckdb
import os
import glob
from datetime import datetime
from pathlib import Path
import json

class DuckDBConverter:
    def __init__(self, db_path="counselling_data.duckdb"):
        self.db_path = db_path
        self.parquet_dir = Path("data/parquet")
        self.parquet_dir.mkdir(exist_ok=True)
        
    def find_processed_files(self):
        """Find all processed counselling CSV files"""
        patterns = [
            "*counselling_processed_*.csv",
            "*2024_processed_*.csv", 
            "*2023_processed_*.csv"
        ]
        
        files = []
        for pattern in patterns:
            files.extend(glob.glob(pattern))
        
        # Remove duplicates and sort by modification time (newest first)
        unique_files = {}
        for file in files:
            # Extract base name (without timestamps)
            if 'aiq2023' in file.lower():
                key = 'aiq2023'
            elif 'aiq2024' in file.lower():
                key = 'aiq2024'
            elif 'kea2023' in file.lower():
                key = 'kea2023'
            elif 'kea2024' in file.lower():
                key = 'kea2024'
            elif 'keadental2024' in file.lower():
                key = 'keadental2024'
            else:
                key = file
                
            # Keep the newest file for each type
            if key not in unique_files or os.path.getctime(file) > os.path.getctime(unique_files[key]):
                unique_files[key] = file
        
        return list(unique_files.values())
    
    def convert_to_parquet(self, csv_file):
        """Convert CSV file to Parquet format"""
        print(f"📦 Converting {csv_file} to Parquet...")
        
        try:
            # Read CSV
            df = pd.read_csv(csv_file)
            
            # Generate parquet filename
            base_name = Path(csv_file).stem
            # Remove timestamp suffixes for cleaner names
            if '_processed_' in base_name:
                clean_name = base_name.split('_processed_')[0] + '_processed'
            else:
                clean_name = base_name
                
            parquet_file = self.parquet_dir / f"{clean_name}.parquet"
            
            # Optimize data types for better compression
            if 'allIndiaRank' in df.columns:
                df['allIndiaRank'] = pd.to_numeric(df['allIndiaRank'], errors='coerce')
            if 'year' in df.columns:
                df['year'] = pd.to_numeric(df['year'], errors='coerce')
            if 'matchConfidence' in df.columns:
                df['matchConfidence'] = pd.to_numeric(df['matchConfidence'], errors='coerce')
            if 'needsManualReview' in df.columns:
                df['needsManualReview'] = df['needsManualReview'].astype(bool)
            if 'isUnmatched' in df.columns:
                df['isUnmatched'] = df['isUnmatched'].astype(bool)
            if 'customMappingApplied' in df.columns:
                df['customMappingApplied'] = df['customMappingApplied'].astype(bool)
            
            # Write to Parquet with good compression
            df.to_parquet(
                parquet_file,
                compression='snappy',
                index=False,
                engine='pyarrow'
            )
            
            # Get file sizes for comparison
            csv_size = os.path.getsize(csv_file) / 1024 / 1024  # MB
            parquet_size = os.path.getsize(parquet_file) / 1024 / 1024  # MB
            compression_ratio = (csv_size - parquet_size) / csv_size * 100
            
            print(f"  ✅ Saved: {parquet_file}")
            print(f"  📊 Size: {csv_size:.1f}MB → {parquet_size:.1f}MB ({compression_ratio:.1f}% reduction)")
            
            return parquet_file, len(df)
            
        except Exception as e:
            print(f"  ❌ Error converting {csv_file}: {e}")
            return None, 0
    
    def create_duckdb_database(self, parquet_files):
        """Create unified DuckDB database from Parquet files"""
        print(f"\n🦆 Creating DuckDB database: {self.db_path}")
        
        # Remove existing database
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
        
        # Connect to DuckDB
        conn = duckdb.connect(self.db_path)
        
        try:
            # Create main counselling table with flexible VARCHAR schema
            # This avoids type conflicts between different data sources
            conn.execute("""
                CREATE TABLE counselling_data (
                    id VARCHAR,
                    allIndiaRank VARCHAR,
                    quota VARCHAR,
                    collegeInstitute VARCHAR,
                    state VARCHAR,
                    course VARCHAR,
                    category VARCHAR,
                    round VARCHAR,
                    year VARCHAR,
                    sourceFile VARCHAR,
                    matchedCollegeId VARCHAR,
                    matchedCollegeName VARCHAR,
                    matchConfidence VARCHAR,
                    matchMethod VARCHAR,
                    matchPass VARCHAR,
                    customMappingApplied VARCHAR,
                    needsManualReview VARCHAR,
                    isUnmatched VARCHAR,
                    dataType VARCHAR
                )
            """)
            
            total_records = 0
            remaining_files = parquet_files
            
            
            # Import all parquet files
            for parquet_file in remaining_files:
                if parquet_file and os.path.exists(parquet_file):
                    print(f"  📥 Importing {parquet_file}...")
                    
                    try:
                        # Get columns from the parquet file
                        file_cols = conn.execute(f"DESCRIBE SELECT * FROM read_parquet('{parquet_file}')").fetchdf()
                        file_columns = set(file_cols['column_name'].tolist())
                        
                        # Get columns from the target table
                        table_cols = conn.execute("PRAGMA table_info(counselling_data)").fetchdf()
                        table_columns = table_cols['name'].tolist()
                        
                        # Create column mapping - use NULL for missing columns
                        select_columns = []
                        for col in table_columns:
                            if col in file_columns:
                                select_columns.append(f"CAST({col} AS VARCHAR) AS {col}")
                            else:
                                select_columns.append(f"NULL AS {col}")
                        
                        # Use DuckDB's native Parquet support with column mapping
                        select_clause = ", ".join(select_columns)
                        conn.execute(f"""
                            INSERT INTO counselling_data 
                            SELECT {select_clause} FROM read_parquet('{parquet_file}')
                        """)
                        
                        # Count records
                        count = conn.execute("SELECT COUNT(*) FROM counselling_data").fetchone()[0]
                        records_added = count - total_records
                        total_records = count
                        
                        print(f"    ✅ Added {records_added:,} records")
                        
                    except Exception as e:
                        print(f"    ⚠️ Error importing {parquet_file}: {e}")
                        continue
            
            # Create indexes for better query performance
            print("  🔍 Creating indexes...")
            
            # First, check what columns actually exist
            columns = conn.execute("PRAGMA table_info(counselling_data)").fetchdf()
            existing_columns = set(columns['name'].tolist())
            
            # Create indexes only for existing columns
            if 'year' in existing_columns:
                conn.execute("CREATE INDEX idx_year ON counselling_data(year)")
            if 'sourceFile' in existing_columns:
                conn.execute("CREATE INDEX idx_source ON counselling_data(sourceFile)")
            if 'matchedCollegeName' in existing_columns:
                conn.execute("CREATE INDEX idx_college ON counselling_data(matchedCollegeName)")
            if 'course' in existing_columns:
                conn.execute("CREATE INDEX idx_course ON counselling_data(course)")
            if 'state' in existing_columns:
                conn.execute("CREATE INDEX idx_state ON counselling_data(state)")
            if 'matchConfidence' in existing_columns:
                try:
                    conn.execute("CREATE INDEX idx_confidence ON counselling_data(matchConfidence)")
                except Exception as e:
                    print(f"    ⚠️ Could not create confidence index: {e}")
            
            # Create summary statistics table
            conn.execute("""
                CREATE TABLE import_summary AS
                SELECT 
                    sourceFile,
                    year,
                    COUNT(*) as record_count,
                    AVG(CASE 
                        WHEN matchConfidence IS NOT NULL AND matchConfidence != '' 
                        THEN CAST(matchConfidence AS DOUBLE) 
                        ELSE NULL 
                    END) as avg_confidence,
                    SUM(CASE 
                        WHEN needsManualReview = 'true' OR needsManualReview = 'True' OR needsManualReview = '1' 
                        THEN 1 ELSE 0 
                    END) as needs_review,
                    SUM(CASE 
                        WHEN isUnmatched = 'true' OR isUnmatched = 'True' OR isUnmatched = '1' 
                        THEN 1 ELSE 0 
                    END) as unmatched,
                    COUNT(DISTINCT matchedCollegeName) as unique_colleges,
                    COUNT(DISTINCT course) as unique_courses
                FROM counselling_data
                GROUP BY sourceFile, year
                ORDER BY CAST(year AS INTEGER) DESC, sourceFile
            """)
            
            print(f"  ✅ Database created with {total_records:,} total records")
            
            # Show summary
            summary = conn.execute("SELECT * FROM import_summary").fetchdf()
            print(f"\n📊 Database Summary:")
            print(summary.to_string(index=False))
            
            return total_records
            
        finally:
            conn.close()
    
    def create_analysis_views(self):
        """Create useful views for data analysis"""
        print(f"\n📈 Creating analysis views...")
        
        conn = duckdb.connect(self.db_path)
        
        try:
            # Year-over-year comparison view
            conn.execute("""
                CREATE VIEW year_comparison AS
                SELECT 
                    year,
                    COUNT(*) as total_allocations,
                    COUNT(DISTINCT matchedCollegeName) as colleges_with_allocations,
                    COUNT(DISTINCT course) as courses_offered,
                    AVG(CASE 
                        WHEN matchConfidence IS NOT NULL AND matchConfidence != '' 
                        THEN CAST(matchConfidence AS DOUBLE) 
                        ELSE NULL 
                    END) as avg_match_confidence,
                    COUNT(DISTINCT CASE WHEN sourceFile LIKE '%aiq%' THEN matchedCollegeName END) as aiq_colleges,
                    COUNT(DISTINCT CASE WHEN sourceFile LIKE '%kea%' THEN matchedCollegeName END) as kea_colleges
                FROM counselling_data
                GROUP BY year
                ORDER BY CAST(year AS INTEGER)
            """)
            
            # Top colleges view
            conn.execute("""
                CREATE VIEW top_colleges AS
                SELECT 
                    matchedCollegeName as college,
                    COUNT(*) as total_allocations,
                    COUNT(DISTINCT course) as courses_offered,
                    COUNT(DISTINCT year) as years_active,
                    AVG(CASE 
                        WHEN matchConfidence IS NOT NULL AND matchConfidence != '' 
                        THEN CAST(matchConfidence AS DOUBLE) 
                        ELSE NULL 
                    END) as avg_confidence
                FROM counselling_data
                WHERE matchedCollegeName IS NOT NULL AND matchedCollegeName != ''
                GROUP BY matchedCollegeName
                ORDER BY total_allocations DESC
            """)
            
            # Course popularity view
            conn.execute("""
                CREATE VIEW course_popularity AS
                SELECT 
                    course,
                    COUNT(*) as allocations,
                    COUNT(DISTINCT matchedCollegeName) as colleges_offering,
                    COUNT(DISTINCT year) as years_offered,
                    AVG(CASE 
                        WHEN allIndiaRank IS NOT NULL AND allIndiaRank != '' AND CAST(allIndiaRank AS INTEGER) > 0
                        THEN CAST(allIndiaRank AS INTEGER) 
                        ELSE NULL 
                    END) as avg_rank_required
                FROM counselling_data
                WHERE course IS NOT NULL AND course != ''
                GROUP BY course
                ORDER BY allocations DESC
            """)
            
            print("  ✅ Created analysis views: year_comparison, top_colleges, course_popularity")
            
        finally:
            conn.close()
    
    def generate_conversion_report(self):
        """Generate a report of the conversion process"""
        report = {
            "conversion_timestamp": datetime.now().isoformat(),
            "database_path": str(self.db_path),
            "parquet_directory": str(self.parquet_dir),
            "total_files_converted": 0,
            "total_records": 0,
            "compression_stats": {},
            "database_size_mb": 0
        }
        
        # Get database size
        if os.path.exists(self.db_path):
            report["database_size_mb"] = os.path.getsize(self.db_path) / 1024 / 1024
        
        # Get parquet files info
        parquet_files = list(self.parquet_dir.glob("*.parquet"))
        report["parquet_files"] = [str(f) for f in parquet_files]
        report["total_files_converted"] = len(parquet_files)
        
        # Save report
        report_file = Path("data/duckdb_conversion_report.json")
        report_file.parent.mkdir(exist_ok=True)
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📋 Conversion report saved to: {report_file}")
        return report
    
    def run_conversion(self):
        """Run the complete conversion process"""
        print("🚀 DUCKDB AND PARQUET CONVERSION")
        print("=" * 50)
        
        # Find processed files
        csv_files = self.find_processed_files()
        print(f"📁 Found {len(csv_files)} processed files to convert:")
        for file in csv_files:
            print(f"  • {file}")
        
        if not csv_files:
            print("❌ No processed files found!")
            return
        
        # Convert to Parquet
        print(f"\n📦 Converting to Parquet format...")
        parquet_files = []
        total_records = 0
        
        for csv_file in csv_files:
            parquet_file, record_count = self.convert_to_parquet(csv_file)
            if parquet_file:
                parquet_files.append(parquet_file)
                total_records += record_count
        
        print(f"\n✅ Converted {len(parquet_files)} files with {total_records:,} total records")
        
        # Create DuckDB database
        db_records = self.create_duckdb_database(parquet_files)
        
        # Create analysis views
        self.create_analysis_views()
        
        # Generate report
        self.generate_conversion_report()
        
        print(f"\n🎉 CONVERSION COMPLETED SUCCESSFULLY!")
        print(f"📊 Database: {self.db_path} ({os.path.getsize(self.db_path) / 1024 / 1024:.1f}MB)")
        print(f"📦 Parquet files: {len(parquet_files)} files in {self.parquet_dir}")
        print(f"📈 Total records: {db_records:,}")

def main():
    converter = DuckDBConverter()
    converter.run_conversion()

if __name__ == "__main__":
    main()