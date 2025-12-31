from agentic_matcher import AgenticMatcher
from rich.console import Console

# Mocking the context to test the validation logic logic directly 
# (simulating the context inside the _process_llm_response loop)

def test_validation_logic():
    print("Testing City Validation Logic...")
    
    # CASE 1: City == State (Should Skip Validation and PASS)
    # Seat Data: State=AGARTALA (Assume), City in DB=AGARTALA
    # This mimics the KARNATAKA case where matched_city == State
    
    matched_city = "KARNATAKA"
    original_state = "KARNATAKA"
    original_address = "ACADEMICSNIRMALA@GMAIL COM, 57" # Does NOT contain KARNATAKA
    
    print(f"\nCASE 1: City='{matched_city}' vs State='{original_state}'")
    
    matched_city_clean = matched_city.upper().strip()
    original_state_norm = original_state.upper().strip()
    
    skip_city_validation = (
        matched_city_clean == original_state_norm
    )
    
    if skip_city_validation:
        print("✅ Outcome: Validation SKIPPED (PASSED)")
    else:
        print(f"❌ Outcome: Validation ENFORCED (Would FAIL because '{matched_city}' not in '{original_address}')")

    # CASE 2: City != State (Should Enforce Validation)
    matched_city = "MYSURU"
    original_state = "KARNATAKA"
    original_address = "ACADEMICSNIRMALA@GMAIL COM, 57" 
    
    print(f"\nCASE 2: City='{matched_city}' vs State='{original_state}'")
    
    matched_city_clean = matched_city.upper().strip()
    original_state_norm = original_state.upper().strip()
    
    skip_city_validation = (
        matched_city_clean == original_state_norm
    )
    
    if not skip_city_validation:
        print("✅ Outcome: Validation ENFORCED (Correct behavior)")
        # Then it would fail check
        if matched_city in original_address:
             print("   (Match found in address)")
        else:
             print("   (No match in address -> REJECT)")
    else:
        print("❌ Outcome: Validation SKIPPED (Incorrect behavior)")

    # CASE 3: PUDUCHERRY Empty Address
    matched_city = "PUDUCHERRY"
    original_state = "PUDUCHERRY"
    original_address = ""
    
    print(f"\nCASE 3: City='{matched_city}' vs State='{original_state}' (Address Empty)")
    
    matched_city_clean = matched_city.upper().strip()
    original_state_norm = original_state.upper().strip()
    
    skip_city_validation = (
        matched_city_clean == original_state_norm
    )
    
    if skip_city_validation:
        print("✅ Outcome: Validation SKIPPED (PASSED)")
    else:
        print("❌ Outcome: Validation ENFORCED (Would FAIL on empty address)")

if __name__ == "__main__":
    test_validation_logic()
