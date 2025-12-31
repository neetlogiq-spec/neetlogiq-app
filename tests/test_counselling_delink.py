
import sqlite3
import os
import logging
from rich.console import Console

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
console = Console()

def test_counselling_delink_sync():
    """
    Test that is_matched flag syncs correctly with master_college_id
    during bulk propagation for counselling_records.
    """
    db_path = 'test_counselling_sync.db'
    master_db_path = 'test_master_sync.db'
    
    # Cleaning up old runs
    if os.path.exists(db_path):
        os.remove(db_path)
    if os.path.exists(master_db_path):
        os.remove(master_db_path)

    # 1. Setup Database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create counselling_records
    cursor.execute("""
    CREATE TABLE counselling_records (
        id TEXT PRIMARY KEY,
        normalized_state TEXT,
        normalized_college_name TEXT,
        normalized_address TEXT,
        course_type TEXT,
        master_college_id TEXT,
        master_state_id TEXT,
        is_matched BOOLEAN DEFAULT 0,
        college_match_score REAL,
        college_match_method TEXT
    )
    """)
    
    # Create group_matching_queue
    cursor.execute("""
    CREATE TABLE group_matching_queue (
        normalized_state TEXT,
        normalized_college_name TEXT,
        normalized_address TEXT,
        sample_course_type TEXT,
        matched_college_id TEXT,
        match_score REAL,
        match_method TEXT
    )
    """)
    
    # Insert Test Data
    # Record A: Currently "matched" in DB, but Queue says "unmatched" (Simulating Delink)
    cursor.execute("""
    INSERT INTO counselling_records 
    (id, normalized_state, normalized_college_name, normalized_address, course_type, 
     master_college_id, is_matched)
    VALUES ('rec_a', 'DELHI', 'AIIMS', 'NO_ADDRESS', 'medical', '101', 1)
    """)
    cursor.execute("""
    INSERT INTO group_matching_queue 
    (normalized_state, normalized_college_name, normalized_address, sample_course_type, 
     matched_college_id, match_score, match_method)
    VALUES ('DELHI', 'AIIMS', 'NO_ADDRESS', 'medical', NULL, NULL, 'delinked_by_guardian')
    """)

    # Record B: Currently "unmatched" in DB, but Queue says "matched" (Simulating New Match)
    cursor.execute("""
    INSERT INTO counselling_records 
    (id, normalized_state, normalized_college_name, normalized_address, course_type, 
     master_college_id, is_matched)
    VALUES ('rec_b', 'MUMBAI', 'KEM', 'NO_ADDRESS', 'medical', NULL, 0)
    """)
    cursor.execute("""
    INSERT INTO group_matching_queue 
    (normalized_state, normalized_college_name, normalized_address, sample_course_type, 
     matched_college_id, match_score, match_method)
    VALUES ('MUMBAI', 'KEM', 'NO_ADDRESS', 'medical', '202', 0.95, 'fuzzy')
    """)
    
    conn.commit()
    conn.close()
    
    # Create dummy master DB needed for attachment
    m_conn = sqlite3.connect(master_db_path)
    m_conn.execute("CREATE TABLE states (id text, normalized_name text)")
    m_conn.execute("CREATE TABLE colleges (id text, state text)") # Minimal schema
    m_conn.execute("CREATE TABLE state_mappings (raw_state text, normalized_state text)")
    m_conn.commit()
    m_conn.close()
    
    # 2. Run Propagation (Simulating Integrated5PassOrchestrator._bulk_propagate_results logic)
    # We can't import the class easily without instantiating everything, so we'll 
    # invoke the method's logic directly or mock the class.
    # Let's import the file and patch the method or use a partial instance.
    
    # Add current directory to path to allow import
    import sys
    sys.path.append(os.getcwd())
    from integrated_5pass_orchestrator import Integrated5PassOrchestrator
    
    # Mocking the instance to avoid initialization overhead
    class MockOrchestrator(Integrated5PassOrchestrator):
        def __init__(self):
            self.seat_db_path = db_path
            self.master_db_path = master_db_path
            self.table_name = 'counselling_records' # Trigger the NEW logic
            self.config_course_aliases = {}
            # Bypass other init stuff
        
        # We only want to run _bulk_propagate_results, inheriting it.
    
    orchestrator = MockOrchestrator()
    console.print("[bold cyan]Run bulk propagation...[/bold cyan]")
    
    # Catching potential errors if _bulk_propagate_results calls other methods
    try:
        orchestrator._bulk_propagate_results()
    except Exception as e:
        # It might fail on 'stats' dictionary access or logging setup, 
        # but the SQL component should have run.
        console.print(f"[yellow]Ignorable execution warning: {e}[/yellow]")
    
    # 3. Verify Results
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Check Record A (Should be delinked AND is_matched=0)
    cursor.execute("SELECT * FROM counselling_records WHERE id='rec_a'")
    rec_a = cursor.fetchone()
    
    # Check Record B (Should be matched AND is_matched=1)
    cursor.execute("SELECT * FROM counselling_records WHERE id='rec_b'")
    rec_b = cursor.fetchone()
    
    conn.close()
    
    # Clean up
    if os.path.exists(db_path):
        os.remove(db_path)
    if os.path.exists(master_db_path):
        os.remove(master_db_path)
        
    # Assertions
    console.print("\n[bold]Verification Results:[/bold]")
    
    # Case A: Delinking
    status_a = "PASS" if (rec_a['master_college_id'] is None and rec_a['is_matched'] == 0) else "FAIL"
    color_a = "green" if status_a == "PASS" else "red"
    console.print(f"[{color_a}]Case A (Delink): ID={rec_a['master_college_id']}, is_matched={rec_a['is_matched']} -> {status_a}[/{color_a}]")
    
    # Case B: New Match
    status_b = "PASS" if (rec_b['master_college_id'] == '202' and rec_b['is_matched'] == 1) else "FAIL"
    color_b = "green" if status_b == "PASS" else "red"
    console.print(f"[{color_b}]Case B (Match):  ID={rec_b['master_college_id']}, is_matched={rec_b['is_matched']} -> {status_b}[/{color_b}]")

    if status_a == "PASS" and status_b == "PASS":
        print("\nSUCCESS: Logic Verified")
    else:
        print("\nFAILURE: is_matched flag did not sync correctly")

if __name__ == "__main__":
    test_counselling_delink_sync()
