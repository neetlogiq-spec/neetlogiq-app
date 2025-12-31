#!/usr/bin/env python3
"""
Test combined Name+Address validation approach.

Compares:
1. Current approach: Validate name and address separately
2. Combined approach: Validate "name, address" as single string
"""

import sqlite3
import warnings
from typing import List, Dict, Tuple
from collections import defaultdict
from rich.console import Console
from rich.table import Table
from rich.progress import Progress
import numpy as np

# Suppress tokenizer warning
warnings.filterwarnings("ignore", message=".*fast tokenizer.*")

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


class CombinedValidator:
    """Validates using combined name+address string."""
    
    def __init__(self):
        self._embedding_model = None
        self._embedding_cache = {}
        
    def _get_embedding_model(self):
        if self._embedding_model is None:
            try:
                from vector_index import get_vector_index
                vector_index = get_vector_index()
                if vector_index and vector_index._engine:
                    self._embedding_model = vector_index._engine.model
                else:
                    console.print("[yellow]Vector index not available[/yellow]")
                    return None
            except Exception as e:
                console.print(f"[red]Failed to load model: {e}[/red]")
                return None
        return self._embedding_model
    
    def _get_embedding(self, text: str) -> np.ndarray:
        """Get embedding with caching."""
        if not text:
            return None
        
        text_key = text.upper().strip()
        if text_key in self._embedding_cache:
            return self._embedding_cache[text_key]
        
        model = self._get_embedding_model()
        if not model:
            return None
        
        result = model.encode([text_key], batch_size=1, max_length=256)
        if 'dense_vecs' in result:
            vec = result['dense_vecs'][0]
        else:
            vec = result[0]
        
        self._embedding_cache[text_key] = vec
        return vec
    
    def validate_combined(
        self, 
        input_name: str, 
        input_address: str,
        master_name: str,
        master_address: str,
        vector_threshold: float = 0.70,
        fuzzy_threshold: float = 70
    ) -> Dict:
        """
        Validate by combining name+address into single string.
        
        Input:  "GOVERNMENT MEDICAL COLLEGE KOZHIKODE" + "CALICUT"
        Master: "GOVERNMENT MEDICAL COLLEGE" + "KOZHIKODE, KERALA"
        
        Compare: "GOVERNMENT MEDICAL COLLEGE KOZHIKODE, CALICUT"
             vs  "GOVERNMENT MEDICAL COLLEGE, KOZHIKODE, KERALA"
        """
        from rapidfuzz import fuzz
        
        # Create combined strings
        input_combined = f"{input_name}, {input_address}" if input_address else input_name
        master_combined = f"{master_name}, {master_address}" if master_address else master_name
        
        # Clean up
        input_combined = input_combined.upper().strip()
        master_combined = master_combined.upper().strip()
        
        # Method 1: Fuzzy matching on combined strings
        fuzzy_token_set = fuzz.token_set_ratio(input_combined, master_combined)
        fuzzy_token_sort = fuzz.token_sort_ratio(input_combined, master_combined)
        fuzzy_combined = max(fuzzy_token_set, fuzzy_token_sort)
        
        # Method 2: Vector similarity on combined strings
        input_vec = self._get_embedding(input_combined)
        master_vec = self._get_embedding(master_combined)
        
        if input_vec is not None and master_vec is not None:
            vector_sim = np.dot(input_vec, master_vec) / (
                np.linalg.norm(input_vec) * np.linalg.norm(master_vec)
            ) * 100
        else:
            vector_sim = fuzzy_combined  # Fallback
        
        # Decision: Pass if EITHER meets threshold
        is_valid = (vector_sim >= vector_threshold * 100) or (fuzzy_combined >= fuzzy_threshold)
        
        return {
            'is_valid': is_valid,
            'input_combined': input_combined[:80],
            'master_combined': master_combined[:80],
            'fuzzy_score': fuzzy_combined,
            'vector_score': vector_sim,
            'reason': 'PASS' if is_valid else f'FAIL: Fuzzy={fuzzy_combined:.0f}%, Vec={vector_sim:.0f}%'
        }


def get_multi_campus_matched_records(limit: int = 600) -> List[Dict]:
    """Get records matched to multi-campus colleges."""
    seat_db = 'data/sqlite/counselling_data_partitioned.db'
    
    conn = sqlite3.connect(seat_db)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
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
    """, (limit * 3,))
    
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
    
    # Prioritize multi-campus
    multi_campus = [r for r in all_records if r['is_multi_campus']]
    others = [r for r in all_records if not r['is_multi_campus']]
    
    result = multi_campus[:min(len(multi_campus), limit // 2)]
    remaining = limit - len(result)
    result.extend(others[:remaining])
    
    return result[:limit]


def get_master_info(master_id: str) -> Tuple[str, str, str]:
    """Get master college name, address, state."""
    master_db = 'data/sqlite/master_data.db'
    conn = sqlite3.connect(master_db)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
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


def validate_with_combined_approach(records: List[Dict]) -> Dict:
    """Validate using combined name+address approach."""
    validator = CombinedValidator()
    
    results = {
        'total': len(records),
        'valid': 0,
        'blocked': 0,
        'multi_campus_total': 0,
        'multi_campus_blocked': 0,
        'blocked_details': [],
        'valid_details': [],
    }
    
    with Progress() as progress:
        task = progress.add_task("[cyan]Testing combined approach...", total=len(records))
        
        for record in records:
            master_name, master_address, master_state = get_master_info(record['master_id'])
            
            if not master_name:
                progress.update(task, advance=1)
                continue
            
            if record['is_multi_campus']:
                results['multi_campus_total'] += 1
            
            # Validate with combined approach
            result = validator.validate_combined(
                input_name=record['college_name'],
                input_address=record['address'],
                master_name=master_name,
                master_address=master_address,
                vector_threshold=0.70,
                fuzzy_threshold=70
            )
            
            if result['is_valid']:
                results['valid'] += 1
                if len(results['valid_details']) < 10:
                    results['valid_details'].append({
                        'input': result['input_combined'],
                        'master': result['master_combined'],
                        'master_id': record['master_id'],
                        'fuzzy': result['fuzzy_score'],
                        'vector': result['vector_score'],
                    })
            else:
                results['blocked'] += 1
                if record['is_multi_campus']:
                    results['multi_campus_blocked'] += 1
                
                if len(results['blocked_details']) < 20:
                    results['blocked_details'].append({
                        'input': result['input_combined'],
                        'master': result['master_combined'],
                        'master_id': record['master_id'],
                        'fuzzy': result['fuzzy_score'],
                        'vector': result['vector_score'],
                        'reason': result['reason'],
                    })
            
            progress.update(task, advance=1)
    
    return results


def print_results(results: Dict):
    """Print results."""
    console.print("\n" + "=" * 80)
    console.print("[bold cyan]COMBINED NAME+ADDRESS VALIDATION TEST[/bold cyan]")
    console.print("=" * 80)
    
    total = results['total']
    blocked = results['blocked']
    valid = results['valid']
    
    table = Table(title="Validation Results")
    table.add_column("Metric", style="cyan")
    table.add_column("Count", justify="right")
    table.add_column("Percentage", justify="right")
    
    table.add_row("Total Records", str(total), "100%")
    table.add_row("[green]Valid Matches[/green]", f"[green]{valid}[/green]", f"[green]{valid/total*100:.1f}%[/green]")
    table.add_row("[red]Blocked[/red]", f"[red]{blocked}[/red]", f"[red]{blocked/total*100:.1f}%[/red]")
    
    console.print(table)
    
    if results['multi_campus_total'] > 0:
        mc = results['multi_campus_total']
        mc_blocked = results['multi_campus_blocked']
        console.print(f"\n[bold yellow]Multi-Campus:[/bold yellow]")
        console.print(f"  Tested: {mc}, Blocked: {mc_blocked} ({mc_blocked/mc*100:.1f}%)")
    
    # Sample blocked
    if results['blocked_details']:
        console.print(f"\n[bold red]Sample Blocked (first 10):[/bold red]")
        for i, d in enumerate(results['blocked_details'][:10], 1):
            console.print(f"\n  {i}. Input:  [yellow]{d['input']}[/yellow]")
            console.print(f"     Master: {d['master']}")
            console.print(f"     Scores: Fuzzy={d['fuzzy']:.0f}%, Vector={d['vector']:.0f}%")
    
    # Sample valid
    if results['valid_details']:
        console.print(f"\n[bold green]Sample Valid (first 5):[/bold green]")
        for i, d in enumerate(results['valid_details'][:5], 1):
            console.print(f"\n  {i}. Input:  [green]{d['input']}[/green]")
            console.print(f"     Master: {d['master']}")
            console.print(f"     Scores: Fuzzy={d['fuzzy']:.0f}%, Vector={d['vector']:.0f}%")
    
    console.print("\n" + "=" * 80)
    block_rate = blocked / total * 100 if total > 0 else 0
    if block_rate < 10:
        console.print("[bold green]✅ EXCELLENT: Block rate < 10%[/bold green]")
    elif block_rate < 20:
        console.print("[bold yellow]⚠️ GOOD: Block rate 10-20%[/bold yellow]")
    else:
        console.print(f"[bold red]❌ HIGH: Block rate {block_rate:.1f}%[/bold red]")
    console.print("=" * 80)


def main():
    console.print("\n[bold]Testing Combined Name+Address Validation[/bold]")
    console.print("Approach: Compare 'name, address' as single string\n")
    
    console.print("[dim]Fetching records...[/dim]")
    records = get_multi_campus_matched_records(limit=600)
    
    multi_count = sum(1 for r in records if r['is_multi_campus'])
    console.print(f"[green]Found {len(records)} records ({multi_count} multi-campus)[/green]\n")
    
    if not records:
        console.print("[red]No records found.[/red]")
        return
    
    results = validate_with_combined_approach(records)
    print_results(results)


if __name__ == "__main__":
    main()
