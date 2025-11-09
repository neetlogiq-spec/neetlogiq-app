#!/usr/bin/env python3
"""
Match and Link UX Enhancement Wrapper
======================================

Provides a clean, user-friendly interface for the match_and_link_database_driven process
with progress bars, summary statistics, and optional verbose mode.

Usage:
    from match_and_link_ux_wrapper import match_and_link_with_ux

    # Run with default UX enhancements (clean output, progress bar)
    match_and_link_with_ux(matcher, table_name='seat_data')

    # Run with verbose mode (for debugging)
    match_and_link_with_ux(matcher, table_name='seat_data', verbose=True)
"""

import sqlite3
import time
import logging
from datetime import datetime, timedelta
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

logger = logging.getLogger(__name__)
console = Console()


class MatchingProgress:
    """Tracks matching statistics for better UX feedback"""

    def __init__(self, total_records):
        self.total = total_records
        self.tier1_processed = 0
        self.tier1_matched = 0
        self.tier2_processed = 0
        self.tier2_matched = 0
        self.tier3_processed = 0
        self.tier3_matched = 0
        self.pass2_processed = 0
        self.pass2_matched = 0
        self.start_time = time.time()

    def tier1_progress(self, matched, processed):
        self.tier1_matched = matched
        self.tier1_processed = processed

    def tier2_progress(self, matched, processed):
        self.tier2_matched = matched
        self.tier2_processed = processed

    def tier3_progress(self, matched, processed):
        self.tier3_matched = matched
        self.tier3_processed = processed

    def pass2_progress(self, matched, processed):
        self.pass2_matched = matched
        self.pass2_processed = processed

    def get_summary(self):
        """Return current matching summary"""
        total_matched = self.tier1_matched + self.tier2_matched + self.tier3_matched + self.pass2_matched
        total_processed = self.tier1_processed + self.tier2_processed + self.tier3_processed + self.pass2_processed
        return {
            'total_matched': total_matched,
            'total_processed': total_processed,
            'accuracy': (total_matched / self.total * 100) if self.total > 0 else 0,
            'tier1': {'matched': self.tier1_matched, 'processed': self.tier1_processed},
            'tier2': {'matched': self.tier2_matched, 'processed': self.tier2_processed},
            'tier3': {'matched': self.tier3_matched, 'processed': self.tier3_processed},
            'pass2': {'matched': self.pass2_matched, 'processed': self.pass2_processed},
        }


def match_and_link_with_ux(matcher, table_name='seat_data', verbose=False):
    """
    Run match_and_link_database_driven with enhanced UX

    Args:
        matcher: AdvancedSQLiteMatcher instance
        table_name: Name of the seat data table (default: 'seat_data')
        verbose: Enable verbose logging (default: False)
    """

    # Show welcome banner
    console.print()
    console.print(Panel.fit(
        "[bold cyan]🚀 College & Course Matching Pipeline[/bold cyan]\n"
        "[dim]Enhanced UX with Progress Tracking[/dim]",
        border_style="cyan"
    ))

    # Get total records
    db_path = f"{matcher.config['database']['sqlite_path']}/{matcher.config['database']['seat_data_db']}"
    conn = sqlite3.connect(db_path)
    total = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    unmatched_before = conn.execute(f"SELECT COUNT(*) FROM {table_name} WHERE master_college_id IS NULL").fetchone()[0]
    conn.close()

    # Initialize progress tracker
    progress = MatchingProgress(total)

    # Show starting metrics
    stats_table = Table(title="Starting Metrics")
    stats_table.add_column("Metric", style="cyan")
    stats_table.add_column("Value", style="green")
    stats_table.add_row("Total Records", f"{total:,}")
    stats_table.add_row("Already Matched", f"{total - unmatched_before:,}")
    stats_table.add_row("Waiting to Match", f"{unmatched_before:,}")
    console.print(stats_table)
    console.print()

    # Show configuration
    config_msg = "[green]✓[/green] XAI Explanations: Disabled (clean output)"
    if matcher.config.get('features', {}).get('log_xai_explanations', False):
        config_msg = "[yellow]⚠[/yellow] XAI Explanations: Enabled (verbose mode)"

    console.print(f"[dim]{config_msg}[/dim]")
    console.print(f"[dim]Verbose Mode: {'Enabled' if verbose else 'Disabled'}[/dim]")
    console.print()

    # Show pipeline overview
    console.print("[bold]Pipeline Overview:[/bold]")
    console.print("  [cyan]PASS 1[/cyan]: Original names matching (3 tiers)")
    console.print("    ├─ [cyan]Tier 1[/cyan]: Exact matches (SQL-only, fastest)")
    console.print("    ├─ [cyan]Tier 2[/cyan]: Fuzzy matches (SQL + Python hybrid)")
    console.print("    └─ [cyan]Tier 3[/cyan]: Complex cases (Ensemble fallback)")
    console.print("  [cyan]PASS 2[/cyan]: Alias matching for unmatched (if enabled)")
    console.print()

    # Run matching with progress tracking
    console.print("[bold yellow]⏳ Starting matching process...[/bold yellow]")
    console.print()

    start_time = time.time()

    # Disable verbose logging for cleaner output
    if not verbose:
        logging.getLogger('recent').setLevel(logging.WARNING)
        logging.getLogger('integrated_cascading_matcher').setLevel(logging.WARNING)

    try:
        # Run the actual matching
        matcher.match_and_link_database_driven(table_name=table_name)

    finally:
        # Re-enable logging if it was disabled
        if not verbose:
            logging.getLogger('recent').setLevel(logging.INFO)
            logging.getLogger('integrated_cascading_matcher').setLevel(logging.INFO)

    elapsed_time = time.time() - start_time

    # Get final metrics
    conn = sqlite3.connect(db_path)
    final_total = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    final_matched = conn.execute(f"SELECT COUNT(*) FROM {table_name} WHERE master_college_id IS NOT NULL").fetchone()[0]
    final_unmatched = final_total - final_matched
    conn.close()

    # Calculate improvements
    matched_diff = final_matched - (total - unmatched_before)

    # Show final summary
    console.print()
    console.print(Panel.fit(
        "[bold green]✅ Matching Complete![/bold green]",
        border_style="green"
    ))

    # Final metrics table
    final_table = Table(title="Final Results")
    final_table.add_column("Metric", style="cyan")
    final_table.add_column("Count", style="green")
    final_table.add_column("Percentage", style="yellow")

    final_table.add_row(
        "Total Records",
        f"{final_total:,}",
        "100%"
    )
    final_table.add_row(
        "Matched Records",
        f"{final_matched:,}",
        f"{(final_matched/final_total*100):.2f}%"
    )
    final_table.add_row(
        "Unmatched Records",
        f"{final_unmatched:,}",
        f"{(final_unmatched/final_total*100):.2f}%"
    )

    console.print(final_table)
    console.print()

    # Show improvements
    if matched_diff > 0:
        console.print(f"[green]✨ New Matches: {matched_diff:,} records[/green]")
    else:
        console.print(f"[yellow]ℹ Matches: No new matches in this run[/yellow]")

    console.print()

    # Show timing
    hours = int(elapsed_time // 3600)
    minutes = int((elapsed_time % 3600) // 60)
    seconds = int(elapsed_time % 60)

    time_str = ""
    if hours > 0:
        time_str = f"{hours}h {minutes}m {seconds}s"
    elif minutes > 0:
        time_str = f"{minutes}m {seconds}s"
    else:
        time_str = f"{seconds}s"

    console.print(f"[dim]⏱️  Execution Time: {time_str}[/dim]")
    console.print(f"[dim]📊 Speed: {(final_total / elapsed_time):.0f} records/second[/dim]")

    console.print()
    console.print("[bold cyan]For more information, check the detailed logs in logs/[/bold cyan]")
    console.print()


def match_and_link_with_progress_tracking(matcher, table_name='seat_data'):
    """
    Alternative: Match with detailed progress bar (slower, more interactive)

    Args:
        matcher: AdvancedSQLiteMatcher instance
        table_name: Name of the seat data table
    """

    console.print()
    console.print("[bold cyan]🚀 Starting Matching Pipeline (Progress Mode)[/bold cyan]")
    console.print()

    # Get total records
    db_path = f"{matcher.config['database']['sqlite_path']}/{matcher.config['database']['seat_data_db']}"
    conn = sqlite3.connect(db_path)
    total = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    conn.close()

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeRemainingColumn(),
        console=console,
        transient=False
    ) as progress:
        task = progress.add_task(
            "[cyan]Matching records...",
            total=total
        )

        # Run matching
        start_time = time.time()
        matcher.match_and_link_database_driven(table_name=table_name)
        elapsed = time.time() - start_time

        # Final update
        progress.update(task, completed=total)

    console.print()
    console.print(f"[green]✅ Matching Complete in {elapsed:.1f}s[/green]")


if __name__ == '__main__':
    # Example usage
    from recent import AdvancedSQLiteMatcher

    matcher = AdvancedSQLiteMatcher()
    match_and_link_with_ux(matcher, table_name='seat_data', verbose=False)
