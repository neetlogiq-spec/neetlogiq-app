#!/usr/bin/env python3
"""
Automated Data Validation System
Validates data quality, consistency, and integrity
"""

import sqlite3
import pandas as pd
import re
from typing import Dict, List, Tuple, Optional
from datetime import datetime
from pathlib import Path
import json
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

class AutomatedValidator:
    """Automated validation system for counselling data"""
    
    def __init__(self, master_db_path: str, counselling_db_path: str):
        self.master_db_path = master_db_path
        self.counselling_db_path = counselling_db_path
        self.console = Console()
        self.validation_results = {
            'errors': [],
            'warnings': [],
            'info': [],
            'stats': {}
        }
    
    def run_all_validations(self) -> Dict:
        """Run all validation checks"""
        self.console.print("[bold blue]🔍 Running Automated Data Validation[/bold blue]")
        
        # Clear previous results
        self.validation_results = {
            'errors': [],
            'warnings': [],
            'info': [],
            'stats': {}
        }
        
        # Run validation checks
        self.validate_referential_integrity()
        self.validate_data_consistency()
        self.validate_data_completeness()
        self.validate_business_rules()
        self.validate_performance_metrics()
        
        # Generate summary
        self._generate_summary()
        
        return self.validation_results
    
    def validate_referential_integrity(self):
        """Validate referential integrity between tables"""
        self.console.print("\n[yellow]🔗 Checking Referential Integrity[/yellow]")
        
        master_conn = sqlite3.connect(self.master_db_path)
        counselling_conn = sqlite3.connect(self.counselling_db_path)
        
        # Check orphaned college references
        orphaned_colleges = pd.read_sql("""
            SELECT DISTINCT cr.master_college_id, cr.college_institute_raw
            FROM counselling_records cr
            LEFT JOIN colleges c ON cr.master_college_id = c.id
            WHERE cr.master_college_id IS NOT NULL AND c.id IS NULL
            LIMIT 10
        """, counselling_conn)
        
        if len(orphaned_colleges) > 0:
            self.validation_results['errors'].append({
                'type': 'Orphaned College References',
                'count': len(orphaned_colleges),
                'details': orphaned_colleges.to_dict('records')
            })
            self.console.print(f"  [red]❌ Found {len(orphaned_colleges)} orphaned college references[/red]")
        else:
            self.console.print("  [green]✅ No orphaned college references found[/green]")
        
        # Check orphaned course references
        orphaned_courses = pd.read_sql("""
            SELECT DISTINCT cr.master_course_id, cr.course_raw
            FROM counselling_records cr
            LEFT JOIN courses c ON cr.master_course_id = c.id
            WHERE cr.master_course_id IS NOT NULL AND c.id IS NULL
            LIMIT 10
        """, counselling_conn)
        
        if len(orphaned_courses) > 0:
            self.validation_results['errors'].append({
                'type': 'Orphaned Course References',
                'count': len(orphaned_courses),
                'details': orphaned_courses.to_dict('records')
            })
            self.console.print(f"  [red]❌ Found {len(orphaned_courses)} orphaned course references[/red]")
        else:
            self.console.print("  [green]✅ No orphaned course references found[/green]")
        
        master_conn.close()
        counselling_conn.close()
    
    def validate_data_consistency(self):
        """Validate data consistency within and across partitions"""
        self.console.print("\n[yellow]🔄 Checking Data Consistency[/yellow]")
        
        counselling_conn = sqlite3.connect(self.counselling_db_path)
        
        # Check for duplicate records
        duplicates = pd.read_sql("""
            SELECT college_institute_raw, course_raw, year, round, category, quota, COUNT(*) as count
            FROM counselling_records
            GROUP BY college_institute_raw, course_raw, year, round, category, quota
            HAVING COUNT(*) > 1
            LIMIT 10
        """, counselling_conn)
        
        if len(duplicates) > 0:
            self.validation_results['warnings'].append({
                'type': 'Duplicate Records',
                'count': len(duplicates),
                'details': duplicates.to_dict('records')
            })
            self.console.print(f"  [yellow]⚠️  Found {len(duplicates)} potential duplicate records[/yellow]")
        else:
            self.console.print("  [green]✅ No duplicate records found[/green]")
        
        # Check inconsistent state mappings
        inconsistent_states = pd.read_sql("""
            SELECT state_raw, COUNT(DISTINCT state_normalized) as normalized_count
            FROM counselling_records
            WHERE state_raw IS NOT NULL AND state_raw != ''
            GROUP BY state_raw
            HAVING COUNT(DISTINCT state_normalized) > 1
            LIMIT 10
        """, counselling_conn)
        
        if len(inconsistent_states) > 0:
            self.validation_results['warnings'].append({
                'type': 'Inconsistent State Mappings',
                'count': len(inconsistent_states),
                'details': inconsistent_states.to_dict('records')
            })
            self.console.print(f"  [yellow]⚠️  Found {len(inconsistent_states)} inconsistent state mappings[/yellow]")
        else:
            self.console.print("  [green]✅ State mappings are consistent[/green]")
        
        counselling_conn.close()
    
    def validate_data_completeness(self):
        """Validate data completeness"""
        self.console.print("\n[yellow]📊 Checking Data Completeness[/yellow]")
        
        counselling_conn = sqlite3.connect(self.counselling_db_path)
        
        # Check for missing required fields
        missing_data = pd.read_sql("""
            SELECT 
                SUM(CASE WHEN college_institute_raw IS NULL OR college_institute_raw = '' THEN 1 ELSE 0 END) as missing_colleges,
                SUM(CASE WHEN course_raw IS NULL OR course_raw = '' THEN 1 ELSE 0 END) as missing_courses,
                SUM(CASE WHEN year IS NULL THEN 1 ELSE 0 END) as missing_years,
                SUM(CASE WHEN round IS NULL THEN 1 ELSE 0 END) as missing_rounds,
                SUM(CASE WHEN category IS NULL OR category = '' THEN 1 ELSE 0 END) as missing_categories,
                SUM(CASE WHEN quota IS NULL OR quota = '' THEN 1 ELSE 0 END) as missing_quotas,
                COUNT(*) as total_records
            FROM counselling_records
        """, counselling_conn).iloc[0].to_dict()
        
        total = missing_data['total_records']
        
        # Report missing data
        for field, count in missing_data.items():
            if field.startswith('missing_') and count > 0:
                field_name = field.replace('missing_', '').title()
                percentage = (count / total * 100) if total > 0 else 0
                
                if percentage > 10:  # More than 10% missing
                    self.validation_results['errors'].append({
                        'type': f'Missing {field_name}',
                        'count': count,
                        'percentage': percentage
                    })
                    self.console.print(f"  [red]❌ {field_name}: {count:,} ({percentage:.1f}%)[/red]")
                elif percentage > 0:  # Some missing but less than 10%
                    self.validation_results['warnings'].append({
                        'type': f'Missing {field_name}',
                        'count': count,
                        'percentage': percentage
                    })
                    self.console.print(f"  [yellow]⚠️  {field_name}: {count:,} ({percentage:.1f}%)[/yellow]")
        
        if sum(missing_data[f] for f in missing_data if f.startswith('missing_')) == 0:
            self.console.print("  [green]✅ All required fields are complete[/green]")
        
        counselling_conn.close()
    
    def validate_business_rules(self):
        """Validate business rules"""
        self.console.print("\n[yellow]📋 Checking Business Rules[/yellow]")
        
        counselling_conn = sqlite3.connect(self.counselling_db_path)
        
        # Check for invalid ranks
        invalid_ranks = pd.read_sql("""
            SELECT COUNT(*) as count
            FROM counselling_records
            WHERE (opening_rank IS NOT NULL AND opening_rank < 0) OR
                  (closing_rank IS NOT NULL AND closing_rank < 0) OR
                  (opening_rank IS NOT NULL AND closing_rank IS NOT NULL AND 
                   opening_rank > closing_rank)
        """, counselling_conn).iloc[0]['count']
        
        if invalid_ranks > 0:
            self.validation_results['errors'].append({
                'type': 'Invalid Ranks',
                'count': invalid_ranks
            })
            self.console.print(f"  [red]❌ Found {invalid_ranks:,} records with invalid ranks[/red]")
        else:
            self.console.print("  [green]✅ All ranks are valid[/green]")
        
        # Check for invalid years
        invalid_years = pd.read_sql("""
            SELECT COUNT(*) as count
            FROM counselling_records
            WHERE year < 2020 OR year > 2030
        """, counselling_conn).iloc[0]['count']
        
        if invalid_years > 0:
            self.validation_results['warnings'].append({
                'type': 'Invalid Years',
                'count': invalid_years
            })
            self.console.print(f"  [yellow]⚠️  Found {invalid_years:,} records with invalid years[/yellow]")
        else:
            self.console.print("  [green]✅ All years are valid[/green]")
        
        # Check for invalid categories
        master_conn = sqlite3.connect(self.master_db_path)
        valid_categories = [row[0] for row in master_conn.execute("SELECT name FROM categories").fetchall()]
        master_conn.close()
        
        invalid_categories = pd.read_sql("""
            SELECT DISTINCT category, COUNT(*) as count
            FROM counselling_records
            WHERE category NOT IN ({})
            GROUP BY category
        """.format(','.join([f"'{c}'" for c in valid_categories])), counselling_conn)
        
        if len(invalid_categories) > 0:
            self.validation_results['warnings'].append({
                'type': 'Invalid Categories',
                'count': len(invalid_categories),
                'details': invalid_categories.to_dict('records')
            })
            self.console.print(f"  [yellow]⚠️  Found {len(invalid_categories)} invalid categories[/yellow]")
        else:
            self.console.print("  [green]✅ All categories are valid[/green]")
        
        counselling_conn.close()
    
    def validate_performance_metrics(self):
        """Validate performance metrics"""
        self.console.print("\n[yellow]⚡ Checking Performance Metrics[/yellow]")
        
        counselling_conn = sqlite3.connect(self.counselling_db_path)
        
        # Check match rates by partition
        partition_stats = pd.read_sql("""
            SELECT 
                partition_key,
                COUNT(*) as total,
                SUM(CASE WHEN master_college_id IS NOT NULL THEN 1 ELSE 0 END) as matched_colleges,
                SUM(CASE WHEN master_course_id IS NOT NULL THEN 1 ELSE 0 END) as matched_courses
            FROM counselling_records
            GROUP BY partition_key
        """, counselling_conn)
        
        low_match_partitions = []
        for _, row in partition_stats.iterrows():
            college_rate = (row['matched_colleges'] / row['total'] * 100) if row['total'] > 0 else 0
            course_rate = (row['matched_courses'] / row['total'] * 100) if row['total'] > 0 else 0
            
            if college_rate < 80 or course_rate < 80:
                low_match_partitions.append({
                    'partition': row['partition_key'],
                    'college_rate': college_rate,
                    'course_rate': course_rate
                })
        
        if low_match_partitions:
            self.validation_results['warnings'].append({
                'type': 'Low Match Rates',
                'count': len(low_match_partitions),
                'details': low_match_partitions
            })
            self.console.print(f"  [yellow]⚠️  Found {len(low_match_partitions)} partitions with low match rates[/yellow]")
        else:
            self.console.print("  [green]✅ All partitions have good match rates[/green]")
        
        counselling_conn.close()
    
    def _generate_summary(self):
        """Generate validation summary"""
        error_count = len(self.validation_results['errors'])
        warning_count = len(self.validation_results['warnings'])
        info_count = len(self.validation_results['info'])
        
        self.validation_results['stats'] = {
            'error_count': error_count,
            'warning_count': warning_count,
            'info_count': info_count,
            'timestamp': datetime.now().isoformat()
        }
        
        # Display summary
        self.console.print("\n[bold]Validation Summary[/bold]")
        
        if error_count > 0:
            self.console.print(f"  [red]❌ Errors: {error_count}[/red]")
        if warning_count > 0:
            self.console.print(f"  [yellow]⚠️  Warnings: {warning_count}[/yellow]")
        if info_count > 0:
            self.console.print(f"  [blue]ℹ️  Info: {info_count}[/blue]")
        
        if error_count == 0 and warning_count == 0:
            self.console.print("  [green]✅ All validations passed![/green]")
    
    def export_validation_report(self, output_path: str = None):
        """Export validation report to JSON"""
        if not output_path:
            output_path = f"validation_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(output_path, 'w') as f:
            json.dump(self.validation_results, f, indent=2)
        
        self.console.print(f"[green]✅ Validation report exported to {output_path}[/green]")
        return output_path
    
    def display_detailed_results(self):
        """Display detailed validation results"""
        if not self.validation_results['errors'] and not self.validation_results['warnings']:
            self.console.print("[green]✅ No issues found![/green]")
            return
        
        # Display errors
        if self.validation_results['errors']:
            self.console.print("\n[bold red]Errors:[/bold red]")
            for error in self.validation_results['errors']:
                self.console.print(f"  • {error['type']}: {error.get('count', 'N/A')} items")
        
        # Display warnings
        if self.validation_results['warnings']:
            self.console.print("\n[bold yellow]Warnings:[/bold yellow]")
            for warning in self.validation_results['warnings']:
                self.console.print(f"  • {warning['type']}: {warning.get('count', 'N/A')} items")

# Example usage
if __name__ == "__main__":
    validator = AutomatedValidator(
        "/Users/kashyapanand/Public/New/data/sqlite/master_data.db",
        "/Users/kashyapanand/Public/New/data/sqlite/counselling_data_partitioned.db"
    )
    
    # Run all validations
    results = validator.run_all_validations()
    
    # Display detailed results
    validator.display_detailed_results()
    
    # Export report
    validator.export_validation_report()
