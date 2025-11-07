#!/usr/bin/env python3
"""
Enhanced Hierarchical College-Course Matcher
Optimized for large-scale seat data import using keyword-based address matching

This matcher uses the insight that master data addresses are keywords 
that should be present within the detailed seat data addresses.
"""

import sqlite3
import pandas as pd
import numpy as np
import re
import logging
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass
from datetime import datetime
import json

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class MatchResult:
    """Result of college matching process"""
    college_id: Optional[int]
    confidence: float
    method: str
    master_address: Optional[str]
    issues: List[str]

@dataclass  
class SeatRecord:
    """Seat data record"""
    state: str
    college: str
    address: str
    university: str
    management: str
    course: str
    seats: int
    
class EnhancedCollegeCourseHierarchicalMatcher:
    """Enhanced hierarchical matcher for college-course data using keyword-based address matching"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        
        # Performance caches
        self.state_college_cache = {}  # state -> {college_name -> [college_records]}
        self.address_keyword_cache = {}  # master_address -> set of keywords
        self.course_cache = {}  # course_name -> course_id
        
        # Statistics
        self.match_stats = {
            'total_processed': 0,
            'exact_matches': 0,
            'keyword_matches': 0,
            'fuzzy_matches': 0,
            'no_matches': 0,
            'multiple_matches': 0
        }
        
        # State normalization mappings (enhanced from your algorithm)
        self.state_normalizations = {
            'DELHI (NCT)': 'DELHI',
            'NEW DELHI': 'DELHI',
            'NCT OF DELHI': 'DELHI',
            'JAMMU & KASHMIR': 'JAMMU & KASHMIR',
            'JAMMU AND KASHMIR': 'JAMMU & KASHMIR',
            'DADRA AND NAGAR HAVELI': 'DADRA & NAGAR HAVELI',
            'ANDAMAN AND NICOBAR ISLANDS': 'ANDAMAN & NICOBAR ISLANDS',
            'ANDAMAN NICOBAR ISLANDS': 'ANDAMAN & NICOBAR ISLANDS',
            'CHATTISGARH': 'CHHATTISGARH',
            'ORISSA': 'ODISHA',
            'PONDICHERRY': 'PUDUCHERRY',
            'UTTRAKHAND': 'UTTARAKHAND',
            # Add LADAKH as separate state
            'LADAKH': 'LADAKH',
        }
        
        # College name normalization patterns
        self.college_normalizations = {
            'GOVT': 'GOVERNMENT',
            'GOVTS': 'GOVERNMENT',  
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
            # Handle common variations
            'INSTITUE': 'INSTITUTE',
            'INSTITUE': 'INSTITUTE',
            'CENTRE': 'CENTER',
            'CENTER': 'CENTRE',  # Also reverse
        }
        
        # Initialize caches
        self._initialize_caches()
    
    def _initialize_caches(self):
        """Initialize performance caches from database"""
        logger.info("🔄 Initializing performance caches...")
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Build state-college cache
            cursor.execute('''
                SELECT 
                    s.name as state,
                    c.id as college_id,
                    c.name as college_name,
                    c.normalized_name,
                    cat.code as category,
                    ca.address as master_address
                FROM colleges c
                JOIN states s ON c.state_id = s.id
                JOIN categories cat ON c.category_id = cat.id
                JOIN college_addresses ca ON c.id = ca.college_id
                ORDER BY s.name, c.name
            ''')
            
            for row in cursor.fetchall():
                state, college_id, college_name, normalized_name, category, master_address = row
                
                if state not in self.state_college_cache:
                    self.state_college_cache[state] = {}
                
                if normalized_name not in self.state_college_cache[state]:
                    self.state_college_cache[state][normalized_name] = []
                
                self.state_college_cache[state][normalized_name].append({
                    'id': college_id,
                    'name': college_name,
                    'normalized_name': normalized_name,
                    'category': category,
                    'master_address': master_address
                })
                
                # Build address keyword cache
                self._extract_address_keywords(master_address)
        
        logger.info(f"✅ Cache initialized: {len(self.state_college_cache)} states, {sum(len(colleges) for colleges in self.state_college_cache.values())} college groups")
    
    def _extract_address_keywords(self, master_address: str) -> Set[str]:
        """Extract searchable keywords from master address"""
        if not master_address or master_address == 'N/A':
            return set()
        
        if master_address in self.address_keyword_cache:
            return self.address_keyword_cache[master_address]
        
        # Clean and split address into keywords
        address = master_address.upper().strip()
        
        # Remove common noise words
        noise_words = {'AND', 'OR', 'THE', 'OF', 'IN', 'AT', 'TO', 'FOR', 'WITH', 'BY'}
        
        # Split by common delimiters and clean
        keywords = set()
        parts = re.split(r'[,\s\-\(\)]+', address)
        
        for part in parts:
            part = part.strip()
            if len(part) >= 3 and part not in noise_words:  # Minimum 3 chars
                keywords.add(part)
        
        self.address_keyword_cache[master_address] = keywords
        return keywords
    
    def normalize_state(self, state: str) -> str:
        """Normalize state name using mappings"""
        if not state:
            return state
        
        normalized = state.upper().strip()
        return self.state_normalizations.get(normalized, normalized)
    
    def normalize_college_name(self, college_name: str) -> str:
        """Normalize college name using patterns"""
        if not college_name:
            return college_name
        
        normalized = college_name.upper().strip()
        
        # Apply normalization mappings
        for abbr, full in self.college_normalizations.items():
            # Use word boundaries to avoid partial replacements
            pattern = r'\b' + re.escape(abbr) + r'\b'
            normalized = re.sub(pattern, full, normalized)
        
        return normalized
    
    def extract_seat_address_keywords(self, seat_address: str) -> Set[str]:
        """Extract keywords from seat data address"""
        if not seat_address or str(seat_address).lower() == 'nan':
            return {'N/A'}
        
        # Clean complex address (especially for DNB data)
        address = str(seat_address).upper().strip()
        
        # Handle 'nan' string specifically
        if address == 'NAN':
            return {'N/A'}
        
        # Clean email patterns (like DHMARKAPUR@GMAIL.COM -> MARKAPUR)
        address = re.sub(r'\b\w*@[\w\.]+\b', lambda m: m.group(0).split('@')[0], address)
        
        # Remove common prefixes but preserve city names
        # Only remove state prefix if it's clearly at the beginning followed by comma
        state_patterns = [
            r'^ANDHRA PRADESH,\s*',
            r'^KARNATAKA,\s*', 
            r'^TAMIL NADU,\s*',
            r'^WEST BENGAL,\s*',
            r'^UTTAR PRADESH,\s*'
        ]
        
        for pattern in state_patterns:
            address = re.sub(pattern, '', address)
        
        # Clean up email-like prefixes (DH from DHMARKAPUR)
        address = re.sub(r'\bDH([A-Z]+)', r'\1', address)
        
        # Remove duplicate patterns (common in DNB data)
        address = re.sub(r'(\b\w+\b)(?:,\s*\1\b)+', r'\1', address)
        
        # Split and extract keywords
        keywords = set()
        parts = re.split(r'[,\s\-\(\)]+', address)
        
        noise_words = {'AND', 'OR', 'THE', 'OF', 'IN', 'AT', 'TO', 'FOR', 'WITH', 'BY', 'GMAIL', 'COM'}
        
        for part in parts:
            part = part.strip()
            if len(part) >= 3 and part not in noise_words:
                keywords.add(part)
        
        # If no keywords found, return N/A
        if not keywords:
            return {'N/A'}
            
        return keywords
    
    def calculate_keyword_match_score(self, master_keywords: Set[str], seat_keywords: Set[str]) -> float:
        """Calculate match score based on keyword overlap with fuzzy matching"""
        # Handle N/A addresses - if master is N/A, any address should match with medium confidence
        if master_keywords == {'N/A'} or 'N/A' in master_keywords:
            return 0.8  # Medium confidence for N/A matches
        
        # If seat address is N/A and master is not, still allow match
        if seat_keywords == {'N/A'} or 'N/A' in seat_keywords:
            return 0.7  # Slightly lower confidence
        
        if not master_keywords or not seat_keywords:
            return 0.0
        
        # Check for direct keyword matches
        intersection = master_keywords.intersection(seat_keywords)
        
        # If no direct matches, try fuzzy matching
        fuzzy_matches = 0
        if not intersection:
            from difflib import SequenceMatcher
            for master_word in master_keywords:
                for seat_word in seat_keywords:
                    # Check substring matches
                    if master_word in seat_word or seat_word in master_word:
                        fuzzy_matches += 1
                        break
                    # Check similarity for variations like MARKAPUR vs DHMARKAPUR  
                    elif len(master_word) >= 4 and len(seat_word) >= 4:
                        similarity = SequenceMatcher(None, master_word, seat_word).ratio()
                        if similarity >= 0.8:  # 80% similarity
                            fuzzy_matches += 1
                            break
        
        # Calculate score
        if intersection:
            overlap_ratio = len(intersection) / len(master_keywords)
        elif fuzzy_matches > 0:
            overlap_ratio = fuzzy_matches / len(master_keywords) * 0.9  # Slightly lower for fuzzy
        else:
            return 0.0
        
        # Bonus for multiple keyword matches
        if len(intersection) > 1 or fuzzy_matches > 1:
            overlap_ratio *= 1.2  # 20% bonus
        
        return min(overlap_ratio, 1.0)  # Cap at 1.0
    
    def match_college_hierarchical(self, seat_record: SeatRecord) -> MatchResult:
        """
        Enhanced hierarchical matching using keyword-based address detection
        
        Process:
        1. Normalize state and college names
        2. Filter by state (dramatic reduction)
        3. Filter by college name (exact/partial)
        4. Use keyword matching for address disambiguation
        5. Return best match with confidence
        """
        self.match_stats['total_processed'] += 1
        
        # Step 1: Normalize input
        normalized_state = self.normalize_state(seat_record.state)
        normalized_college = self.normalize_college_name(seat_record.college)
        
        # Step 2: State filter (reduces 16k+ to ~hundreds)
        if normalized_state not in self.state_college_cache:
            self.match_stats['no_matches'] += 1
            return MatchResult(
                college_id=None,
                confidence=0.0,
                method='NO_STATE_MATCH',
                master_address=None,
                issues=[f'State not found: {normalized_state}']
            )
        
        state_colleges = self.state_college_cache[normalized_state]
        
        # Step 3: College name matching (reduces hundreds to ~few)
        college_candidates = []
        
        # Try exact match first
        if normalized_college in state_colleges:
            college_candidates.extend(state_colleges[normalized_college])
            method = 'EXACT_COLLEGE_NAME'
        else:
            # Try aggressive partial matching since all colleges should exist
            for college_key, records in state_colleges.items():
                # More aggressive matching - any significant word overlap
                normalized_words = set(normalized_college.split())
                college_words = set(college_key.split())
                
                # Calculate word overlap
                common_words = normalized_words.intersection(college_words)
                
                # Multiple matching strategies
                match_found = False
                
                # Strategy 1: Substantial word overlap (2+ words)
                if len(common_words) >= 2:
                    match_found = True
                
                # Strategy 2: Traditional substring match
                elif (normalized_college in college_key) or (college_key in normalized_college):
                    match_found = True
                
                # Strategy 3: High percentage word overlap (for shorter names)
                elif len(normalized_words) > 0 and len(common_words) / len(normalized_words) >= 0.6:
                    match_found = True
                
                # Strategy 4: Key identifier words (for hospitals, government colleges)
                elif any(key_word in college_key for key_word in ['HOSPITAL', 'MEDICAL', 'DENTAL', 'COLLEGE']):
                    # Check if main identifying words match
                    main_words = [w for w in normalized_words if w not in ['AND', 'THE', 'OF', 'IN']]
                    if any(word in college_key for word in main_words if len(word) > 3):
                        match_found = True
                
                if match_found:
                    college_candidates.extend(records)
            
            method = 'PARTIAL_COLLEGE_NAME' if college_candidates else 'NO_COLLEGE_MATCH'
        
        if not college_candidates:
            self.match_stats['no_matches'] += 1
            return MatchResult(
                college_id=None,
                confidence=0.0,
                method='NO_COLLEGE_MATCH',
                master_address=None,
                issues=[f'College not found: {normalized_college}']
            )
        
        # Step 4: Keyword-based address matching (final disambiguation)
        seat_keywords = self.extract_seat_address_keywords(seat_record.address)
        
        best_match = None
        best_score = 0.0
        
        for candidate in college_candidates:
            master_keywords = self._extract_address_keywords(candidate['master_address'])
            score = self.calculate_keyword_match_score(master_keywords, seat_keywords)
            
            if score > best_score:
                best_score = score
                best_match = candidate
        
        # Determine result based on score and method - more permissive since all colleges should exist
        if best_match and best_score >= 0.5:  # Lower threshold for keyword match
            confidence = min(best_score * 0.9, 1.0)  # Slightly lower confidence than exact
            self.match_stats['keyword_matches'] += 1
            result_method = f'{method}_KEYWORD'
        elif best_match and len(college_candidates) == 1:  # Only one candidate - high confidence
            confidence = 0.9  # Higher confidence for unique matches
            self.match_stats['exact_matches'] += 1  
            result_method = f'{method}_UNIQUE'
        elif best_match and best_score > 0:  # Any address match at all
            confidence = 0.7  # Medium confidence 
            self.match_stats['fuzzy_matches'] += 1
            result_method = f'{method}_FUZZY'
        elif best_match:  # College found but no address match - still accept it
            confidence = 0.6  # Lower but acceptable confidence
            self.match_stats['fuzzy_matches'] += 1
            result_method = f'{method}_NO_ADDRESS'
        else:
            self.match_stats['no_matches'] += 1
            return MatchResult(
                college_id=None,
                confidence=0.0,
                method='NO_COLLEGE_FOUND',
                master_address=None,
                issues=[f'No college match found for: {normalized_college} in {normalized_state}']
            )
        
        if len(college_candidates) > 1:
            self.match_stats['multiple_matches'] += 1
        
        return MatchResult(
            college_id=best_match['id'],
            confidence=confidence,
            method=result_method,
            master_address=best_match['master_address'],
            issues=[]
        )
    
    def process_seat_data_file(self, file_path: str, category: str) -> Dict:
        """Process entire seat data file efficiently"""
        logger.info(f"🚀 Processing {category} seat data from: {file_path}")
        
        # Read data
        df = pd.read_excel(file_path, sheet_name='Sheet1', header=0)
        logger.info(f"📊 Loaded {len(df)} records")
        
        # Convert to SeatRecord objects
        seat_records = []
        for _, row in df.iterrows():
            seat_record = SeatRecord(
                state=str(row['STATE']).strip(),
                college=str(row['COLLEGE/INSTITUTE']).strip(), 
                address=str(row['ADDRESS']).strip(),
                university=str(row['UNIVERSITY_AFFILIATION']).strip(),
                management=str(row['MANAGEMENT']).strip(),
                course=str(row['COURSE']).strip(),
                seats=int(row['SEATS']) if pd.notna(row['SEATS']) else 0
            )
            seat_records.append(seat_record)
        
        # Process matches
        results = []
        unmatched = []
        
        logger.info("🔍 Starting hierarchical matching process...")
        
        for i, seat_record in enumerate(seat_records):
            if i % 1000 == 0:
                logger.info(f"   Progress: {i}/{len(seat_records)} records processed...")
            
            match_result = self.match_college_hierarchical(seat_record)
            
            result_data = {
                'seat_record': seat_record,
                'match_result': match_result,
                'row_index': i
            }
            
            if match_result.college_id:
                results.append(result_data)
            else:
                unmatched.append(result_data)
        
        # Generate summary
        total = len(seat_records)
        matched = len(results)
        
        summary = {
            'category': category,
            'total_records': total,
            'matched_records': matched,
            'unmatched_records': len(unmatched),
            'match_rate': matched / total if total > 0 else 0,
            'results': results,
            'unmatched': unmatched[:50],  # Limit unmatched for memory
            'statistics': dict(self.match_stats)
        }
        
        logger.info(f"✅ {category} processing completed:")
        logger.info(f"   Total: {total} records")
        logger.info(f"   Matched: {matched} ({matched/total:.1%})")
        logger.info(f"   Unmatched: {len(unmatched)} ({len(unmatched)/total:.1%})")
        
        return summary
    
    def get_match_statistics(self) -> Dict:
        """Get detailed matching statistics"""
        total = self.match_stats['total_processed']
        
        if total == 0:
            return self.match_stats
        
        stats = dict(self.match_stats)
        stats.update({
            'exact_match_rate': stats['exact_matches'] / total,
            'keyword_match_rate': stats['keyword_matches'] / total, 
            'fuzzy_match_rate': stats['fuzzy_matches'] / total,
            'no_match_rate': stats['no_matches'] / total,
            'overall_match_rate': (total - stats['no_matches']) / total
        })
        
        return stats


def main():
    """Main execution function for testing"""
    db_path = '/Users/kashyapanand/Public/New/data/multi_category_colleges.db'
    
    # Initialize matcher
    matcher = EnhancedCollegeCourseHierarchicalMatcher(db_path)
    
    # Define seat data files
    seat_files = [
        ('/Users/kashyapanand/Desktop/EXPORT/seat data/dental.xlsx', 'DENTAL'),
        ('/Users/kashyapanand/Desktop/EXPORT/seat data/medical.xlsx', 'MEDICAL'),
        ('/Users/kashyapanand/Desktop/EXPORT/seat data/DNB UPDATED.xlsx', 'DNB')
    ]
    
    print("🚀 ENHANCED HIERARCHICAL COLLEGE-COURSE MATCHER")
    print("=" * 80)
    print("This system processes large-scale seat data using keyword-based address matching")
    print("Optimized for 16k+ records with hierarchical filtering")
    
    # Process each file
    all_results = {}
    
    for file_path, category in seat_files:
        print(f"\n{'='*60}")
        print(f"📊 PROCESSING {category}")
        print(f"{'='*60}")
        
        summary = matcher.process_seat_data_file(file_path, category)
        all_results[category] = summary
        
        # Show sample matches
        if summary['results']:
            print(f"\n✅ Sample successful matches:")
            for i, result_data in enumerate(summary['results'][:3]):
                seat = result_data['seat_record']
                match = result_data['match_result']
                print(f"  {i+1}. {seat.college[:50]}...")
                print(f"     Seat Address: {seat.address[:50]}...")
                print(f"     Master Address: {match.master_address}")
                print(f"     Confidence: {match.confidence:.2f} | Method: {match.method}")
        
        if summary['unmatched']:
            print(f"\n❌ Sample unmatched records:")
            for i, result_data in enumerate(summary['unmatched'][:3]):
                seat = result_data['seat_record']
                match = result_data['match_result']
                print(f"  {i+1}. {seat.college[:50]}...")
                print(f"     Issues: {', '.join(match.issues)}")
    
    # Overall statistics
    print(f"\n{'='*80}")
    print("📈 OVERALL STATISTICS")
    print(f"{'='*80}")
    
    stats = matcher.get_match_statistics()
    print(f"Total Records Processed: {stats['total_processed']:,}")
    print(f"Overall Match Rate: {stats.get('overall_match_rate', 0):.1%}")
    print(f"Exact Matches: {stats['exact_matches']:,} ({stats.get('exact_match_rate', 0):.1%})")
    print(f"Keyword Matches: {stats['keyword_matches']:,} ({stats.get('keyword_match_rate', 0):.1%})")  
    print(f"Fuzzy Matches: {stats['fuzzy_matches']:,} ({stats.get('fuzzy_match_rate', 0):.1%})")
    print(f"No Matches: {stats['no_matches']:,} ({stats.get('no_match_rate', 0):.1%})")
    
    return all_results


if __name__ == "__main__":
    results = main()