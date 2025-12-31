#!/usr/bin/env python3
"""
Test script to run the actual orchestrator with the new Ultimate Dashboard UI
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from integrated_5pass_orchestrator import Integrated5PassOrchestrator

def test_orchestrator_ui():
    # print("Initializing Orchestrator...")
    orchestrator = Integrated5PassOrchestrator()
    
    # Run the workflow
    # Note: This will run the actual matching logic on the database
    # Ensure this is safe to run or use a test database if needed
    orchestrator.run_complete_workflow()

if __name__ == "__main__":
    test_orchestrator_ui()
