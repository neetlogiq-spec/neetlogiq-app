import logging
from integrated_5pass_orchestrator import Integrated5PassOrchestrator
from rich.console import Console

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("Integrated5PassOrchestrator")

def debug_orchestrator_state():
    console = Console()
    console.print("[bold cyan]🔍 Debugging Orchestrator State for Islampur...[/bold cyan]")
    
    # 1. Initialize Orchestrator
    orch = Integrated5PassOrchestrator(seat_db_path="data/sqlite/seat_data.db")
    
    # 2. Load Master Data (simulate process_matching start)
    console.print("Loading Master Data...")
    orch.recent3_matcher.load_master_data()
    
    orch.master_colleges = []
    if 'medical' in orch.recent3_matcher.master_data:
        orch.master_colleges.extend(orch.recent3_matcher.master_data['medical']['colleges'])
    if 'dental' in orch.recent3_matcher.master_data:
        orch.master_colleges.extend(orch.recent3_matcher.master_data['dental']['colleges'])
    if 'dnb' in orch.recent3_matcher.master_data:
        orch.master_colleges.extend(orch.recent3_matcher.master_data['dnb']['colleges'])
        
    console.print(f"Master Colleges Count: {len(orch.master_colleges)}")
    
    # 3. Check Index
    index = orch.recent3_matcher.college_code_index
    console.print(f"College Code Index Size: {len(index)}")
    
    code = "701443"
    if code in index:
        console.print(f"✅ Code {code} found in index! IDs: {index[code]}")
    else:
        console.print(f"❌ Code {code} NOT found in index!")
        return

    # 4. Check Master Colleges for ID
    target_id = "DNB1175"
    found_in_master = False
    for col in orch.master_colleges:
        if col['id'] == target_id:
            found_in_master = True
            console.print(f"✅ Found {target_id} in master_colleges: {col['name']}")
            break
    
    if not found_in_master:
        console.print(f"❌ {target_id} NOT found in master_colleges!")
        return

    # 5. Test _pass0_code_match
    query_name = "ISLAMPUR SDH/ ISSH"
    query_state = "WEST BENGAL"
    query_address = "ISLAMPUR, WEST BENGAL, ISLAMPUR SUPER SPECIALTY HOSPITAL, SUKANTAPALLY, ISLAMPUR, UTTAR DINAJPUR, ISLAMPUR SUPER SPECIALTY HOSPITAL, SUKANTAPALLY, ISLAMPUR, UTTAR DINAJPUR, WEST BENGAL, 733202 (701443)"
    
    console.print(f"\nTesting _pass0_code_match for: {query_name}")
    match, success = orch._pass0_code_match(query_address, query_name, query_state, "DNB")
    
    if success:
        console.print(f"✅ Match Success: {match['name']} (ID: {match['id']})")
    else:
        console.print("❌ Match Failed!")
        
        # Debug why
        candidates, filtered, reason = orch._get_filtered_candidates_by_code(query_address, orch.master_colleges)
        console.print(f"  Filtering Result: {len(candidates)} candidates. Reason: {reason}")
        
        for cand in candidates:
            from rapidfuzz import fuzz
            name_sim = fuzz.ratio(query_name.upper(), cand['name'].upper()) / 100.0
            console.print(f"  Candidate: {cand['name']}")
            console.print(f"  Name Similarity: {name_sim}")
            
            state_upper = query_state.upper()
            c_state = cand.get('state', '').upper()
            c_addr = cand.get('address', '').upper()
            addr_match = (state_upper == c_state or state_upper in c_addr)
            console.print(f"  Address Match: {addr_match} (State: {c_state})")

if __name__ == "__main__":
    debug_orchestrator_state()
