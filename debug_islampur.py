import sqlite3
from recent3 import AdvancedSQLiteMatcher
from integrated_5pass_orchestrator import Integrated5PassOrchestrator

def debug_islampur():
    print("--- Debugging Islampur (Group 1175) ---")
    
    # 1. Load Master Data
    matcher = AdvancedSQLiteMatcher()
    matcher.load_master_data()
    
    # 2. Test Matching
    orch = Integrated5PassOrchestrator()
    orch.master_colleges = []
    # Flatten master colleges for orchestrator
    for stream in ['medical', 'dental', 'dnb']:
        if stream in matcher.master_data:
            orch.master_colleges.extend(matcher.master_data[stream]['colleges'])
            
    orch.recent3_matcher = matcher
    
    query_name = "ISLAMPUR SDH/ ISSH"
    query_state = "WEST BENGAL"
    query_address = "ISLAMPUR, WEST BENGAL, ISLAMPUR SUPER SPECIALTY HOSPITAL, SUKANTAPALLY, ISLAMPUR, UTTAR DINAJPUR, ISLAMPUR SUPER SPECIALTY HOSPITAL, SUKANTAPALLY, ISLAMPUR, UTTAR DINAJPUR, WEST BENGAL, 733202 (701443)"
    
    print(f"\nQuery Name: {query_name}")
    print(f"Query Address: {query_address}")
    
    # Test Pass 0.5
    print("\n--- Testing Pass 0.5 (Code Match) ---")
    match, success = orch._pass0_code_match(
        query_address, query_name, query_state, "DNB"
    )
    
    if success:
        print(f"✅ Pass 0.5 Matched: {match['name']} (ID: {match['id']})")
    else:
        print("❌ Pass 0.5 Failed!")

if __name__ == "__main__":
    debug_islampur()
