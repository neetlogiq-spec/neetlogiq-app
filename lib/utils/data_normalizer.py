#!/usr/bin/env python3
"""
Data Normalizer
Normalizes college names and addresses for matching.

This module handles:
- Whitespace normalization
- Case conversion
- Special character handling
- Abbreviation expansion
- Pincode removal
"""

import re
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)


class DataNormalizer:
    """Normalizes college and address data for matching"""

    def __init__(self, config: Dict = None):
        """
        Initialize normalizer with configuration.

        Args:
            config: Configuration dictionary (from config.yaml)
        """
        self.config = config or {}

        # Load abbreviations from config
        self.abbreviations = self.config.get('abbreviations', {
            'GOVT': 'GOVERNMENT',
            'MED': 'MEDICAL',
            'COLL': 'COLLEGE',
            'INST': 'INSTITUTE',
            'UNIV': 'UNIVERSITY',
            'DIST': 'DISTRICT',
            'HOSP': 'HOSPITAL',
            'GEN': 'GENERAL',
            'SCH': 'SCHOOL',
            'DEPT': 'DEPARTMENT',
            'MIN': 'MINORITY',
            'PVT': 'PRIVATE',
            'MGMT': 'MANAGEMENT',
            'TECH': 'TECHNOLOGY',
            'AIIMS': 'ALL INDIA INSTITUTE OF MEDICAL SCIENCES',
            'JIPMER': 'JAWAHARLAL INSTITUTE OF POSTGRADUATE MEDICAL EDUCATION AND RESEARCH',
        })

    def normalize_college_name(self, name: str) -> str:
        """
        Normalize college name for matching.

        Process:
        1. Convert to uppercase
        2. Remove extra whitespace
        3. Expand abbreviations
        4. Remove special characters (except spaces)
        5. Handle multi-space issues

        Args:
            name: College name to normalize

        Returns:
            Normalized college name
        """
        if not name:
            return ""

        # 1. Convert to uppercase
        name = str(name).upper().strip()

        # 2. Remove extra whitespace
        name = re.sub(r'\s+', ' ', name)

        # 3. Expand abbreviations
        for abbrev, expansion in self.abbreviations.items():
            # Use word boundary to avoid partial replacements
            pattern = r'\b' + re.escape(abbrev) + r'\b'
            name = re.sub(pattern, expansion, name)

        # 4. Remove special characters except spaces, parentheses, hyphens
        # Keep these: letters, numbers, spaces, hyphens, parentheses, apostrophes
        name = re.sub(r"[^\w\s\-()']", '', name)

        # 5. Remove extra spaces again
        name = re.sub(r'\s+', ' ', name).strip()

        # 6. Remove trailing/leading parentheses
        name = re.sub(r'^\(+|\)+$', '', name).strip()

        return name

    def normalize_address(self, address: str, state: str = None) -> str:
        """
        Normalize address for matching.

        Process:
        1. Convert to uppercase
        2. Remove extra whitespace
        3. Remove state name (if provided) - prevents duplicate state in address
        4. Remove pincodes
        5. Remove extra punctuation
        6. Keep only important keywords

        Args:
            address: Address to normalize
            state: Optional state name to remove from address

        Returns:
            Normalized address
        """
        if not address:
            return ""

        # 1. Convert to uppercase
        address = str(address).upper().strip()

        # 2. Remove extra whitespace
        address = re.sub(r'\s+', ' ', address)

        # 3. Remove state name from address (if provided)
        # This handles cases like "MANIPUR, POROMPAT, IMPHAL" where state=MANIPUR
        if state:
            address = self.remove_state_from_address(address, state)

        # 4. Remove 6-digit pincodes
        address = re.sub(r'\b\d{6}\b', '', address)

        # 5. Remove extra punctuation (keep hyphens, commas, spaces)
        address = re.sub(r'[^\w\s\-,]', '', address)

        # 6. Remove extra spaces
        address = re.sub(r'\s+', ' ', address).strip()

        return address

    def remove_state_from_address(self, address: str, state: str) -> str:
        """
        Remove state name from address to avoid redundancy.
        
        Example:
        - Address: "MANIPUR, POROMPAT, IMPHAL -EAST"
        - State: "MANIPUR"
        - Result: "POROMPAT, IMPHAL -EAST"
        
        Only removes the EXACT state name (with word boundaries) to prevent
        cross-data removal (e.g., won't remove 'WEST' from 'WEST BENGAL').
        
        Args:
            address: Address string
            state: State name to remove
            
        Returns:
            Address with state name removed
        """
        if not address or not state:
            return address
        
        state = str(state).upper().strip()
        address = str(address).upper().strip()
        
        # Build pattern to match state name with word boundaries
        # Also handle common variations like trailing comma, leading comma
        state_pattern = r'\b' + re.escape(state) + r'\b'
        
        # Remove state name
        address = re.sub(state_pattern, '', address)
        
        # Clean up any resulting double commas or leading/trailing commas
        address = re.sub(r',\s*,', ',', address)  # Double commas
        address = re.sub(r'^\s*,\s*', '', address)  # Leading comma
        address = re.sub(r'\s*,\s*$', '', address)  # Trailing comma
        address = re.sub(r'\s+', ' ', address).strip()  # Extra spaces
        
        return address

    def normalize_stream(self, stream: str) -> str:
        """
        Normalize stream/course type.

        Standard types: MEDICAL, DENTAL, DNB, ENGINEERING

        Args:
            stream: Stream to normalize

        Returns:
            Normalized stream
        """
        if not stream:
            return ""

        stream = str(stream).upper().strip()

        # Map common variations to standard names
        stream_map = {
            'ALLOPATHY': 'MEDICAL',
            'MBBS': 'MEDICAL',
            'MD': 'MEDICAL',
            'MS': 'MEDICAL',
            'BDS': 'DENTAL',
            'MDS': 'DENTAL',
            'DENTISTRY': 'DENTAL',
            'AYURVEDA': 'AYURVEDA',
            'HOMEOPATHY': 'HOMEOPATHY',
            'UNANI': 'UNANI',
            'SIDDHA': 'SIDDHA',
        }

        return stream_map.get(stream, stream)

    def normalize_state(self, state: str) -> str:
        """
        Normalize state name.

        Args:
            state: State name to normalize

        Returns:
            Normalized state name
        """
        if not state:
            return ""

        state = str(state).upper().strip()

        # Load state mappings from config
        state_mappings = self.config.get('state_normalization', {}).get('mappings', {})

        # Check exact matches first
        for key, value in state_mappings.items():
            if key.upper() == state:
                return value.upper()

        return state

    def normalize_course_name(self, course: str) -> str:
        """
        Normalize course name.

        Args:
            course: Course name to normalize

        Returns:
            Normalized course name
        """
        if not course:
            return ""

        # Convert to uppercase
        course = str(course).upper().strip()

        # Remove extra whitespace
        course = re.sub(r'\s+', ' ', course)

        # Load course aliases from config
        course_aliases = self.config.get('aliases', {}).get('course_aliases', {})

        for alias, canonical in course_aliases.items():
            if alias.upper() == course:
                return canonical.upper()

        return course

    def normalize_record(self, record: Dict) -> Dict:
        """
        Normalize all fields in a record.

        Args:
            record: Record dictionary

        Returns:
            Normalized record dictionary
        """
        normalized = record.copy()

        # Normalize college name
        if 'college_name' in normalized and normalized['college_name']:
            normalized['normalized_college_name'] = self.normalize_college_name(
                normalized['college_name']
            )

        # Normalize address (pass state to remove redundant state name from address)
        if 'address' in normalized and normalized['address']:
            state_for_removal = normalized.get('state') or normalized.get('normalized_state')
            normalized['normalized_address'] = self.normalize_address(
                normalized['address'],
                state=state_for_removal
            )

        # Normalize stream
        if 'stream' in normalized and normalized['stream']:
            normalized['stream'] = self.normalize_stream(normalized['stream'])

        # Normalize state
        if 'state' in normalized and normalized['state']:
            normalized['state'] = self.normalize_state(normalized['state'])

        # Normalize course
        if 'course_name' in normalized and normalized['course_name']:
            normalized['normalized_course_name'] = self.normalize_course_name(
                normalized['course_name']
            )

        return normalized

    @staticmethod
    def remove_pincode(text: str) -> str:
        """Remove pincodes from text"""
        if not text:
            return ""
        return re.sub(r'\b\d{6}\b', '', str(text)).strip()

    @staticmethod
    def remove_special_chars(text: str) -> str:
        """Remove special characters, keep alphanumeric and spaces"""
        if not text:
            return ""
        return re.sub(r'[^\w\s]', '', str(text))

    @staticmethod
    def clean_whitespace(text: str) -> str:
        """Remove extra whitespace"""
        if not text:
            return ""
        return re.sub(r'\s+', ' ', str(text)).strip()


# Module-level functions for convenience
_normalizer = None


def get_normalizer(config: Dict = None) -> DataNormalizer:
    """Get singleton normalizer instance"""
    global _normalizer
    if _normalizer is None:
        _normalizer = DataNormalizer(config)
    return _normalizer


def normalize_college_name(name: str) -> str:
    """Normalize college name"""
    normalizer = get_normalizer()
    return normalizer.normalize_college_name(name)


def normalize_address(address: str) -> str:
    """Normalize address"""
    normalizer = get_normalizer()
    return normalizer.normalize_address(address)


def normalize_record(record: Dict) -> Dict:
    """Normalize record"""
    normalizer = get_normalizer()
    return normalizer.normalize_record(record)
