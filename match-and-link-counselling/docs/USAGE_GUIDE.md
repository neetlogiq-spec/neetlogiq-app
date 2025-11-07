# Usage Guide - Counselling Data Matching System

## 📖 Table of Contents
1. [Getting Started](#getting-started)
2. [Basic Workflow](#basic-workflow)
3. [Advanced Usage](#advanced-usage)
4. [Interactive Review](#interactive-review)
5. [Alias Management](#alias-management)
6. [Batch Processing](#batch-processing)
7. [Troubleshooting](#troubleshooting)

## 🚀 Getting Started

### Installation

```bash
# Clone or navigate to project directory
cd match-and-link-counselling

# Install dependencies
pip install -r requirements.txt

# Verify installation
python match_and_link_counselling_data.py --help
```

### Directory Setup

```bash
# Create required directories
mkdir -p data/sqlite logs config

# Ensure master database exists
ls data/sqlite/master_data.db

# Ensure counselling database exists
ls data/sqlite/counselling_data_partitioned.db
```

### Configuration

1. Copy example config:
```bash
cp config/config.yaml.example config/config.yaml
```

2. Edit `config.yaml` with your settings
3. Verify configuration:
```bash
python -c "import yaml; print(yaml.safe_load(open('config/config.yaml')))"
```

## 🔄 Basic Workflow

### Step 1: Import Counselling Data

First, import your Excel files into the partitioned database:

```bash
python import_counselling_data.py \
    --excel-file data/raw/AIQ-2024.xlsx \
    --partition AIQ-2024
```

### Step 2: Run Matching

```python
#!/usr/bin/env python3
from match_and_link_counselling_data import CounsellingDataMatcher

# Initialize
matcher = CounsellingDataMatcher(config_path='config/config.yaml')

# Load master data
matcher.load_master_data()

# Process specific partition
matcher.process_partition('AIQ-2024')

# Generate report
report = matcher.generate_match_report('AIQ-2024')
print(report)
```

### Step 3: Review and Improve

```python
# Interactive review of unmatched records
matcher.interactive_review(partition='AIQ-2024', limit=50)

# Re-run matching after creating aliases
matcher.process_partition('AIQ-2024')

# Check improved match rate
matcher.generate_match_report('AIQ-2024')
```

### Step 4: Export Results

```python
# Export to CSV
matcher.export_matched_data('AIQ-2024', 'output/aiq2024_matched.csv')

# Export unmatched for review
matcher.export_unmatched('AIQ-2024', 'output/aiq2024_unmatched.csv')

# Export full report
matcher.export_report('AIQ-2024', 'output/aiq2024_report.md')
```

## 🎓 Advanced Usage

### Parallel Processing

```python
# Enable parallel processing with custom worker count
matcher = CounsellingDataMatcher(
    config_path='config/config.yaml',
    enable_parallel=True,
    num_workers=8  # Use 8 CPU cores
)

# Process large partition
matcher.process_partition('ALL-INDIA-2024')
```

### Batch Processing Multiple Partitions

```python
partitions = [
    'AIQ-2023',
    'AIQ-2024',
    'KEA-2023',
    'KEA-2024',
    'KEA-DENTAL-2024'
]

for partition in partitions:
    print(f"\n{'='*50}")
    print(f"Processing: {partition}")
    print('='*50)

    matcher.process_partition(partition)
    report = matcher.generate_match_report(partition)
    print(report)
```

### Custom Match Thresholds

```python
# Lower thresholds for more matches (less confident)
matcher.config['matching']['thresholds'] = {
    'exact': 100,
    'high_confidence': 85,  # Was 90
    'medium_confidence': 75,  # Was 80
    'low_confidence': 65      # Was 75
}

# Re-run matching
matcher.process_partition('AIQ-2024')
```

### State Mapping Management

```python
from scripts.create_state_mapping import (
    create_state_mapping_table,
    add_counselling_state_mappings,
    print_unmapped_states
)

# Create initial state mapping table
create_state_mapping_table('data/sqlite/master_data.db')

# Add states from Excel
add_counselling_state_mappings(
    excel_path='data/raw/AIQ-2024.xlsx',
    db_path='data/sqlite/master_data.db'
)

# Check for unmapped states
print_unmapped_states('data/sqlite/master_data.db')
```

## 🎨 Interactive Review

### Starting Interactive Review

```bash
# From command line
python match_and_link_counselling_data.py \
    --partition AIQ-2024 \
    --review \
    --limit 50
```

Or programmatically:

```python
matcher.interactive_review(partition='AIQ-2024', limit=50)
```

### Understanding the Interface

When you start interactive review, you'll see:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 RECORD 1/50 - Unmatched College & Course
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Why This Failed:
   College: Best match score was 68.5% (threshold: 75%)
   Course: No similar course found in master data

📍 Partition:        AIQ-2024
🏥 College (Raw):    JAYA JAGADGURU MURUGHARAJENDRA MEDICAL COLLEGE
🏥 College (Norm):   JAYA JAGADGURU MURUGHARAJENDRA MEDICAL COLLEGE
📚 Course (Raw):     MD IN GENERAL MEDICINE
📚 Course (Norm):    MD IN GENERAL MEDICINE
🗺️  State:           KARNATAKA → KARNATAKA
📊 Affects:          459 records

🎯 Top 5 College Suggestions:
  [1] 95% JAYA JAGADGURU (MED0234 | KARNATAKA | MEDICAL)
  [2] 88% JAGADGURU MEDICAL (MED0567 | KARNATAKA | MEDICAL)
  [3] 82% MURUGHA MEDICAL (MED0891 | KARNATAKA | MEDICAL)

🎯 Top 5 Course Suggestions:
  [4] 98% MD IN GENERAL MEDICINE (CRS0045)
  [5] 92% MD GENERAL MEDICINE (CRS0046)

Actions:
  [1-5] Select suggestion to create alias
  [6] Browse all colleges/courses
  [7] Skip this record
  [8] Skip all remaining
  [9] Mark for manual review
  [10] Export unmatched to CSV

Choose action:
```

### Action Explanations

**[1-5] Select Suggestion**
- Directly selects from top 5 suggestions
- Creates alias automatically
- Moves to next record

**[6] Browse All**
- Shows top 20 from all colleges/courses
- Allows manual ID entry
- More options for edge cases

**[7] Skip This Record**
- Moves to next without changes
- Can come back later

**[8] Skip All Remaining**
- Exits review session
- Saves progress

**[9] Mark for Manual Review**
- Flags record in database
- Can filter these later

**[10] Export Unmatched**
- Exports all unmatched to CSV
- For offline review

### Tips for Efficient Review

1. **Start with High-Impact Records**
   - Records are ordered by count (most affected first)
   - Fix high-impact issues first for maximum improvement

2. **Use Quick Match for Obvious Cases**
   - If you see 90%+ match in top 5, use it
   - Saves time vs browsing all

3. **Create Aliases Strategically**
   - Common abbreviations
   - Typo variants
   - Alternative names

4. **Session Management**
   - Review in 30-minute sessions
   - Process 20-30 records per session
   - Re-run matching after each session

5. **Monitor Progress**
   - Check match rate improvement
   - Export unmatched periodically
   - Review validation errors

## 📝 Alias Management

### Creating College Aliases

```python
# Programmatically add alias
matcher.create_college_alias(
    alias_name='AIIMS DELHI',
    original_name='ALL INDIA INSTITUTE OF MEDICAL SCIENCES NEW DELHI',
    college_id='MED0001'
)

# Batch create from CSV
matcher.import_college_aliases('aliases/college_aliases.csv')
```

CSV format:
```csv
alias_name,original_name,college_id
AIIMS DELHI,ALL INDIA INSTITUTE OF MEDICAL SCIENCES NEW DELHI,MED0001
CMC VELLORE,CHRISTIAN MEDICAL COLLEGE VELLORE,MED0123
```

### Creating Course Aliases

```python
# Single alias
matcher.create_course_alias(
    alias_name='MD MEDICINE',
    original_name='MD IN GENERAL MEDICINE',
    course_id='CRS0045'
)

# Batch import
matcher.import_course_aliases('aliases/course_aliases.csv')
```

### Viewing Aliases

```python
# List all college aliases
college_aliases = matcher.get_college_aliases()
for alias in college_aliases:
    print(f"{alias['alias_name']} → {alias['original_name']}")

# List all course aliases
course_aliases = matcher.get_course_aliases()
for alias in course_aliases:
    print(f"{alias['alias_name']} → {alias['original_name']}")
```

### Exporting Aliases

```python
# Export to CSV for backup
matcher.export_aliases('backup/aliases_backup.csv')

# Export to JSON
matcher.export_aliases_json('backup/aliases_backup.json')
```

## 🔄 Batch Processing

### Processing All Partitions

```python
#!/usr/bin/env python3
from match_and_link_counselling_data import CounsellingDataMatcher

matcher = CounsellingDataMatcher(enable_parallel=True)
matcher.load_master_data()

# Get all partitions
partitions = matcher.get_all_partitions()

# Process each
summary = {
    'total': len(partitions),
    'processed': 0,
    'failed': 0,
    'results': {}
}

for partition in partitions:
    try:
        print(f"\nProcessing {partition}...")
        matcher.process_partition(partition)
        report = matcher.generate_match_report(partition)

        summary['processed'] += 1
        summary['results'][partition] = report

    except Exception as e:
        print(f"Error processing {partition}: {e}")
        summary['failed'] += 1

# Print summary
print("\n" + "="*60)
print("BATCH PROCESSING SUMMARY")
print("="*60)
print(f"Total Partitions: {summary['total']}")
print(f"Successfully Processed: {summary['processed']}")
print(f"Failed: {summary['failed']}")

# Export consolidated report
matcher.export_consolidated_report(summary, 'output/batch_report.md')
```

### Scheduled Processing

```bash
# Using cron
# Run daily at 2 AM
0 2 * * * cd /path/to/project && python batch_process.py >> logs/cron.log 2>&1
```

Or use a scheduler script:

```python
import schedule
import time

def run_matching():
    matcher = CounsellingDataMatcher()
    matcher.load_master_data()
    matcher.process_all_partitions()
    matcher.generate_consolidated_report()

# Schedule daily at 2 AM
schedule.every().day.at("02:00").do(run_matching)

while True:
    schedule.run_pending()
    time.sleep(60)
```

## 🔧 Troubleshooting

### Issue: Low Match Rates

**Symptoms**: Match rate below 80%

**Solutions**:
1. Check master data completeness
2. Verify state mappings
3. Run interactive review
4. Create aliases for common variations
5. Lower confidence thresholds temporarily

```python
# Debug: Show unmatched records
unmatched = matcher.get_unmatched_records('AIQ-2024', limit=100)
for record in unmatched:
    print(f"College: {record['college_institute_raw']}")
    print(f"State: {record['state_raw']}")
    print(f"Course: {record['course_raw']}")
    print("---")
```

### Issue: Slow Processing

**Symptoms**: Takes > 1 hour for medium partition

**Solutions**:
1. Enable parallel processing
2. Check database indexes
3. Clear old cache files
4. Optimize configuration

```python
# Check indexes
matcher.verify_database_indexes()

# Clear caches
matcher.clear_all_caches()

# Optimize configuration
matcher.config['matching']['use_cache'] = True
matcher.config['matching']['cache_size'] = 10000
```

### Issue: Memory Errors

**Symptoms**: Out of memory errors during processing

**Solutions**:
1. Reduce worker count
2. Process smaller batches
3. Clear caches more frequently
4. Increase swap space

```python
# Process in smaller chunks
chunk_size = 5000
total_records = matcher.count_records('AIQ-2024')

for offset in range(0, total_records, chunk_size):
    matcher.process_partition_chunk('AIQ-2024', offset, chunk_size)
    matcher.clear_caches()  # Clear after each chunk
```

### Issue: Database Lock Errors

**Symptoms**: "Database is locked" errors

**Solutions**:
1. Close other connections
2. Use WAL mode
3. Add retry logic
4. Increase timeout

```python
# Enable WAL mode
matcher.enable_wal_mode()

# Add retry logic
import time
max_retries = 3
for attempt in range(max_retries):
    try:
        matcher.process_partition('AIQ-2024')
        break
    except sqlite3.OperationalError as e:
        if 'locked' in str(e) and attempt < max_retries - 1:
            time.sleep(1)
            continue
        raise
```

### Issue: Validation Errors

**Symptoms**: Many validation errors in report

**Solutions**:
1. Check source data quality
2. Review validation rules
3. Update master data
4. Fix data issues at source

```python
# Get validation errors
errors = matcher.get_validation_errors('AIQ-2024')

# Group by type
from collections import Counter
error_types = Counter(e['error_type'] for e in errors)
print("Validation Errors:")
for error_type, count in error_types.most_common():
    print(f"  {error_type}: {count}")

# Export for review
matcher.export_validation_errors('AIQ-2024', 'output/validation_errors.csv')
```

## 📊 Monitoring & Reports

### Match Rate Monitoring

```python
# Get current match rates
rates = matcher.get_match_rates('AIQ-2024')
print(f"College Match Rate: {rates['college']:.1f}%")
print(f"Course Match Rate: {rates['course']:.1f}%")
print(f"Overall Match Rate: {rates['overall']:.1f}%")

# Track over time
history = matcher.get_match_rate_history('AIQ-2024')
for entry in history:
    print(f"{entry['timestamp']}: {entry['match_rate']:.1f}%")
```

### Detailed Reports

```python
# Generate comprehensive report
report = matcher.generate_detailed_report('AIQ-2024')
print(report)

# Export to markdown
matcher.export_detailed_report('AIQ-2024', 'reports/aiq2024_detailed.md')

# Export to JSON for analysis
matcher.export_report_json('AIQ-2024', 'reports/aiq2024.json')
```

### Custom Queries

```python
# Get statistics
stats = matcher.get_partition_statistics('AIQ-2024')
print(f"Total Records: {stats['total']:,}")
print(f"Matched: {stats['matched']:,}")
print(f"Unmatched Colleges: {stats['unmatched_colleges']:,}")
print(f"Unmatched Courses: {stats['unmatched_courses']:,}")

# Get top unmatched colleges
top_unmatched = matcher.get_top_unmatched_colleges('AIQ-2024', limit=20)
for college, count in top_unmatched:
    print(f"{college}: {count} records")
```

---

**Need More Help?**

- See [README.md](README.md) for overview
- See [ALGORITHM_DETAILS.md](ALGORITHM_DETAILS.md) for technical details
- See [API_REFERENCE.md](API_REFERENCE.md) for API docs
- Check logs in `logs/counselling_matching.log`
