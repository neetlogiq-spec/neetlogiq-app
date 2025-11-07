#!/usr/bin/env python3
"""
Extract Unmatched Records from Enhanced College Matcher
Creates a comprehensive markdown report of all unmatched records for manual review
"""

import sys
sys.path.append('/Users/kashyapanand/Public/New')

from enhanced_college_course_matcher import EnhancedCollegeCourseHierarchicalMatcher, SeatRecord
import pandas as pd
from collections import defaultdict
import os

def extract_unmatched_records():
    """Extract all unmatched records and create markdown report"""
    
    db_path = '/Users/kashyapanand/Public/New/data/multi_category_colleges.db'
    matcher = EnhancedCollegeCourseHierarchicalMatcher(db_path)
    
    # Define seat data files
    seat_files = [
        ('/Users/kashyapanand/Desktop/EXPORT/seat data/dental.xlsx', 'DENTAL'),
        ('/Users/kashyapanand/Desktop/EXPORT/seat data/medical.xlsx', 'MEDICAL'),
        ('/Users/kashyapanand/Desktop/EXPORT/seat data/DNB UPDATED.xlsx', 'DNB')
    ]
    
    all_unmatched = []
    category_stats = {}
    
    print("🔍 Extracting unmatched records from all categories...")
    
    for file_path, category in seat_files:
        print(f"\n📊 Processing {category}...")
        
        # Read data
        df = pd.read_excel(file_path, sheet_name='Sheet1', header=0)
        
        unmatched_records = []
        issue_counts = defaultdict(int)
        
        for i, row in df.iterrows():
            seat_record = SeatRecord(
                state=str(row['STATE']).strip(),
                college=str(row['COLLEGE/INSTITUTE']).strip(),
                address=str(row['ADDRESS']).strip(),
                university=str(row['UNIVERSITY_AFFILIATION']).strip(),
                management=str(row['MANAGEMENT']).strip(),
                course=str(row['COURSE']).strip(),
                seats=int(row['SEATS']) if pd.notna(row['SEATS']) else 0
            )
            
            match_result = matcher.match_college_hierarchical(seat_record)
            
            if not match_result.college_id:
                # This is an unmatched record
                issue_type = match_result.issues[0] if match_result.issues else 'Unknown issue'
                issue_counts[issue_type] += 1
                
                unmatched_records.append({
                    'category': category,
                    'row_index': i,
                    'state': seat_record.state,
                    'college': seat_record.college,
                    'address': seat_record.address,
                    'university': seat_record.university,
                    'management': seat_record.management,
                    'course': seat_record.course,
                    'seats': seat_record.seats,
                    'issue_type': issue_type,
                    'method': match_result.method,
                    'all_issues': ', '.join(match_result.issues)
                })
        
        print(f"   Found {len(unmatched_records)} unmatched records")
        all_unmatched.extend(unmatched_records)
        
        category_stats[category] = {
            'total_records': len(df),
            'unmatched_count': len(unmatched_records),
            'unmatched_rate': len(unmatched_records) / len(df),
            'issue_breakdown': dict(issue_counts)
        }
    
    return all_unmatched, category_stats

def create_markdown_report(unmatched_records, category_stats):
    """Create comprehensive markdown report"""
    
    # Group records by issue type and category
    issues_by_type = defaultdict(list)
    issues_by_category = defaultdict(list)
    
    for record in unmatched_records:
        issues_by_type[record['issue_type']].append(record)
        issues_by_category[record['category']].append(record)
    
    # Create markdown content
    md_content = []
    
    # Header
    md_content.append("# Unmatched Records Report")
    md_content.append("## Enhanced Hierarchical College-Course Matcher")
    md_content.append(f"**Total Unmatched Records:** {len(unmatched_records)}")
    md_content.append("")
    
    # Summary statistics
    md_content.append("## Summary Statistics")
    md_content.append("")
    
    total_records = sum(stats['total_records'] for stats in category_stats.values())
    total_unmatched = len(unmatched_records)
    overall_rate = total_unmatched / total_records
    
    md_content.append(f"| Category | Total Records | Unmatched | Rate |")
    md_content.append(f"|----------|---------------|-----------|------|")
    
    for category, stats in category_stats.items():
        md_content.append(f"| {category} | {stats['total_records']:,} | {stats['unmatched_count']} | {stats['unmatched_rate']:.1%} |")
    
    md_content.append(f"| **TOTAL** | **{total_records:,}** | **{total_unmatched}** | **{overall_rate:.1%}** |")
    md_content.append("")
    
    # Issue type breakdown
    md_content.append("## Issue Type Breakdown")
    md_content.append("")
    
    issue_type_counts = defaultdict(int)
    for record in unmatched_records:
        issue_type_counts[record['issue_type']] += 1
    
    md_content.append("| Issue Type | Count | Percentage |")
    md_content.append("|------------|-------|------------|")
    
    for issue_type, count in sorted(issue_type_counts.items(), key=lambda x: x[1], reverse=True):
        percentage = count / total_unmatched
        md_content.append(f"| {issue_type} | {count} | {percentage:.1%} |")
    
    md_content.append("")
    
    # Detailed records by category
    for category in ['DENTAL', 'MEDICAL', 'DNB']:
        if category not in issues_by_category:
            continue
            
        records = issues_by_category[category]
        md_content.append(f"## {category} Category - {len(records)} Unmatched Records")
        md_content.append("")
        
        # Group by issue type within category
        category_issues = defaultdict(list)
        for record in records:
            category_issues[record['issue_type']].append(record)
        
        for issue_type, issue_records in category_issues.items():
            md_content.append(f"### {issue_type} ({len(issue_records)} records)")
            md_content.append("")
            
            md_content.append("| # | State | College | Address | University | Management | Course | Seats |")
            md_content.append("|---|-------|---------|---------|------------|------------|---------|--------|")
            
            for i, record in enumerate(issue_records[:50], 1):  # Limit to 50 per issue type
                college = record['college'][:60] + '...' if len(record['college']) > 60 else record['college']
                address = record['address'][:40] + '...' if len(record['address']) > 40 else record['address']
                university = record['university'][:30] + '...' if len(record['university']) > 30 else record['university']
                
                md_content.append(f"| {i} | {record['state']} | {college} | {address} | {university} | {record['management']} | {record['course'][:30]}... | {record['seats']} |")
            
            if len(issue_records) > 50:
                md_content.append(f"| ... | *{len(issue_records) - 50} more records* | | | | | | |")
            
            md_content.append("")
    
    # Unique colleges by state for pattern analysis
    md_content.append("## Unique Unmatched Colleges by State")
    md_content.append("*For pattern analysis and master data gaps*")
    md_content.append("")
    
    unique_colleges = {}
    for record in unmatched_records:
        state = record['state']
        college = record['college']
        
        if state not in unique_colleges:
            unique_colleges[state] = set()
        unique_colleges[state].add(college)
    
    for state in sorted(unique_colleges.keys()):
        colleges = sorted(unique_colleges[state])
        md_content.append(f"### {state} ({len(colleges)} unique colleges)")
        md_content.append("")
        
        for i, college in enumerate(colleges, 1):
            md_content.append(f"{i}. {college}")
        
        md_content.append("")
    
    return "\n".join(md_content)

def main():
    """Main execution"""
    print("🚀 UNMATCHED RECORDS EXTRACTION")
    print("=" * 60)
    
    # Extract unmatched records
    unmatched_records, category_stats = extract_unmatched_records()
    
    # Create markdown report
    print(f"\n📝 Creating markdown report...")
    markdown_content = create_markdown_report(unmatched_records, category_stats)
    
    # Save to file
    output_file = '/Users/kashyapanand/Public/New/unmatched_records_report.md'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(markdown_content)
    
    print(f"✅ Report saved to: {output_file}")
    print(f"📊 Total unmatched records: {len(unmatched_records)}")
    
    # Show summary
    print(f"\n📋 Quick Summary:")
    for category, stats in category_stats.items():
        print(f"   {category}: {stats['unmatched_count']} unmatched ({stats['unmatched_rate']:.1%})")

if __name__ == "__main__":
    main()