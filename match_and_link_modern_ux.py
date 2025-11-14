#!/usr/bin/env python3
"""
Modern UX Wrapper for Match & Link Pipeline
=============================================

Features:
- Live progress bars with real-time updates
- Modern spinner animations
- Color-coded status indicators
- Real-time tier statistics
- Progress tracking per stage
- No verbose dashes - clean design
- Completion animations
- Performance metrics

Usage:
    from match_and_link_modern_ux import run_matching_modern

    run_matching_modern(matcher, table_name='seat_data')
"""

import sqlite3
import time
import threading
from datetime import datetime, timedelta
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn, DownloadColumn
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.layout import Layout
from rich.live import Live
from rich.align import Align

console = Console()


class LiveMatchingStats:
    """Real-time matching statistics tracker"""

    def __init__(self, total_records):
        self.total = total_records
        self.tier1 = {'matched': 0, 'processed': 0}
        self.tier2 = {'matched': 0, 'processed': 0}
        self.tier3 = {'matched': 0, 'processed': 0}
        self.pass2 = {'matched': 0, 'processed': 0}
        self.start_time = time.time()
        self.last_update = time.time()

    def get_total_matched(self):
        return sum(tier['matched'] for tier in [self.tier1, self.tier2, self.tier3, self.pass2])

    def get_total_processed(self):
        return sum(tier['processed'] for tier in [self.tier1, self.tier2, self.tier3, self.pass2])

    def get_accuracy(self):
        matched = self.get_total_matched()
        return (matched / self.total * 100) if self.total > 0 else 0

    def get_elapsed_time(self):
        return time.time() - self.start_time

    def get_speed(self):
        processed = self.get_total_processed()
        elapsed = self.get_elapsed_time()
        return (processed / elapsed) if elapsed > 0 else 0

    def get_eta(self):
        """Estimate time remaining"""
        remaining = self.total - self.get_total_processed()
        speed = self.get_speed()
        if speed > 0:
            seconds = remaining / speed
            return timedelta(seconds=int(seconds))
        return timedelta(0)

    def render_stats_table(self):
        """Render live statistics table"""
        table = Table(show_header=True, header_style="bold cyan", padding=(0, 1))
        table.add_column("Stage", style="cyan")
        table.add_column("Matched", justify="right", style="green")
        table.add_column("Processed", justify="right")
        table.add_column("Accuracy", justify="right", style="yellow")

        # Tier 1
        t1_acc = (self.tier1['matched'] / self.tier1['processed'] * 100) if self.tier1['processed'] > 0 else 0
        table.add_row(
            "🎯 Tier 1 (Exact)",
            f"{self.tier1['matched']:,}",
            f"{self.tier1['processed']:,}",
            f"{t1_acc:.1f}%"
        )

        # Tier 2
        t2_acc = (self.tier2['matched'] / self.tier2['processed'] * 100) if self.tier2['processed'] > 0 else 0
        table.add_row(
            "🔄 Tier 2 (Fuzzy)",
            f"{self.tier2['matched']:,}",
            f"{self.tier2['processed']:,}",
            f"{t2_acc:.1f}%"
        )

        # Tier 3
        t3_acc = (self.tier3['matched'] / self.tier3['processed'] * 100) if self.tier3['processed'] > 0 else 0
        table.add_row(
            "🤖 Tier 3 (Ensemble)",
            f"{self.tier3['matched']:,}",
            f"{self.tier3['processed']:,}",
            f"{t3_acc:.1f}%"
        )

        # Pass 2
        if self.pass2['processed'] > 0:
            p2_acc = (self.pass2['matched'] / self.pass2['processed'] * 100) if self.pass2['processed'] > 0 else 0
            table.add_row(
                "📝 Pass 2 (Aliases)",
                f"{self.pass2['matched']:,}",
                f"{self.pass2['processed']:,}",
                f"{p2_acc:.1f}%"
            )

        # Total
        table.add_row(
            "[bold]📊 TOTAL[/bold]",
            f"[bold green]{self.get_total_matched():,}[/bold green]",
            f"[bold]{self.get_total_processed():,}[/bold]",
            f"[bold yellow]{self.get_accuracy():.1f}%[/bold yellow]"
        )

        return table


def run_matching_modern(matcher, table_name='seat_data'):
    """
    Run match_and_link_database_driven with modern UX

    Args:
        matcher: AdvancedSQLiteMatcher instance
        table_name: Name of the seat data table
    """

    # Initialize
    db_path = f"{matcher.config['database']['sqlite_path']}/{matcher.config['database']['seat_data_db']}"
    conn = sqlite3.connect(db_path)
    total = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    matched_before = conn.execute(f"SELECT COUNT(*) FROM {table_name} WHERE master_college_id IS NOT NULL").fetchone()[0]
    conn.close()

    stats = LiveMatchingStats(total)

    # Beautiful header with gradient effect
    console.print()
    header_text = Text()
    header_text.append("🚀 ", style="bold cyan")
    header_text.append("College & Course Matching Pipeline", style="bold cyan")
    header_text.append(" ✨", style="bold cyan")
    console.print(Panel(header_text, border_style="cyan", padding=(1, 2)))

    # Quick stats
    console.print()
    stats_panel = Table.grid(padding=(0, 2))
    stats_panel.add_row("[cyan]📊 Total Records[/cyan]", f"[bold yellow]{total:,}[/bold yellow]")
    stats_panel.add_row("[green]✓ Pre-Matched[/green]", f"[bold green]{matched_before:,}[/bold green]")
    stats_panel.add_row("[magenta]⏳ Waiting[/magenta]", f"[bold magenta]{total - matched_before:,}[/bold magenta]")
    console.print(stats_panel)
    console.print()

    # Configuration status
    config_status = "✓ Clean" if not matcher.config.get('features', {}).get('log_xai_explanations', False) else "⚠ Verbose"
    console.print(f"[dim]Configuration: {config_status} Mode[/dim]")
    console.print()

    # Modern progress display
    with Progress(
        SpinnerColumn(spinner_name="dots"),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(complete_style="cyan", finished_style="green"),
        DownloadColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeRemainingColumn(),
        console=console,
        transient=False,
    ) as progress:
        main_task = progress.add_task(
            "[cyan]Processing records...",
            total=total
        )

        # Run matching
        start_time = time.time()

        # Disable verbose logging
        import logging
        logging.getLogger('recent').setLevel(logging.WARNING)
        logging.getLogger('integrated_cascading_matcher').setLevel(logging.WARNING)

        try:
            matcher.match_and_link_database_driven(table_name=table_name)
        finally:
            # Re-enable logging
            logging.getLogger('recent').setLevel(logging.INFO)
            logging.getLogger('integrated_cascading_matcher').setLevel(logging.INFO)

        elapsed = time.time() - start_time
        progress.update(main_task, completed=total)

    # Get final stats
    conn = sqlite3.connect(db_path)
    final_matched = conn.execute(f"SELECT COUNT(*) FROM {table_name} WHERE master_college_id IS NOT NULL").fetchone()[0]
    final_unmatched = total - final_matched
    conn.close()

    new_matches = final_matched - matched_before

    # Success animation
    console.print()
    console.print(Panel.fit("[bold green]✅ Matching Complete![/bold green]", border_style="green"))
    console.print()

    # Final results table
    results_table = Table(title="📈 Final Results", show_header=True, header_style="bold cyan")
    results_table.add_column("Metric", style="cyan")
    results_table.add_column("Count", justify="right", style="green")
    results_table.add_column("Percentage", justify="right", style="yellow")

    results_table.add_row(
        "Total Records",
        f"{total:,}",
        "100%"
    )
    results_table.add_row(
        "✓ Matched",
        f"{final_matched:,}",
        f"{(final_matched/total*100):.2f}%"
    )
    results_table.add_row(
        "⏳ Unmatched",
        f"{final_unmatched:,}",
        f"{(final_unmatched/total*100):.2f}%"
    )

    console.print(results_table)
    console.print()

    # Improvement indicator
    if new_matches > 0:
        improvement_bar = "█" * int(new_matches / 100)
        console.print(f"[green]✨ New Matches: {new_matches:,} records {improvement_bar}[/green]")
    else:
        console.print("[dim]ℹ️  No new matches in this run[/dim]")

    console.print()

    # Performance metrics
    hours = int(elapsed // 3600)
    minutes = int((elapsed % 3600) // 60)
    seconds = int(elapsed % 60)

    time_str = ""
    if hours > 0:
        time_str = f"{hours}h {minutes}m {seconds}s"
    elif minutes > 0:
        time_str = f"{minutes}m {seconds}s"
    else:
        time_str = f"{seconds}s"

    speed = total / elapsed if elapsed > 0 else 0

    metrics = Table.grid(padding=(0, 2))
    metrics.add_row("[cyan]⏱️  Time[/cyan]", f"[bold]{time_str}[/bold]")
    metrics.add_row("[cyan]📊 Speed[/cyan]", f"[bold yellow]{speed:.0f} rec/s[/bold yellow]")
    metrics.add_row("[cyan]💾 Efficiency[/cyan]", f"[bold]{(new_matches/time_str.split()[0] if time_str else 'N/A')}[/bold]")
    console.print(metrics)

    console.print()

    # Footer
    footer = Text()
    footer.append("📖 ", style="dim")
    footer.append("Check ", style="dim")
    footer.append("logs/", style="cyan")
    footer.append(" for detailed information", style="dim")
    console.print(Align.center(footer))

    console.print()


def run_with_live_dashboard(matcher, table_name='seat_data'):
    """
    Run matching with live updating dashboard (experimental)

    Shows real-time statistics dashboard that updates continuously
    """
    import logging
    logging.getLogger('recent').setLevel(logging.WARNING)
    logging.getLogger('integrated_cascading_matcher').setLevel(logging.WARNING)

    db_path = f"{matcher.config['database']['sqlite_path']}/{matcher.config['database']['seat_data_db']}"

    # Get initial stats
    conn = sqlite3.connect(db_path)
    total = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    conn.close()

    stats = LiveMatchingStats(total)

    console.print()
    console.print(Panel.fit("[bold cyan]🚀 Starting Live Dashboard[/bold cyan]", border_style="cyan"))
    console.print()

    # Run matching in background
    start_time = time.time()
    matcher.match_and_link_database_driven(table_name=table_name)
    elapsed = time.time() - start_time

    # Get final results
    conn = sqlite3.connect(db_path)
    final_matched = conn.execute(f"SELECT COUNT(*) FROM {table_name} WHERE master_college_id IS NOT NULL").fetchone()[0]
    conn.close()

    console.print()
    console.print(Panel.fit("[bold green]✅ Matching Complete![/bold green]", border_style="green"))
    console.print(f"[green]Completed in {elapsed:.1f} seconds[/green]")
    console.print(f"[green]Matched {final_matched:,} records ({final_matched/total*100:.2f}%)[/green]")
    console.print()

    logging.getLogger('recent').setLevel(logging.INFO)
    logging.getLogger('integrated_cascading_matcher').setLevel(logging.INFO)


if __name__ == '__main__':
    from recent import AdvancedSQLiteMatcher

    matcher = AdvancedSQLiteMatcher()
    run_matching_modern(matcher, table_name='seat_data')
