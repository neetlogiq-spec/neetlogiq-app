import sys
import os
from recent3 import AdvancedSQLiteMatcher

def debug_state_norm():
    matcher = AdvancedSQLiteMatcher()
    
    states = [
        "Andhra Pradesh",
        "ANDHRA PRADESH",
        "Andaman and Nicobar Islands",
        "ANDAMAN & NICOBAR ISLANDS",
        "A & N Islands"
    ]
    
    print("--- Debugging State Normalization ---")
    for s in states:
        norm = matcher.normalize_state_name_import(s)
        print(f"'{s}' -> '{norm}'")
        
    print("\n--- Checking Equality ---")
    s1 = matcher.normalize_state_name_import("Andhra Pradesh")
    s2 = matcher.normalize_state_name_import("Andaman and Nicobar Islands")
    print(f"'{s1}' == '{s2}' ? {s1 == s2}")

if __name__ == "__main__":
    debug_state_norm()
