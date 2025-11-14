#!/usr/bin/env python3
"""
Run Cascading Hierarchical Matcher with Composite College Key Fix
================================================================
This script uses the NEW cascading matcher that includes the
composite_college_key fix for handling duplicate college names.

Usage:
    python3 run_cascading_matcher.py

This will:
1. Run STAGE 1: Pure Hierarchical (with composite key) - ~97-99% accuracy
2. Run STAGE 2: Hierarchical + RapidFuzz (for remaining records)
3. Run STAGE 3: Hierarchical + Transformers (for hardest cases)
"""

import sys
from pathlib import Path
from cascading_hierarchical_ensemble_matcher import CascadingHierarchicalEnsembleMatcher
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
import time

console = Console()

def main():
    console.print(Panel.fit(
        "[bold cyan]🚀 Cascading Hierarchical Matcher with Composite College Key Fix[/bold cyan]\n"
        "Uses STATE → COURSE → COMPOSITE KEY → NAME → ADDRESS hierarchy",
        border_style="cyan"
    ))

    # Database paths
    seat_db = "data/sqlite/seat_data.db"
    master_db = "data/sqlite/master_data.db"

    # Check if databases exist
    if not Path(seat_db).exists():
        console.print(f"[red]❌ Error: {seat_db} not found![/red]")
        return

    if not Path(master_db).exists():
        console.print(f"[red]❌ Error: {master_db} not found![/red]")
        return

    console.print(f"\n[green]✓ Database paths validated[/green]")
    console.print(f"  Seat data: {seat_db}")
    console.print(f"  Master data: {master_db}")

    # Initialize cascading matcher
    console.print(f"\n[cyan]Initializing Cascading Hierarchical Ensemble Matcher...[/cyan]")

    try:
        matcher = CascadingHierarchicalEnsembleMatcher(
            seat_db_path=seat_db,
            master_db_path=master_db
        )
        console.print(f"[green]✓ Cascading matcher initialized successfully[/green]")
    except Exception as e:
        console.print(f"[red]❌ Error initializing matcher: {e}[/red]")
        import traceback
        traceback.print_exc()
        return

    # Run cascading matching
    console.print(f"\n[bold cyan]Starting Cascading Matching Process[/bold cyan]")
    console.print("━" * 60)

    start_time = time.time()

    try:
        # This runs all 3 stages sequentially
        results = matcher.match_all_records_cascading('seat_data')

        elapsed = time.time() - start_time

        console.print("\n" + "="*60)
        console.print("[bold green]CASCADING MATCHING COMPLETE[/bold green]")
        console.print("="*60)

        # Display results
        if results:
            table = Table(title="Matching Results", show_header=True, header_style="bold cyan")
            table.add_column("Metric", style="cyan")
            table.add_column("Value", style="green", justify="right")

            total_records = results.get('total_records', 0)
            matched = results.get('matched', 0)
            unmatched = results.get('unmatched', 0)
            accuracy = (matched / total_records * 100) if total_records > 0 else 0

            table.add_row("Total Records", f"{total_records:,}")
            table.add_row("Matched", f"{matched:,}")
            table.add_row("Unmatched", f"{unmatched:,}")
            table.add_row("Accuracy", f"{accuracy:.2f}%")
            table.add_row("Execution Time", f"{elapsed:.1f}s")

            console.print(table)

            # Stage breakdown
            if 'stage_1_matched' in results:
                console.print(f"\n[cyan]Stage Breakdown:[/cyan]")
                console.print(f"  Stage 1 (Hierarchical): {results.get('stage_1_matched', 0):,} matched")
                console.print(f"  Stage 2 (RapidFuzz): {results.get('stage_2_matched', 0):,} matched")
                console.print(f"  Stage 3 (Transformers): {results.get('stage_3_matched', 0):,} matched")

        console.print(f"\n[green]✅ Matching complete! Time: {elapsed:.1f}s[/green]")

        # Show some sample matches
        console.print(f"\n[cyan]Fetching sample matches...[/cyan]")

        import sqlite3
        import pandas as pd

        conn = sqlite3.connect(seat_db)

        # Sample DISTRICT HOSPITAL matches to verify composite key fix
        dh_query = """
        SELECT
            sd.id,
            sd.college_name,
            sd.address,
            sd.master_college_id,
            c.name as matched_college,
            c.composite_college_key
        FROM seat_data sd
        LEFT JOIN master_data.colleges c ON sd.master_college_id = c.id
        WHERE sd.normalized_college_name LIKE 'DISTRICT HOSPITAL%'
          AND sd.normalized_state = 'KARNATAKA'
          AND sd.master_college_id IS NOT NULL
        LIMIT 5
        """

        try:
            dh_matches = pd.read_sql(dh_query, conn)

            if len(dh_matches) > 0:
                console.print(f"\n[cyan]Sample DISTRICT HOSPITAL matches (verifying composite key fix):[/cyan]")
                for idx, row in dh_matches.iterrows():
                    console.print(f"\n  Match {idx+1}:")
                    console.print(f"  - Input: {row['college_name']}")
                    console.print(f"  - Address: {row['address'][:60]}...")
                    console.print(f"  - Matched to: {row['master_college_id']} - {row['matched_college']}")
                    console.print(f"  - Composite key: {row['composite_college_key'][:70]}...")
        except Exception as e:
            console.print(f"[yellow]Could not fetch sample matches: {e}[/yellow]")

        conn.close()

    except Exception as e:
        console.print(f"\n[red]❌ Error during matching: {e}[/red]")
        import traceback
        traceback.print_exc()
        return

    console.print(f"\n[bold green]🎉 All done![/bold green]")

if __name__ == '__main__':
    main()
