#!/usr/bin/env python3
"""
Real-time Analytics and Monitoring System
Provides live insights into the matching process and data quality
"""

import sqlite3
import pandas as pd
import time
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
from rich.console import Console
from rich.table import Table
from rich.live import Live
from rich.layout import Layout
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
import json
from pathlib import Path

class RealtimeAnalytics:
    """Real-time analytics for counselling data matching"""
    
    def __init__(self, master_db_path: str, counselling_db_path: str):
        self.master_db_path = master_db_path
        self.counselling_db_path = counselling_db_path
        self.console = Console()
        self.start_time = datetime.now()
        
    def create_dashboard(self):
        """Create a real-time dashboard"""
        layout = Layout()
        
        # Define layout sections
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="main"),
            Layout(name="footer", size=3)
        )
        
        layout["main"].split_row(
            Layout(name="stats"),
            Layout(name="charts")
        )
        
        layout["stats"].split_column(
            Layout(name="match_rates"),
            Layout(name="data_quality"),
            Layout(name="performance")
        )
        
        return layout
    
    def get_match_statistics(self) -> Dict:
        """Get current match statistics"""
        conn = sqlite3.connect(self.counselling_db_path)
        
        # Overall match rates
        stats = pd.read_sql("""
            SELECT
                COUNT(*) as total_records,
                SUM(CASE WHEN master_college_id IS NOT NULL THEN 1 ELSE 0 END) as matched_colleges,
                SUM(CASE WHEN master_course_id IS NOT NULL THEN 1 ELSE 0 END) as matched_courses,
                SUM(CASE WHEN master_college_id IS NOT NULL AND master_course_id IS NOT NULL THEN 1 ELSE 0 END) as fully_matched,
                AVG(college_match_score) as avg_college_score,
                AVG(course_match_score) as avg_course_score
            FROM counselling_records
        """, conn).iloc[0].to_dict()
        
        # Calculate percentages
        stats['college_match_rate'] = (stats['matched_colleges'] / stats['total_records'] * 100) if stats['total_records'] > 0 else 0
        stats['course_match_rate'] = (stats['matched_courses'] / stats['total_records'] * 100) if stats['total_records'] > 0 else 0
        stats['full_match_rate'] = (stats['fully_matched'] / stats['total_records'] * 100) if stats['total_records'] > 0 else 0
        
        conn.close()
        return stats
    
    def get_data_quality_metrics(self) -> Dict:
        """Get data quality metrics"""
        conn = sqlite3.connect(self.counselling_db_path)
        
        # Data quality metrics
        quality = pd.read_sql("""
            SELECT
                COUNT(*) as total_records,
                SUM(CASE WHEN college_institute_raw IS NULL OR college_institute_raw = '' THEN 1 ELSE 0 END) as missing_colleges,
                SUM(CASE WHEN course_raw IS NULL OR course_raw = '' THEN 1 ELSE 0 END) as missing_courses,
                SUM(CASE WHEN state_raw IS NULL OR state_raw = '' THEN 1 ELSE 0 END) as missing_states,
                SUM(CASE WHEN category IS NULL OR category = '' THEN 1 ELSE 0 END) as missing_categories,
                SUM(CASE WHEN quota IS NULL OR quota = '' THEN 1 ELSE 0 END) as missing_quotas
            FROM counselling_records
        """, conn).iloc[0].to_dict()
        
        # Calculate percentages
        total = quality['total_records']
        if total > 0:
            quality['missing_college_pct'] = (quality['missing_colleges'] / total * 100)
            quality['missing_course_pct'] = (quality['missing_courses'] / total * 100)
            quality['missing_state_pct'] = (quality['missing_states'] / total * 100)
            quality['missing_category_pct'] = (quality['missing_categories'] / total * 100)
            quality['missing_quota_pct'] = (quality['missing_quotas'] / total * 100)
        
        conn.close()
        return quality
    
    def get_performance_metrics(self) -> Dict:
        """Get performance metrics"""
        conn = sqlite3.connect(self.counselling_db_path)
        
        # Performance metrics by partition
        performance = pd.read_sql("""
            SELECT
                p.partition_key,
                p.source,
                p.year,
                p.level,
                p.total_records,
                p.matched_records,
                p.unmatched_records,
                p.needs_review_records,
                p.last_updated
            FROM partition_metadata p
            ORDER BY p.last_updated DESC
            LIMIT 10
        """, conn)
        
        conn.close()
        return performance.to_dict('records')
    
    def get_top_unmatched(self) -> List[Dict]:
        """Get top unmatched records"""
        conn = sqlite3.connect(self.counselling_db_path)
        
        # Top unmatched colleges
        unmatched = pd.read_sql("""
            SELECT
                college_institute_raw,
                state_raw,
                COUNT(*) as record_count,
                GROUP_CONCAT(DISTINCT partition_key) as partitions
            FROM counselling_records
            WHERE master_college_id IS NULL
            GROUP BY college_institute_raw, state_raw
            ORDER BY record_count DESC
            LIMIT 10
        """, conn)
        
        conn.close()
        return unmatched.to_dict('records')
    
    def render_match_rates_table(self) -> Table:
        """Render match rates table"""
        stats = self.get_match_statistics()
        
        table = Table(title="Match Rates", show_header=True, header_style="bold magenta")
        table.add_column("Metric", style="cyan")
        table.add_column("Count", justify="right", style="white")
        table.add_column("Percentage", justify="right", style="green")
        
        table.add_row(
            "Total Records",
            f"{stats['total_records']:,}",
            "100%"
        )
        table.add_row(
            "Matched Colleges",
            f"{stats['matched_colleges']:,}",
            f"{stats['college_match_rate']:.1f}%"
        )
        table.add_row(
            "Matched Courses",
            f"{stats['matched_courses']:,}",
            f"{stats['course_match_rate']:.1f}%"
        )
        table.add_row(
            "Fully Matched",
            f"{stats['fully_matched']:,}",
            f"{stats['full_match_rate']:.1f}%"
        )
        
        return table
    
    def render_data_quality_table(self) -> Table:
        """Render data quality table"""
        quality = self.get_data_quality_metrics()
        
        table = Table(title="Data Quality", show_header=True, header_style="bold magenta")
        table.add_column("Field", style="cyan")
        table.add_column("Missing", justify="right", style="red")
        table.add_column("Percentage", justify="right", style="yellow")
        
        table.add_row(
            "Colleges",
            f"{quality['missing_colleges']:,}",
            f"{quality.get('missing_college_pct', 0):.1f}%"
        )
        table.add_row(
            "Courses",
            f"{quality['missing_courses']:,}",
            f"{quality.get('missing_course_pct', 0):.1f}%"
        )
        table.add_row(
            "States",
            f"{quality['missing_states']:,}",
            f"{quality.get('missing_state_pct', 0):.1f}%"
        )
        table.add_row(
            "Categories",
            f"{quality['missing_categories']:,}",
            f"{quality.get('missing_category_pct', 0):.1f}%"
        )
        table.add_row(
            "Quotas",
            f"{quality['missing_quotas']:,}",
            f"{quality.get('missing_quota_pct', 0):.1f}%"
        )
        
        return table
    
    def render_performance_table(self) -> Table:
        """Render performance table"""
        performance = self.get_performance_metrics()
        
        table = Table(title="Recent Performance", show_header=True, header_style="bold magenta")
        table.add_column("Partition", style="cyan")
        table.add_column("Total", justify="right", style="white")
        table.add_column("Matched", justify="right", style="green")
        table.add_column("Rate", justify="right", style="yellow")
        
        for perf in performance[:5]:  # Show top 5
            match_rate = (perf['matched_records'] / perf['total_records'] * 100) if perf['total_records'] > 0 else 0
            table.add_row(
                perf['partition_key'],
                f"{perf['total_records']:,}",
                f"{perf['matched_records']:,}",
                f"{match_rate:.1f}%"
            )
        
        return table
    
    def render_unmatched_table(self) -> Table:
        """Render top unmatched table"""
        unmatched = self.get_top_unmatched()
        
        table = Table(title="Top Unmatched Colleges", show_header=True, header_style="bold magenta")
        table.add_column("College", style="red")
        table.add_column("State", style="yellow")
        table.add_column("Records", justify="right", style="white")
        
        for item in unmatched[:5]:  # Show top 5
            college = item['college_institute_raw'][:40] + "..." if len(item['college_institute_raw']) > 40 else item['college_institute_raw']
            table.add_row(
                college,
                item['state_raw'] or "Unknown",
                f"{item['record_count']:,}"
            )
        
        return table
    
    def start_live_dashboard(self, refresh_interval: int = 5):
        """Start live dashboard with automatic refresh"""
        try:
            with Live(self.create_dashboard(), refresh_per_second=1) as live:
                while True:
                    layout = self.create_dashboard()
                    
                    # Update header
                    elapsed = datetime.now() - self.start_time
                    layout["header"].update(
                        Panel(
                            f"[bold blue]NeetLogIQ Real-time Analytics[/bold blue]\n"
                            f"Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | "
                            f"Running for: {str(elapsed).split('.')[0]}",
                            border_style="blue"
                        )
                    )
                    
                    # Update stats section
                    layout["stats"]["match_rates"].update(
                        Panel(self.render_match_rates_table(), border_style="green")
                    )
                    layout["stats"]["data_quality"].update(
                        Panel(self.render_data_quality_table(), border_style="yellow")
                    )
                    layout["stats"]["performance"].update(
                        Panel(self.render_performance_table(), border_style="cyan")
                    )
                    
                    # Update charts section
                    layout["charts"]["left"].update(
                        Panel(self.render_unmatched_table(), border_style="red")
                    )
                    
                    # Update footer
                    layout["footer"].update(
                        Panel(
                            "[dim]Press Ctrl+C to exit[/dim]",
                            border_style="white"
                        )
                    )
                    
                    live.update(layout)
                    time.sleep(refresh_interval)
        except KeyboardInterrupt:
            self.console.print("\n[green]✅ Dashboard stopped[/green]")
    
    def export_analytics_report(self, output_path: str = None):
        """Export analytics report to JSON"""
        if not output_path:
            output_path = f"analytics_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'match_statistics': self.get_match_statistics(),
            'data_quality': self.get_data_quality_metrics(),
            'performance': self.get_performance_metrics(),
            'top_unmatched': self.get_top_unmatched()
        }
        
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        self.console.print(f"[green]✅ Analytics report exported to {output_path}[/green]")
        return output_path

# Example usage
if __name__ == "__main__":
    analytics = RealtimeAnalytics(
        "/Users/kashyapanand/Public/New/data/sqlite/master_data.db",
        "/Users/kashyapanand/Public/New/data/sqlite/counselling_data_partitioned.db"
    )
    
    # Start live dashboard
    analytics.start_live_dashboard()
