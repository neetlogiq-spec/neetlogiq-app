#!/usr/bin/env python3
"""
INTERACTIVE REVIEW DASHBOARD - Enhanced Version

A rich-based dashboard for interactive review of unmatched records.
Provides a clean UI for reviewing and matching colleges, courses, etc.
Enhanced with state, address, and course type fields.
"""

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.layout import Layout
from rich.text import Text
from rich.columns import Columns
from rich import box


class ReviewDashboard:
    """Interactive dashboard for reviewing unmatched records."""
    
    def __init__(self, console: Console = None):
        self.console = console or Console()
    
    def render(
        self,
        current_item: dict,
        matches: list,
        queue_items: list = None,
        stats: dict = None,
    ):
        """
        Render the review dashboard.
        
        Args:
            current_item: Dict with keys:
                - name: Record name (required)
                - count: Records affected (optional)
                - state: State/region (optional)
                - address: Full address (optional)
                - course_type: Course type (optional)
                - courses: Related courses (optional)
            matches: List of dicts with keys:
                - name: Match name
                - score: Match score (0-100)
                - id: Master ID
                - level: Match level label
                - state: Match state (optional)
                - address: Match address (optional)
            queue_items: List of upcoming items (optional)
            stats: Dict with 'reviewed', 'matched', 'skipped', 'remaining' keys
        """
        # Header
        self.console.print()
        self.console.print(Panel.fit(
            f"[bold cyan]📋 Review Item[/bold cyan]",
            border_style="cyan"
        ))
        
        # Current item being reviewed - ENHANCED with more fields
        self.console.print(f"\n[bold white]{current_item.get('name', 'Unknown')}[/bold white]")
        
        # Show additional context fields
        details = []
        
        count = current_item.get('count', 0)
        if count:
            details.append(f"[dim]Records:[/dim] {count:,}")
        
        state = current_item.get('state', '')
        if state:
            details.append(f"[dim]State:[/dim] [yellow]{state}[/yellow]")
        
        address = current_item.get('address', '')
        if address:
            # Truncate long addresses
            addr_display = address[:60] + "..." if len(address) > 60 else address
            details.append(f"[dim]Address:[/dim] [cyan]{addr_display}[/cyan]")
        
        course_type = current_item.get('course_type', '')
        if course_type:
            details.append(f"[dim]Course Type:[/dim] [magenta]{course_type}[/magenta]")
        
        courses = current_item.get('courses', '')
        if courses:
            courses_display = courses[:50] + "..." if len(str(courses)) > 50 else courses
            details.append(f"[dim]Courses:[/dim] [blue]{courses_display}[/blue]")
        
        # Print details in a compact format
        if details:
            self.console.print("  " + " | ".join(details[:3]))  # First 3 on one line
            if len(details) > 3:
                self.console.print("  " + " | ".join(details[3:]))  # Rest on next line
        
        # Match suggestions - Use formatted text instead of table to avoid truncation
        if matches:
            self.console.print(f"\n[bold cyan]Suggested Matches:[/bold cyan]")
            
            for i, match in enumerate(matches, 1):
                score = match.get('score', 0)
                score_color = "green" if score >= 90 else "yellow" if score >= 70 else "red"
                
                match_name = match.get('name', '')
                match_id = match.get('id', '')
                match_state = match.get('state', '')
                match_addr = match.get('address', match.get('city', ''))
                
                # Format each match as a compact block
                self.console.print(f"\n  [{i}] [bold white]{match_name}[/bold white]")
                self.console.print(f"      ID: [green]{match_id}[/green] | Score: [{score_color}]{score}%[/{score_color}] | State: [blue]{match_state}[/blue]")
                if match_addr:
                    self.console.print(f"      Address: [dim]{match_addr}[/dim]")
            
            # Show validation warnings if state mismatch
            seat_state = current_item.get('state', '').upper()
            if seat_state:
                for i, match in enumerate(matches[:3], 1):
                    match_state = match.get('state', '').upper()
                    if match_state and seat_state and match_state != seat_state:
                        if not self._states_match(seat_state, match_state):
                            self.console.print(f"\n  [yellow]⚠ Match {i}: State mismatch ({seat_state} ≠ {match_state})[/yellow]")
        else:
            self.console.print("\n[yellow]No matches found[/yellow]")
        
        # Queue preview (upcoming items)
        if queue_items and len(queue_items) > 0:
            self.console.print(f"\n[dim]Next in queue: ", end="")
            queue_names = [item.get('name', '')[:30] for item in queue_items[:3]]
            self.console.print(f"[dim]" + ", ".join(queue_names) + "[/dim]")
        
        # Stats bar
        if stats:
            self.console.print()
            reviewed = stats.get('reviewed', 0)
            matched = stats.get('matched', 0)
            skipped = stats.get('skipped', 0)
            remaining = stats.get('remaining', 0)
            
            # Calculate match rate
            total = reviewed if reviewed > 0 else 1
            match_rate = (matched / total) * 100
            
            stats_text = (
                f"[dim]Reviewed: {reviewed} | "
                f"Matched: [green]{matched}[/green] ({match_rate:.0f}%) | "
                f"Skipped: [yellow]{skipped}[/yellow] | "
                f"Remaining: [cyan]{remaining}[/cyan][/dim]"
            )
            self.console.print(stats_text)
        
        # Action hints
        self.console.print(f"\n[bold]Actions:[/bold]")
        if matches:
            self.console.print("  [1-5] Select match by number")
        self.console.print("  [ID]  Enter master ID directly (e.g., MED001, DEN001, CRS001)")
        self.console.print("  [s]   Skip this item")
        self.console.print("  [a]   Show all matches (if available)")
        self.console.print("  [x]   Exit review")
        self.console.print()
    
    def _states_match(self, state1: str, state2: str) -> bool:
        """Check if two states match, considering common aliases."""
        if state1 == state2:
            return True
        
        # Common state aliases
        aliases = {
            'DELHI': ['DELHI (NCT)', 'NCT OF DELHI', 'NEW DELHI'],
            'DELHI (NCT)': ['DELHI', 'NCT OF DELHI', 'NEW DELHI'],
            'ORISSA': ['ODISHA'],
            'ODISHA': ['ORISSA'],
            'UTTARANCHAL': ['UTTARAKHAND'],
            'UTTARAKHAND': ['UTTARANCHAL'],
            'PONDICHERRY': ['PUDUCHERRY'],
            'PUDUCHERRY': ['PONDICHERRY'],
        }
        
        if state1 in aliases:
            return state2 in aliases[state1]
        return False
    
    def show_confirmation(self, item_name: str, match_name: str, match_id: str, count: int, 
                          item_state: str = None, match_state: str = None):
        """Show confirmation dialog for a match with state validation."""
        content = (
            f"[bold yellow]Confirm Match[/bold yellow]\n\n"
            f"Item: [white]{item_name}[/white]\n"
            f"Match: [cyan]{match_name}[/cyan] ({match_id})\n"
            f"Records: [green]{count:,}[/green]"
        )
        
        if item_state and match_state:
            if item_state.upper() == match_state.upper():
                content += f"\nState: [green]✓ {item_state}[/green]"
            else:
                content += f"\nState: [red]⚠ {item_state} → {match_state}[/red]"
        
        self.console.print()
        self.console.print(Panel.fit(content, border_style="yellow"))
    
    def show_success(self, count: int, match_name: str, match_id: str = None):
        """Show success message after matching."""
        id_str = f" ({match_id})" if match_id else ""
        self.console.print(f"[green]✅ Matched {count:,} records to {match_name}{id_str}[/green]")
    
    def show_error(self, message: str):
        """Show error message."""
        self.console.print(f"[red]❌ {message}[/red]")
    
    def show_skip(self):
        """Show skip message."""
        self.console.print("[yellow]⏭️  Skipped[/yellow]")
    
    def show_state_warning(self, seat_state: str, match_state: str):
        """Show state mismatch warning."""
        self.console.print(f"[yellow]⚠ State mismatch: Record is in {seat_state}, but match is in {match_state}[/yellow]")
    
    def show_address_comparison(self, seat_address: str, match_address: str):
        """Show side-by-side address comparison."""
        self.console.print("\n[bold]Address Comparison:[/bold]")
        
        table = Table(show_header=True, header_style="bold", box=box.SIMPLE)
        table.add_column("Record Address", style="cyan", max_width=40)
        table.add_column("Match Address", style="green", max_width=40)
        
        table.add_row(
            seat_address[:40] if seat_address else "(none)",
            match_address[:40] if match_address else "(none)"
        )
        
        self.console.print(table)


# Module-level convenience function
def create_dashboard(console: Console = None) -> ReviewDashboard:
    """Create a new ReviewDashboard instance."""
    return ReviewDashboard(console)


if __name__ == "__main__":
    # Demo/test the enhanced dashboard
    console = Console()
    dashboard = ReviewDashboard(console)
    
    # Sample data with enhanced fields
    current_item = {
        'name': 'GOVERNMENT MEDICAL COLLEGE, MUMBAI',
        'count': 150,
        'state': 'MAHARASHTRA',
        'address': 'Dr. E. Moses Road, Haji Ali, Mumbai 400012',
        'course_type': 'MBBS',
        'courses': 'MBBS, MD General Medicine, MS Surgery'
    }
    
    matches = [
        {
            'name': 'Government Medical College Mumbai', 
            'id': 'MED001', 
            'score': 95, 
            'level': 'Excellent',
            'state': 'MAHARASHTRA',
            'address': 'Haji Ali, Mumbai'
        },
        {
            'name': 'GMC Mumbai', 
            'id': 'MED002', 
            'score': 82, 
            'level': 'Good',
            'state': 'MAHARASHTRA',
            'address': 'Parel, Mumbai'
        },
        {
            'name': 'Govt Medical College Pune', 
            'id': 'MED003', 
            'score': 65, 
            'level': 'Fair',
            'state': 'MAHARASHTRA',
            'address': 'Sassoon Road, Pune'
        },
    ]
    
    queue = [
        {'name': 'AIIMS Delhi'},
        {'name': 'JIPMER Puducherry'},
        {'name': 'CMC Vellore'},
    ]
    
    stats = {
        'reviewed': 10,
        'matched': 8,
        'skipped': 2,
        'remaining': 50
    }
    
    dashboard.render(current_item, matches, queue, stats)
    
    # Demo confirmation
    print("\n--- Confirmation Demo ---")
    dashboard.show_confirmation(
        "GOVERNMENT MEDICAL COLLEGE, MUMBAI",
        "Government Medical College Mumbai",
        "MED001",
        150,
        "MAHARASHTRA",
        "MAHARASHTRA"
    )
