import logging
import sys
import os
from integrated_5pass_orchestrator import Integrated5PassOrchestrator

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def debug_mismatch():
    print("🔍 Debugging False Matches...")
    
    orchestrator = Integrated5PassOrchestrator()
    
    # Mock data for DNB0040 (from Master Data)
    # We need to see what DNB0040 actually is in the DB
    # But for now let's assume it's "Government General Hospital, Guntur" or similar
    
    # Let's try to match a query that SHOULD NOT match DNB0040
    # The error said DNB0040 (Andhra) was linked to Andaman state.
    # This implies a query from Andaman matched DNB0040.
    
    query_andaman = {
        'college_name': 'GB Pant Hospital',  # Typical Andaman hospital
        'state': 'Andaman and Nicobar Islands',
        'address': 'Port Blair',
        'course_type': 'DNB'
    }
    
    print(f"\nTesting Query: {query_andaman}")
    
    # Test Pass 0.5
    print("\n--- Testing Pass 0.5 (Code Match) ---")
    # Assume query has a code that might collide? Or maybe no code.
    match, success = orchestrator._pass0_code_match(
        query_andaman['address'], 
        query_andaman['college_name'], 
        query_andaman['state'], 
        query_andaman['course_type']
    )
    print(f"Pass 0.5 Result: {match}, Success: {success}")
    
    # Test Pass 0 (Composite Key)
    print("\n--- Testing Pass 0 (Composite Key) ---")
    # We need a composite key. Let's assume one.
    composite_key = f"{query_andaman['college_name']}, {query_andaman['address']}"
    match, ambiguity = orchestrator._pass0_composite_key_matching(
        query_andaman['college_name'],
        query_andaman['state'],
        query_andaman['address'],
        composite_key,
        query_andaman['course_type']
    )
    print(f"Pass 0 Result: {match}, Ambiguity: {ambiguity}")

if __name__ == "__main__":
    debug_mismatch()
