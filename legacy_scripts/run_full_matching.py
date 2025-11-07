#!/usr/bin/env python3
"""
Run the full matching process with updated mappings to see final results
"""

import json
import pandas as pd
import numpy as np
import logging
from pathlib import Path
from collections import Counter

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def load_mappings():
    """Load all mapping files"""
    mappings = {
        'aliases': {},
        'address_mappings': {},
        'skip_list': []
    }
    
    # Load college aliases
    alias_file = Path('data/college_name_aliases.json')
    if alias_file.exists():
        with open(alias_file, 'r', encoding='utf-8') as f:
            mappings['aliases'] = json.load(f)
    
    # Load address mappings
    addr_file = Path('data/custom_address_mappings.json')
    if addr_file.exists():
        with open(addr_file, 'r', encoding='utf-8') as f:
            mappings['address_mappings'] = json.load(f)
    
    # Load skip list
    skip_file = Path('data/skip_list.json')
    if skip_file.exists():
        with open(skip_file, 'r', encoding='utf-8') as f:
            mappings['skip_list'] = json.load(f)
    
    return mappings

def apply_custom_mappings(df, mappings):
    """Apply custom mappings to the dataframe"""
    
    # Apply college name aliases
    df['original_college_name'] = df['college_name'].copy()
    df['college_name'] = df['college_name'].replace(mappings['aliases'])
    
    # Count how many records were affected by aliases
    alias_changes = (df['college_name'] != df['original_college_name']).sum()
    logger.info(f"   📝 Applied {alias_changes} college name aliases")
    
    # Apply address mappings (these would need more complex logic in a real matcher)
    address_changes = 0
    for original_addr, target_keywords in mappings['address_mappings'].items():
        # Simple approach: mark records that have address mappings
        mask = df['address'].str.contains(target_keywords.split(',')[0], case=False, na=False)
        address_changes += mask.sum()
    
    logger.info(f"   🗺️  {address_changes} records potentially affected by address mappings")
    
    return df

def analyze_matching_results():
    """Analyze the current matching status with updated mappings"""
    
    logger.info("🚀 FULL MATCHING ANALYSIS WITH UPDATED MAPPINGS")
    logger.info("=" * 80)
    
    # Load mappings
    logger.info("📂 Loading mappings...")
    mappings = load_mappings()
    
    logger.info(f"   College aliases: {len(mappings['aliases'])}")
    logger.info(f"   Address mappings: {len(mappings['address_mappings'])}")
    logger.info(f"   Skip list entries: {len(mappings['skip_list'])}")
    
    # Load counselling data
    logger.info("📊 Loading counselling data...")
    try:
        df = pd.read_csv('data/NEET_UG_2024_Counselling_Data.csv')
        logger.info(f"   Loaded {len(df)} total records")
    except Exception as e:
        logger.error(f"❌ Failed to load counselling data: {e}")
        return
    
    # Apply custom mappings
    logger.info("🔄 Applying custom mappings...")
    df = apply_custom_mappings(df, mappings)
    
    # Analyze current status
    logger.info("📈 ANALYSIS RESULTS")
    logger.info("-" * 50)
    
    # Count unique college-state combinations
    unique_combinations = df[['state_name', 'college_name']].drop_duplicates()
    logger.info(f"   Unique college-state combinations: {len(unique_combinations)}")
    
    # Show most common colleges
    college_counts = df['college_name'].value_counts()
    logger.info(f"   Most common colleges:")
    for college, count in college_counts.head(10).items():
        logger.info(f"      {college}: {count} records")
    
    # Show state distribution
    state_counts = df['state_name'].value_counts()
    logger.info(f"   State distribution (top 10):")
    for state, count in state_counts.head(10).items():
        logger.info(f"      {state}: {count} records")
    
    # Check for potential unmatched patterns
    logger.info("🔍 POTENTIAL REMAINING ISSUES")
    logger.info("-" * 50)
    
    # Look for colleges that might still need attention
    problem_patterns = []
    
    for college in college_counts.index[:50]:  # Check top 50 colleges
        if any(keyword in college.upper() for keyword in ['EMAIL', '@', 'HTTP', 'WWW']):
            problem_patterns.append(f"Email/URL in name: {college}")
        elif len(college) > 100:
            problem_patterns.append(f"Very long name: {college[:50]}...")
        elif college.upper() in ['N/A', 'NOT AVAILABLE', 'UNKNOWN']:
            problem_patterns.append(f"Missing data: {college}")
    
    if problem_patterns:
        logger.info("   ⚠️  Potential issues found:")
        for issue in problem_patterns[:10]:  # Show first 10
            logger.info(f"      {issue}")
    else:
        logger.info("   ✅ No obvious issues found in top colleges")
    
    # Final summary
    logger.info("")
    logger.info("📋 FINAL SUMMARY")
    logger.info("-" * 50)
    total_records = len(df)
    records_with_aliases = len(df[df['college_name'] != df['original_college_name']])
    
    logger.info(f"   Total records processed:     {total_records:,}")
    logger.info(f"   Records with applied aliases: {records_with_aliases:,}")
    logger.info(f"   Unique colleges after mapping: {df['college_name'].nunique():,}")
    logger.info(f"   Unique states:               {df['state_name'].nunique()}")
    
    success_rate = (records_with_aliases / total_records) * 100
    logger.info(f"   Mapping application rate:    {success_rate:.2f}%")

if __name__ == "__main__":
    analyze_matching_results()