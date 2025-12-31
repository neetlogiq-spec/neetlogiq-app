import sqlite3
from recent3 import AdvancedSQLiteMatcher
from integrated_5pass_orchestrator import Integrated5PassOrchestrator

def debug_zoi():
    print("--- Debugging Zoi Hospital (Group 2057) ---")
    
    # 1. Load Master Data for Zoi
    matcher = AdvancedSQLiteMatcher()
    matcher.load_master_data()
    
    zoi_master = None
    if 'dnb' in matcher.master_data:
        for col in matcher.master_data['dnb']['colleges']:
            if col['id'] == 'DNB1036':
                zoi_master = col
                break
    
    if zoi_master:
        print(f"✅ Found Master Record: {zoi_master['name']} (ID: {zoi_master['id']})")
        print(f"Master Address: '{zoi_master.get('address', '')}'")
    else:
        print("❌ Master Record DNB1036 not found!")
        return

    # 2. Test Matching
    orch = Integrated5PassOrchestrator()
    orch.master_colleges = list(matcher.master_data['dnb']['colleges'])
    orch.recent3_matcher = matcher
    
    query_name = "ZOI HOSPITAL"
    query_state = "TELANGANA"
    query_address = "(A UNIT OF PANCHVAID HEALTHCARE SERVICES PVT. LTD) #, ZOI HOSPITAL, BESIDE HSBC BANK, RAJ BHAVAN ROAD, 500082 ,ZOI HOSPITAL, BESIDE HSBC BANK, RAJ BHAVAN ROAD, 500082, TELANGANA"
    
    print(f"\nQuery Name: {query_name}")
    print(f"Query Address: {query_address}")
    
    # Test Pass 0 (Composite Key)
    print("\n--- Testing Pass 0 (Composite Key) ---")
    # Need to generate composite key first
    # But Pass 0 uses keyword overlap.
    # Let's call _pass0_composite_key_matching directly if we can simulate composite key
    # Or just check keyword overlap manually
    
    # Check Pass 1-2
    print("\n--- Testing Pass 1-2 ---")
    match, score, method = orch._pass1_2_orchestrator_matching(
        query_name, query_state, "DNB", "Some Course", query_address
    )
    print(f"Pass 1-2 Result: {match['name'] if match else 'None'}, Score: {score}, Method: {method}")

if __name__ == "__main__":
    debug_zoi()
