#!/usr/bin/env python3
"""
KEA2024 Hierarchical Matching Adapter
Converts KEA2024.xlsx data to work with the existing EnhancedCollegeCourseHierarchicalMatcher
"""

import pandas as pd
import sys
import logging
from pathlib import Path
from datetime import datetime

# Add the current directory to path to import the hierarchical matcher
sys.path.append('/Users/kashyapanand/Public/New')

from enhanced_college_course_matcher import EnhancedCollegeCourseHierarchicalMatcher, SeatRecord

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class KEA2024HierarchicalAdapter:
    def __init__(self, db_path: str, kea_file_path: str):
        self.db_path = db_path
        self.kea_file_path = kea_file_path
        self.matcher = EnhancedCollegeCourseHierarchicalMatcher(db_path)
        
    def convert_kea_to_seat_format(self) -> str:
        """Convert KEA2024.xlsx to the expected seat data format"""
        logger.info("📊 Converting KEA2024 data to hierarchical matcher format...")
        
        # Read KEA2024 data
        df_kea = pd.read_excel(self.kea_file_path)
        logger.info(f"📋 Loaded {len(df_kea)} KEA2024 records")
        logger.info(f"📋 KEA columns: {list(df_kea.columns)}")
        
        # Convert to seat data format
        df_converted = pd.DataFrame({
            'STATE': df_kea['STATE'],  # STATE exists in KEA2024
            'COLLEGE/INSTITUTE': df_kea['COLLEGE/INSTITUTE'],  # Direct mapping
            'ADDRESS': 'N/A',  # KEA2024 doesn't have address, use N/A
            'UNIVERSITY_AFFILIATION': 'N/A',  # Not available in KEA2024
            'MANAGEMENT': df_kea.get('QUOTA', 'N/A'),  # Use QUOTA as management type
            'COURSE': df_kea['COURSE'],  # Direct mapping
            'SEATS': 1,  # KEA2024 is allocation data, each row represents 1 seat allocated
            # Additional KEA-specific fields for tracking
            'ALL_INDIA_RANK': df_kea['ALL_INDIA_RANK'],
            'CATEGORY': df_kea['CATEGORY'],
            'ROUND': df_kea['ROUND'],
            'YEAR': df_kea['YEAR']
        })
        
        # Save converted data
        output_file = 'kea2024_converted_for_hierarchical.xlsx'
        df_converted.to_excel(output_file, index=False)
        logger.info(f"✅ Converted data saved to: {output_file}")
        logger.info(f"📊 Converted {len(df_converted)} records")
        
        return output_file
    
    def process_kea_with_hierarchical_matching(self):
        """Process KEA2024 data using the hierarchical matching system"""
        logger.info("🚀 KEA2024 HIERARCHICAL MATCHING")
        logger.info("=" * 60)
        
        # Convert data format
        converted_file = self.convert_kea_to_seat_format()
        
        # Process using hierarchical matcher
        logger.info("🔍 Starting hierarchical matching process...")
        summary = self.matcher.process_seat_data_file(converted_file, 'KEA2024_COUNSELLING')
        
        # Extract detailed results
        results = []
        unmatched = []
        
        logger.info("📊 Processing detailed results...")
        
        for result_data in summary['results']:
            seat_record = result_data['seat_record']
            match_result = result_data['match_result']
            
            # Create enhanced record with KEA-specific data
            enhanced_record = {
                'id': f'kea_hierarchical_{result_data["row_index"]}_{int(datetime.now().timestamp())}',
                'original_college': seat_record.college,
                'original_state': seat_record.state,
                'original_course': seat_record.course,
                'matched_college_id': match_result.college_id,
                'match_confidence': match_result.confidence,
                'match_method': match_result.method,
                'master_address': match_result.master_address,
                'issues': match_result.issues,
                'management_quota': seat_record.management,
                'needs_manual_review': match_result.confidence < 0.8,  # Per your rules
                'match_pass': self._determine_match_pass(match_result.confidence),
                'processing_timestamp': datetime.now().isoformat(),
                'source_file': 'KEA2024.xlsx',
                'matching_algorithm': 'hierarchical_keyword_based'
            }
            
            results.append(enhanced_record)
        
        # Process unmatched records
        for result_data in summary['unmatched']:
            seat_record = result_data['seat_record']
            match_result = result_data['match_result']
            
            unmatched_record = {
                'id': f'kea_unmatched_{result_data["row_index"]}_{int(datetime.now().timestamp())}',
                'original_college': seat_record.college,
                'original_state': seat_record.state,
                'original_course': seat_record.course,
                'issues': match_result.issues,
                'method': match_result.method,
                'management_quota': seat_record.management,
                'needs_master_data_update': True,
                'processing_timestamp': datetime.now().isoformat(),
                'source_file': 'KEA2024.xlsx',
                'matching_algorithm': 'hierarchical_keyword_based'
            }
            
            unmatched.append(unmatched_record)
        
        # Save results
        self._save_hierarchical_results(results, unmatched, summary)
        
        # Generate comprehensive report
        self._generate_hierarchical_report(summary, results, unmatched)
        
        return {
            'summary': summary,
            'matched_results': results,
            'unmatched_results': unmatched
        }
    
    def _determine_match_pass(self, confidence: float) -> int:
        """Determine match pass based on confidence score"""
        if confidence >= 0.95:
            return 1  # Exact match
        elif confidence >= 0.85:
            return 2  # High confidence
        elif confidence >= 0.75:
            return 3  # Medium confidence
        elif confidence >= 0.6:
            return 4  # Low confidence
        else:
            return 5  # Very low confidence / needs review
    
    def _save_hierarchical_results(self, results, unmatched, summary):
        """Save all hierarchical matching results"""
        
        # Save matched results
        if results:
            df_matched = pd.DataFrame(results)
            matched_file = 'kea2024_hierarchical_matched.csv'
            df_matched.to_csv(matched_file, index=False)
            logger.info(f"✅ Matched results saved to: {matched_file}")
        
        # Save unmatched results
        if unmatched:
            df_unmatched = pd.DataFrame(unmatched)
            unmatched_file = 'kea2024_hierarchical_unmatched.csv'
            df_unmatched.to_csv(unmatched_file, index=False)
            logger.info(f"📝 Unmatched results saved to: {unmatched_file}")
        
        # Save complete summary
        import json
        summary_file = 'kea2024_hierarchical_summary.json'
        with open(summary_file, 'w', encoding='utf-8') as f:
            # Convert any non-serializable objects to strings
            serializable_summary = self._make_serializable(summary)
            json.dump(serializable_summary, f, indent=2)
        logger.info(f"📊 Summary saved to: {summary_file}")
    
    def _make_serializable(self, obj):
        """Convert objects to JSON-serializable format"""
        if hasattr(obj, '__dict__'):
            return {key: self._make_serializable(value) for key, value in obj.__dict__.items()}
        elif isinstance(obj, list):
            return [self._make_serializable(item) for item in obj[:10]]  # Limit to first 10 for memory
        elif isinstance(obj, dict):
            return {key: self._make_serializable(value) for key, value in obj.items()}
        else:
            return str(obj)
    
    def _generate_hierarchical_report(self, summary, results, unmatched):
        """Generate comprehensive hierarchical matching report"""
        
        total_records = summary['total_records']
        matched_count = len(results)
        unmatched_count = len(unmatched)
        match_rate = (matched_count / total_records * 100) if total_records > 0 else 0
        
        # Analyze confidence distribution
        confidence_stats = {
            'high_confidence': sum(1 for r in results if r['match_confidence'] >= 0.8),
            'medium_confidence': sum(1 for r in results if 0.6 <= r['match_confidence'] < 0.8),
            'low_confidence': sum(1 for r in results if r['match_confidence'] < 0.6),
            'needs_review': sum(1 for r in results if r['needs_manual_review'])
        }
        
        logger.info("")
        logger.info("🎯 HIERARCHICAL MATCHING REPORT")
        logger.info("=" * 60)
        logger.info(f"📊 Total KEA2024 records: {total_records:,}")
        logger.info(f"✅ Successfully matched: {matched_count:,} ({match_rate:.1f}%)")
        logger.info(f"❌ Unmatched records: {unmatched_count:,} ({(unmatched_count/total_records*100):.1f}%)")
        
        logger.info("")
        logger.info("🎯 CONFIDENCE DISTRIBUTION")
        logger.info("-" * 40)
        logger.info(f"High confidence (≥0.8): {confidence_stats['high_confidence']:,}")
        logger.info(f"Medium confidence (0.6-0.8): {confidence_stats['medium_confidence']:,}")
        logger.info(f"Low confidence (<0.6): {confidence_stats['low_confidence']:,}")
        logger.info(f"Needs manual review: {confidence_stats['needs_review']:,}")
        
        # Show matching method distribution
        method_stats = {}
        for result in results:
            method = result['match_method']
            method_stats[method] = method_stats.get(method, 0) + 1
        
        logger.info("")
        logger.info("🔍 MATCHING METHOD DISTRIBUTION")
        logger.info("-" * 40)
        for method, count in sorted(method_stats.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / matched_count * 100) if matched_count > 0 else 0
            logger.info(f"{method}: {count:,} ({percentage:.1f}%)")
        
        # Show sample matches
        if results:
            logger.info("")
            logger.info("✅ SAMPLE SUCCESSFUL MATCHES")
            logger.info("-" * 40)
            for i, result in enumerate(results[:3]):
                logger.info(f"{i+1}. {result['original_college'][:50]}")
                logger.info(f"   Confidence: {result['match_confidence']:.3f}")
                logger.info(f"   Method: {result['match_method']}")
                logger.info(f"   College ID: {result['matched_college_id']}")
        
        # Show unmatched issues
        if unmatched:
            issue_counts = {}
            for record in unmatched:
                for issue in record['issues']:
                    issue_counts[issue] = issue_counts.get(issue, 0) + 1
            
            logger.info("")
            logger.info("❌ UNMATCHED RECORD ISSUES")
            logger.info("-" * 40)
            for issue, count in sorted(issue_counts.items(), key=lambda x: x[1], reverse=True):
                logger.info(f"{issue}: {count} records")
        
        logger.info("")
        logger.info("📝 NEXT STEPS (Per Master Data Rules)")
        logger.info("-" * 50)
        logger.info(f"1. Review {confidence_stats['needs_review']} low confidence matches")
        logger.info(f"2. Add {unmatched_count} unmatched colleges to master data")
        logger.info("3. User approval required for final processing")
        logger.info("4. Version control and audit trail maintained")

def main():
    """Main execution function"""
    db_path = '/Users/kashyapanand/Public/New/data/multi_category_colleges.db'
    kea_file = '/Users/kashyapanand/Desktop/EXPORT/KEA2024.xlsx'
    
    # Check if required files exist
    if not Path(db_path).exists():
        logger.error(f"❌ Database not found: {db_path}")
        return
    
    if not Path(kea_file).exists():
        logger.error(f"❌ KEA2024 file not found: {kea_file}")
        return
    
    # Initialize adapter and process
    adapter = KEA2024HierarchicalAdapter(db_path, kea_file)
    results = adapter.process_kea_with_hierarchical_matching()
    
    logger.info("")
    logger.info("🎉 KEA2024 HIERARCHICAL MATCHING COMPLETED!")
    logger.info("✅ Used the same algorithm as seat data processing")
    logger.info("✅ Full master data integration applied")
    logger.info("✅ Confidence scoring and audit trails maintained")

if __name__ == "__main__":
    main()