#!/usr/bin/env python3
"""
Test Ensemble Validation for PASS 5 Agentic Matching

Uses the 125 known false matches from PASS 8 as ground truth to test:
1. Pre-filter: Would ensemble have filtered bad candidates before LLM?
2. Post-validate: Would ensemble have caught LLM's bad picks?
3. Combined: Both layers working together

Run: python3 test_ensemble_pass5.py
"""

import sqlite3
from typing import List, Dict, Tuple
from dataclasses import dataclass
from collections import defaultdict
from rich.console import Console
from rich.table import Table

from cross_group_validator import CrossGroupValidator, EnsembleScores, GroupInfo, DeviationResult

console = Console()


@dataclass
class TestResult:
    """Result of testing a single false match"""
    input_name: str
    input_address: str
    master_id: str
    master_name: str
    master_address: str
    ensemble_scores: EnsembleScores
    is_deviation: bool
    reasons: List[str]
    prefilter_would_catch: bool
    postvalidate_would_catch: bool


class EnsemblePass5Tester:
    """Test ensemble voting for PASS 5 integration"""
    
    # Pre-filter thresholds (more lenient - just remove obvious bad candidates)
    PREFILTER_WEIGHTED_MIN = 40.0
    PREFILTER_UNIQUE_ID_MIN = 30.0  # Lower since we want to let borderline through to LLM
    
    # Post-validate thresholds (stricter - catch what LLM missed)
    POSTVALIDATE_WEIGHTED_MIN = 50.0
    POSTVALIDATE_UNIQUE_ID_MIN = 50.0
    POSTVALIDATE_ADDRESS_MIN = 50.0
    POSTVALIDATE_VECTOR_MIN = 70.0
    
    def __init__(self):
        self.validator = CrossGroupValidator()
        self.counselling_db = 'data/sqlite/counselling_data_partitioned.db'
        self.master_db = 'data/sqlite/master_data.db'
    
    def get_false_matches(self) -> List[DeviationResult]:
        """
        Get the known false matches from PASS 8.
        These are groups that were matched but flagged as deviations.
        """
        console.print("[dim]Loading false matches from PASS 8...[/dim]")
        
        # Run PASS 8 dry-run to get deviations
        groups_by_master = self.validator._get_groups_by_master_id()
        all_deviations = []
        
        for master_id, groups in groups_by_master.items():
            master_info = self.validator._get_master_college_info(master_id)
            if not master_info:
                continue
            
            master_name, master_address, master_state = master_info
            deviations = self.validator._detect_deviations(master_id, groups, master_name, master_address)
            all_deviations.extend(deviations)
        
        console.print(f"[green]Found {len(all_deviations)} known false matches[/green]")
        return all_deviations
    
    def would_prefilter_catch(self, scores: EnsembleScores) -> Tuple[bool, List[str]]:
        """
        Check if pre-filter would have removed this candidate.
        Pre-filter uses more lenient thresholds to not over-filter.
        """
        reasons = []
        
        if scores.weighted_total < self.PREFILTER_WEIGHTED_MIN:
            reasons.append(f"Weighted {scores.weighted_total:.0f}% < {self.PREFILTER_WEIGHTED_MIN}%")
        
        if scores.unique_id < self.PREFILTER_UNIQUE_ID_MIN:
            reasons.append(f"UID {scores.unique_id:.0f}% < {self.PREFILTER_UNIQUE_ID_MIN}%")
        
        return len(reasons) > 0, reasons
    
    def would_postvalidate_catch(self, scores: EnsembleScores) -> Tuple[bool, List[str]]:
        """
        Check if post-validate would have rejected LLM's pick.
        Post-validate uses stricter thresholds (same as PASS 8).
        """
        return self.validator.is_ensemble_deviation(scores)
    
    def test_all_scenarios(self, false_matches: List[DeviationResult]) -> Dict:
        """Run all three test scenarios"""
        results = {
            'total': len(false_matches),
            'prefilter': {'caught': 0, 'missed': 0, 'details': []},
            'postvalidate': {'caught': 0, 'missed': 0, 'details': []},
            'combined': {
                'prefilter_only': 0,
                'postvalidate_only': 0,
                'both': 0,
                'missed_both': 0,
                'details': []
            }
        }
        
        for deviation in false_matches:
            # Get master info
            master_info = self.validator._get_master_college_info(deviation.master_college_id)
            if not master_info:
                continue
            
            master_name, master_address, _ = master_info
            
            # Calculate ensemble scores
            scores = self.validator.calculate_ensemble_similarity(
                group_name=deviation.college_name,
                master_name=master_name,
                group_address=deviation.college_name,  # Use from GroupInfo if available
                master_address=master_address
            )
            
            # Test pre-filter
            prefilter_catches, prefilter_reasons = self.would_prefilter_catch(scores)
            
            # Test post-validate
            postvalidate_catches, postvalidate_reasons = self.would_postvalidate_catch(scores)
            
            # Update counts
            if prefilter_catches:
                results['prefilter']['caught'] += 1
            else:
                results['prefilter']['missed'] += 1
            
            if postvalidate_catches:
                results['postvalidate']['caught'] += 1
            else:
                results['postvalidate']['missed'] += 1
            
            # Combined analysis
            if prefilter_catches and postvalidate_catches:
                results['combined']['both'] += 1
            elif prefilter_catches and not postvalidate_catches:
                results['combined']['prefilter_only'] += 1
            elif not prefilter_catches and postvalidate_catches:
                results['combined']['postvalidate_only'] += 1
            else:
                results['combined']['missed_both'] += 1
                # Store details for missed cases
                results['combined']['details'].append({
                    'input': deviation.college_name[:50],
                    'master': master_name[:50],
                    'scores': scores,
                })
        
        return results
    
    def print_results(self, results: Dict):
        """Print formatted test results"""
        total = results['total']
        
        console.print("\n" + "=" * 80)
        console.print("[bold cyan]ENSEMBLE VALIDATION FOR PASS 5 - TEST RESULTS[/bold cyan]")
        console.print("=" * 80)
        
        # Scenario 1: Pre-filter
        console.print("\n[bold yellow]Scenario 1: PRE-FILTER (before LLM)[/bold yellow]")
        console.print(f"  Thresholds: Weighted < {self.PREFILTER_WEIGHTED_MIN}% OR UID < {self.PREFILTER_UNIQUE_ID_MIN}%")
        pre_caught = results['prefilter']['caught']
        pre_pct = (pre_caught / total) * 100 if total > 0 else 0
        console.print(f"  [green]Prevented:[/green] {pre_caught}/{total} ({pre_pct:.0f}%)")
        console.print(f"  [red]Missed:[/red] {results['prefilter']['missed']}/{total}")
        
        # Scenario 2: Post-validate
        console.print("\n[bold yellow]Scenario 2: POST-VALIDATE (after LLM)[/bold yellow]")
        console.print(f"  Thresholds: UID < 50% OR Vec < 70% OR Addr < 50% OR Weighted < 50%")
        post_caught = results['postvalidate']['caught']
        post_pct = (post_caught / total) * 100 if total > 0 else 0
        console.print(f"  [green]Caught & Rejected:[/green] {post_caught}/{total} ({post_pct:.0f}%)")
        console.print(f"  [red]Missed:[/red] {results['postvalidate']['missed']}/{total}")
        
        # Scenario 3: Combined
        console.print("\n[bold yellow]Scenario 3: COMBINED (pre + post)[/bold yellow]")
        comb = results['combined']
        total_unique = comb['prefilter_only'] + comb['postvalidate_only'] + comb['both']
        total_pct = (total_unique / total) * 100 if total > 0 else 0
        
        console.print(f"  [cyan]Caught by pre-filter only:[/cyan] {comb['prefilter_only']}")
        console.print(f"  [cyan]Caught by post-validate only:[/cyan] {comb['postvalidate_only']}")
        console.print(f"  [cyan]Caught by both:[/cyan] {comb['both']}")
        console.print(f"  [bold green]Total unique catches:[/bold green] {total_unique}/{total} ({total_pct:.0f}%)")
        console.print(f"  [bold red]Missed by both:[/bold red] {comb['missed_both']}/{total}")
        
        # Show missed cases if any
        if comb['missed_both'] > 0 and comb['details']:
            console.print("\n[bold red]Cases missed by both layers:[/bold red]")
            for detail in comb['details'][:5]:  # Show first 5
                console.print(f"  Input: {detail['input']}")
                console.print(f"  Master: {detail['master']}")
                s = detail['scores']
                console.print(f"  Scores: UID:{s.unique_id:.0f} Addr:{s.address:.0f} Vec:{s.vector:.0f} Phon:{s.phonetic:.0f} Wgt:{s.weighted_total:.0f}")
                console.print()
        
        # Summary table
        console.print("\n" + "=" * 80)
        table = Table(title="Summary Comparison")
        table.add_column("Scenario", style="cyan")
        table.add_column("Catch Rate", justify="right")
        table.add_column("Status", justify="center")
        
        table.add_row(
            "Pre-filter",
            f"{pre_pct:.0f}%",
            "[green]✓ PASS[/green]" if pre_pct >= 70 else "[yellow]⚠ REVIEW[/yellow]"
        )
        table.add_row(
            "Post-validate",
            f"{post_pct:.0f}%",
            "[green]✓ PASS[/green]" if post_pct >= 90 else "[yellow]⚠ REVIEW[/yellow]"
        )
        table.add_row(
            "Combined",
            f"{total_pct:.0f}%",
            "[green]✓ PASS[/green]" if total_pct >= 95 else "[yellow]⚠ REVIEW[/yellow]"
        )
        
        console.print(table)
        console.print("=" * 80)
        
        # Recommendation
        console.print("\n[bold]RECOMMENDATION:[/bold]")
        if total_pct >= 95:
            console.print("[bold green]✓ Combined approach achieves >95% - RECOMMENDED FOR PRODUCTION[/bold green]")
        elif post_pct >= 90:
            console.print("[bold yellow]⚠ Post-validate alone achieves >90% - Consider post-validate only[/bold yellow]")
        else:
            console.print("[bold red]✗ Catch rates below target - Review thresholds[/bold red]")


def main():
    console.print("\n[bold]Testing Ensemble Validation for PASS 5[/bold]\n")
    
    tester = EnsemblePass5Tester()
    
    # Get known false matches
    false_matches = tester.get_false_matches()
    
    if not false_matches:
        console.print("[red]No false matches found. Run PASS 8 first.[/red]")
        return
    
    # Run all scenarios
    results = tester.test_all_scenarios(false_matches)
    
    # Print results
    tester.print_results(results)


if __name__ == "__main__":
    main()
