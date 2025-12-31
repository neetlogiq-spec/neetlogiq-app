import sqlite3
from rapidfuzz import fuzz
import pandas as pd

def verify_hypothesis():
    # Connect to databases
    seat_conn = sqlite3.connect('data/sqlite/seat_data.db')
    seat_conn.row_factory = sqlite3.Row
    master_conn = sqlite3.connect('data/sqlite/master_data.db')
    master_conn.row_factory = sqlite3.Row
    
    # Get unmatched records
    cursor = seat_conn.cursor()
    cursor.execute("""
        SELECT group_id, normalized_college_name, normalized_state, normalized_address 
        FROM group_matching_queue 
        WHERE matched_college_id IS NULL
    """)
    unmatched = [dict(row) for row in cursor.fetchall()]
    
    print(f"Analyzing {len(unmatched)} unmatched records...")
    
    potential_matches = 0
    
    for record in unmatched:
        name = record['normalized_college_name']
        state = record['normalized_state']
        
        # Search in master DB
        m_cursor = master_conn.cursor()
        
        # Search all tables
        candidates = []
        for table in ['medical_colleges', 'dental_colleges', 'dnb_colleges']:
            m_cursor.execute(f"""
                SELECT id, name, normalized_name, state, normalized_state, address
                FROM {table}
                WHERE UPPER(normalized_state) = UPPER(?)
            """, (state,))
            
            for row in m_cursor.fetchall():
                m_name = row['normalized_name'] if row['normalized_name'] else row['name']
                
                # Check similarity
                ratio = fuzz.ratio(name.upper(), m_name.upper())
                token_sort = fuzz.token_sort_ratio(name.upper(), m_name.upper())
                
                if token_sort >= 90:
                    candidates.append({
                        'id': row['id'],
                        'name': m_name,
                        'score': token_sort,
                        'table': table
                    })
        
        # Analyze candidates
        if candidates:
            # Sort by score
            candidates.sort(key=lambda x: x['score'], reverse=True)
            best = candidates[0]
            
            # Check uniqueness (Single Campus check)
            # Count how many times this college name appears in master DB for this state
            m_cursor.execute(f"""
                SELECT COUNT(*) as count
                FROM {best['table']}
                WHERE UPPER(normalized_name) = UPPER(?) AND UPPER(normalized_state) = UPPER(?)
            """, (best['name'], state))
            count = m_cursor.fetchone()['count']
            
            # Check for CONFUSION RISK (Unique Name check)
            # Are there OTHER colleges in this state with similar names?
            m_cursor.execute(f"""
                SELECT name, normalized_name 
                FROM {best['table']}
                WHERE UPPER(normalized_state) = UPPER(?) AND UPPER(normalized_name) != UPPER(?)
            """, (state, best['name']))
            
            confusion_candidates = []
            for row in m_cursor.fetchall():
                other_name = row['normalized_name'] if row['normalized_name'] else row['name']
                sim = fuzz.token_sort_ratio(name.upper(), other_name.upper())
                if sim > 80:
                    confusion_candidates.append(f"{other_name} ({sim}%)")
            
            if count == 1:
                if not confusion_candidates:
                    print(f"✅ MATCH FOUND: {name} -> {best['name']} (Score: {best['score']}) [Single Campus] [Unique Name]")
                    potential_matches += 1
                else:
                    print(f"⚠️ CONFUSION RISK: {name} -> {best['name']} (Score: {best['score']})")
                    print(f"   Confusing with: {', '.join(confusion_candidates)}")
            else:
                print(f"⚠️ AMBIGUOUS (Multi-Campus): {name} -> {best['name']} (Score: {best['score']}) [Count: {count}]")
        else:
            print(f"❌ NO MATCH: {name}")

    print(f"\nSummary: Found {potential_matches} potential matches out of {len(unmatched)} unmatched records.")

if __name__ == "__main__":
    verify_hypothesis()
