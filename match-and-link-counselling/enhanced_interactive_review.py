#!/usr/bin/env python3
"""
Enhanced Interactive Review System with State Mapping
Integrates college, course, and state mapping in a single interface
"""

import sqlite3
import pandas as pd
import sys
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.prompt import Prompt, Confirm
from rich.panel import Panel
from rich.progress import Progress
from rich import print as rprint
from typing import Dict, List, Tuple, Optional
import re

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))
from scripts.create_state_mapping import get_normalized_state, CANONICAL_STATES

class EnhancedInteractiveReview:
    """Enhanced interactive review system with state mapping"""
    
    def __init__(self):
        self.console = Console()
        self.master_db_path = "/Users/kashyapanand/Public/New/data/sqlite/master_data.db"
        self.counselling_db_path = "/Users/kashyapanand/Public/New/data/sqlite/counselling_data_partitioned.db"
        
        # Load master data
        self.master_data = self._load_master_data()
        self.state_mappings = self._load_state_mappings()
        
        # Statistics
        self.stats = {
            'reviewed': 0,
            'college_aliases_created': 0,
            'course_aliases_created': 0,
            'state_mappings_created': 0,
            'skipped': 0,
            'start_time': pd.Timestamp.now()
        }
    
    def _load_master_data(self) -> Dict:
        """Load master colleges, courses, and states"""
        master_conn = sqlite3.connect(self.master_db_path)
        
        # Load colleges
        medical_df = pd.read_sql("SELECT * FROM medical_colleges", master_conn)
        dental_df = pd.read_sql("SELECT * FROM dental_colleges", master_conn)
        dnb_df = pd.read_sql("SELECT * FROM dnb_colleges", master_conn)
        
        # Add type column
        medical_df['type'] = 'MEDICAL'
        dental_df['type'] = 'DENTAL'
        dnb_df['type'] = 'DNB'
        
        # Combine all colleges
        colleges_df = pd.concat([medical_df, dental_df, dnb_df], ignore_index=True)
        
        # Load courses
        courses_df = pd.read_sql("SELECT * FROM courses", master_conn)
        
        # Load states
        states_df = pd.read_sql("SELECT * FROM states", master_conn)
        
        master_conn.close()
        
        return {
            'colleges': colleges_df.to_dict('records'),
            'courses': courses_df.to_dict('records'),
            'states': states_df.to_dict('records')
        }
    
    def _load_state_mappings(self) -> Dict:
        """Load existing state mappings"""
        conn = sqlite3.connect(self.master_db_path)
        
        try:
            mappings_df = pd.read_sql("""
                SELECT raw_state, normalized_state, is_verified
                FROM state_mappings
                WHERE is_verified = 1
            """, conn)
            
            conn.close()
            return dict(zip(mappings_df['raw_state'], mappings_df['normalized_state']))
        except:
            conn.close()
            return {}
    
    def refresh_and_apply_state_mappings(self):
        """Refresh state mappings from master database and apply to all counselling records"""
        self.console.print("\n[bold cyan]🔄 Refreshing and Applying State Mappings[/bold cyan]")
        
        # Reload state mappings from master database
        self.state_mappings = self._load_state_mappings()
        
        # Get all state mappings
        master_conn = sqlite3.connect(self.master_db_path)
        state_mappings_df = pd.read_sql("""
            SELECT raw_state, normalized_state 
            FROM state_mappings 
            WHERE is_verified = 1 AND raw_state != normalized_state
        """, master_conn)
        master_conn.close()
        
        if len(state_mappings_df) == 0:
            self.console.print("[green]✅ No new state mappings to apply[/green]")
            return
        
        # Apply mappings to counselling records
        counselling_conn = sqlite3.connect(self.counselling_db_path)
        cursor = counselling_conn.cursor()
        
        updated_count = 0
        for _, row in state_mappings_df.iterrows():
            # Get the state ID from master database
            master_conn = sqlite3.connect(self.master_db_path)
            state_cursor = master_conn.cursor()
            state_cursor.execute("SELECT id FROM states WHERE normalized_name = ?", (row['normalized_state'],))
            state_result = state_cursor.fetchone()
            master_conn.close()
            
            state_id = state_result[0] if state_result else None
            
            # Update records with this state mapping
            cursor.execute("""
                UPDATE counselling_records
                SET state_normalized = ?,
                    master_state_id = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE state_raw = ? AND state_normalized != ?
            """, (row['normalized_state'], state_id, row['raw_state'], row['normalized_state']))
            
            rows_updated = cursor.rowcount
            if rows_updated > 0:
                updated_count += rows_updated
                self.console.print(f"  • Mapped '{row['raw_state']}' → '{row['normalized_state']}' ({rows_updated} records)")
        
        counselling_conn.commit()
        counselling_conn.close()
        
        self.console.print(f"\n[green]✅ Applied state mappings to {updated_count} records[/green]")
    
    def show_main_menu(self):
        """Display main menu options"""
        self.console.print(Panel.fit(
            "[bold blue]🔍 Enhanced Interactive Review System[/bold blue]\n"
            "[dim]Review and map colleges, courses, and states[/dim]",
            border_style="blue"
        ))
        
        table = Table(title="Review Options")
        table.add_column("Option", style="cyan")
        table.add_column("Description", style="white")
        
        table.add_row("1", "Review Unmatched Colleges")
        table.add_row("2", "Review Unmatched Courses")
        table.add_row("3", "Review Unmapped States")
        table.add_row("4", "Review All (Colleges, Courses & States)")
        table.add_row("5", "Refresh & Apply State Mappings")
        table.add_row("6", "Exit")
        
        self.console.print(table)
        
        choice = Prompt.ask("Select option", choices=["1", "2", "3", "4", "5", "6"])
        return choice
    
    def review_unmatched_colleges(self):
        """Review unmatched colleges"""
        self.console.print("\n[bold yellow]🏫 Reviewing Unmatched Colleges[/bold yellow]")
        
        conn = sqlite3.connect(self.counselling_db_path)
        
        # Get unmatched colleges
        unmatched = pd.read_sql("""
            SELECT DISTINCT
                college_institute_raw,
                college_institute_normalized,
                state_raw,
                state_normalized,
                COUNT(*) as record_count,
                GROUP_CONCAT(DISTINCT partition_key) as partitions
            FROM counselling_records
            WHERE master_college_id IS NULL
            GROUP BY college_institute_raw, state_raw
            ORDER BY record_count DESC
            LIMIT 50
        """, conn)
        
        conn.close()
        
        if len(unmatched) == 0:
            self.console.print("[green]✅ No unmatched colleges found![/green]")
            return
        
        self.console.print(f"Found {len(unmatched)} unmatched college groups")
        
        for idx, row in unmatched.iterrows():
            self._review_college_record(row)
            self.stats['reviewed'] += 1
            
            # Ask if user wants to continue
            if idx < len(unmatched) - 1:
                if not Confirm.ask("Continue to next college?"):
                    break
    
    def review_unmatched_courses(self):
        """Review unmatched courses"""
        self.console.print("\n[bold yellow]📚 Reviewing Unmatched Courses[/bold yellow]")
        
        conn = sqlite3.connect(self.counselling_db_path)
        
        # Get unmatched courses
        unmatched = pd.read_sql("""
            SELECT DISTINCT
                course_raw,
                course_normalized,
                COUNT(*) as record_count,
                GROUP_CONCAT(DISTINCT partition_key) as partitions
            FROM counselling_records
            WHERE master_course_id IS NULL
            GROUP BY course_raw
            ORDER BY record_count DESC
            LIMIT 50
        """, conn)
        
        conn.close()
        
        if len(unmatched) == 0:
            self.console.print("[green]✅ No unmatched courses found![/green]")
            return
        
        self.console.print(f"Found {len(unmatched)} unmatched course groups")
        
        for idx, row in unmatched.iterrows():
            self._review_course_record(row)
            self.stats['reviewed'] += 1
            
            # Ask if user wants to continue
            if idx < len(unmatched) - 1:
                if not Confirm.ask("Continue to next course?"):
                    break
    
    def review_unmapped_states(self):
        """Review unmapped states"""
        self.console.print("\n[bold yellow]📍 Reviewing Unmapped States[/bold yellow]")
        
        # Get all valid states from master database
        master_conn = sqlite3.connect(self.master_db_path)
        valid_states_df = pd.read_sql("SELECT normalized_name FROM states", master_conn)
        master_conn.close()
        valid_states = set(valid_states_df['normalized_name'].tolist())
        
        # Get unmapped states from counselling database
        conn = sqlite3.connect(self.counselling_db_path)
        
        # Get all states from counselling records
        all_states_df = pd.read_sql("""
            SELECT DISTINCT
                state_raw,
                state_normalized,
                COUNT(*) as record_count,
                GROUP_CONCAT(DISTINCT partition_key) as partitions
            FROM counselling_records
            WHERE state_raw IS NOT NULL 
            AND state_raw != ''
            GROUP BY state_raw
            ORDER BY record_count DESC
            LIMIT 50
        """, conn)
        
        # Filter out states that are already mapped
        unmapped = all_states_df[~all_states_df['state_normalized'].isin(valid_states)]
        
        conn.close()
        
        if len(unmapped) == 0:
            self.console.print("[green]✅ No unmapped states found![/green]")
            return
        
        self.console.print(f"Found {len(unmapped)} unmapped state groups")
        
        for idx, row in unmapped.iterrows():
            self._review_state_record(row)
            self.stats['reviewed'] += 1
            
            # Ask if user wants to continue
            if idx < len(unmapped) - 1:
                if not Confirm.ask("Continue to next state?"):
                    break
    
    def _review_college_record(self, row):
        """Review a single unmatched college record"""
        self.console.print("\n" + "="*60)
        self.console.print(f"[bold]College:[/bold] {row['college_institute_raw']}")
        self.console.print(f"[dim]State:[/dim] {row['state_raw'] or 'Not specified'}")
        self.console.print(f"[dim]Affects {row['record_count']} records in: {row['partitions']}[/dim]")
        
        # Get college suggestions
        suggestions = self._get_college_suggestions(
            row['college_institute_raw'], 
            row['state_raw']
        )
        
        if suggestions:
            self.console.print("\n[bold]Top Suggestions:[/bold]")
            table = Table()
            table.add_column("No.", style="cyan")
            table.add_column("College Name", style="white")
            table.add_column("State", style="yellow")
            table.add_column("Type", style="green")
            table.add_column("Score", justify="right", style="magenta")
            
            for i, suggestion in enumerate(suggestions[:5], 1):
                table.add_row(
                    str(i),
                    suggestion['name'][:50] + "..." if len(suggestion['name']) > 50 else suggestion['name'],
                    suggestion['state'],
                    suggestion['type'],
                    f"{suggestion['score']:.1f}"
                )
            
            self.console.print(table)
        
        # Show options
        self.console.print("\n[bold]Options:[/bold]")
        self.console.print("1-5: Select suggestion")
        self.console.print("a: Create alias")
        self.console.print("s: Skip")
        self.console.print("q: Quit review")
        
        choice = Prompt.ask("Your choice").lower()
        
        if choice in ['1', '2', '3', '4', '5']:
            idx = int(choice) - 1
            if idx < len(suggestions):
                self._apply_college_match(row, suggestions[idx])
        elif choice == 'a':
            self._create_college_alias(row)
        elif choice == 's':
            self.stats['skipped'] += 1
        elif choice == 'q':
            return
    
    def _review_course_record(self, row):
        """Review a single unmatched course record"""
        self.console.print("\n" + "="*60)
        self.console.print(f"[bold]Course:[/bold] {row['course_raw']}")
        self.console.print(f"[dim]Affects {row['record_count']} records in: {row['partitions']}[/dim]")
        
        # Get course suggestions
        suggestions = self._get_course_suggestions(row['course_raw'])
        
        if suggestions:
            self.console.print("\n[bold]Top Suggestions:[/bold]")
            table = Table()
            table.add_column("No.", style="cyan")
            table.add_column("Course Name", style="white")
            table.add_column("Score", justify="right", style="magenta")
            
            for i, suggestion in enumerate(suggestions[:5], 1):
                table.add_row(
                    str(i),
                    suggestion['name'][:50] + "..." if len(suggestion['name']) > 50 else suggestion['name'],
                    f"{suggestion['score']:.1f}"
                )
            
            self.console.print(table)
        
        # Show options
        self.console.print("\n[bold]Options:[/bold]")
        self.console.print("1-5: Select suggestion")
        self.console.print("a: Create alias")
        self.console.print("s: Skip")
        self.console.print("q: Quit review")
        
        choice = Prompt.ask("Your choice").lower()
        
        if choice in ['1', '2', '3', '4', '5']:
            idx = int(choice) - 1
            if idx < len(suggestions):
                self._apply_course_match(row, suggestions[idx])
        elif choice == 'a':
            self._create_course_alias(row)
        elif choice == 's':
            self.stats['skipped'] += 1
        elif choice == 'q':
            return
    
    def _review_state_record(self, row):
        """Review a single unmapped state record"""
        self.console.print("\n" + "="*60)
        self.console.print(f"[bold]Raw State:[/bold] {row['state_raw']}")
        self.console.print(f"[dim]Normalized:[/dim] {row['state_normalized'] or 'None'}")
        self.console.print(f"[dim]Affects {row['record_count']} records in: {row['partitions']}[/dim]")
        
        # Get state suggestions
        suggestions = self._get_state_suggestions(row['state_raw'])
        
        if suggestions:
            self.console.print("\n[bold]Top Suggestions:[/bold]")
            table = Table()
            table.add_column("No.", style="cyan")
            table.add_column("State Name", style="white")
            table.add_column("Score", justify="right", style="magenta")
            
            for i, suggestion in enumerate(suggestions[:5], 1):
                table.add_row(
                    str(i),
                    suggestion['name'],
                    f"{suggestion['score']:.1f}"
                )
            
            self.console.print(table)
        
        # Show options
        self.console.print("\n[bold]Options:[/bold]")
        self.console.print("1-5: Select suggestion")
        self.console.print("m: Map to custom state")
        self.console.print("s: Skip")
        self.console.print("q: Quit review")
        
        choice = Prompt.ask("Your choice").lower()
        
        if choice in ['1', '2', '3', '4', '5']:
            idx = int(choice) - 1
            if idx < len(suggestions):
                self._apply_state_mapping(row, suggestions[idx])
        elif choice == 'm':
            self._create_custom_state_mapping(row)
        elif choice == 's':
            self.stats['skipped'] += 1
        elif choice == 'q':
            return
    
    def _get_college_suggestions(self, college_name: str, state: str) -> List[Dict]:
        """Get college suggestions using fuzzy matching"""
        from rapidfuzz import process, fuzz
        
        # Filter by state if provided
        if state and state in self.state_mappings:
            normalized_state = self.state_mappings[state]
            filtered_colleges = [
                college for college in self.master_data['colleges']
                if college.get('state') == normalized_state
            ]
        else:
            filtered_colleges = self.master_data['colleges']
        
        # Get fuzzy matches
        results = process.extract(
            college_name,
            [college['name'] for college in filtered_colleges],
            scorer=fuzz.WRatio,
            limit=5
        )
        
        # Create suggestion objects
        suggestions = []
        for name, score, idx in results:
            college = filtered_colleges[idx]
            suggestions.append({
                'id': college['id'],
                'name': college['name'],
                'state': college.get('state', 'Unknown'),
                'type': college.get('type', 'Unknown'),
                'score': score
            })
        
        return suggestions
    
    def _get_course_suggestions(self, course_name: str) -> List[Dict]:
        """Get course suggestions using fuzzy matching"""
        from rapidfuzz import process, fuzz
        
        # Get fuzzy matches
        results = process.extract(
            course_name,
            [course['name'] for course in self.master_data['courses']],
            scorer=fuzz.WRatio,
            limit=5
        )
        
        # Create suggestion objects
        suggestions = []
        for name, score, idx in results:
            course = self.master_data['courses'][idx]
            suggestions.append({
                'id': course['id'],
                'name': course['name'],
                'score': score
            })
        
        return suggestions
    
    def _get_state_suggestions(self, state_name: str) -> List[Dict]:
        """Get state suggestions using fuzzy matching"""
        from rapidfuzz import process, fuzz
        
        # Get fuzzy matches against canonical states
        results = process.extract(
            state_name,
            list(CANONICAL_STATES.keys()),
            scorer=fuzz.WRatio,
            limit=5
        )
        
        # Create suggestion objects
        suggestions = []
        for name, score, idx in results:
            suggestions.append({
                'name': name,
                'score': score
            })
        
        return suggestions
    
    def _apply_college_match(self, row, suggestion):
        """Apply college match to all affected records"""
        conn = sqlite3.connect(self.counselling_db_path)
        cursor = conn.cursor()
        
        # Update all records with this college
        cursor.execute("""
            UPDATE counselling_records
            SET master_college_id = ?,
                college_match_score = ?,
                college_match_method = 'MANUAL_REVIEW',
                is_matched = CASE 
                    WHEN master_course_id IS NOT NULL THEN TRUE
                    ELSE is_matched
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE college_institute_raw = ? 
            AND (state_raw = ? OR (? IS NULL AND state_raw IS NULL))
        """, (
            suggestion['id'],
            suggestion['score'],
            row['college_institute_raw'],
            row['state_raw'],
            row['state_raw']
        ))
        
        conn.commit()
        conn.close()
        
        self.console.print(f"[green]✅ Matched {row['record_count']} records to {suggestion['name']}[/green]")
    
    def _apply_course_match(self, row, suggestion):
        """Apply course match to all affected records"""
        conn = sqlite3.connect(self.counselling_db_path)
        cursor = conn.cursor()
        
        # Update all records with this course
        cursor.execute("""
            UPDATE counselling_records
            SET master_course_id = ?,
                course_match_score = ?,
                course_match_method = 'MANUAL_REVIEW',
                is_matched = CASE 
                    WHEN master_college_id IS NOT NULL THEN TRUE
                    ELSE is_matched
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE course_raw = ?
        """, (
            suggestion['id'],
            suggestion['score'],
            row['course_raw']
        ))
        
        conn.commit()
        conn.close()
        
        self.console.print(f"[green]✅ Matched {row['record_count']} records to {suggestion['name']}[/green]")
    
    def _apply_state_mapping(self, row, suggestion):
        """Apply state mapping to all affected records"""
        conn = sqlite3.connect(self.counselling_db_path)
        cursor = conn.cursor()
        
        # Get the state ID from master database
        master_conn = sqlite3.connect(self.master_db_path)
        state_cursor = master_conn.cursor()
        state_cursor.execute("SELECT id FROM states WHERE normalized_name = ?", (suggestion['name'],))
        state_result = state_cursor.fetchone()
        master_conn.close()
        
        state_id = state_result[0] if state_result else None
        
        # Update all records with this state
        cursor.execute("""
            UPDATE counselling_records
            SET state_normalized = ?,
                master_state_id = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE state_raw = ?
        """, (suggestion['name'], state_id, row['state_raw']))
        
        conn.commit()
        conn.close()
        
        # Add to state mappings table
        self._save_state_mapping(row['state_raw'], suggestion['name'])
        
        self.console.print(f"[green]✅ Mapped state '{row['state_raw']}' to '{suggestion['name']}'[/green]")
        self.stats['state_mappings_created'] += 1
    
    def _create_college_alias(self, row):
        """Create a college alias"""
        self.console.print("\n[bold]Create College Alias[/bold]")
        
        # Show all colleges for selection
        self.console.print("Select college type:")
        self.console.print("1: Medical")
        self.console.print("2: Dental")
        self.console.print("3: DNB")
        
        choice = Prompt.ask("College type", choices=["1", "2", "3"])
        type_map = {"1": "MEDICAL", "2": "DENTAL", "3": "DNB"}
        college_type = type_map[choice]
        
        # Filter colleges by type
        filtered_colleges = [
            college for college in self.master_data['colleges']
            if college.get('type') == college_type
        ]
        
        # Let user search for college
        search_term = Prompt.ask("Enter college name to search")
        
        # Get matches
        from rapidfuzz import process, fuzz
        results = process.extract(
            search_term,
            [college['name'] for college in filtered_colleges],
            scorer=fuzz.WRatio,
            limit=10
        )
        
        if not results:
            self.console.print("[red]No matches found[/red]")
            return
        
        # Show matches
        table = Table()
        table.add_column("No.", style="cyan")
        table.add_column("College Name", style="white")
        table.add_column("State", style="yellow")
        
        for i, (name, score, idx) in enumerate(results, 1):
            college = filtered_colleges[idx]
            table.add_row(str(i), name, college.get('state', 'Unknown'))
        
        self.console.print(table)
        
        # Select college
        choice = Prompt.ask("Select college", choices=[str(i) for i in range(1, len(results) + 1)])
        selected_college = filtered_colleges[results[int(choice) - 1][2]]
        
        # Create alias
        self._save_college_alias(row['college_institute_raw'], selected_college['id'], selected_college['name'])
        
        # Apply match
        self._apply_college_match(row, {
            'id': selected_college['id'],
            'name': selected_college['name'],
            'score': 100.0
        })
        
        self.stats['college_aliases_created'] += 1
    
    def _create_course_alias(self, row):
        """Create a course alias"""
        self.console.print("\n[bold]Create Course Alias[/bold]")
        
        # Let user search for course
        search_term = Prompt.ask("Enter course name to search")
        
        # Get matches
        from rapidfuzz import process, fuzz
        results = process.extract(
            search_term,
            [course['name'] for course in self.master_data['courses']],
            scorer=fuzz.WRatio,
            limit=10
        )
        
        if not results:
            self.console.print("[red]No matches found[/red]")
            return
        
        # Show matches
        table = Table()
        table.add_column("No.", style="cyan")
        table.add_column("Course Name", style="white")
        
        for i, (name, score, idx) in enumerate(results, 1):
            table.add_row(str(i), name)
        
        self.console.print(table)
        
        # Select course
        choice = Prompt.ask("Select course", choices=[str(i) for i in range(1, len(results) + 1)])
        selected_course = self.master_data['courses'][results[int(choice) - 1][2]]
        
        # Create alias
        self._save_course_alias(row['course_raw'], selected_course['id'], selected_course['name'])
        
        # Apply match
        self._apply_course_match(row, {
            'id': selected_course['id'],
            'name': selected_course['name'],
            'score': 100.0
        })
        
        self.stats['course_aliases_created'] += 1
    
    def _create_custom_state_mapping(self, row):
        """Create a custom state mapping"""
        self.console.print("\n[bold]Create Custom State Mapping[/bold]")
        
        # Show available states
        table = Table()
        table.add_column("No.", style="cyan")
        table.add_column("State Name", style="white")
        
        for i, state in enumerate(CANONICAL_STATES.keys(), 1):
            table.add_row(str(i), state)
        
        self.console.print(table)
        
        # Select state
        choice = Prompt.ask("Select state", choices=[str(i) for i in range(1, len(CANONICAL_STATES) + 1)])
        selected_state = list(CANONICAL_STATES.keys())[int(choice) - 1]
        
        # Apply mapping
        self._apply_state_mapping(row, {'name': selected_state})
    
    def _save_college_alias(self, alias_name, college_id, original_name):
        """Save college alias to database"""
        conn = sqlite3.connect(self.master_db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO college_aliases
            (alias_name, original_name, college_id, confidence)
            VALUES (?, ?, ?, ?)
        """, (alias_name, original_name, college_id, 100.0))
        
        conn.commit()
        conn.close()
    
    def _save_course_alias(self, alias_name, course_id, original_name):
        """Save course alias to database"""
        conn = sqlite3.connect(self.master_db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO course_aliases
            (alias_name, original_name, course_id, confidence)
            VALUES (?, ?, ?, ?)
        """, (alias_name, original_name, course_id, 100.0))
        
        conn.commit()
        conn.close()
    
    def _save_state_mapping(self, raw_state, normalized_state):
        """Save state mapping to database"""
        conn = sqlite3.connect(self.master_db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO state_mappings
            (raw_state, normalized_state, is_verified, notes)
            VALUES (?, ?, ?, ?)
        """, (raw_state, normalized_state, True, "Created via interactive review"))
        
        conn.commit()
        conn.close()
    
    def show_summary(self):
        """Show review session summary"""
        elapsed = pd.Timestamp.now() - self.stats['start_time']
        
        self.console.print("\n" + "="*60)
        self.console.print("[bold]Review Session Summary[/bold]")
        self.console.print(f"Records reviewed: {self.stats['reviewed']}")
        self.console.print(f"College aliases created: {self.stats['college_aliases_created']}")
        self.console.print(f"Course aliases created: {self.stats['course_aliases_created']}")
        self.console.print(f"State mappings created: {self.stats['state_mappings_created']}")
        self.console.print(f"Skipped: {self.stats['skipped']}")
        self.console.print(f"Time elapsed: {elapsed}")
    
    def run(self):
        """Run the interactive review system"""
        while True:
            choice = self.show_main_menu()
            
            if choice == "1":
                self.review_unmatched_colleges()
            elif choice == "2":
                self.review_unmatched_courses()
            elif choice == "3":
                self.review_unmapped_states()
            elif choice == "4":
                self.review_unmatched_colleges()
                self.review_unmatched_courses()
                self.review_unmapped_states()
            elif choice == "5":
                self.refresh_and_apply_state_mappings()
            elif choice == "6":
                break
        
        self.show_summary()

if __name__ == "__main__":
    review = EnhancedInteractiveReview()
    review.run()
