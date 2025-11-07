#!/usr/bin/env python3
"""
Master Data → Counselling Data Matcher
Creates proper relationships between master data (colleges) and counselling data
Uses fuzzy matching to link counselling records to standardized college names

Usage:
    python3 master-data-counselling-matcher.py --master-data data/parquet/colleges.parquet --counselling-data data/parquet/2024/cutoffs_aiq_2024.parquet
    python3 master-data-counselling-matcher.py --help
"""

import pandas as pd
import json
import logging
import argparse
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import re
from collections import Counter
from difflib import SequenceMatcher

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MasterDataCounsellingMatcher:
    def __init__(self):
        self.master_colleges = {}
        self.college_aliases = {}
        self.stats = {
            'total_counselling_records': 0,
            'matched_records': 0,
            'unmatched_records': 0,
            'high_confidence_matches': 0,
            'medium_confidence_matches': 0,
            'low_confidence_matches': 0,
            'exact_matches': 0,
            'fuzzy_matches': 0
        }
        
    def load_master_data(self, master_data_path: str) -> Dict:
        """Load master college data from parquet file"""
        logger.info(f"📖 Loading master college data from: {master_data_path}")
        
        try:
            # Read parquet file
            df = pd.read_parquet(master_data_path)
            logger.info(f"📊 Loaded {len(df)} master college records")
            
            # Create master colleges dictionary
            for idx, row in df.iterrows():
                college_id = row.get('id', f'college_{idx}')
                college_name = str(row.get('name', '')).strip()
                state = str(row.get('state', '')).strip()
                city = str(row.get('city', '')).strip()
                
                if college_name:
                    # Store in master colleges dict
                    self.master_colleges[college_id] = {
                        'id': college_id,
                        'name': college_name,
                        'state': state,
                        'city': city,
                        'normalized_name': self.normalize_text(college_name),
                        'aliases': self.generate_aliases(college_name)
                    }
            
            logger.info(f"✅ Master data loaded: {len(self.master_colleges)} colleges")
            return self.master_colleges
            
        except Exception as e:
            logger.error(f"❌ Error loading master data: {e}")
            raise
    
    def normalize_text(self, text: str) -> str:
        """Normalize text for matching"""
        if not text or pd.isna(text):
            return ""
        
        # Convert to string and uppercase
        normalized = str(text).upper().strip()
        
        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Common normalizations
        normalizations = {
            'GOVT': 'GOVERNMENT',
            'GOVT.': 'GOVERNMENT',
            'GMC': 'GOVERNMENT MEDICAL COLLEGE',
            'GMCH': 'GOVERNMENT MEDICAL COLLEGE AND HOSPITAL',
            'INST': 'INSTITUTE',
            'INSTITUE': 'INSTITUTE',
            'INSITUTE': 'INSTITUTE',
            'COLLAGE': 'COLLEGE',
            'COLEGE': 'COLLEGE',
            'HOSP': 'HOSPITAL',
            'HOSPITOL': 'HOSPITAL',
            'MED': 'MEDICAL',
            'MEDICLE': 'MEDICAL',
            'UNIV': 'UNIVERSITY',
            'UNIVERCITY': 'UNIVERSITY',
            'CENTRE': 'CENTER',
            '&': 'AND',
            'CO.': 'COMPANY',
            'LTD': 'LIMITED',
            'PVT': 'PRIVATE',
            'PVT.': 'PRIVATE',
        }
        
        for abbr, full in normalizations.items():
            pattern = r'\b' + re.escape(abbr) + r'\b'
            normalized = re.sub(pattern, full, normalized)
            
        return normalized
    
    def generate_aliases(self, college_name: str) -> List[str]:
        """Generate possible aliases for a college name"""
        aliases = []
        normalized = self.normalize_text(college_name)
        
        # Add the normalized name itself
        aliases.append(normalized)
        
        # Remove common suffixes and create variations
        suffixes_to_remove = [
            'MEDICAL COLLEGE',
            'MEDICAL COLLEGE AND HOSPITAL',
            'INSTITUTE OF MEDICAL SCIENCES',
            'INSTITUTE OF HIGHER MEDICAL SCIENCES',
            'GENERAL HOSPITAL',
            'MEMORIAL HOSPITAL',
            'UNIVERSITY',
            'COLLEGE',
            'INSTITUTE',
            'HOSPITAL'
        ]
        
        for suffix in suffixes_to_remove:
            if normalized.endswith(suffix):
                # Create alias without suffix
                alias = normalized[:-len(suffix)].strip()
                if alias:
                    aliases.append(alias)
                break
        
        # Create acronym variations
        words = normalized.split()
        if len(words) > 2:
            # First letter of each word
            acronym = ''.join([word[0] for word in words if word])
            aliases.append(acronym)
            
            # First two letters of first word + rest
            if len(words) > 1:
                partial_acronym = words[0][:2] + ''.join([word[0] for word in words[1:] if word])
                aliases.append(partial_acronym)
        
        return list(set(aliases))  # Remove duplicates
    
    def extract_college_name_from_counselling(self, college_institute: str) -> Tuple[str, str]:
        """Extract clean college name from counselling data"""
        if not college_institute or pd.isna(college_institute):
            return "", ""
        
        # Split by comma to separate college name from address
        parts = str(college_institute).split(',')
        college_name = parts[0].strip()
        address = ','.join(parts[1:]).strip() if len(parts) > 1 else ""
        
        # Clean up college name - remove common suffixes in parentheses
        college_name = re.sub(r'\s*\([^)]*\)\s*$', '', college_name)
        college_name = re.sub(r'\s*,\s*$', '', college_name)
        
        return college_name, address
    
    def calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts"""
        if not text1 or not text2:
            return 0.0
        
        # Use SequenceMatcher for fuzzy matching
        return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()
    
    def find_best_college_match(self, counselling_college_name: str, counselling_state: str = "") -> Tuple[Optional[str], float, str]:
        """
        Find the best matching college in master data
        Returns: (college_id, confidence, method)
        """
        if not counselling_college_name:
            return None, 0.0, "empty_name"
        
        # Normalize the counselling college name
        normalized_counselling = self.normalize_text(counselling_college_name)
        
        best_match = None
        best_confidence = 0.0
        best_method = "no_match"
        
        # First pass: Exact matches
        for college_id, college_data in self.master_colleges.items():
            if college_data['normalized_name'] == normalized_counselling:
                self.stats['exact_matches'] += 1
                return college_id, 1.0, "exact_match"
        
        # Second pass: Check aliases
        for college_id, college_data in self.master_colleges.items():
            for alias in college_data['aliases']:
                if alias == normalized_counselling:
                    self.stats['exact_matches'] += 1
                    return college_id, 0.95, "alias_match"
        
        # Third pass: Fuzzy matching
        for college_id, college_data in self.master_colleges.items():
            # Check main name
            similarity = self.calculate_similarity(normalized_counselling, college_data['normalized_name'])
            if similarity > best_confidence:
                best_match = college_id
                best_confidence = similarity
                best_method = "fuzzy_main"
            
            # Check aliases
            for alias in college_data['aliases']:
                similarity = self.calculate_similarity(normalized_counselling, alias)
                if similarity > best_confidence:
                    best_match = college_id
                    best_confidence = similarity
                    best_method = "fuzzy_alias"
        
        # Fourth pass: State-based filtering for better accuracy
        if counselling_state and best_match and best_confidence > 0.6:
            matched_college = self.master_colleges[best_match]
            if matched_college['state'].upper() != counselling_state.upper():
                # Reduce confidence if states don't match
                best_confidence *= 0.8
                best_method += "_state_mismatch"
        
        # Update stats based on confidence
        if best_confidence >= 0.9:
            self.stats['high_confidence_matches'] += 1
        elif best_confidence >= 0.7:
            self.stats['medium_confidence_matches'] += 1
        else:
            self.stats['low_confidence_matches'] += 1
        
        if best_confidence >= 0.7:
            self.stats['fuzzy_matches'] += 1
        
        return best_match, best_confidence, best_method
    
    def process_counselling_data(self, counselling_data_path: str) -> List[Dict]:
        """Process counselling data and match with master colleges"""
        logger.info(f"📖 Processing counselling data from: {counselling_data_path}")
        
        try:
            # Read parquet file
            df = pd.read_parquet(counselling_data_path)
            logger.info(f"📊 Loaded {len(df)} counselling records")
            
            processed_records = []
            self.stats['total_counselling_records'] = len(df)
            
            for idx, row in df.iterrows():
                try:
                    # Extract counselling data
                    college_institute = str(row.get('collegeInstitute', '')).strip()
                    state = str(row.get('state', '')).strip()
                    course = str(row.get('course', '')).strip()
                    all_india_rank = row.get('allIndiaRank', 0)
                    quota = str(row.get('quota', '')).strip()
                    category = str(row.get('category', '')).strip()
                    round_info = str(row.get('round', '')).strip()
                    year = row.get('year', 2024)
                    
                    # Extract clean college name
                    college_name, address = self.extract_college_name_from_counselling(college_institute)
                    
                    # Find best match in master data
                    matched_college_id, confidence, method = self.find_best_college_match(college_name, state)
                    
                    # Get matched college data
                    matched_college = None
                    if matched_college_id:
                        matched_college = self.master_colleges[matched_college_id]
                        self.stats['matched_records'] += 1
                    else:
                        self.stats['unmatched_records'] += 1
                    
                    # Create processed record
                    record = {
                        'id': f'counselling_{idx + 1}_{int(datetime.now().timestamp())}',
                        'original_data': {
                            'collegeInstitute': college_institute,
                            'state': state,
                            'course': course,
                            'allIndiaRank': int(all_india_rank) if all_india_rank else 0,
                            'quota': quota,
                            'category': category,
                            'round': round_info,
                            'year': int(year) if year else 2024
                        },
                        'matched_data': {
                            'collegeId': matched_college_id,
                            'collegeName': matched_college['name'] if matched_college else None,
                            'collegeState': matched_college['state'] if matched_college else None,
                            'collegeCity': matched_college['city'] if matched_college else None,
                            'matchConfidence': confidence,
                            'matchMethod': method,
                            'isMatched': matched_college_id is not None
                        },
                        'extracted_data': {
                            'collegeName': college_name,
                            'address': address,
                            'normalizedName': self.normalize_text(college_name)
                        }
                    }
                    
                    processed_records.append(record)
                    
                    if (idx + 1) % 1000 == 0:
                        logger.info(f"📊 Processed {idx + 1:,} records...")
                        
                except Exception as e:
                    logger.warning(f"Error processing row {idx}: {e}")
                    continue
            
            logger.info(f"✅ Processed {len(processed_records):,} counselling records")
            return processed_records
            
        except Exception as e:
            logger.error(f"❌ Error processing counselling data: {e}")
            raise
    
    def save_processed_data(self, records: List[Dict], output_path: str):
        """Save processed data with master data relationships"""
        logger.info(f"💾 Saving processed data to: {output_path}")
        
        try:
            # Create output directory if it doesn't exist
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            
            # Save as JSON
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(records, f, indent=2, ensure_ascii=False)
            
            logger.info(f"✅ Data saved successfully to {output_path}")
            
            # Also save CSV for easy review
            csv_path = output_path.replace('.json', '.csv')
            df = pd.DataFrame(records)
            df.to_csv(csv_path, index=False)
            logger.info(f"✅ CSV version saved to {csv_path}")
            
            return output_path, csv_path
            
        except Exception as e:
            logger.error(f"❌ Error saving data: {e}")
            raise
    
    def generate_matching_report(self, records: List[Dict], output_path: str):
        """Generate detailed matching report"""
        match_rate = (self.stats['matched_records'] / self.stats['total_counselling_records'] * 100) if self.stats['total_counselling_records'] > 0 else 0
        
        # Analyze confidence distribution
        confidence_distribution = {
            'high_confidence': 0,
            'medium_confidence': 0,
            'low_confidence': 0,
            'unmatched': 0
        }
        
        for record in records:
            confidence = record['matched_data']['matchConfidence']
            if record['matched_data']['isMatched']:
                if confidence >= 0.9:
                    confidence_distribution['high_confidence'] += 1
                elif confidence >= 0.7:
                    confidence_distribution['medium_confidence'] += 1
                else:
                    confidence_distribution['low_confidence'] += 1
            else:
                confidence_distribution['unmatched'] += 1
        
        # Find unmatched colleges for manual review
        unmatched_colleges = []
        for record in records:
            if not record['matched_data']['isMatched']:
                college_name = record['extracted_data']['collegeName']
                if college_name not in [uc['collegeName'] for uc in unmatched_colleges]:
                    unmatched_colleges.append({
                        'collegeName': college_name,
                        'normalizedName': record['extracted_data']['normalizedName'],
                        'state': record['original_data']['state'],
                        'count': 1
                    })
                else:
                    # Increment count
                    for uc in unmatched_colleges:
                        if uc['collegeName'] == college_name:
                            uc['count'] += 1
                            break
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'totalCounsellingRecords': self.stats['total_counselling_records'],
                'matchedRecords': self.stats['matched_records'],
                'unmatchedRecords': self.stats['unmatched_records'],
                'matchRate': round(match_rate, 2)
            },
            'confidenceDistribution': confidence_distribution,
            'matchingStats': {
                'exactMatches': self.stats['exact_matches'],
                'fuzzyMatches': self.stats['fuzzy_matches'],
                'highConfidenceMatches': self.stats['high_confidence_matches'],
                'mediumConfidenceMatches': self.stats['medium_confidence_matches'],
                'lowConfidenceMatches': self.stats['low_confidence_matches']
            },
            'unmatchedColleges': sorted(unmatched_colleges, key=lambda x: x['count'], reverse=True),
            'recommendations': {
                'addToMasterData': [uc['collegeName'] for uc in unmatched_colleges[:20]],  # Top 20 unmatched
                'reviewLowConfidence': confidence_distribution['low_confidence'],
                'manualReviewNeeded': len(unmatched_colleges)
            }
        }
        
        # Save report
        report_path = output_path.replace('.json', '_report.json')
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        logger.info("📋 MATCHING REPORT")
        logger.info("=" * 50)
        logger.info(f"Total counselling records: {self.stats['total_counselling_records']:,}")
        logger.info(f"Matched records: {self.stats['matched_records']:,} ({match_rate:.1f}%)")
        logger.info(f"Unmatched records: {self.stats['unmatched_records']:,}")
        logger.info("")
        logger.info("🎯 CONFIDENCE DISTRIBUTION")
        logger.info("-" * 30)
        logger.info(f"High confidence (≥0.9): {confidence_distribution['high_confidence']:,}")
        logger.info(f"Medium confidence (0.7-0.9): {confidence_distribution['medium_confidence']:,}")
        logger.info(f"Low confidence (<0.7): {confidence_distribution['low_confidence']:,}")
        logger.info(f"Unmatched: {confidence_distribution['unmatched']:,}")
        logger.info("")
        logger.info("🔍 MATCHING METHODS")
        logger.info("-" * 20)
        logger.info(f"Exact matches: {self.stats['exact_matches']:,}")
        logger.info(f"Fuzzy matches: {self.stats['fuzzy_matches']:,}")
        logger.info("")
        logger.info("📝 RECOMMENDATIONS")
        logger.info("-" * 20)
        logger.info(f"Add to master data: {len(unmatched_colleges)} unique colleges")
        logger.info(f"Review low confidence: {confidence_distribution['low_confidence']:,} records")
        
        return report_path

def main():
    parser = argparse.ArgumentParser(
        description='Master Data → Counselling Data Matcher',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 master-data-counselling-matcher.py --master-data data/parquet/colleges.parquet --counselling-data data/parquet/2024/cutoffs_aiq_2024.parquet
  python3 master-data-counselling-matcher.py --master-data data/parquet/colleges.parquet --counselling-data data/parquet/2024/cutoffs_kea_2024.parquet --output data/processed/kea_2024_matched.json
        """
    )
    
    parser.add_argument('--master-data', '-m', required=True, help='Path to master college data parquet file')
    parser.add_argument('--counselling-data', '-c', required=True, help='Path to counselling data parquet file')
    parser.add_argument('--output', '-o', help='Output path for processed data (default: auto-generated)')
    parser.add_argument('--version', action='version', version='Master Data Counselling Matcher v1.0')
    
    args = parser.parse_args()
    
    # Validate files exist
    if not Path(args.master_data).exists():
        logger.error(f"❌ Master data file not found: {args.master_data}")
        sys.exit(1)
    
    if not Path(args.counselling_data).exists():
        logger.error(f"❌ Counselling data file not found: {args.counselling_data}")
        sys.exit(1)
    
    # Generate output path if not provided
    if not args.output:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        counselling_name = Path(args.counselling_data).stem
        args.output = f"data/processed/{counselling_name}_matched_{timestamp}.json"
    
    try:
        # Initialize matcher
        matcher = MasterDataCounsellingMatcher()
        
        # Load master data
        matcher.load_master_data(args.master_data)
        
        # Process counselling data
        records = matcher.process_counselling_data(args.counselling_data)
        
        # Save processed data
        json_path, csv_path = matcher.save_processed_data(records, args.output)
        
        # Generate report
        report_path = matcher.generate_matching_report(records, args.output)
        
        logger.info("")
        logger.info("🎉 MASTER DATA MATCHING COMPLETED SUCCESSFULLY!")
        logger.info("📁 Files generated:")
        logger.info(f"   JSON: {json_path}")
        logger.info(f"   CSV: {csv_path}")
        logger.info(f"   Report: {report_path}")
        
    except Exception as e:
        logger.error(f"❌ Matching failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
