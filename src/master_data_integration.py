#!/usr/bin/env python3
"""
Master Data Integration System for College Import
Handles name normalization and standardization using master mappings
Follows user rules for data processing and validation
"""

import pandas as pd
import re
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass
from fuzzywuzzy import fuzz
import csv


@dataclass
class MasterMapping:
    """Represents a master data mapping rule"""
    type: str  # COLLEGE, COURSE, STATE
    find: str  # Pattern to find
    replace: str  # Replacement value
    state: str  # Applicable state
    frequency: int  # Usage frequency
    priority: str  # HIGH, MEDIUM, LOW
    category: str  # ABBREVIATION, TYPO, NAME_VARIATION, etc.
    notes: str  # Additional context


@dataclass  
class MatchResult:
    """Result of matching against master data"""
    original: str
    normalized: str
    confidence: float
    match_type: str  # EXACT, FUZZY, PATTERN, NEW
    mapping_used: Optional[MasterMapping] = None
    requires_review: bool = False
    

class MasterDataIntegration:
    """
    Integrates imported data with master data for normalization
    
    Key principles from user rules:
    1. Master data contains normalized and standardized names 
    2. Imported data should be converted to uppercase
    3. Master data may not be 100% accurate and requires corrections
    4. New unmatched data should be reported and queued for manual review
    5. Match confidence scores tracked, <0.8 flagged for verification
    6. Audit trails maintained for raw to master data matches
    """
    
    def __init__(self, master_mappings_file: str = "data/master-mappings.csv"):
        self.master_mappings_file = master_mappings_file
        self.mappings: List[MasterMapping] = []
        self.normalized_colleges: Set[str] = set()
        self.normalized_states: Set[str] = set()
        self.match_cache: Dict[str, MatchResult] = {}
        
        self.load_master_mappings()
    
    def load_master_mappings(self):
        """Load master mappings from CSV file"""
        try:
            df = pd.read_csv(self.master_mappings_file, sep='|', header=0)
            
            for _, row in df.iterrows():
                mapping = MasterMapping(
                    type=str(row.get('Type', '')).strip().strip('"'),
                    find=str(row.get('Find', '')).strip().strip('"').upper(),
                    replace=str(row.get('Replace', '')).strip().strip('"').upper(),
                    state=str(row.get('State', '')).strip().strip('"').upper(),
                    frequency=int(row.get('Frequency', 0)),
                    priority=str(row.get('Priority', 'LOW')).strip().strip('"').upper(),
                    category=str(row.get('Category', '')).strip().strip('"').upper(),
                    notes=str(row.get('Notes', '')).strip().strip('"')
                )
                
                self.mappings.append(mapping)
                
                # Build normalized sets
                if mapping.type == 'COLLEGE':
                    self.normalized_colleges.add(mapping.replace)
                elif mapping.type == 'STATE':
                    self.normalized_states.add(mapping.replace)
            
            print(f"Loaded {len(self.mappings)} master mappings")
            print(f"Normalized colleges: {len(self.normalized_colleges)}")
            print(f"Normalized states: {len(self.normalized_states)}")
            
        except Exception as e:
            print(f"Warning: Could not load master mappings: {e}")
            self.mappings = []
    
    def normalize_text(self, text: str) -> str:
        """Convert text to normalized uppercase format"""
        if not text or pd.isna(text):
            return ""
        
        # Convert to uppercase and strip whitespace
        normalized = str(text).upper().strip()
        
        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', normalized)
        
        return normalized
    
    def find_exact_mapping(self, text: str, mapping_type: str, state: str = "") -> Optional[MasterMapping]:
        """Find exact mapping for given text"""
        normalized_text = self.normalize_text(text)
        
        for mapping in self.mappings:
            if (mapping.type == mapping_type and 
                mapping.find == normalized_text and
                (not state or mapping.state in ['MULTIPLE', state])):
                return mapping
        
        return None
    
    def find_pattern_mapping(self, text: str, mapping_type: str, state: str = "") -> Optional[MasterMapping]:
        """Find pattern-based mapping (for abbreviations, etc.)"""
        normalized_text = self.normalize_text(text)
        
        for mapping in self.mappings:
            if (mapping.type == mapping_type and
                (not state or mapping.state in ['MULTIPLE', state]) and
                mapping.category in ['ABBREVIATION', 'FORMAT_ISSUE']):
                
                # Check if pattern matches
                if mapping.find in normalized_text:
                    return mapping
        
        return None
    
    def calculate_fuzzy_score(self, text1: str, text2: str) -> float:
        """Calculate fuzzy matching score between two texts"""
        if not text1 or not text2:
            return 0.0
        
        # Use token sort ratio for better handling of word order
        score = fuzz.token_sort_ratio(text1.upper(), text2.upper()) / 100.0
        return score
    
    def find_fuzzy_match(self, text: str, candidates: Set[str], threshold: float = 0.8) -> Tuple[Optional[str], float]:
        """Find fuzzy match from candidates"""
        normalized_text = self.normalize_text(text)
        best_match = None
        best_score = 0.0
        
        for candidate in candidates:
            score = self.calculate_fuzzy_score(normalized_text, candidate)
            if score > best_score and score >= threshold:
                best_score = score
                best_match = candidate
        
        return best_match, best_score
    
    def match_college_name(self, college_name: str, state: str = "") -> MatchResult:
        """
        Match college name against master data
        Returns MatchResult with confidence score
        """
        original = college_name
        normalized_input = self.normalize_text(college_name)
        
        # Check cache first
        cache_key = f"COLLEGE:{normalized_input}:{state}"
        if cache_key in self.match_cache:
            return self.match_cache[cache_key]
        
        # 1. Try exact mapping
        exact_mapping = self.find_exact_mapping(normalized_input, 'COLLEGE', state)
        if exact_mapping:
            result = MatchResult(
                original=original,
                normalized=exact_mapping.replace,
                confidence=1.0,
                match_type='EXACT',
                mapping_used=exact_mapping,
                requires_review=False
            )
            self.match_cache[cache_key] = result
            return result
        
        # 2. Try pattern mapping (abbreviations)
        pattern_mapping = self.find_pattern_mapping(normalized_input, 'COLLEGE', state)
        if pattern_mapping:
            # Apply pattern replacement
            normalized_name = normalized_input.replace(pattern_mapping.find, pattern_mapping.replace)
            result = MatchResult(
                original=original,
                normalized=normalized_name,
                confidence=0.9,
                match_type='PATTERN',
                mapping_used=pattern_mapping,
                requires_review=False
            )
            self.match_cache[cache_key] = result
            return result
        
        # 3. Try fuzzy matching against normalized colleges
        fuzzy_match, fuzzy_score = self.find_fuzzy_match(normalized_input, self.normalized_colleges)
        if fuzzy_match and fuzzy_score >= 0.8:
            result = MatchResult(
                original=original,
                normalized=fuzzy_match,
                confidence=fuzzy_score,
                match_type='FUZZY',
                requires_review=fuzzy_score < 0.9
            )
            self.match_cache[cache_key] = result
            return result
        
        # 4. No match found - new data
        result = MatchResult(
            original=original,
            normalized=normalized_input,  # Keep normalized form
            confidence=0.0,
            match_type='NEW',
            requires_review=True
        )
        self.match_cache[cache_key] = result
        return result
    
    def match_state_name(self, state_name: str) -> MatchResult:
        """Match state name against master data"""
        original = state_name
        normalized_input = self.normalize_text(state_name)
        
        # Check cache
        cache_key = f"STATE:{normalized_input}"
        if cache_key in self.match_cache:
            return self.match_cache[cache_key]
        
        # Try exact mapping
        exact_mapping = self.find_exact_mapping(normalized_input, 'STATE')
        if exact_mapping:
            result = MatchResult(
                original=original,
                normalized=exact_mapping.replace,
                confidence=1.0,
                match_type='EXACT',
                mapping_used=exact_mapping
            )
            self.match_cache[cache_key] = result
            return result
        
        # Try fuzzy matching
        fuzzy_match, fuzzy_score = self.find_fuzzy_match(normalized_input, self.normalized_states)
        if fuzzy_match and fuzzy_score >= 0.8:
            result = MatchResult(
                original=original,
                normalized=fuzzy_match,
                confidence=fuzzy_score,
                match_type='FUZZY',
                requires_review=fuzzy_score < 0.9
            )
            self.match_cache[cache_key] = result
            return result
        
        # No match - keep normalized
        result = MatchResult(
            original=original,
            normalized=normalized_input,
            confidence=0.0,
            match_type='NEW',
            requires_review=True
        )
        self.match_cache[cache_key] = result
        return result
    
    def normalize_dataframe(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
        """
        Normalize entire DataFrame using master data
        Returns normalized DataFrame and audit information
        """
        df_normalized = df.copy()
        audit_results = {
            'total_records': len(df),
            'college_matches': {'exact': 0, 'pattern': 0, 'fuzzy': 0, 'new': 0},
            'state_matches': {'exact': 0, 'pattern': 0, 'fuzzy': 0, 'new': 0},
            'low_confidence_matches': [],
            'new_data_for_review': [],
            'normalization_errors': []
        }
        
        # Normalize colleges
        if 'COLLEGE' in df_normalized.columns:
            college_results = []
            for idx, college in df_normalized['COLLEGE'].items():
                state = df_normalized.loc[idx, 'STATE'] if 'STATE' in df_normalized.columns else ""
                
                try:
                    result = self.match_college_name(college, state)
                    college_results.append(result)
                    df_normalized.loc[idx, 'COLLEGE_NORMALIZED'] = result.normalized
                    df_normalized.loc[idx, 'COLLEGE_CONFIDENCE'] = result.confidence
                    df_normalized.loc[idx, 'COLLEGE_MATCH_TYPE'] = result.match_type
                    
                    # Update audit counts
                    audit_results['college_matches'][result.match_type.lower()] += 1
                    
                    # Track low confidence and new data
                    if result.requires_review:
                        if result.match_type == 'NEW':
                            audit_results['new_data_for_review'].append({
                                'type': 'COLLEGE',
                                'original': result.original,
                                'state': state,
                                'row': idx + 1
                            })
                        elif result.confidence < 0.8:
                            audit_results['low_confidence_matches'].append({
                                'type': 'COLLEGE',
                                'original': result.original,
                                'normalized': result.normalized,
                                'confidence': result.confidence,
                                'state': state,
                                'row': idx + 1
                            })
                            
                except Exception as e:
                    audit_results['normalization_errors'].append({
                        'row': idx + 1,
                        'college': college,
                        'error': str(e)
                    })
        
        # Normalize states
        if 'STATE' in df_normalized.columns:
            for idx, state in df_normalized['STATE'].items():
                try:
                    result = self.match_state_name(state)
                    df_normalized.loc[idx, 'STATE_NORMALIZED'] = result.normalized
                    df_normalized.loc[idx, 'STATE_CONFIDENCE'] = result.confidence
                    df_normalized.loc[idx, 'STATE_MATCH_TYPE'] = result.match_type
                    
                    # Update audit counts
                    audit_results['state_matches'][result.match_type.lower()] += 1
                    
                    if result.requires_review and result.match_type == 'NEW':
                        audit_results['new_data_for_review'].append({
                            'type': 'STATE',
                            'original': result.original,
                            'row': idx + 1
                        })
                        
                except Exception as e:
                    audit_results['normalization_errors'].append({
                        'row': idx + 1,
                        'state': state,
                        'error': str(e)
                    })
        
        return df_normalized, audit_results
    
    def generate_audit_report(self, audit_results: Dict) -> str:
        """Generate human-readable audit report"""
        report = []
        report.append("=== MASTER DATA NORMALIZATION AUDIT REPORT ===")
        report.append(f"Total records processed: {audit_results['total_records']}")
        report.append("")
        
        # College matches
        report.append("College Name Normalization:")
        for match_type, count in audit_results['college_matches'].items():
            report.append(f"  {match_type.upper()}: {count}")
        report.append("")
        
        # State matches  
        report.append("State Name Normalization:")
        for match_type, count in audit_results['state_matches'].items():
            report.append(f"  {match_type.upper()}: {count}")
        report.append("")
        
        # Low confidence matches
        if audit_results['low_confidence_matches']:
            report.append(f"Low Confidence Matches ({len(audit_results['low_confidence_matches'])} require review):")
            for match in audit_results['low_confidence_matches'][:10]:  # Show first 10
                report.append(f"  Row {match['row']}: {match['original']} -> {match['normalized']} (confidence: {match['confidence']:.2f})")
            if len(audit_results['low_confidence_matches']) > 10:
                report.append(f"  ... and {len(audit_results['low_confidence_matches']) - 10} more")
            report.append("")
        
        # New data for review
        if audit_results['new_data_for_review']:
            report.append(f"New Data for Manual Review ({len(audit_results['new_data_for_review'])} items):")
            for item in audit_results['new_data_for_review'][:10]:  # Show first 10
                report.append(f"  Row {item['row']}: {item['type']} = {item['original']}")
            if len(audit_results['new_data_for_review']) > 10:
                report.append(f"  ... and {len(audit_results['new_data_for_review']) - 10} more")
            report.append("")
        
        # Errors
        if audit_results['normalization_errors']:
            report.append(f"Normalization Errors ({len(audit_results['normalization_errors'])}):")
            for error in audit_results['normalization_errors']:
                report.append(f"  Row {error['row']}: {error['error']}")
            report.append("")
        
        return "\n".join(report)


if __name__ == "__main__":
    # Test master data integration
    integrator = MasterDataIntegration()
    
    # Test college name matching
    test_colleges = [
        "SMS MEDICAL COLLEGE",
        "GOVT MEDICAL COLLEGE", 
        "OSMANIA MEDICAL COLLGE",  # typo
        "NEW UNKNOWN COLLEGE"
    ]
    
    print("Testing college name matching:")
    for college in test_colleges:
        result = integrator.match_college_name(college, "RAJASTHAN")
        print(f"{college} -> {result.normalized} (confidence: {result.confidence:.2f}, type: {result.match_type})")
    
    print("\nTesting with dental data...")
    try:
        from flat_format_reader import FlatFormatReader
        
        reader = FlatFormatReader()
        file_path = "/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/dental ad.xlsx"
        df, validation = reader.read_flat_data(file_path, sheet_name='Sheet1')
        
        # Take first 20 records for testing
        df_test = df.head(20)
        
        # Normalize using master data
        df_normalized, audit = integrator.normalize_dataframe(df_test)
        
        print(f"\nNormalization results for {len(df_test)} test records:")
        print(integrator.generate_audit_report(audit))
        
        print("\nFirst 5 normalized records:")
        cols_to_show = ['STATE', 'COLLEGE', 'COLLEGE_NORMALIZED', 'COLLEGE_CONFIDENCE', 'COLLEGE_MATCH_TYPE']
        print(df_normalized[cols_to_show].head())
        
    except Exception as e:
        print(f"Error in testing: {e}")