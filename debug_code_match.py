import sqlite3
import re
from recent3 import AdvancedSQLiteMatcher
from integrated_5pass_orchestrator import Integrated5PassOrchestrator

def debug_code_match():
    print("--- Debugging Code Match (902791) ---")
    
    # 1. Check Database Record (seat_data)
    print(f"\nSearching for 902791 in seat_data...")
    db_path = "data/seat_data.db"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, college_name, address, normalized_address
        FROM seat_data
        WHERE normalized_address LIKE '%902791%' OR address LIKE '%902791%'
        LIMIT 1
    """)
    row = cursor.fetchone()
    
    if not row:
        print("❌ No record found in seat_data with 902791!")
    else:
        print(f"Found in seat_data (ID: {row['id']})")
        print(f"Raw Address: '{row['address']}'")
        print(f"Norm Address: '{row['normalized_address']}'")

    conn.close()

    # 2. Check Master Data Content
    print(f"\nChecking Master Data Content...")
    matcher = AdvancedSQLiteMatcher()
    matcher.load_master_data()
    
    # Check DNB colleges for 902791
    found_in_master = False
    if 'dnb' in matcher.master_data:
        print(f"DNB Colleges Count: {len(matcher.master_data['dnb']['colleges'])}")
        for i, college in enumerate(matcher.master_data['dnb']['colleges']):
            if i < 3:
                print(f"Sample Master Address {i}: {college.get('address', '')}")
            
            if '902791' in college.get('address', ''):
                print(f"✅ Found 902791 in Master Data: {college['name']}")
                print(f"Address: {college['address']}")
                found_in_master = True
                
                # Test Regex on this address
                codes = re.findall(r'\((\d{6})\)', college['address'])
                print(f"Regex Extraction: {codes}")
                break
    
    if not found_in_master:
        print("❌ 902791 NOT found in Master Data DNB colleges")

    # Check Index again
    print(f"\nIndex Size: {len(matcher.college_code_index)}")
    if '902791' in matcher.college_code_index:
        print(f"✅ Code 902791 found in index!")
    else:
        print(f"❌ Code 902791 NOT found in index!")

    # 3. Test Orchestrator Method
    print(f"\nTesting Orchestrator Method...")
    orch = Integrated5PassOrchestrator()
    # Manually inject master_colleges since we are not running full workflow
    orch.master_colleges = list(matcher.master_data['dnb']['colleges']) # Assuming DNB
    # Also need to set recent3_matcher
    orch.recent3_matcher = matcher
    
    test_address = "ANDAMAN AND NICOBAR, DHS ANNEXE BUILDING, ATLANTA POINT, PORT BLAIR, SOUTH ANDAMAN, DHS ANNEXE BUILDING, ATLANTA POINT, PORT BLAIR, SOUTH ANDAMAN, ANDAMAN AND NICOBAR ISLANDS, 744104 (902791)"
    
    match, success = orch._pass0_code_match(
        test_address, 
        "ANDAMAN AND NICOBAR ISLANDS INSTITUTE OF MEDICAL SCIENCES", 
        "ANDAMAN AND NICOBAR ISLANDS", 
        "DNB"
    )
    print(f"Orchestrator Match Result: {match}, Success: {success}")

if __name__ == "__main__":
    debug_code_match()
