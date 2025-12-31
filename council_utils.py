import re
from typing import Dict, Any, List, Optional

class TheCleaner:
    """
    The Preprocessor for the Council of Matchers.
    Responsible for sanitizing input data, extracting signals, and normalizing names.
    """
    
    def __init__(self):
        self.noise_patterns = [
            r'\bO/O\b', r'\bOFFICE OF\b', r'\bDEAN\b', r'\bPRINCIPAL\b', 
            r'\bDIRECTOR\b', r'\bSUPERINTENDENT\b', r'\bMEDICAL SUPERINTENDENT\b',
            r'\bTHE DEAN\b', r'\bTHE PRINCIPAL\b'
        ]
        
        self.email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        self.url_pattern = r'\b(?:http|https)://[^\s]+|www\.[^\s]+\b'
        self.pincode_pattern = r'\b\d{6}\b'
        self.std_code_pattern = r'\b0\d{2,4}\b' # Simple STD code detection
        
        self.replacements = {
            r'\bGOVT\.?\b': 'GOVERNMENT',
            r'\bHOSP\.?\b': 'HOSPITAL',
            r'\bCOLL\.?\b': 'COLLEGE',
            r'\bINST\.?\b': 'INSTITUTE',
            r'\bMED\.?\b': 'MEDICAL',
            r'\bSCI\.?\b': 'SCIENCES',
            r'\bKIMS\b': 'KRISHNA INSTITUTE OF MEDICAL SCIENCES',
            r'\bRIMS\b': 'REGIONAL INSTITUTE OF MEDICAL SCIENCES',
            r'\bMIMS\b': 'MANDYA INSTITUTE OF MEDICAL SCIENCES',
            r'\bRES\.?\b': 'RESEARCH',
            r'\bMEM\.?\b': 'MEMORIAL',
            r'\bGEN\.?\b': 'GENERAL',
            r'\bDIST\.?\b': 'DISTRICT',
            r'\bHQ\b': 'HEADQUARTERS',
            r'\bHEAD QUARTERS\b': 'HEADQUARTERS',
            r'\bPVT\.?\b': 'PRIVATE',
            r'\bLTD\.?\b': 'LIMITED'
        }

    def clean_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Clean and enrich a record (Query or Candidate).
        Returns a new dictionary with 'cleaned_data' and 'signals'.
        """
        original_name = record.get('college_name', '') or record.get('name', '')
        original_address = record.get('address', '') or ''
        
        # 1. Extract Signals
        signals = self._extract_signals(original_address)
        
        # 2. Clean Address
        cleaned_address = self._clean_text(original_address, remove_signals=True)
        
        # 3. Clean Name
        cleaned_name = self._clean_text(original_name)
        normalized_name = self._normalize_name(cleaned_name)
        core_name = self._extract_core_name(normalized_name)
        
        return {
            'original': record,
            'cleaned_name': cleaned_name,
            'normalized_name': normalized_name,
            'core_name': core_name,
            'cleaned_address': cleaned_address,
            'signals': signals
        }

    def _extract_signals(self, text: str) -> Dict[str, Any]:
        if not text:
            return {'emails': [], 'urls': [], 'pincodes': [], 'std_codes': []}
            
        emails = re.findall(self.email_pattern, text)
        urls = re.findall(self.url_pattern, text)
        
        # STD codes are tricky, often part of phone numbers. 
        # For now, just simple extraction if standalone or start of string
        # This needs refinement.
        std_codes = [] 
        
        # 4. Extract College Codes (6 digits in brackets, e.g. (902791))
        # This is a specific signal for the new master data format
        college_codes = re.findall(r'\((\d{6})\)', text)
        
        # 5. Extract Pincodes (6 digits, NOT in brackets)
        # We use a negative lookbehind/lookahead to ensure it's not part of the college code
        # But simpler: Remove college codes from text first, then find pincodes
        text_no_codes = re.sub(r'\(\d{6}\)', '', text)
        pincodes = re.findall(r'\b\d{6}\b', text_no_codes)
        
        return {
            'emails': emails,
            'urls': urls,
            'pincodes': pincodes,
            'college_codes': college_codes,
            'std_codes': std_codes
        }

    def _clean_text(self, text: str, remove_signals: bool = False) -> str:
        if not text: return ""
        
        cleaned = text.upper()
        
        # Remove signals if requested (to clean up address for Geographer)
        if remove_signals:
            cleaned = re.sub(self.email_pattern, '', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(self.url_pattern, '', cleaned, flags=re.IGNORECASE)
            # Remove College Codes (in brackets)
            cleaned = re.sub(r'\(\d{6}\)', '', cleaned)
            # Remove Pincodes (standalone 6 digits)
            cleaned = re.sub(self.pincode_pattern, '', cleaned)
            
        # Remove Noise
            
        # Remove Noise
        for pattern in self.noise_patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
            
        # Remove special chars (keep alphanumeric, commas, spaces, hyphens)
        cleaned = re.sub(r'[^A-Z0-9\s,-]', ' ', cleaned)
        
        # Collapse spaces
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        return cleaned

    def _normalize_name(self, name: str) -> str:
        normalized = name
        for pattern, replacement in self.replacements.items():
            normalized = re.sub(pattern, replacement, normalized, flags=re.IGNORECASE)
        return normalized

    def _extract_core_name(self, name: str) -> str:
        """
        Extracts the 'Core' name by removing generic terms.
        e.g. "Gandhi Medical College" -> "GANDHI"
        e.g. "District Hospital" -> "DISTRICT HOSPITAL" (if only generic)
        """
        generic_terms = {
            'GOVERNMENT', 'MEDICAL', 'COLLEGE', 'HOSPITAL', 'INSTITUTE', 'SCIENCES', 
            'RESEARCH', 'CENTRE', 'CENTER', 'GENERAL', 'DISTRICT', 'MEMORIAL', 
            'PRIVATE', 'LIMITED', 'TRUST', 'SOCIETY', 'FOUNDATION', 'UNIVERSITY',
            'AND', 'OF', 'THE', 'AT', 'IN', ',', '.', '-', 'DEPT', 'DEPARTMENT'
        }
        
        # Remove punctuation for tokenization
        clean_name = re.sub(r'[^\w\s]', ' ', name)
        tokens = clean_name.split()
        core_tokens = [t for t in tokens if t not in generic_terms]
        
        if not core_tokens:
            return name # Fallback if everything is generic
            
        return " ".join(core_tokens)

    def extract_city(self, address: str) -> Optional[str]:
        """
        Extracts city from address using heuristic (last meaningful word).
        """
        if not address: return None
        
        # Normalize
        tokens = re.findall(r'\b[A-Za-z]+\b', address.upper())
        if not tokens: return None
        
        STOP_WORDS = {
            'ROAD', 'RD', 'ST', 'STREET', 'MARG', 'LANE', 'PATH', 'HIGHWAY', 'EXPRESSWAY',
            'NAGAR', 'COLONY', 'ENCLAVE', 'SOCIETY', 'APARTMENT', 'FLAT', 'HOUSE',
            'HOSPITAL', 'COLLEGE', 'INSTITUTE', 'CENTRE', 'CENTER', 'CLINIC', 'TRUST', 'FOUNDATION',
            'OPP', 'NEAR', 'BEHIND', 'BESIDE', 'NEXT', 'TO',
            'SECTOR', 'PHASE', 'BLOCK', 'PLOT', 'NO',
            'DIST', 'DISTRICT', 'TALUKA', 'TEHSIL', 'PO', 'PS',
            'AT', 'POST', 'VIA', 'OFF',
            # States
            'ANDHRA', 'PRADESH', 'ARUNACHAL', 'ASSAM', 'BIHAR', 'CHHATTISGARH', 'GOA', 'GUJARAT',
            'HARYANA', 'HIMACHAL', 'JHARKHAND', 'KARNATAKA', 'KERALA', 'MADHYA', 'MAHARASHTRA',
            'MANIPUR', 'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'PUNJAB', 'RAJASTHAN',
            'SIKKIM', 'TAMIL', 'NADU', 'TELANGANA', 'TRIPURA', 'UTTAR', 'UTTARAKHAND', 'WEST', 'BENGAL',
            'DELHI', 'JAMMU', 'KASHMIR', 'LADAKH', 'PUDUCHERRY', 'INDIA',
            'EMAIL', 'WEBSITE', 'WEB', 'MAIL', 'CONTACT', 'PH', 'PHONE', 'TEL', 'FAX'
        }
        
        # Look at the last 5 tokens (excluding very short ones)
        candidates = [t for t in reversed(tokens) if len(t) > 2]
        
        # print(f"DEBUG: City Candidates: {candidates[:5]}")
        
        for token in candidates[:5]: # Limit search depth
            if token not in STOP_WORDS:
                # print(f"DEBUG: Found City: {token}")
                return token
                
        return None
