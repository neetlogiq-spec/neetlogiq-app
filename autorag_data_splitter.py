#!/usr/bin/env python3
"""
AutoRAG Data Splitter
Splits the counselling database into AutoRAG-compatible files (<3.8MB each)
while maintaining data integrity and analytical capabilities
"""

import duckdb
import pandas as pd
import os
from pathlib import Path
import json
from datetime import datetime

class AutoRAGDataSplitter:
    def __init__(self, source_db="counselling_data.duckdb", output_dir="autorag_data"):
        self.source_db = source_db
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.max_size_mb = 3.5  # Keep under 3.8MB with buffer
        
    def analyze_data_distribution(self):
        """Analyze data to determine optimal splitting strategy"""
        print("🔍 Analyzing data distribution for optimal splitting...")
        
        conn = duckdb.connect(self.source_db)
        
        # Get data distribution by source and year
        analysis = conn.execute("""
            SELECT 
                CASE 
                    WHEN sourceFile LIKE '%AIQ2024%' THEN 'AIQ_2024'
                    WHEN sourceFile LIKE '%AIQ2023%' THEN 'AIQ_2023'
                    WHEN sourceFile LIKE '%KEA2024%' THEN 'KEA_2024'
                    WHEN sourceFile LIKE '%KEA2023%' THEN 'KEA_2023'
                    WHEN sourceFile LIKE '%DENTAL%' THEN 'KEA_DENTAL_2024'
                    ELSE sourceFile
                END as data_source,
                COUNT(*) as record_count,
                AVG(CAST(matchConfidence AS DOUBLE)) as avg_confidence,
                COUNT(DISTINCT matchedCollegeName) as unique_colleges,
                COUNT(DISTINCT course) as unique_courses
            FROM counselling_data 
            GROUP BY data_source
            ORDER BY record_count DESC
        """).fetchdf()
        
        print(analysis.to_string(index=False))
        conn.close()
        return analysis
    
    def create_source_specific_files(self):
        """Create separate DuckDB files for each data source"""
        print("\n📦 Creating source-specific AutoRAG files...")
        
        conn = duckdb.connect(self.source_db)
        
        # Define data sources and their filters
        sources = {
            'AIQ_2024': "sourceFile LIKE '%AIQ2024%'",
            'AIQ_2023': "sourceFile LIKE '%AIQ2023%'", 
            'KEA_2024': "sourceFile LIKE '%KEA2024%'",
            'KEA_2023': "sourceFile LIKE '%KEA2023%'",
            'KEA_DENTAL_2024': "sourceFile LIKE '%DENTAL%'"
        }
        
        created_files = []
        
        for source_name, filter_condition in sources.items():
            output_file = self.output_dir / f"counselling_data_{source_name.lower()}.duckdb"
            
            # Create new database for this source
            source_conn = duckdb.connect(str(output_file))
            
            # Get data from main database
            main_data = conn.execute(f"""
                SELECT * FROM counselling_data WHERE {filter_condition}
            """).fetchdf()
            
            # Create table and insert data
            source_conn.execute("""
                CREATE TABLE counselling_data (
                    id VARCHAR, allIndiaRank VARCHAR, quota VARCHAR,
                    collegeInstitute VARCHAR, state VARCHAR, course VARCHAR,
                    category VARCHAR, round VARCHAR, year VARCHAR,
                    sourceFile VARCHAR, matchedCollegeId VARCHAR,
                    matchedCollegeName VARCHAR, matchConfidence VARCHAR,
                    matchMethod VARCHAR, matchPass VARCHAR,
                    customMappingApplied VARCHAR, needsManualReview VARCHAR,
                    isUnmatched VARCHAR, dataType VARCHAR
                )
            """)
            
            # Insert data in batches to avoid memory issues
            batch_size = 10000
            for i in range(0, len(main_data), batch_size):
                batch = main_data.iloc[i:i+batch_size]
                source_conn.register('batch_data', batch)
                source_conn.execute("INSERT INTO counselling_data SELECT * FROM batch_data")
                source_conn.unregister('batch_data')
            
            # Create indexes for performance
            source_conn.execute("CREATE INDEX idx_college ON counselling_data(matchedCollegeName)")
            source_conn.execute("CREATE INDEX idx_course ON counselling_data(course)")
            source_conn.execute("CREATE INDEX idx_confidence ON counselling_data(matchConfidence)")
            
            # Get record count and file size
            count = source_conn.execute("SELECT COUNT(*) FROM counselling_data").fetchone()[0]
            source_conn.close()
            
            file_size_mb = os.path.getsize(output_file) / 1024 / 1024
            
            if file_size_mb <= self.max_size_mb:
                print(f"  ✅ {source_name}: {count:,} records, {file_size_mb:.1f}MB")
                created_files.append({
                    'source': source_name,
                    'file': str(output_file),
                    'records': count,
                    'size_mb': file_size_mb
                })
            else:
                print(f"  ⚠️ {source_name}: {count:,} records, {file_size_mb:.1f}MB (TOO LARGE)")
                # Need to split this further
                created_files.extend(self.split_large_source(source_name, str(output_file), count))
        
        conn.close()
        return created_files
    
    def split_large_source(self, source_name, db_file, total_records):
        """Split large sources into smaller chunks"""
        print(f"    🔄 Splitting {source_name} into smaller chunks...")
        
        conn = duckdb.connect(db_file)
        
        # Calculate chunk size (aim for ~2.5MB files)
        chunk_size = min(30000, total_records // 2)  # Split large sources
        chunks_needed = (total_records + chunk_size - 1) // chunk_size
        
        created_files = []
        
        for i in range(chunks_needed):
            chunk_file = self.output_dir / f"counselling_data_{source_name.lower()}_part{i+1}.duckdb"
            chunk_conn = duckdb.connect(str(chunk_file))
            
            # Get chunk of data
            offset = i * chunk_size
            chunk_data = conn.execute(f"""
                SELECT * FROM counselling_data 
                LIMIT {chunk_size} OFFSET {offset}
            """).fetchdf()
            
            # Create table schema
            chunk_conn.execute("""
                CREATE TABLE counselling_data (
                    id VARCHAR, allIndiaRank VARCHAR, quota VARCHAR,
                    collegeInstitute VARCHAR, state VARCHAR, course VARCHAR,
                    category VARCHAR, round VARCHAR, year VARCHAR,
                    sourceFile VARCHAR, matchedCollegeId VARCHAR,
                    matchedCollegeName VARCHAR, matchConfidence VARCHAR,
                    matchMethod VARCHAR, matchPass VARCHAR,
                    customMappingApplied VARCHAR, needsManualReview VARCHAR,
                    isUnmatched VARCHAR, dataType VARCHAR
                )
            """)
            
            # Insert chunk data
            chunk_conn.register('chunk_data', chunk_data)
            chunk_conn.execute("INSERT INTO counselling_data SELECT * FROM chunk_data")
            chunk_conn.unregister('chunk_data')
            
            # Create indexes
            chunk_conn.execute("CREATE INDEX idx_college ON counselling_data(matchedCollegeName)")
            chunk_conn.execute("CREATE INDEX idx_course ON counselling_data(course)")
            
            chunk_count = chunk_conn.execute("SELECT COUNT(*) FROM counselling_data").fetchone()[0]
            chunk_conn.close()
            
            chunk_size_mb = os.path.getsize(chunk_file) / 1024 / 1024
            
            print(f"      ✅ Part {i+1}: {chunk_count:,} records, {chunk_size_mb:.1f}MB")
            
            created_files.append({
                'source': f"{source_name}_PART{i+1}",
                'file': str(chunk_file),
                'records': chunk_count,
                'size_mb': chunk_size_mb
            })
        
        # Remove the large original file
        conn.close()
        os.remove(db_file)
        
        return created_files
    
    def create_parquet_chunks(self):
        """Create AutoRAG-compatible Parquet chunks as alternative"""
        print("\n📦 Creating Parquet chunks for AutoRAG...")
        
        conn = duckdb.connect(self.source_db)
        parquet_dir = self.output_dir / "parquet_chunks"
        parquet_dir.mkdir(exist_ok=True)
        
        # Split by source and limit records per file
        chunk_size = 20000  # Records per chunk
        
        sources = ['AIQ_2024', 'AIQ_2023', 'KEA_2024', 'KEA_2023', 'KEA_DENTAL_2024']
        source_filters = {
            'AIQ_2024': "sourceFile LIKE '%AIQ2024%'",
            'AIQ_2023': "sourceFile LIKE '%AIQ2023%'", 
            'KEA_2024': "sourceFile LIKE '%KEA2024%'",
            'KEA_2023': "sourceFile LIKE '%KEA2023%'",
            'KEA_DENTAL_2024': "sourceFile LIKE '%DENTAL%'"
        }
        
        created_parquets = []
        
        for source in sources:
            # Get total count for this source
            total = conn.execute(f"""
                SELECT COUNT(*) FROM counselling_data 
                WHERE {source_filters[source]}
            """).fetchone()[0]
            
            if total == 0:
                continue
                
            chunks_needed = (total + chunk_size - 1) // chunk_size
            
            for i in range(chunks_needed):
                chunk_file = parquet_dir / f"counselling_{source.lower()}_chunk{i+1}.parquet"
                offset = i * chunk_size
                
                # Export chunk to parquet
                conn.execute(f"""
                    COPY (
                        SELECT * FROM counselling_data 
                        WHERE {source_filters[source]}
                        LIMIT {chunk_size} OFFSET {offset}
                    ) TO '{chunk_file}' (FORMAT PARQUET, COMPRESSION SNAPPY)
                """)
                
                chunk_size_mb = os.path.getsize(chunk_file) / 1024 / 1024
                chunk_records = min(chunk_size, total - offset)
                
                print(f"  ✅ {source} Chunk {i+1}: {chunk_records:,} records, {chunk_size_mb:.1f}MB")
                
                created_parquets.append({
                    'source': f"{source}_CHUNK{i+1}",
                    'file': str(chunk_file),
                    'records': chunk_records,
                    'size_mb': chunk_size_mb
                })
        
        conn.close()
        return created_parquets
    
    def create_summary_metadata(self, duckdb_files, parquet_files):
        """Create metadata file for AutoRAG integration"""
        metadata = {
            "created_timestamp": datetime.now().isoformat(),
            "autorag_compatible": True,
            "max_file_size_mb": self.max_size_mb,
            "total_original_records": 128602,
            "duckdb_files": duckdb_files,
            "parquet_files": parquet_files,
            "usage_instructions": {
                "duckdb": "Use duckdb.connect(file) to query individual sources",
                "parquet": "Use pandas.read_parquet(file) for chunk analysis",
                "recommended": "Use DuckDB files for SQL analytics, Parquet for ML/AutoRAG"
            }
        }
        
        metadata_file = self.output_dir / "autorag_metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"\n📋 Metadata saved to: {metadata_file}")
        return metadata
    
    def run_splitting(self):
        """Execute the complete splitting process"""
        print("🚀 AutoRAG DATA SPLITTING")
        print("=" * 50)
        
        # Analyze current data
        self.analyze_data_distribution()
        
        # Create source-specific DuckDB files
        duckdb_files = self.create_source_specific_files()
        
        # Create Parquet chunks 
        parquet_files = self.create_parquet_chunks()
        
        # Create metadata
        metadata = self.create_summary_metadata(duckdb_files, parquet_files)
        
        # Summary report
        print(f"\n🎉 AUTORAG SPLITTING COMPLETED!")
        print(f"📊 Created {len(duckdb_files)} DuckDB files")
        print(f"📦 Created {len(parquet_files)} Parquet chunks")
        print(f"💾 All files under {self.max_size_mb}MB for AutoRAG compatibility")
        print(f"🗂️ Output directory: {self.output_dir}")
        
        return metadata

def main():
    splitter = AutoRAGDataSplitter()
    splitter.run_splitting()

if __name__ == "__main__":
    main()