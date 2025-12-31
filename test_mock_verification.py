#!/usr/bin/env python3
"""
Test Guardian Pipeline with Mock Data
Tests both TRUE matches and FALSE matches to verify LLM accuracy.
"""

from agentic_verifier import (
    AgenticVerifier, 
    VerificationRecord, 
    VerificationVerdict
)
from rich.console import Console
from rich.table import Table

console = Console()

# ==================== MOCK TEST DATA ====================
# Create test cases with KNOWN correct/incorrect matches

MOCK_TEST_CASES = [
    # ===== TRUE MATCHES (Should APPROVE) =====
    {
        "name": "Exact Match",
        "expected": "APPROVE",
        "record": VerificationRecord(
            record_id="TEST_001",
            seat_college_name="AIIMS NEW DELHI",
            seat_state="DELHI (NCT)",
            seat_address="ANSARI NAGAR, NEW DELHI",
            seat_course_type="medical",
            master_college_id="MED0001",
            master_name="AIIMS NEW DELHI",
            master_state="DELHI (NCT)",
            master_address="ANSARI NAGAR, NEW DELHI",
            match_score=1.0,
            match_method="exact_match",
        )
    },
    {
        "name": "Name Split (SETH GS case)",
        "expected": "APPROVE",
        "record": VerificationRecord(
            record_id="TEST_002",
            seat_college_name="SETH GS MEDICAL COLLEGE",
            seat_state="MAHARASHTRA",
            seat_address="AND KEM HOSPITAL, MUMBAI",  # Name continues in address!
            seat_course_type="medical",
            master_college_id="MED0440",
            master_name="SETH GS MEDICAL COLLEGE AND KEM HOSPITAL",
            master_state="MAHARASHTRA",
            master_address="MUMBAI",
            match_score=0.79,
            match_method="pass5_council_match",
        )
    },
    {
        "name": "State Normalization (ORISSA/ODISHA)",
        "expected": "APPROVE",
        "record": VerificationRecord(
            record_id="TEST_003",
            seat_college_name="HI-TECH MEDICAL COLLEGE",
            seat_state="ODISHA",  # Normalized
            seat_address="ROURKELA",
            seat_course_type="medical",
            master_college_id="MED0494",
            master_name="HI-TECH MEDICAL COLLEGE AND HOSPITAL",
            master_state="ODISHA",
            master_address="ROURKELA",
            match_score=0.88,
            match_method="fuzzy_match",
        )
    },
    {
        "name": "Minor Typo (SWAMINARAYAN/SWAMINAYARAN)",
        "expected": "APPROVE",
        "record": VerificationRecord(
            record_id="TEST_004",
            seat_college_name="SWAMINARAYAN INSTITUTE OF MEDICAL SCIENCES",
            seat_state="GUJARAT",
            seat_address=None,
            seat_course_type="medical",
            master_college_id="MED0146",
            master_name="SWAMINAYARAN INSTITUTE OF MEDICAL SCIENCES",  # R/Y swap
            master_state="GUJARAT",
            master_address=None,
            match_score=0.92,
            match_method="soft_tfidf",
        )
    },
    {
        "name": "Abbreviation Match (GOVT/GOVERNMENT)",
        "expected": "APPROVE",
        "record": VerificationRecord(
            record_id="TEST_005",
            seat_college_name="GOVT MEDICAL COLLEGE",
            seat_state="KERALA",
            seat_address="THIRUVANANTHAPURAM",
            seat_course_type="medical",
            master_college_id="MED0200",
            master_name="GOVERNMENT MEDICAL COLLEGE",
            master_state="KERALA",
            master_address="THIRUVANANTHAPURAM",
            match_score=0.95,
            match_method="alias_match",
        )
    },
    
    # ===== FALSE MATCHES (Should REJECT) =====
    {
        "name": "Different State",
        "expected": "REJECT",
        "record": VerificationRecord(
            record_id="TEST_006",
            seat_college_name="GOVERNMENT MEDICAL COLLEGE",
            seat_state="KERALA",
            seat_address="THIRUVANANTHAPURAM",
            seat_course_type="medical",
            master_college_id="MED0300",
            master_name="GOVERNMENT MEDICAL COLLEGE",
            master_state="TAMIL NADU",  # WRONG STATE!
            master_address="CHENNAI",
            match_score=0.90,
            match_method="fuzzy_match",
        )
    },
    {
        "name": "Different Institution",
        "expected": "REJECT",
        "record": VerificationRecord(
            record_id="TEST_007",
            seat_college_name="CHRISTIAN MEDICAL COLLEGE",
            seat_state="TAMIL NADU",
            seat_address="VELLORE",
            seat_course_type="medical",
            master_college_id="MED0400",
            master_name="ST JOHNS MEDICAL COLLEGE",  # DIFFERENT COLLEGE!
            master_state="KARNATAKA",
            master_address="BANGALORE",
            match_score=0.65,
            match_method="fuzzy_match",
        )
    },
    {
        "name": "Medical vs Dental Stream",
        "expected": "REJECT",
        "record": VerificationRecord(
            record_id="TEST_008",
            seat_college_name="AIIMS DENTAL COLLEGE",  # DENTAL
            seat_state="DELHI (NCT)",
            seat_address="NEW DELHI",
            seat_course_type="dental",
            master_college_id="MED0001",
            master_name="AIIMS NEW DELHI",  # MEDICAL (wrong stream)
            master_state="DELHI (NCT)",
            master_address="NEW DELHI",
            match_score=0.85,
            match_method="fuzzy_match",
        )
    },
    {
        "name": "Completely Different College",
        "expected": "REJECT",
        "record": VerificationRecord(
            record_id="TEST_009",
            seat_college_name="KASTURBA MEDICAL COLLEGE",
            seat_state="KARNATAKA",
            seat_address="MANIPAL",
            seat_course_type="medical",
            master_college_id="MED0500",
            master_name="BANGALORE MEDICAL COLLEGE",  # COMPLETELY DIFFERENT!
            master_state="KARNATAKA",
            master_address="BANGALORE",
            match_score=0.50,
            match_method="fallback",
        )
    },
    {
        "name": "Name Mismatch with Same State",
        "expected": "REJECT", 
        "record": VerificationRecord(
            record_id="TEST_010",
            seat_college_name="MADRAS MEDICAL COLLEGE",
            seat_state="TAMIL NADU",
            seat_address="CHENNAI",
            seat_course_type="medical",
            master_college_id="MED0600",
            master_name="STANLEY MEDICAL COLLEGE",  # DIFFERENT COLLEGE in same city!
            master_state="TAMIL NADU",
            master_address="CHENNAI",
            match_score=0.55,
            match_method="location_match",
        )
    },
]


def run_mock_test():
    """Run mock test with known matches and check accuracy."""
    console.print("\n[bold cyan]=" * 60)
    console.print("[bold cyan]🧪 MOCK TEST: Guardian Pipeline Accuracy Check")
    console.print("[bold cyan]=" * 60)
    
    # Separate expected outcomes
    expected_approve = [t for t in MOCK_TEST_CASES if t["expected"] == "APPROVE"]
    expected_reject = [t for t in MOCK_TEST_CASES if t["expected"] == "REJECT"]
    
    console.print(f"\n[green]Expected APPROVE: {len(expected_approve)} cases")
    console.print(f"[red]Expected REJECT: {len(expected_reject)} cases")
    console.print(f"[white]Total test cases: {len(MOCK_TEST_CASES)}")
    
    # Initialize verifier
    verifier = AgenticVerifier()
    
    # Extract records
    test_records = [t["record"] for t in MOCK_TEST_CASES]
    
    # Run consensus verification
    console.print("\n[bold magenta]Running Multi-Model Consensus Verification...[/bold magenta]\n")
    results = verifier.verify_with_consensus(test_records, required_votes=3)
    
    # Analyze results
    console.print("\n[bold cyan]=" * 60)
    console.print("[bold cyan]📊 TEST RESULTS")
    console.print("[bold cyan]=" * 60)
    
    # Build results table
    table = Table(title="Mock Test Results")
    table.add_column("Test ID", style="cyan")
    table.add_column("Test Name", style="white")
    table.add_column("Expected", justify="center")
    table.add_column("Actual", justify="center")
    table.add_column("Votes", justify="center")
    table.add_column("Result", justify="center")
    
    correct = 0
    for test_case, result in zip(MOCK_TEST_CASES, results):
        expected = test_case["expected"]
        actual = result.final_verdict.value.upper()
        
        is_correct = expected == actual
        if is_correct:
            correct += 1
        
        # Format
        exp_emoji = "✅" if expected == "APPROVE" else "❌"
        act_emoji = "✅" if actual == "APPROVE" else "❌"
        result_emoji = "✓" if is_correct else "✗"
        result_style = "green" if is_correct else "red bold"
        
        vote_str = f"{result.approve_count}A/{result.reject_count}R"
        
        table.add_row(
            result.record_id,
            test_case["name"][:30],
            f"{exp_emoji} {expected}",
            f"{act_emoji} {actual}",
            vote_str,
            f"[{result_style}]{result_emoji}[/{result_style}]",
        )
    
    console.print(table)
    
    # Summary
    accuracy = (correct / len(MOCK_TEST_CASES)) * 100
    console.print(f"\n[bold]Accuracy: {correct}/{len(MOCK_TEST_CASES)} = {accuracy:.1f}%[/bold]")
    
    if accuracy >= 80:
        console.print("[bold green]✅ TEST PASSED - Accuracy >= 80%[/bold green]")
    else:
        console.print("[bold red]❌ TEST FAILED - Accuracy < 80%[/bold red]")
    
    # Show vote details
    console.print("\n[bold cyan]Vote Details:[/bold cyan]")
    for test_case, result in zip(MOCK_TEST_CASES, results):
        votes_info = []
        for v in result.votes:
            votes_info.append(f"{v.model_name.split('/')[-1][:20]}:{v.verdict.value[0].upper()}")
        vote_detail = ", ".join(votes_info) if votes_info else "No votes captured"
        console.print(f"  {result.record_id}: [{result.approve_count}A/{result.reject_count}R] {vote_detail}")
    
    return correct, len(MOCK_TEST_CASES), accuracy


if __name__ == "__main__":
    correct, total, accuracy = run_mock_test()
