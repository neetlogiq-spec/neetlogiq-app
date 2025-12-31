#!/usr/bin/env python3
"""
COUNSELLING DATA ORCHESTRATOR
Wrapper that runs the 5-pass orchestrator on counselling_records table.

Strategy: Creates a temporary 'seat_data' view pointing to counselling_records,
runs the existing orchestrator (which expects seat_data), and the results
automatically propagate to the underlying counselling_records table.
"""

import sqlite3
import logging
from pathlib import Path
from rich.console import Console
from rich.panel import Panel

logger = logging.getLogger(__name__)
console = Console()


class CounsellingOrchestrator:
    """
    Thin wrapper that enables 5-pass orchestrator to work on counselling_records
    without modifying the orchestrator code.
    """
    
    def __init__(self, 
                 counselling_db='data/sqlite/counselling_data_partitioned.db',
                 master_db='data/sqlite/master_data.db'):
        self.counselling_db = counselling_db
        self.master_db = master_db
    
    def run(self):
        """Run the 5-pass orchestrator on counselling_records"""
        
        console.print(Panel.fit(
            "[bold cyan]🎓 COUNSELLING DATA ORCHESTRATOR[/bold cyan]\n"
            "Running 5-pass matching on counselling_records via view wrapper",
            border_style="cyan"
        ))
        
        # NO VIEW NEEDED - Pass table_name directly to avoid 335x slowdown!
        # VIEWs in SQLite don't use indexes effectively
        console.print("\n[yellow]🚀 Running 5-pass orchestrator on counselling_records...[/yellow]\n")
        try:
            from integrated_5pass_orchestrator import Integrated5PassOrchestrator
            
            # Pass table_name='counselling_records' to read directly from the table
            orchestrator = Integrated5PassOrchestrator(
                seat_db_path=self.counselling_db,
                master_db_path=self.master_db,
                table_name='counselling_records'  # Direct table access, not VIEW!
            )
            orchestrator.run_complete_workflow()
            
        except Exception as e:
            logger.error(f"Orchestrator failed: {e}")
            console.print(f"[red]❌ Orchestrator error: {e}[/red]")
            raise
        
        # Step 4: Report results
        self._report_results()
        
        console.print(Panel.fit(
            "[bold green]✅ COUNSELLING MATCHING COMPLETE[/bold green]",
            border_style="green"
        ))
    
    def _setup_view(self):
        """Create seat_data view pointing to counselling_records"""
        conn = sqlite3.connect(self.counselling_db)
        cursor = conn.cursor()
        
        # Check if seat_data already exists as a table (would be a problem)
        cursor.execute("SELECT type FROM sqlite_master WHERE name='seat_data'")
        existing = cursor.fetchone()
        
        if existing and existing[0] == 'table':
            raise ValueError(
                "seat_data already exists as a TABLE in counselling database! "
                "This wrapper requires seat_data to not exist or be a view."
            )
        
        # Drop existing view if any
        cursor.execute("DROP VIEW IF EXISTS seat_data")
        
        # Create view that maps counselling_records to seat_data
        # Note: View must include all columns the orchestrator expects
        cursor.execute("""
            CREATE VIEW seat_data AS 
            SELECT 
                id,
                college_name,
                normalized_college_name,
                state,
                normalized_state,
                address,
                normalized_address,
                course_name,
                normalized_course_name,
                course_type,
                master_college_id,
                master_course_id,
                master_state_id,
                college_match_score,
                college_match_method,
                course_match_score,
                course_match_method
            FROM counselling_records
        """)
        
        conn.commit()
        
        # Verify view was created
        cursor.execute("SELECT COUNT(*) FROM seat_data")
        count = cursor.fetchone()[0]
        console.print(f"   [green]✓[/green] View created with {count:,} records")
        
        conn.close()
    
    def _cleanup_view(self):
        """Remove the temporary seat_data view"""
        conn = sqlite3.connect(self.counselling_db)
        conn.execute("DROP VIEW IF EXISTS seat_data")
        conn.commit()
        conn.close()
        console.print("   [green]✓[/green] View removed")
    
    def _report_results(self):
        """Report matching results"""
        conn = sqlite3.connect(self.counselling_db)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM counselling_records")
        total = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM counselling_records 
            WHERE master_college_id IS NOT NULL AND master_college_id != ''
        """)
        matched = cursor.fetchone()[0]
        
        conn.close()
        
        pct = (matched / total * 100) if total > 0 else 0
        console.print(f"\n[cyan]📊 Counselling Match Results:[/cyan]")
        console.print(f"   Total records: {total:,}")
        console.print(f"   Matched: {matched:,} ({pct:.2f}%)")
        console.print(f"   Unmatched: {total - matched:,}")


def run_counselling_matching():
    """Convenience function to run counselling matching"""
    orchestrator = CounsellingOrchestrator()
    orchestrator.run()


if __name__ == "__main__":
    run_counselling_matching()
