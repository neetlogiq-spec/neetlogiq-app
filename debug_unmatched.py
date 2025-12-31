import sqlite3
import re
from recent3 import AdvancedSQLiteMatcher
from rich.console import Console
from rich.table import Table

def debug_unmatched():
    console = Console()
    console.print("[bold cyan]🔍 Investigating Unmatched Records...[/bold cyan]")
    
    # 1. Load Master Data (for index check)
    matcher = AdvancedSQLiteMatcher()
    matcher.load_master_data()
    
    # 2. Fetch Unmatched Groups
    db_path = "data/sqlite/seat_data.db"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT group_id, college_name, address, normalized_address, state, record_count
        FROM group_matching_queue
        WHERE matched_college_id IS NULL
        ORDER BY record_count DESC
    """)
    rows = cursor.fetchall()
    
    if not rows:
        console.print("[green]✅ No unmatched records found![/green]")
        return

    console.print(f"[yellow]⚠️  Found {len(rows)} unmatched groups[/yellow]")
    
    for row in rows:
        console.print(f"\n[bold]Group ID: {row['group_id']} (Records: {row['record_count']})[/bold]")
        console.print(f"Name: {row['college_name']}")
        console.print(f"State: {row['state']}")
        console.print(f"Raw Address: '{row['address']}'")
        
        # Check for codes
        raw_codes = re.findall(r'\((\d{6})\)', row['address'] or '')
        
        if raw_codes:
            console.print(f"[bold red]Found Codes in Address: {raw_codes}[/bold red]")
            for code in raw_codes:
                if code in matcher.college_code_index:
                    college_ids = matcher.college_code_index[code]
                    console.print(f"  ✅ Code {code} exists in Master Index! Mapped to: {college_ids}")
                    # Fetch master college details
                    for cid in college_ids:
                        # Find college in master data
                        found = False
                        for stream in ['medical', 'dental', 'dnb']:
                            if stream in matcher.master_data:
                                for col in matcher.master_data[stream]['colleges']:
                                    if col['id'] == cid:
                                        console.print(f"     Master Name: {col['name']}")
                                        console.print(f"     Master State: {col.get('state', 'N/A')}")
                                        found = True
                                        break
                            if found: break
                else:
                    console.print(f"  ❌ Code {code} NOT found in Master Index")
        else:
            console.print("[dim]No codes found in address[/dim]")

    conn.close()

if __name__ == "__main__":
    debug_unmatched()
