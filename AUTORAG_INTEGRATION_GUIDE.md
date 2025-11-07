# AutoRAG Integration Guide
## Counselling Data Management System

**Generated**: September 26, 2024  
**Compatibility**: AutoRAG file size requirements (<3.8MB)  
**Total Records**: 128,602 across all files

---

## 🎯 **AUTORAG-COMPATIBLE FILES READY**

The original 19.3MB DuckDB database has been successfully split into **17 AutoRAG-compatible files**:

### 📊 **DuckDB Files (8 files)**
All DuckDB files are under 3.5MB and maintain full SQL analytics capabilities:

| File | Records | Size | Source |
|------|---------|------|--------|
| `counselling_data_aiq_2024_part1.duckdb` | 28,866 | 2.5MB | AIQ 2024 Part 1 |
| `counselling_data_aiq_2024_part2.duckdb` | 28,866 | 2.8MB | AIQ 2024 Part 2 |
| `counselling_data_aiq_2024_part3.duckdb` | 1 | 1.0MB | AIQ 2024 Part 3 |
| `counselling_data_aiq_2023_part1.duckdb` | 26,984 | 2.5MB | AIQ 2023 Part 1 |
| `counselling_data_aiq_2023_part2.duckdb` | 26,984 | 2.8MB | AIQ 2023 Part 2 |
| `counselling_data_kea_2024.duckdb` | 7,105 | 1.3MB | KEA 2024 Complete |
| `counselling_data_kea_2023.duckdb` | 7,041 | 1.3MB | KEA 2023 Complete |
| `counselling_data_kea_dental_2024.duckdb` | 2,755 | 1.3MB | KEA Dental 2024 |

### 📦 **Parquet Files (9 files)**
Highly compressed parquet chunks optimized for ML and AutoRAG workflows:

| File | Records | Size | Source |
|------|---------|------|--------|
| `counselling_aiq_2024_chunk1.parquet` | 20,000 | 0.44MB | AIQ 2024 Chunk 1 |
| `counselling_aiq_2024_chunk2.parquet` | 20,000 | 0.45MB | AIQ 2024 Chunk 2 |
| `counselling_aiq_2024_chunk3.parquet` | 17,733 | 0.41MB | AIQ 2024 Chunk 3 |
| `counselling_aiq_2023_chunk1.parquet` | 20,000 | 0.41MB | AIQ 2023 Chunk 1 |
| `counselling_aiq_2023_chunk2.parquet` | 20,000 | 0.47MB | AIQ 2023 Chunk 2 |
| `counselling_aiq_2023_chunk3.parquet` | 13,968 | 0.37MB | AIQ 2023 Chunk 3 |
| `counselling_kea_2024_chunk1.parquet` | 7,105 | 0.11MB | KEA 2024 Complete |
| `counselling_kea_2023_chunk1.parquet` | 7,041 | 0.12MB | KEA 2023 Complete |
| `counselling_kea_dental_2024_chunk1.parquet` | 2,755 | 0.05MB | KEA Dental 2024 |

---

## 🚀 **USAGE INSTRUCTIONS**

### For AutoRAG Integration

#### **Option 1: DuckDB Files (Recommended for Analytics)**
```python
import duckdb

# Connect to specific data source
conn = duckdb.connect('autorag_data/counselling_data_kea_2024.duckdb')

# Query counselling data
results = conn.execute("""
    SELECT matchedCollegeName, course, COUNT(*) as allocations
    FROM counselling_data 
    GROUP BY matchedCollegeName, course
    ORDER BY allocations DESC
    LIMIT 10
""").fetchdf()

conn.close()
```

#### **Option 2: Parquet Files (Recommended for ML/AutoRAG)**
```python
import pandas as pd

# Load parquet chunk for analysis
df = pd.read_parquet('autorag_data/parquet_chunks/counselling_kea_2024_chunk1.parquet')

# Process for AutoRAG
counselling_data = df[['matchedCollegeName', 'course', 'allIndiaRank', 'matchConfidence']]
```

### Multiple File Processing
```python
import glob
import pandas as pd

# Load all KEA data from parquet files
kea_files = glob.glob('autorag_data/parquet_chunks/counselling_kea_*.parquet')
kea_data = pd.concat([pd.read_parquet(f) for f in kea_files], ignore_index=True)

print(f"Total KEA records: {len(kea_data):,}")
```

---

## 📋 **DATA SCHEMA**

Each file contains the complete counselling data schema with 19 fields:

### Core Fields
- `id`: Unique record identifier
- `allIndiaRank`: Student's All India Rank
- `quota`: Admission quota (General, Reserved, etc.)
- `collegeInstitute`: Original college name from source
- `state`: College state
- `course`: Course name
- `category`: Student category
- `round`: Counselling round
- `year`: Academic year

### Matching Metadata
- `sourceFile`: Original data file name
- `matchedCollegeId`: Matched college ID from master data
- `matchedCollegeName`: Standardized college name
- `matchConfidence`: Matching confidence score (0.0-1.0)
- `matchMethod`: Algorithm used for matching
- `matchPass`: Processing pass number
- `customMappingApplied`: Boolean flag
- `needsManualReview`: Boolean flag  
- `isUnmatched`: Boolean flag
- `dataType`: Data type classification

---

## 🔍 **AUTORAG WORKFLOW EXAMPLES**

### Example 1: College Analysis
```python
import duckdb
import pandas as pd

# Analyze top colleges across all years
files = [
    'autorag_data/counselling_data_aiq_2024_part1.duckdb',
    'autorag_data/counselling_data_kea_2024.duckdb'
]

results = []
for file in files:
    conn = duckdb.connect(file)
    data = conn.execute("""
        SELECT 
            matchedCollegeName,
            COUNT(*) as total_allocations,
            AVG(CAST(allIndiaRank AS INTEGER)) as avg_rank,
            COUNT(DISTINCT course) as courses_offered
        FROM counselling_data 
        WHERE matchedCollegeName IS NOT NULL
        GROUP BY matchedCollegeName
        ORDER BY total_allocations DESC
        LIMIT 20
    """).fetchdf()
    results.append(data)
    conn.close()

# Combine results for comprehensive analysis
top_colleges = pd.concat(results).groupby('matchedCollegeName').sum().reset_index()
```

### Example 2: Course Demand Analysis  
```python
# Load multiple parquet files for course analysis
import glob

parquet_files = glob.glob('autorag_data/parquet_chunks/counselling_*.parquet')
course_data = []

for file in parquet_files:
    df = pd.read_parquet(file)
    course_summary = df.groupby('course').agg({
        'allIndiaRank': ['count', 'mean'],
        'matchedCollegeName': 'nunique'
    }).round(2)
    course_data.append(course_summary)

# Analyze course popularity trends
course_analysis = pd.concat(course_data).groupby('course').sum()
```

### Example 3: AutoRAG Knowledge Base Creation
```python
# Create knowledge base from counselling data
def create_autorag_knowledge_base():
    knowledge_entries = []
    
    # Process each parquet chunk
    for file in glob.glob('autorag_data/parquet_chunks/*.parquet'):
        df = pd.read_parquet(file)
        
        for _, row in df.iterrows():
            entry = {
                'text': f"In {row['year']}, {row['course']} at {row['matchedCollegeName']} had admission with rank {row['allIndiaRank']} under {row['quota']} quota.",
                'metadata': {
                    'college': row['matchedCollegeName'],
                    'course': row['course'],
                    'year': row['year'],
                    'rank': row['allIndiaRank'],
                    'confidence': row['matchConfidence']
                }
            }
            knowledge_entries.append(entry)
    
    return knowledge_entries

knowledge_base = create_autorag_knowledge_base()
print(f"Created knowledge base with {len(knowledge_base):,} entries")
```

---

## 📊 **FILE SELECTION STRATEGY**

### For Different Use Cases:

#### **SQL Analytics & Complex Queries**
- Use **DuckDB files** for complex aggregations, joins, and SQL-based analysis
- Each file maintains full database capabilities with indexes
- Ideal for exploring data relationships and generating insights

#### **Machine Learning & AutoRAG**  
- Use **Parquet files** for ML workflows, feature extraction, and AutoRAG integration
- Highly compressed, fast loading, and optimized for columnar operations
- Perfect for batch processing and model training

#### **Specific Data Source Focus**
- **KEA Data**: Use complete single files (smaller datasets)
- **AIQ Data**: Use chunked files (larger datasets split for performance)

---

## ⚡ **PERFORMANCE OPTIMIZATION**

### Loading Strategy
```python
# Efficient loading for large-scale processing
def load_counselling_data_efficiently(source_type='kea'):
    if source_type == 'kea':
        # KEA data is smaller, load complete files
        files = glob.glob(f'autorag_data/counselling_data_kea_*.duckdb')
    else:
        # AIQ data is larger, load chunks as needed
        files = glob.glob(f'autorag_data/counselling_data_aiq_*_part1.duckdb')
    
    return files

# Memory-efficient processing
def process_in_chunks(files, chunk_processor):
    results = []
    for file in files:
        conn = duckdb.connect(file)
        chunk_result = chunk_processor(conn)
        results.append(chunk_result)
        conn.close()
    return results
```

---

## 🔧 **MAINTENANCE & UPDATES**

### Adding New Data
When new counselling data is imported:

1. **Process with standard-importer.py**
2. **Run autorag_data_splitter.py** to create new AutoRAG-compatible files
3. **Update metadata.json** with new file information
4. **Maintain file size compliance** (<3.8MB per file)

### File Management
- Store AutoRAG files in dedicated `autorag_data/` directory
- Use `autorag_metadata.json` for file inventory and specifications
- Regular cleanup of old versions when updated

---

## ✅ **VERIFICATION CHECKLIST**

- [x] **All files under 3.8MB**: ✅ Largest file is 2.8MB
- [x] **Data integrity maintained**: ✅ All 128,602 records preserved
- [x] **Schema consistency**: ✅ 19 fields across all files
- [x] **Query functionality**: ✅ DuckDB files support full SQL
- [x] **ML compatibility**: ✅ Parquet files optimized for ML workflows
- [x] **Documentation complete**: ✅ Usage examples and metadata included

---

## 📋 **SUMMARY**

**✅ AutoRAG Compatibility Achieved**

- **17 files created**: 8 DuckDB + 9 Parquet
- **All files <3.5MB**: Maximum file size compliance maintained
- **Complete data coverage**: All 128,602 records across 5 data sources
- **Dual format support**: SQL analytics (DuckDB) + ML workflows (Parquet)
- **Production ready**: Fully tested and documented for AutoRAG integration

**Next Steps**: Use these AutoRAG-compatible files in your machine learning and automated analysis workflows with confidence in data quality and performance optimization.