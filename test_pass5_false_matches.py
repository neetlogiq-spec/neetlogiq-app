#!/usr/bin/env python3
"""
Test PASS 5 Ensemble Validation on 125 False Matches

Simulates what would happen if the 125 known false matches went through
the agentic matcher WITH the new ensemble validation in place.

This tests:
1. Would pre-filter remove the bad candidates?
2. Would post-validate block the wrong LLM match?
3. Overall: Would the system PREVENT the false match?
"""

import sqlite3
from typing import List, Dict, Tuple
from collections import defaultdict
from rich.console import Console
from rich.table import Table
from rich.progress import Progress

from cross_group_validator import CrossGroupValidator
from ensemble_validator import EnsembleValidator, ValidationResult

console = Console()


def get_false_matches() -> List[Dict]:
    """Get the 125 known false matches with their details."""
    validator = CrossGroupValidator()
    
    # Get all groups
    groups_by_master = validator._get_groups_by_master_id()
    
    false_matches = []
    
    for master_id, groups in groups_by_master.items():
        master_info = validator._get_master_college_info(master_id)
        if not master_info:
            continue
        
        master_name, master_address, master_state = master_info
        
        # Find deviating groups
        for group in groups:
            scores = validator.calculate_ensemble_similarity(
                group_name=group.normalized_college_name,
                master_name=master_name,
                group_address=group.normalized_address,
                master_address=master_address
            )
            
            is_dev, reasons = validator.is_ensemble_deviation(scores)
            
            if is_dev:
                false_matches.append({
                    'master_id': master_id,
                    'master_name': master_name,
                    'master_address': master_address,
                    'master_state': master_state,
                    'input_name': group.normalized_college_name,
                    'input_address': group.normalized_address,
                    'input_state': group.normalized_state,
                    'record_count': group.record_count,
                    'original_scores': scores,
                    'deviation_reasons': reasons,
                })
    
    return false_matches


def simulate_pass5_matching(false_matches: List[Dict]) -> Dict:
    """
    Simulate what would happen if these records went through PASS 5.
    
    For each false match:
    1. Get candidates from master database (how PASS 5 finds candidates)
    2. Apply pre-filter (ensemble)
    3. Simulate LLM picking the wrong match
    4. Apply post-validate (ensemble)
    5. Track if the false match would be BLOCKED
    """
    ensemble_validator = EnsembleValidator()
    
    results = {
        'total': len(false_matches),
        'prefilter_blocked': 0,
        'postfilter_blocked': 0,
        'both_blocked': 0,
        'neither_blocked': 0,
        'total_blocked': 0,
        'details': []
    }
    
    # Connect to master DB to get candidate info
    master_db = 'data/sqlite/master_data.db'
    
    with Progress() as progress:
        task = progress.add_task("[cyan]Testing false matches...", total=len(false_matches))
        
        for fm in false_matches:
            master_id = fm['master_id']
            master_name = fm['master_name']
            master_address = fm['master_address']
            input_name = fm['input_name']
            input_address = fm['input_address']
            
            # Simulate candidate that LLM would pick (the wrong master)
            wrong_candidate = {
                'id': master_id,
                'name': master_name,
                'address': master_address,
                'normalized_name': master_name,
                'normalized_address': master_address,
            }
            
            # Step 1: Would PRE-FILTER remove this candidate?
            filtered, removed = ensemble_validator.prefilter_candidates(
                candidates=[wrong_candidate],
                input_name=input_name,
                input_address=input_address
            )
            prefilter_blocked = (len(filtered) == 0)
            
            # Step 2: Would POST-VALIDATE reject this match?
            post_result = ensemble_validator.postvalidate_match(
                input_name=input_name,
                input_address=input_address,
                master_id=master_id,
                master_name=master_name,
                master_address=master_address
            )
            postfilter_blocked = not post_result.is_valid
            
            # Track results
            if prefilter_blocked and postfilter_blocked:
                results['both_blocked'] += 1
                results['total_blocked'] += 1
            elif prefilter_blocked:
                results['prefilter_blocked'] += 1
                results['total_blocked'] += 1
            elif postfilter_blocked:
                results['postfilter_blocked'] += 1
                results['total_blocked'] += 1
            else:
                results['neither_blocked'] += 1
                results['details'].append({
                    'input': input_name[:50],
                    'master': master_name[:50],
                    'scores': post_result.scores,
                    'reasons': fm['deviation_reasons'],
                })
            
            progress.update(task, advance=1)
    
    return results


def print_results(results: Dict):
    """Print formatted test results."""
    console.print("\n" + "=" * 80)
    console.print("[bold cyan]PASS 5 SIMULATION - FALSE MATCH BLOCKING TEST[/bold cyan]")
    console.print("=" * 80)
    
    total = results['total']
    blocked = results['total_blocked']
    blocked_pct = (blocked / total) * 100 if total > 0 else 0
    
    console.print(f"\n[bold]Test: Would these 125 false matches be BLOCKED by PASS 5?[/bold]")
    
    # Summary table
    table = Table(title="Blocking Results")
    table.add_column("Category", style="cyan")
    table.add_column("Count", justify="right")
    table.add_column("Percentage", justify="right")
    
    table.add_row(
        "Blocked by Pre-filter only",
        str(results['prefilter_blocked']),
        f"{results['prefilter_blocked']/total*100:.1f}%"
    )
    table.add_row(
        "Blocked by Post-filter only",
        str(results['postfilter_blocked']),
        f"{results['postfilter_blocked']/total*100:.1f}%"
    )
    table.add_row(
        "Blocked by BOTH",
        str(results['both_blocked']),
        f"{results['both_blocked']/total*100:.1f}%"
    )
    table.add_row(
        "[bold green]TOTAL BLOCKED[/bold green]",
        f"[bold green]{blocked}[/bold green]",
        f"[bold green]{blocked_pct:.1f}%[/bold green]"
    )
    table.add_row(
        "[bold red]NOT BLOCKED (False Positives)[/bold red]",
        f"[bold red]{results['neither_blocked']}[/bold red]",
        f"[bold red]{results['neither_blocked']/total*100:.1f}%[/bold red]"
    )
    
    console.print(table)
    
    # Show unblocked cases
    if results['neither_blocked'] > 0:
        console.print("\n[bold red]Cases that would NOT be blocked (require manual review):[/bold red]")
        for i, detail in enumerate(results['details'][:5], 1):
            s = detail['scores']
            console.print(f"\n  {i}. [yellow]{detail['input']}[/yellow]")
            console.print(f"     → {detail['master']}")
            console.print(f"     Scores: UID:{s.unique_id:.0f} Addr:{s.address:.0f} Vec:{s.vector:.0f} Phon:{s.phonetic:.0f} Wgt:{s.weighted_total:.0f}")
            console.print(f"     Original deviation: {detail['reasons'][0] if detail['reasons'] else 'N/A'}")
    
    console.print("\n" + "=" * 80)
    
    # Final verdict
    if blocked_pct >= 99:
        console.print("[bold green]✅ EXCELLENT: 99%+ of false matches would be BLOCKED![/bold green]")
    elif blocked_pct >= 95:
        console.print("[bold green]✅ GOOD: 95%+ of false matches would be blocked[/bold green]")
    elif blocked_pct >= 90:
        console.print("[bold yellow]⚠️ ACCEPTABLE: 90%+ blocked, but review unblocked cases[/bold yellow]")
    else:
        console.print("[bold red]❌ NEEDS IMPROVEMENT: Less than 90% blocked[/bold red]")
    
    console.print("=" * 80)


def main():
    console.print("\n[bold]Testing PASS 5 Ensemble Validation on 125 False Matches[/bold]\n")
    
    # Get false matches
    console.print("[dim]Loading 125 known false matches...[/dim]")
    false_matches = get_false_matches()
    console.print(f"[green]Found {len(false_matches)} false matches to test[/green]\n")
    
    if not false_matches:
        console.print("[red]No false matches found. Run PASS 8 first.[/red]")
        return
    
    # Simulate PASS 5 matching
    results = simulate_pass5_matching(false_matches)
    
    # Print results
    print_results(results)


if __name__ == "__main__":
    main()
