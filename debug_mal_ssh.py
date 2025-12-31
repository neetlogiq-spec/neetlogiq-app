import sqlite3
from recent3 import AdvancedSQLiteMatcher
from integrated_5pass_orchestrator import Integrated5PassOrchestrator
from rapidfuzz import fuzz

def debug_mal_ssh():
    print("--- Debugging MAL SSH (Group 1185, Code 701454) ---")
    
    # 1. Load Master Data
    matcher = AdvancedSQLiteMatcher()
    matcher.load_master_data()
    
    # 2. Check Index
    code = "701454"
    if code in matcher.college_code_index:
        print(f"✅ Code {code} found in index! IDs: {matcher.college_code_index[code]}")
    else:
        print(f"❌ Code {code} NOT found in index!")
        return
    
    # 3. Find Master College
    target_id = "DNB1185"
    master_college = None
    for stream in ['medical', 'dental', 'dnb']:
        if stream in matcher.master_data:
            for col in matcher.master_data[stream]['colleges']:
                if col['id'] == target_id:
                    master_college = col
                    break
    
    if master_college:
        print(f"✅ Master College: {master_college['name']}")
        print(f"   State: {master_college.get('state', 'N/A')}")
        print(f"   Address: {master_college.get('address', 'N/A')[:100]}...")
    else:
        print(f"❌ Master College {target_id} NOT found!")
        return
    
    # 4. Get Seat Data for Group 1185
    db_path = "data/sqlite/seat_data.db"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT group_id, normalized_state, normalized_college_name, normalized_address,
               state, college_name, address
        FROM group_matching_queue
        WHERE group_id = 1185
    """)
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        print(f"❌ Group 1185 NOT found in group_matching_queue!")
        return
    
    print(f"\n--- Seat Data for Group 1185 ---")
    print(f"Raw Name: '{row['college_name']}'")
    print(f"Normalized Name: '{row['normalized_college_name']}'")
    print(f"Raw State: '{row['state']}'")
    print(f"Normalized State: '{row['normalized_state']}'")
    print(f"Raw Address: '{row['address'][:100]}...'")
    
    # 5. Test Name Similarity
    raw_name = row['college_name']
    norm_name = row['normalized_college_name']
    master_name = master_college['name']
    
    print(f"\n--- Name Similarity Tests ---")
    print(f"Raw Name vs Master: fuzz.ratio = {fuzz.ratio(raw_name.upper(), master_name.upper())}")
    print(f"Raw Name vs Master: fuzz.token_set_ratio = {fuzz.token_set_ratio(raw_name.upper(), master_name.upper())}")
    print(f"Norm Name vs Master: fuzz.ratio = {fuzz.ratio(norm_name.upper(), master_name.upper())}")
    print(f"Norm Name vs Master: fuzz.token_set_ratio = {fuzz.token_set_ratio(norm_name.upper(), master_name.upper())}")
    
    # 6. Test State Match
    raw_state = row['state']
    norm_state = row['normalized_state']
    master_state = master_college.get('state', '')
    master_addr = master_college.get('address', '')
    
    print(f"\n--- State Validation Tests ---")
    print(f"Raw State: '{raw_state}'")
    print(f"Norm State: '{norm_state}'")
    print(f"Master State: '{master_state}'")
    print(f"Raw State == Master State: {raw_state.upper() == master_state.upper()}")
    print(f"Norm State == Master State: {norm_state.upper() == master_state.upper()}")
    print(f"Raw State in Master Addr: {raw_state.upper() in master_addr.upper()}")
    
    # 7. Test Pass 0.5 directly
    print(f"\n--- Testing Pass 0.5 Directly ---")
    orch = Integrated5PassOrchestrator(seat_db_path=db_path)
    orch.recent3_matcher = matcher
    orch.master_colleges = []
    for stream in ['medical', 'dental', 'dnb']:
        if stream in matcher.master_data:
            orch.master_colleges.extend(matcher.master_data[stream]['colleges'])
    
    raw_address = row['address']
    
    # Strategy 1: Norm Name + Norm State
    match1, success1 = orch._pass0_code_match(raw_address, norm_name, norm_state, "DNB")
    print(f"Strategy 1 (Norm Name + Norm State): {success1}")
    
    # Strategy 2: Raw Name + Norm State
    match2, success2 = orch._pass0_code_match(raw_address, raw_name, norm_state, "DNB")
    print(f"Strategy 2 (Raw Name + Norm State): {success2}")
    
    # Strategy 3: Raw Name + Raw State
    match3, success3 = orch._pass0_code_match(raw_address, raw_name, raw_state.strip(), "DNB")
    print(f"Strategy 3 (Raw Name + Raw State): {success3}")

if __name__ == "__main__":
    debug_mal_ssh()
