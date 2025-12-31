import re

def clean_address_current(address, college_name, state):
    """Current implementation of clean_address for comparison"""
    if not address: return ''
    
    # Mock normalize_text (basic version)
    def normalize(text):
        return str(text).upper().strip()
    
    cleaned = normalize(address)
    college_normalized = normalize(college_name)
    state_normalized = normalize(state)
    
    # Current broken logic
    if college_name:
        if college_normalized:
            cleaned = cleaned.replace(college_normalized, ' ')
    
    if state:
        if state_normalized:
            cleaned = cleaned.replace(state_normalized, ' ')
            
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

def clean_address_improved(address, college_name, state):
    """Improved implementation with deduplication"""
    if not address: return ''
    
    # Basic normalization
    cleaned = str(address).upper().strip()
    college_normalized = str(college_name).upper().strip()
    state_normalized = str(state).upper().strip()
    
    # 1. Remove College Name (Global replace)
    if college_normalized:
        # Escape for regex and ensure boundary or comma/space surroundings
        # Only remove if it's a significant match (len > 3)
        if len(college_normalized) > 3:
             cleaned = re.sub(re.escape(college_normalized), '', cleaned, flags=re.IGNORECASE)

    # 2. Remove State Name (Global replace)
    if state_normalized:
        cleaned = re.sub(re.escape(state_normalized), '', cleaned, flags=re.IGNORECASE)

    # 3. Split by comma and deduplicate segments
    segments = [s.strip() for s in cleaned.split(',')]
    unique_segments = []
    seen = set()
    
    for seg in segments:
        seg_clean = re.sub(r'[^A-Z0-9]', '', seg) # Strict check for duplication
        if not seg_clean: continue # Skip empty
        
        # Skip if segment is just digits/pincode (handled later) or too short
        if seg_clean in seen:
            continue
            
        unique_segments.append(seg)
        seen.add(seg_clean)
    
    # Reassemble
    result = ', '.join(unique_segments)
    
    # 4. Cleanup cleanup
    result = re.sub(r'\s+', ' ', result).strip()
    result = re.sub(r'^[,\s]+', '', result)
    result = re.sub(r'[,\s]+$', '', result)
    
    return result

# Test Data
college = "AREA HOSPITAL"
state = "ANDHRA PRADESH"
raw_address = "ANDHRA PRADESH, NEAR OLD BUSTAND, GUDUR, TIRUPATI DISTRICT, ANDHRA PRADESH, NEAR OLD BUSTAND, GUDUR, TIRUPATI DISTRICT, ANDHRA PRADESH, ANDHRA PRADESH, 524101 (701530)"

print(f"Original Address: {raw_address}\n")

current_result = clean_address_current(raw_address, college, state)
print(f"Current Logic Result:\n{current_result}\n")

improved_result = clean_address_improved(raw_address, college, state)
print(f"Improved Logic Result:\n{improved_result}\n")

expected = "NEAR OLD BUSTAND, GUDUR, TIRUPATI DISTRICT, 524101 (701530)"
print(f"Expected: {expected}")

if expected.replace(',','') in improved_result.replace(',',''): # Loose check
     print("✅ Improved logic matches expectations!")
else:
     print("❌ Improved logic NOT matching yet.")
