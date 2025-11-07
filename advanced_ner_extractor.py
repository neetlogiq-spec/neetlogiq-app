#!/usr/bin/env python3
"""
Named Entity Recognition (NER) Module
Extracts college names, courses, locations, and other entities from text
"""

import spacy
import re
from typing import List, Dict, Tuple, Optional
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class EducationNER:
    """NER for educational data extraction"""

    def __init__(self, model_name: str = 'en_core_web_sm'):
        """
        Initialize NER extractor

        Args:
            model_name: spaCy model name
                - 'en_core_web_sm': Small, fast (default)
                - 'en_core_web_md': Medium, better accuracy
                - 'en_core_web_lg': Large, best accuracy
        """
        logger.info(f"Loading spaCy model: {model_name}")
        try:
            self.nlp = spacy.load(model_name)
        except OSError:
            logger.warning(f"Model {model_name} not found. Downloading...")
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", model_name])
            self.nlp = spacy.load(model_name)

        # Custom patterns for medical/dental education
        self.college_patterns = self._build_college_patterns()
        self.course_patterns = self._build_course_patterns()
        self.quota_patterns = self._build_quota_patterns()
        self.category_patterns = self._build_category_patterns()

    def _build_college_patterns(self) -> List[Dict]:
        """Build patterns for college name extraction"""
        return [
            # Medical colleges
            r'\b(?:GOVERNMENT\s+)?(?:MEDICAL\s+COLLEGE|MEDICAL\s+COLLEGE\s+AND\s+HOSPITAL)',
            r'\bGOVT\.?\s+MEDICAL\s+COLLEGE\b',
            r'\bINSTITUTE\s+OF\s+MEDICAL\s+SCIENCES?\b',
            r'\bALL\s+INDIA\s+INSTITUTE\s+OF\s+MEDICAL\s+SCIENCES?\b',
            r'\bAIIMS\b',
            r'\bARMED\s+FORCES\s+MEDICAL\s+COLLEGE\b',
            r'\bAFMC\b',

            # Dental colleges
            r'\bDENTAL\s+COLLEGE(?:\s+AND\s+HOSPITAL)?\b',
            r'\bGOVT\.?\s+DENTAL\s+COLLEGE\b',

            # General patterns
            r'\bCOLLEGE\s+OF\s+(?:MEDICINE|DENTISTRY)\b',
            r'\b[A-Z][A-Za-z]+\s+(?:MEDICAL|DENTAL)\s+COLLEGE\b',

            # Hospital-based
            r'\b(?:[A-Z][A-Za-z]+\s+)+HOSPITAL(?:\s+AND\s+RESEARCH\s+CENTRE)?\b',

            # DNB institutions
            r'\b(?:[A-Z][A-Za-z]+\s+)+(?:HOSPITAL|MEDICAL\s+CENTER|HEALTH\s+CARE)\b',
        ]

    def _build_course_patterns(self) -> List[str]:
        """Build patterns for course extraction"""
        return [
            # UG courses
            r'\bMBBS\b',
            r'\bBDS\b',
            r'\bBACHELOR\s+OF\s+(?:MEDICINE|DENTAL\s+SURGERY)\b',

            # PG courses - Medical
            r'\bMD\s+(?:IN\s+)?[A-Z][A-Za-z\s]+',
            r'\bMS\s+(?:IN\s+)?[A-Z][A-Za-z\s]+',
            r'\bMD/MS\s+(?:IN\s+)?[A-Z][A-Za-z\s]+',
            r'\bDM\s+(?:IN\s+)?[A-Z][A-Za-z\s]+',
            r'\bM\.?CH\.?\s+(?:IN\s+)?[A-Z][A-Za-z\s]+',

            # PG courses - Dental
            r'\bMDS\s+(?:IN\s+)?[A-Z][A-Za-z\s]+',
            r'\bPG\s+DIPLOMA\s+(?:IN\s+)?[A-Z][A-Za-z\s]+',

            # DNB
            r'\bDNB\s+(?:-\s+)?(?:IN\s+)?[A-Z][A-Za-z\s]+',

            # Diploma
            r'\bDIPLOMA\s+(?:IN\s+)?[A-Z][A-Za-z\s]+',
        ]

    def _build_quota_patterns(self) -> Dict[str, List[str]]:
        """Build patterns for quota extraction"""
        return {
            'ALL_INDIA_QUOTA': [r'\bAIQ\b', r'\bALL\s+INDIA\s+QUOTA\b', r'\bALL\s+INDIA\b'],
            'STATE_QUOTA': [r'\bSTATE\s+QUOTA\b', r'\bSQ\b', r'\bIN-?STATE\b'],
            'DEEMED': [r'\bDEEMED\b', r'\bDEEMED\s+UNIVERSITY\b'],
            'MANAGEMENT': [r'\bMANAGEMENT\b', r'\bMANAGEMENT\s+QUOTA\b', r'\bPRIVATE\b'],
            'DNB': [r'\bDNB\b', r'\bNATIONAL\s+BOARD\b'],
            'CENTRAL_POOL': [r'\bCENTRAL\s+POOL\b', r'\bCP\b'],
        }

    def _build_category_patterns(self) -> Dict[str, List[str]]:
        """Build patterns for category extraction"""
        return {
            'GENERAL': [r'\bGENERAL\b', r'\bGEN\b', r'\bOPEN\b', r'\bUR\b'],
            'OBC': [r'\bOBC\b', r'\bOTHER\s+BACKWARD\s+CLASS(?:ES)?\b'],
            'SC': [r'\bSC\b', r'\bSCHEDULED\s+CASTE\b'],
            'ST': [r'\bST\b', r'\bSCHEDULED\s+TRIBE\b'],
            'EWS': [r'\bEWS\b', r'\bECONOMICALLY\s+WEAKER\s+SECTION\b'],
        }

    def extract_colleges(self, text: str) -> List[Dict]:
        """
        Extract college names from text

        Args:
            text: Input text

        Returns:
            List of extracted colleges with metadata
        """
        if not text:
            return []

        extracted = []

        # Use spaCy NER for ORG entities
        doc = self.nlp(text)
        for ent in doc.ents:
            if ent.label_ == 'ORG':
                # Check if it's a medical/dental institution
                for pattern in self.college_patterns:
                    if re.search(pattern, ent.text, re.IGNORECASE):
                        extracted.append({
                            'text': ent.text,
                            'start': ent.start_char,
                            'end': ent.end_char,
                            'type': 'college',
                            'method': 'spacy_org',
                            'confidence': 0.9
                        })
                        break

        # Use regex patterns as fallback
        for pattern in self.college_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                # Avoid duplicates
                is_duplicate = any(
                    abs(e['start'] - match.start()) < 10
                    for e in extracted
                )
                if not is_duplicate:
                    extracted.append({
                        'text': match.group(),
                        'start': match.start(),
                        'end': match.end(),
                        'type': 'college',
                        'method': 'regex_pattern',
                        'confidence': 0.8
                    })

        return extracted

    def extract_courses(self, text: str) -> List[Dict]:
        """
        Extract course names from text

        Args:
            text: Input text

        Returns:
            List of extracted courses
        """
        if not text:
            return []

        extracted = []

        for pattern in self.course_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                course_text = match.group().strip()

                # Determine course type
                course_type = self._classify_course(course_text)

                extracted.append({
                    'text': course_text,
                    'start': match.start(),
                    'end': match.end(),
                    'type': 'course',
                    'course_type': course_type,
                    'confidence': 0.95
                })

        return extracted

    def _classify_course(self, course_text: str) -> str:
        """Classify course type"""
        course_upper = course_text.upper()

        if course_upper.startswith('MBBS'):
            return 'MEDICAL_UG'
        elif course_upper.startswith('BDS'):
            return 'DENTAL_UG'
        elif any(course_upper.startswith(p) for p in ['MD ', 'MS ', 'MD/MS', 'DM ', 'MCH']):
            return 'MEDICAL_PG'
        elif course_upper.startswith('MDS'):
            return 'DENTAL_PG'
        elif course_upper.startswith('DNB'):
            return 'DNB'
        elif 'PG DIPLOMA' in course_upper:
            return 'PG_DIPLOMA'
        elif 'DIPLOMA' in course_upper:
            return 'DIPLOMA'
        else:
            return 'UNKNOWN'

    def extract_locations(self, text: str) -> List[Dict]:
        """
        Extract location entities (states, cities)

        Args:
            text: Input text

        Returns:
            List of locations
        """
        if not text:
            return []

        doc = self.nlp(text)
        locations = []

        for ent in doc.ents:
            if ent.label_ in ['GPE', 'LOC']:  # Geopolitical entity, Location
                locations.append({
                    'text': ent.text,
                    'start': ent.start_char,
                    'end': ent.end_char,
                    'type': 'location',
                    'label': ent.label_,
                    'confidence': 0.85
                })

        return locations

    def extract_quota(self, text: str) -> Optional[str]:
        """
        Extract quota from text

        Args:
            text: Input text

        Returns:
            Quota type or None
        """
        if not text:
            return None

        text_upper = text.upper()

        for quota, patterns in self.quota_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text_upper):
                    return quota

        return None

    def extract_category(self, text: str) -> Optional[str]:
        """
        Extract category from text

        Args:
            text: Input text

        Returns:
            Category or None
        """
        if not text:
            return None

        text_upper = text.upper()

        for category, patterns in self.category_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text_upper):
                    return category

        return None

    def extract_all(self, text: str) -> Dict:
        """
        Extract all entities from text

        Args:
            text: Input text

        Returns:
            Dictionary with all extracted entities
        """
        return {
            'colleges': self.extract_colleges(text),
            'courses': self.extract_courses(text),
            'locations': self.extract_locations(text),
            'quota': self.extract_quota(text),
            'category': self.extract_category(text),
        }

    def parse_counselling_record(self, text: str) -> Dict:
        """
        Parse a counselling record text into structured data

        Args:
            text: Counselling record text (e.g., from Excel cell)

        Returns:
            Structured dictionary
        """
        entities = self.extract_all(text)

        # Extract primary college (first one)
        college_name = entities['colleges'][0]['text'] if entities['colleges'] else None

        # Extract primary course (first one)
        course_name = entities['courses'][0]['text'] if entities['courses'] else None

        # Extract location (state)
        state = entities['locations'][0]['text'] if entities['locations'] else None

        return {
            'college_name': college_name,
            'course_name': course_name,
            'state': state,
            'quota': entities['quota'],
            'category': entities['category'],
            'raw_text': text,
            'all_entities': entities
        }

    def smart_field_extraction(self, record: Dict) -> Dict:
        """
        Smart extraction from partially filled record

        Args:
            record: Record with some fields filled

        Returns:
            Enhanced record with extracted fields
        """
        enhanced = record.copy()

        # Combine all available text
        all_text = ' '.join([
            str(record.get('college_institute', '')),
            str(record.get('course', '')),
            str(record.get('allotted_institute', '')),
            str(record.get('remarks', ''))
        ])

        entities = self.extract_all(all_text)

        # Fill missing fields
        if not enhanced.get('college_name') and entities['colleges']:
            enhanced['college_name'] = entities['colleges'][0]['text']

        if not enhanced.get('course_name') and entities['courses']:
            enhanced['course_name'] = entities['courses'][0]['text']

        if not enhanced.get('state') and entities['locations']:
            enhanced['state'] = entities['locations'][0]['text']

        if not enhanced.get('quota') and entities['quota']:
            enhanced['quota'] = entities['quota']

        if not enhanced.get('category') and entities['category']:
            enhanced['category'] = entities['category']

        return enhanced


# Standalone usage
if __name__ == "__main__":
    # Initialize NER
    ner = EducationNER()

    # Test texts
    test_texts = [
        "GOVT MEDICAL COLLEGE THIRUVANANTHAPURAM, KERALA - MD GENERAL MEDICINE (AIQ, OPEN)",
        "All India Institute of Medical Sciences Delhi - MBBS - All India Quota - SC Category",
        "Christian Medical College Vellore - DNB Cardiology - Management Quota"
    ]

    for text in test_texts:
        print(f"\n{'='*80}")
        print(f"Text: {text}")
        print(f"{'='*80}")

        parsed = ner.parse_counselling_record(text)

        print(f"\nExtracted:")
        print(f"  College: {parsed['college_name']}")
        print(f"  Course: {parsed['course_name']}")
        print(f"  State: {parsed['state']}")
        print(f"  Quota: {parsed['quota']}")
        print(f"  Category: {parsed['category']}")
