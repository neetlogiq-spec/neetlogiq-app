#!/usr/bin/env python3
"""
Enhanced text normalization for college and course matching
Preserves important structural elements like brackets, commas, and slashes
"""

import re
from functools import lru_cache

class EnhancedNormalizer:
    """Enhanced text normalizer with better handling of structural elements"""
    
    def __init__(self, config=None):
        # Default configuration
        self.config = config or {
            'to_uppercase': True,
            'handle_hyphens_dots': True,
            'normalize_whitespace': True,
            'preserve_brackets': True,
            'preserve_commas': True,
            'preserve_slashes': True
        }
        
        # Common abbreviations to expand
        self.abbreviations = {
            'ESI': 'EMPLOYEES STATE INSURANCE',
            'ESIC': 'EMPLOYEES STATE INSURANCE CORPORATION',
            'GOVT': 'GOVERNMENT',
            'PG': 'POST GRADUATE',
            'HOSP': 'HOSPITAL',
            'SSH': 'SUPER SPECIALITY HOSPITAL',
            'SDH': 'SUB DISTRICT HOSPITAL',
            'MED': 'MEDICAL',
            'COLL': 'COLLEGE',
            'INST': 'INSTITUTE',
            'UNIV': 'UNIVERSITY',
            'MCH': 'MASTER OF CHIRURGICAL',
            'DM': 'DOCTOR OF MEDICINE',
            'MD': 'DOCTOR OF MEDICINE',
            'MS': 'MASTER OF SURGERY',
        }
        
        # Words to remove (common noise words)
        self.noise_words = {
            'THE', 'AND', 'OF', 'IN', 'FOR', 'WITH', 'AT', 'ON', 'BY', 'TO', 'FROM'
        }
    
    @lru_cache(maxsize=10000)
    def normalize_text(self, text: str) -> str:
        """Enhanced text normalization that preserves structural elements"""
        if not text or text == '':
            return ''
        
        text = str(text).strip()
        
        # Convert to uppercase
        if self.config['to_uppercase']:
            text = text.upper()
        
        # Expand common abbreviations
        for abbrev, expansion in self.abbreviations.items():
            text = re.sub(r'\b' + re.escape(abbrev) + r'\b', expansion, text)
        
        # Handle hyphens and dots with proper spacing
        if self.config['handle_hyphens_dots']:
            text = re.sub(r'(?<!\s)-(?!\s)', ' - ', text)
            text = re.sub(r'(?<!\s)\.(?!\s)', ' . ', text)
        
        # Define what to preserve based on configuration
        preserve_pattern = r'\w\s'
        if self.config.get('preserve_brackets', True):
            preserve_pattern += r'()'
        if self.config.get('preserve_commas', True):
            preserve_pattern += r','
        if self.config.get('preserve_slashes', True):
            preserve_pattern += r'/'
        
        # Remove special characters except preserved ones
        text = re.sub(r'[^' + preserve_pattern + ']', '', text)
        
        # Remove noise words (optional, can be configured)
        if self.config.get('remove_noise_words', False):
            words = text.split()
            text = ' '.join(word for word in words if word not in self.noise_words)
        
        # Normalize whitespace
        if self.config['normalize_whitespace']:
            text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def normalize_for_exact_match(self, text: str) -> str:
        """Normalization specifically for exact matching - more conservative"""
        if not text or text == '':
            return ''
        
        text = str(text).strip()
        
        # Convert to uppercase
        text = text.upper()
        
        # Only normalize spacing and handle obvious issues
        text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
        text = re.sub(r'\s*,\s*', ', ', text)  # Normalize commas
        text = re.sub(r'\s*/\s*', ' / ', text)  # Normalize slashes
        text = re.sub(r'\s*\(\s*', ' (', text)  # Normalize opening brackets
        text = re.sub(r'\s*\)\s*', ') ', text)  # Normalize closing brackets
        
        return text.strip()
    
    def extract_primary_name(self, text: str) -> str:
        """Extract primary name before brackets"""
        if '(' in text and ')' in text:
            # Get text before first bracket
            primary = text.split('(')[0].strip()
            return primary
        return text
    
    def extract_secondary_name(self, text: str) -> str:
        """Extract secondary name from brackets"""
        if '(' in text and ')' in text:
            # Get text inside brackets
            match = re.search(r'\((.*?)\)', text)
            if match:
                return match.group(1).strip()
        return ''
    
    def normalize_with_components(self, text: str) -> dict:
        """Normalize text and return components"""
        normalized = self.normalize_text(text)
        primary = self.extract_primary_name(normalized)
        secondary = self.extract_secondary_name(normalized)
        
        return {
            'full': normalized,
            'primary': primary,
            'secondary': secondary,
            'has_secondary': bool(secondary)
        }

# Example usage and testing
if __name__ == "__main__":
    normalizer = EnhancedNormalizer()
    
    test_cases = [
        "JNM MEDICAL COLLEGE (WCD)",
        "GOVT. MEDICAL COLLEGE, KOTTAYAM",
        "AIIMS/MEDICAL COLLEGE",
        "ESI PGIMR, ESIC MEDICAL COLLEGE",
        "KEM HOSPITAL - SETH G.S. MEDICAL COLLEGE"
    ]
    
    print("Enhanced Normalization Examples:")
    print("=" * 50)
    
    for test in test_cases:
        result = normalizer.normalize_with_components(test)
        print(f"Original: {test}")
        print(f"Full:      {result['full']}")
        print(f"Primary:   {result['primary']}")
        print(f"Secondary: {result['secondary']}")
        print("-" * 30)
