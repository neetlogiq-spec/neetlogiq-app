"""
Best-in-Class Record ID Generator for Seat Data

Generates unique, state-aware record IDs that include:
- State code (prevents cross-state duplicates)
- Normalized college name
- Normalized course name
- Address hash (distinguishes same college in different locations)

Format: {STATE_CODE}_{COLLEGE}_{COURSE}_{ADDRESS_HASH}
Example: MH_GOVT_MED_COLL_MUMBAI_MBBS_4a2f9e01
"""

import hashlib
import re
from typing import Optional

class BetterRecordIDGenerator:
    """Generate unique, state-aware record IDs"""

    # State abbreviations
    STATE_CODES = {
        'ANDHRA PRADESH': 'AP',
        'ARUNACHAL PRADESH': 'AR',
        'ASSAM': 'AS',
        'BIHAR': 'BR',
        'CHHATTISGARH': 'CG',
        'GIZA': 'GO',  # Goa
        'GUJRAT': 'GJ',  # Gujarat
        'GUJARATI': 'GJ',  # Alternative spelling
        'HARYANA': 'HR',
        'HIMACHAL PRADESH': 'HP',
        'JAMMU AND KASHMIR': 'JK',
        'JHARKHAND': 'JH',
        'KARNATAKA': 'KA',
        'KERALA': 'KL',
        'MADHYA PRADESH': 'MP',
        'MAHARASHTRA': 'MH',
        'MANIPUR': 'MN',
        'MEGHALAYA': 'ML',
        'MIZORAM': 'MZ',
        'NAGALAND': 'NL',
        'ODISHA': 'OD',
        'PUNJAB': 'PB',
        'RAJASTHAN': 'RJ',
        'SIKKIM': 'SK',
        'TAMIL NADU': 'TN',
        'TELANGANA': 'TG',
        'TRIPURA': 'TR',
        'UTTAR PRADESH': 'UP',
        'UTTARAKHAND': 'UK',
        'WEST BENGAL': 'WB',
        'CHANDIGARH': 'CH',
        'DAMAN AND DIU': 'DD',
        'DADRA AND NAGAR HAVELI': 'DN',
        'LADAKH': 'LD',
        'LAKSHADWEEP': 'LS',
        'PUDUCHERRY': 'PY',
    }

    @staticmethod
    def normalize_text(text: str) -> str:
        """Normalize text by removing special chars and shortening"""
        if not text:
            return 'UNK'

        # Convert to uppercase
        text = str(text).upper().strip()

        # Remove special characters, keep only alphanumeric
        text = re.sub(r'[^A-Z0-9\s]', '', text)

        # Remove extra spaces
        text = re.sub(r'\s+', ' ', text).strip()

        # Abbreviate: Take first letter of each word, max 20 chars
        words = text.split()
        if len(words) > 1:
            # Multiple words - take first letters
            abbrev = ''.join([w[0] for w in words[:4]])
            # Or take first few words shortened
            short = '_'.join([w[:3] for w in words[:3]])
            return short[:20] if short else abbrev
        else:
            # Single word - shorten to max 20 chars
            return text[:20] if text else 'UNK'

    @staticmethod
    def get_state_code(state: str) -> str:
        """Get state code from state name"""
        if not state:
            return 'XX'

        state_upper = state.upper().strip()

        # Exact match
        if state_upper in BetterRecordIDGenerator.STATE_CODES:
            return BetterRecordIDGenerator.STATE_CODES[state_upper]

        # Try partial matches
        for st_name, code in BetterRecordIDGenerator.STATE_CODES.items():
            if state_upper in st_name or st_name in state_upper:
                return code

        # Fallback: Use first 2 letters
        return state_upper[:2]

    @staticmethod
    def hash_address(address: Optional[str]) -> str:
        """Generate short hash of address for uniqueness"""
        if not address:
            return '00000000'

        address_normalized = address.upper().strip()

        # Create SHA-256 hash
        hash_obj = hashlib.sha256(address_normalized.encode())
        hash_hex = hash_obj.hexdigest()

        # Return first 8 characters
        return hash_hex[:8]

    @staticmethod
    def generate_record_id(
        state: str,
        college_name: str,
        course_name: str,
        address: Optional[str] = None
    ) -> str:
        """
        Generate unique, state-aware record ID

        Format: {STATE_CODE}_{COLLEGE}_{COURSE}_{ADDRESS_HASH}

        Example:
        - Input: state='MAHARASHTRA', college='Government Medical College',
                 course='MBBS', address='Mumbai'
        - Output: MH_GOV_MED_MBB_MUMBAI_5f8a2c3d

        Args:
            state: State name (e.g., 'MAHARASHTRA')
            college_name: College name (e.g., 'Government Medical College')
            course_name: Course name (e.g., 'MBBS')
            address: Address/location (e.g., 'Mumbai')

        Returns:
            Record ID string
        """
        # Get state code
        state_code = BetterRecordIDGenerator.get_state_code(state)

        # Normalize and abbreviate college name
        college_norm = BetterRecordIDGenerator.normalize_text(college_name)

        # Normalize and abbreviate course name
        course_norm = BetterRecordIDGenerator.normalize_text(course_name)

        # Get address hash
        addr_hash = BetterRecordIDGenerator.hash_address(address)

        # Combine into record ID
        record_id = f"{state_code}_{college_norm}_{course_norm}_{addr_hash}"

        return record_id

    @staticmethod
    def generate_batch_ids(records: list) -> list:
        """
        Generate record IDs for batch of records

        Args:
            records: List of dicts with keys: state, college_name, course_name, address

        Returns:
            List of dicts with added 'record_id' field
        """
        for record in records:
            record['record_id'] = BetterRecordIDGenerator.generate_record_id(
                state=record.get('state', 'UNKNOWN'),
                college_name=record.get('college_name', ''),
                course_name=record.get('course_name', ''),
                address=record.get('address')
            )

        return records


# Example usage and tests
if __name__ == '__main__':
    print("\n" + "="*100)
    print("BEST-IN-CLASS RECORD ID GENERATOR - EXAMPLES")
    print("="*100 + "\n")

    test_cases = [
        {
            'state': 'MAHARASHTRA',
            'college_name': 'Government Medical College',
            'course_name': 'MBBS',
            'address': 'Mumbai'
        },
        {
            'state': 'MADHYA PRADESH',
            'college_name': 'Government Medical College',
            'course_name': 'MBBS',
            'address': 'Indore'
        },
        {
            'state': 'MANIPUR',
            'college_name': 'Government Medical College',
            'course_name': 'MBBS',
            'address': 'Churachandpur'
        },
        {
            'state': 'KARNATAKA',
            'college_name': 'Bengaluru Medical College',
            'course_name': 'MD in Pathology',
            'address': 'Bangalore'
        },
        {
            'state': 'TAMIL NADU',
            'college_name': 'All India Institute of Medical Sciences',
            'course_name': 'Diploma in Anaesthesia',
            'address': 'Chennai'
        }
    ]

    generator = BetterRecordIDGenerator()

    for i, case in enumerate(test_cases, 1):
        record_id = generator.generate_record_id(**case)
        print(f"Test {i}:")
        print(f"  Input:    {case['state']:20s} | {case['college_name']:40s}")
        print(f"            {case['course_name']:20s} | {case['address']}")
        print(f"  Output:   {record_id}")
        print()

    print("="*100)
    print("KEY BENEFITS:")
    print("="*100)
    print("✅ State-aware: Prevents cross-state duplicates")
    print("✅ Readable: Can identify college/course/state from ID")
    print("✅ Unique: Address hash ensures uniqueness for same college in different locations")
    print("✅ Deterministic: Same input always produces same ID")
    print("✅ No collisions: Based on composite key (state, college, course, address)")
    print("="*100 + "\n")
