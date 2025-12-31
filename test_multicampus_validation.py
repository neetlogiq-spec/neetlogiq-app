#!/usr/bin/env python3
"""
Test Ensemble Validation on Multi-Campus Colleges

Tests ensemble validation specifically on multi-campus hospital chains
like KIMS, Apollo, Narayana, Manipal, etc. which are prone to false matches.

Fetches ~600 records from matched data and validates them.
"""

import sqlite3
import warnings
from typing import List, Dict, Tuple
from collections import defaultdict
from rich.console import Console
from rich.table import Table
from rich.progress import Progress

# Suppress tokenizer warning
warnings.filterwarnings("ignore", message=".*fast tokenizer.*")

from ensemble_validator import EnsembleValidator

console = Console()

# Multi-campus chains to focus on
MULTI_CAMPUS_CHAINS = [
    'KIMS', 'APOLLO', 'NARAYANA', 'MANIPAL', 'FORTIS', 'MAX', 'MEDANTA',
    'ASTER', 'CARE', 'GLOBAL', 'COLUMBIA', 'YASHODA', 'STERLING',
    'PUSHPAGIRI', 'AMRITA', 'KASTURBA', 'HITECH', 'IMS', 'SUM',
    'AUTONOMOUS STATE MEDICAL COLLEGE', 'GOVERNMENT MEDICAL COLLEGE',
    'GOVERNMENT DENTAL COLLEGE', 'DISTRICT HOSPITAL', 'AREA HOSPITAL',
    'ESIC', 'AIIMS', 'GMC', 'VINAYAKA', 'DR D Y PATIL', 'OSMANIA',
]


def get_multi_campus_matched_records(limit: int = 600) -> List[Dict]:
    """
    Get records that are matched to multi-campus colleges from counselling_records.
    """
    seat_db = 'data/sqlite/counselling_data_partitioned.db'
    master_db = 'data/sqlite/master_data.db'
    
    conn = sqlite3.connect(seat_db)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get matched records from counselling_records
    cursor.execute("""
        SELECT 
            id,
            normalized_college_name,
            normalized_address,
            normalized_state,
            master_college_id,
            course_type
        FROM counselling_records
        WHERE master_college_id IS NOT NULL
        AND master_college_id != ''
        LIMIT ?
    """, (limit * 3,))  # Get more to filter multi-campus
    
    all_records = []
    for row in cursor.fetchall():
        college_name = row['normalized_college_name'] or ''
        is_multi_campus = any(chain in college_name.upper() for chain in MULTI_CAMPUS_CHAINS)
        
        all_records.append({
            'id': row['id'],
            'college_name': college_name,
            'address': row['normalized_address'] or '',
            'state': row['normalized_state'] or '',
            'master_id': row['master_college_id'],
            'course_type': row['course_type'] or 'medical',
            'is_multi_campus': is_multi_campus,
        })
    
    conn.close()
    
    # Prioritize multi-campus records
    multi_campus = [r for r in all_records if r['is_multi_campus']]
    others = [r for r in all_records if not r['is_multi_campus']]
    
    # Take more multi-campus, fill rest with others
    result = multi_campus[:min(len(multi_campus), limit // 2)]
    remaining = limit - len(result)
    result.extend(others[:remaining])
    
    return result[:limit]


def get_master_info(master_id: str, master_db: str = 'data/sqlite/master_data.db') -> Tuple[str, str, str]:
    """Get master college name, address, state."""
    conn = sqlite3.connect(master_db)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Determine table
    if master_id.startswith('MED'):
        table = 'medical_colleges'
    elif master_id.startswith('DEN'):
        table = 'dental_colleges'
    else:
        table = 'dnb_colleges'
    
    cursor.execute(f"""
        SELECT 
            COALESCE(normalized_name, name) as name,
            COALESCE(normalized_address, address) as address,
            COALESCE(normalized_state, state) as state
        FROM {table}
        WHERE id = ?
    """, (master_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return row['name'], row['address'] or '', row['state'] or ''
    return '', '', ''


def validate_matches(records: List[Dict]) -> Dict:
    """
    Validate matches using ensemble voting.
    
    Returns breakdown of results.
    """
    ensemble = EnsembleValidator()
    
    results = {
        'total': len(records),
        'valid': 0,
        'blocked': 0,
        'blocked_by_uid': 0,
        'blocked_by_address': 0,
        'blocked_by_vector': 0,
        'blocked_by_weighted': 0,
        'multi_campus_total': 0,
        'multi_campus_blocked': 0,
        'blocked_details': [],
        'valid_details': [],
    }
    
    with Progress() as progress:
        task = progress.add_task("[cyan]Validating matches...", total=len(records))
        
        for record in records:
            master_name, master_address, master_state = get_master_info(record['master_id'])
            
            if not master_name:
                progress.update(task, advance=1)
                continue
            
            # Track multi-campus
            if record['is_multi_campus']:
                results['multi_campus_total'] += 1
            
            # Validate
            result = ensemble.postvalidate_match(
                input_name=record['college_name'],
                input_address=record['address'],
                master_id=record['master_id'],
                master_name=master_name,
                master_address=master_address
            )
            
            if result.is_valid:
                results['valid'] += 1
                if len(results['valid_details']) < 10:
                    results['valid_details'].append({
                        'input': record['college_name'][:50],
                        'master': master_name[:50],
                        'master_id': record['master_id'],
                        'scores': result.scores,
                    })
            else:
                results['blocked'] += 1
                if record['is_multi_campus']:
                    results['multi_campus_blocked'] += 1
                
                # Track reason
                for reason in result.reasons:
                    if 'Unique ID' in reason:
                        results['blocked_by_uid'] += 1
                    elif 'Address' in reason:
                        results['blocked_by_address'] += 1
                    elif 'Vector' in reason:
                        results['blocked_by_vector'] += 1
                    elif 'Weighted' in reason:
                        results['blocked_by_weighted'] += 1
                
                if len(results['blocked_details']) < 20:
                    results['blocked_details'].append({
                        'input': record['college_name'][:50],
                        'master': master_name[:50],
                        'master_id': record['master_id'],
                        'scores': result.scores,
                        'reasons': result.reasons,
                    })
            
            progress.update(task, advance=1)
    
    return results


def print_results(results: Dict):
    """Print formatted results."""
    console.print("\n" + "=" * 80)
    console.print("[bold cyan]ENSEMBLE VALIDATION - MULTI-CAMPUS ACCURACY TEST[/bold cyan]")
    console.print("=" * 80)
    
    total = results['total']
    blocked = results['blocked']
    valid = results['valid']
    
    # Summary table
    table = Table(title="Validation Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Count", justify="right")
    table.add_column("Percentage", justify="right")
    
    table.add_row("Total Records Tested", str(total), "100%")
    table.add_row("[green]Valid Matches[/green]", f"[green]{valid}[/green]", f"[green]{valid/total*100:.1f}%[/green]")
    table.add_row("[red]Blocked (Potential False Positives)[/red]", f"[red]{blocked}[/red]", f"[red]{blocked/total*100:.1f}%[/red]")
    
    console.print(table)
    
    # Multi-campus focus
    if results['multi_campus_total'] > 0:
        mc_total = results['multi_campus_total']
        mc_blocked = results['multi_campus_blocked']
        console.print(f"\n[bold yellow]Multi-Campus Focus:[/bold yellow]")
        console.print(f"  Multi-campus records tested: {mc_total}")
        console.print(f"  Multi-campus blocked: {mc_blocked} ({mc_blocked/mc_total*100:.1f}%)")
    
    # Blocking reasons
    console.print(f"\n[bold]Blocking Reasons Breakdown:[/bold]")
    console.print(f"  Unique ID < 50%: {results['blocked_by_uid']}")
    console.print(f"  Address < 50%: {results['blocked_by_address']}")
    console.print(f"  Vector < 70%: {results['blocked_by_vector']}")
    console.print(f"  Weighted < 50%: {results['blocked_by_weighted']}")
    
    # Sample blocked matches
    if results['blocked_details']:
        console.print(f"\n[bold red]Sample Blocked Matches (potential false positives):[/bold red]")
        for i, detail in enumerate(results['blocked_details'][:10], 1):
            s = detail['scores']
            console.print(f"\n  {i}. [yellow]{detail['input']}[/yellow]")
            console.print(f"     → {detail['master']} ({detail['master_id']})")
            console.print(f"     Scores: UID:{s.unique_id:.0f} Addr:{s.address:.0f} Vec:{s.vector:.0f} Wgt:{s.weighted_total:.0f}")
            console.print(f"     Reason: {detail['reasons'][0] if detail['reasons'] else 'N/A'}")
    
    # Sample valid matches
    if results['valid_details']:
        console.print(f"\n[bold green]Sample Valid Matches (passed validation):[/bold green]")
        for i, detail in enumerate(results['valid_details'][:5], 1):
            s = detail['scores']
            console.print(f"\n  {i}. [green]{detail['input']}[/green]")
            console.print(f"     → {detail['master']} ({detail['master_id']})")
            console.print(f"     Scores: UID:{s.unique_id:.0f} Addr:{s.address:.0f} Vec:{s.vector:.0f} Wgt:{s.weighted_total:.0f}")
    
    console.print("\n" + "=" * 80)
    
    # Assessment
    block_rate = blocked / total * 100 if total > 0 else 0
    if block_rate < 5:
        console.print("[bold green]✅ LOW BLOCK RATE (<5%) - Most matches are valid![/bold green]")
    elif block_rate < 15:
        console.print("[bold yellow]⚠️ MODERATE BLOCK RATE (5-15%) - Review blocked matches[/bold yellow]")
    else:
        console.print("[bold red]❌ HIGH BLOCK RATE (>15%) - Many potential false positives![/bold red]")
    
    console.print("=" * 80)


def main():
    console.print("\n[bold]Testing Ensemble Validation on Multi-Campus Records[/bold]\n")
    
    # Get records
    console.print("[dim]Fetching matched records (prioritizing multi-campus)...[/dim]")
    records = get_multi_campus_matched_records(limit=600)
    
    multi_count = sum(1 for r in records if r['is_multi_campus'])
    console.print(f"[green]Found {len(records)} records ({multi_count} multi-campus)[/green]\n")
    
    if not records:
        console.print("[red]No matched records found in counselling_records.[/red]")
        return
    
    # Validate
    results = validate_matches(records)
    
    # Print results
    print_results(results)


if __name__ == "__main__":
    main()
