from council_matcher import CouncilChairman, Candidate
from council_utils import TheCleaner
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)

def test_multi_signal_validation():
    print("🔐 Testing Multi-Signal Validation (Code + Name + Address)...")
    
    # Mock Master Data
    master_colleges = [
        {
            'id': 'MED999',
            'name': 'ANDAMAN NICOBAR INSTITUTE',
            'address': 'PORT BLAIR, ANDAMAN (902791)',
            'state': 'ANDAMAN AND NICOBAR',
            'type': 'MEDICAL'
        }
    ]
    
    chairman = CouncilChairman()
    chairman.load_master_data(master_colleges)
    
    # Test Case 1: Code + Name + Address Match (Expected: MATCH)
    print("\n--- Test Case 1: Code + Name + Address Match ---")
    query_1 = {
        'college_name': 'Andaman Nicobar Institute',
        'address': 'Port Blair (902791)',
        'state': 'ANDAMAN AND NICOBAR'
    }
    candidate_1 = Candidate('MED999', 'ANDAMAN NICOBAR INSTITUTE', 'PORT BLAIR, ANDAMAN (902791)', 'ANDAMAN AND NICOBAR', 'MEDICAL')
    
    d1, c1, v1 = chairman.evaluate_candidate(query_1, candidate_1)
    breaker_vote_1 = next((v for v in v1 if v.member_name == "The Code Breaker"), None)
    print(f"CodeBreaker: {breaker_vote_1.decision} ({breaker_vote_1.confidence:.2f}) - {breaker_vote_1.reason}")
    assert breaker_vote_1.decision == 'MATCH', "Should MATCH with all validations passed"
    
    # Test Case 2: Code + Address but Wrong Name (Expected: ABSTAIN)
    print("\n--- Test Case 2: Code + Address but Wrong Name ---")
    query_2 = {
        'college_name': 'COMPLETELY DIFFERENT INSTITUTE',  # Wrong name
        'address': 'Port Blair (902791)',
        'state': 'ANDAMAN AND NICOBAR'
    }
    
    d2, c2, v2 = chairman.evaluate_candidate(query_2, candidate_1)
    breaker_vote_2 = next((v for v in v2 if v.member_name == "The Code Breaker"), None)
    print(f"CodeBreaker: {breaker_vote_2.decision} ({breaker_vote_2.confidence:.2f}) - {breaker_vote_2.reason}")
    assert breaker_vote_2.decision == 'ABSTAIN', "Should ABSTAIN when name validation fails"
    
    # Test Case 3: Code + Name but Wrong Address (Expected: ABSTAIN)
    print("\n--- Test Case 3: Code + Name but Wrong Address ---")
    query_3 = {
        'college_name': 'Andaman Nicobar Institute',
        'address': 'Mumbai (902791)',  # Wrong location
        'state': 'MAHARASHTRA'
    }
    
    d3, c3, v3 = chairman.evaluate_candidate(query_3, candidate_1)
    breaker_vote_3 = next((v for v in v3 if v.member_name == "The Code Breaker"), None)
    print(f"CodeBreaker: {breaker_vote_3.decision} ({breaker_vote_3.confidence:.2f}) - {breaker_vote_3.reason}")
    assert breaker_vote_3.decision == 'ABSTAIN', "Should ABSTAIN when address validation fails"
    
    # Test Case 4: Code Mismatch (Expected: REJECT)
    print("\n--- Test Case 4: Code Mismatch ---")
    query_4 = {
        'college_name': 'Andaman Nicobar Institute',
        'address': 'Port Blair (123456)',  # Different code
        'state': 'ANDAMAN AND NICOBAR'
    }
    candidate_4 = Candidate('MED999', 'ANDAMAN NICOBAR INSTITUTE', 'PORT BLAIR, ANDAMAN (902791)', 'ANDAMAN AND NICOBAR', 'MEDICAL')
    
    d4, c4, v4 = chairman.evaluate_candidate(query_4, candidate_4)
    breaker_vote_4 = next((v for v in v4 if v.member_name == "The Code Breaker"), None)
    print(f"CodeBreaker: {breaker_vote_4.decision} ({breaker_vote_4.confidence:.2f}) - {breaker_vote_4.reason}")
    assert breaker_vote_4.decision == 'REJECT', "Should REJECT on code mismatch"
    
    # Test Case 5: Lenient Name Match (0.7 threshold)
    print("\n--- Test Case 5: Lenient Name Match (Threshold Test) ---")
    query_5 = {
        'college_name': 'ANDAMAN INSTITUTE',  # Partial match
        'address': 'Port Blair (902791)',
        'state': 'ANDAMAN AND NICOBAR'
    }
    
    d5, c5, v5 = chairman.evaluate_candidate(query_5, candidate_1)
    breaker_vote_5 = next((v for v in v5 if v.member_name == "The Code Breaker"), None)
    print(f"CodeBreaker: {breaker_vote_5.decision} ({breaker_vote_5.confidence:.2f}) - {breaker_vote_5.reason}")
    # This should still match as "ANDAMAN INSTITUTE" vs "ANDAMAN NICOBAR INSTITUTE" has decent overlap
    
    print("\n✅ All multi-signal validation tests passed!")

if __name__ == "__main__":
    test_multi_signal_validation()
