#!/usr/bin/env python3
"""
Match Review CLI Tool

Interactive tool for reviewing match decisions and taking corrective actions.

Usage:
    python review_matches.py             # Interactive review mode
    python review_matches.py --export    # Export to CSV
    python review_matches.py --stats     # Show statistics
    python review_matches.py --pending   # Show pending reviews
"""

import argparse
import sqlite3
import os
import sys
from datetime import datetime
from typing import Optional, List, Dict
from rich.console import Console
from rich.table import Table
from rich.prompt import Prompt, Confirm
from rich.panel import Panel

from match_audit import get_audit_logger, MatchAuditLogger

console = Console()

# Master DB path
MASTER_DB_PATH = 'data/sqlite/master_data.db'


def get_db_paths(data_type: str = 'seat') -> Dict[str, str]:
    """Get database paths for specified data type.
    
    Args:
        data_type: 'seat' or 'counselling'
        
    Returns:
        Dict with 'data_db', 'group_table', and 'record_table' paths
    """
    if data_type == 'counselling':
        return {
            'data_db': 'data/sqlite/counselling_data_partitioned.db',
            'group_table': 'group_matching_queue',
            'record_table': 'counselling_records',
        }
    else:
        return {
            'data_db': 'data/sqlite/seat_data.db',
            'group_table': 'group_matching_queue',
            'record_table': 'seat_data',
        }

def get_college_suggestions(seat_name: str, seat_state: str = '', limit: int = 5) -> List[Dict]:
    """
    Get top N college suggestions from master database.
    Searches medical, dental, and DNB colleges.
    """
    from rapidfuzz import fuzz, process
    
    conn = sqlite3.connect(MASTER_DB_PATH)
    conn.row_factory = sqlite3.Row
    
    all_suggestions = []
    seat_name_upper = seat_name.upper().strip()
    
    for table, prefix in [('medical_colleges', 'MED'), ('dental_colleges', 'DEN'), ('dnb_colleges', 'DNB')]:
        try:
            cursor = conn.execute(f"""
                SELECT id, COALESCE(normalized_name, name) as name, 
                       COALESCE(normalized_state, state) as state,
                       COALESCE(normalized_address, address) as address
                FROM {table}
            """)
            colleges = [dict(row) for row in cursor.fetchall()]
            
            # Use rapidfuzz to find best matches
            college_names = [c['name'].upper() for c in colleges]
            matches = process.extract(
                seat_name_upper,
                college_names,
                scorer=fuzz.token_set_ratio,
                limit=limit
            )
            
            for match_name, score, idx in matches:
                college = colleges[idx]
                # Boost score if state matches
                state_boost = 5 if seat_state and college.get('state', '').upper() == seat_state.upper() else 0
                all_suggestions.append({
                    'id': college['id'],
                    'name': college['name'],
                    'state': college.get('state', ''),
                    'address': college.get('address', ''),
                    'score': min(100, score + state_boost),
                    'type': prefix
                })
        except Exception as e:
            pass  # Table might not exist
    
    conn.close()
    
    # Sort by score descending and return top N
    all_suggestions.sort(key=lambda x: x['score'], reverse=True)
    return all_suggestions[:limit]


def lookup_college_by_id(college_id: str) -> Optional[Dict]:
    """Lookup a college by ID (MED/DEN/DNB prefix)."""
    conn = sqlite3.connect(MASTER_DB_PATH)
    conn.row_factory = sqlite3.Row
    
    college_id = college_id.upper().strip()
    
    if college_id.startswith('MED'):
        table = 'medical_colleges'
    elif college_id.startswith('DEN'):
        table = 'dental_colleges'
    elif college_id.startswith('DNB'):
        table = 'dnb_colleges'
    else:
        conn.close()
        return None
    
    cursor = conn.execute(f"""
        SELECT id, COALESCE(normalized_name, name) as name,
               COALESCE(normalized_state, state) as state,
               COALESCE(normalized_address, address) as address
        FROM {table} WHERE id = ?
    """, (college_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None


def update_group_match(group_id: str, matched_college_id: str, seat_db_path: str = 'data/sqlite/seat_data.db'):
    """Update group_matching_queue with match result."""
    conn = sqlite3.connect(seat_db_path)
    conn.execute("""
        UPDATE group_matching_queue 
        SET matched_college_id = ?, match_method = 'manual_review', is_processed = 0
        WHERE group_id = ?
    """, (matched_college_id, group_id))
    affected = conn.total_changes
    conn.commit()
    conn.close()
    return affected


def delink_group(group_id: str, seat_db_path: str = 'data/sqlite/seat_data.db'):
    """Remove match from group_matching_queue - set matched_college_id to NULL."""
    conn = sqlite3.connect(seat_db_path)
    conn.execute("""
        UPDATE group_matching_queue 
        SET matched_college_id = NULL, is_processed = 0
        WHERE group_id = ?
    """, (group_id,))
    affected = conn.total_changes
    conn.commit()
    conn.close()
    return affected


def propagate_group_matches(seat_db_path: str = 'data/sqlite/seat_data.db'):
    """
    Propagate group matches to individual seat_data records.
    Call this after reviewing groups to apply changes.
    """
    conn = sqlite3.connect(seat_db_path)
    
    # Get all unprocessed groups with matches
    cursor = conn.execute("""
        SELECT group_id, matched_college_id, normalized_college_name, normalized_state
        FROM group_matching_queue 
        WHERE matched_college_id IS NOT NULL AND is_processed = 0
    """)
    groups = cursor.fetchall()
    
    total_updated = 0
    for group_id, matched_id, college_name, state in groups:
        # Update seat_data records matching this group
        conn.execute("""
            UPDATE seat_data 
            SET matched_college_id = ?, match_status = 'matched'
            WHERE UPPER(college_name) = ? AND UPPER(state) = ?
              AND (matched_college_id IS NULL OR matched_college_id != ?)
        """, (matched_id, college_name.upper() if college_name else '', 
              state.upper() if state else '', matched_id))
        total_updated += conn.total_changes
        
        # Mark group as processed
        conn.execute("UPDATE group_matching_queue SET is_processed = 1 WHERE group_id = ?", (group_id,))
    
    conn.commit()
    conn.close()
    return len(groups), total_updated


def add_to_blocklist(
    seat_name: str, 
    master_name: str, 
    reason: str = "User blocked via review",
    blocklist_path: str = 'data/guardian_blocklist.csv'
):
    """Add a name pair to Guardian blocklist."""
    import csv
    
    os.makedirs(os.path.dirname(blocklist_path), exist_ok=True)
    
    # Append to blocklist
    file_exists = os.path.exists(blocklist_path)
    with open(blocklist_path, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['seat_name_pattern', 'master_name_pattern', 'reason', 'added_date'])
        writer.writerow([seat_name, master_name, reason, __import__('datetime').datetime.now().isoformat()])
    
    return True


def invalidate_cache(seat_college_name: str):
    """Invalidate LLM cache entry for this match."""
    from llm_response_cache import get_matcher_cache
    
    try:
        cache = get_matcher_cache()
        cache.invalidate(seat_college_name)
        return True
    except Exception as e:
        console.print(f"[red]Cache invalidation failed: {e}[/red]")
        return False


def ai_rematch_group(entry: dict) -> Optional[Dict]:
    """
    Call AgenticMatcher for a single group to get a fresh AI match decision.
    
    Args:
        entry: Group entry dict with seat_college_name, seat_state, seat_address
        
    Returns:
        Dict with matched_college_id, confidence, reason, and explanation or None if failed
    """
    try:
        from agentic_matcher import AgenticMatcher
        
        # Build record dict from entry
        record = {
            'record_id': entry.get('group_id', 'review_group'),
            'college_name': entry.get('seat_college_name', ''),
            'normalized_college_name': entry.get('seat_college_name', '').upper(),
            'state': entry.get('seat_state', ''),
            'normalized_state': entry.get('seat_state', '').upper(),
            'address': entry.get('seat_address', ''),
            'normalized_address': entry.get('seat_address', '').upper(),
            'course_type': 'medical',  # Default, can be enhanced
        }
        
        # Get top candidates from our suggestion engine (reuse existing function)
        suggestions = get_college_suggestions(
            record['college_name'], 
            record['state'], 
            limit=10
        )
        
        if not suggestions:
            return {'matched_college_id': None, 'confidence': 0.0, 
                    'reason': 'No candidates found in master database', 'explanation': []}
        
        # Convert suggestions to candidate tuples for matcher
        candidates = [
            (s['id'], s['name'], s['state'], s.get('address', ''))
            for s in suggestions
        ]
        
        # Initialize matcher and call single record match
        matcher = AgenticMatcher()
        
        if not matcher.clients:
            return {'matched_college_id': None, 'confidence': 0.0, 
                    'reason': 'No API clients available', 'explanation': []}
        
        # Use the first available model
        model = list(matcher.model_configs.keys())[0] if matcher.model_configs else 'google/gemini-2.0-flash-exp:free'
        
        decision = matcher._single_record_match(record, candidates, model)
        
        if decision and decision.matched_college_id:
            # Build XAI explanation
            matched_college = lookup_college_by_id(decision.matched_college_id)
            explanation = []
            
            # Name similarity component
            from rapidfuzz import fuzz
            name_sim = fuzz.token_set_ratio(
                record['college_name'].upper(), 
                (matched_college.get('name', '') if matched_college else '').upper()
            ) / 100.0
            explanation.append({
                'factor': 'Name Similarity',
                'score': name_sim,
                'status': '✅' if name_sim >= 0.85 else '⚠️' if name_sim >= 0.70 else '❌'
            })
            
            # State match component
            state_match = record['state'].upper() == (matched_college.get('state', '') if matched_college else '').upper()
            explanation.append({
                'factor': 'State Match',
                'score': 1.0 if state_match else 0.0,
                'status': '✅' if state_match else '❌'
            })
            
            # Address overlap component
            if record['address'] and matched_college and matched_college.get('address'):
                seat_words = set(record['address'].upper().split())
                master_words = set(matched_college['address'].upper().split())
                overlap = len(seat_words & master_words) / max(len(seat_words), 1)
                explanation.append({
                    'factor': 'Address Overlap',
                    'score': overlap,
                    'status': '✅' if overlap >= 0.3 else '⚠️' if overlap > 0 else '❌'
                })
            
            return {
                'matched_college_id': decision.matched_college_id,
                'matched_college_name': matched_college.get('name', '') if matched_college else '',
                'confidence': decision.confidence,
                'reason': decision.reason,
                'model': decision.model,
                'explanation': explanation
            }
        else:
            return {
                'matched_college_id': None,
                'confidence': 0.0,
                'reason': decision.reason if decision else 'AI returned no match',
                'explanation': []
            }
            
    except ImportError as e:
        console.print(f"[red]AgenticMatcher not available: {e}[/red]")
        return None
    except Exception as e:
        console.print(f"[red]AI re-match failed: {e}[/red]")
        return None


def show_entry(entry: dict):
    """Display a single group entry for review with enhanced visibility."""
    status = entry['status']
    status_color = "green" if status == "MATCHED" else "yellow" if "WARN" in status else "red"
    record_count = entry.get('record_count', 1)
    
    # Extra context for blocks
    reason_hl = f"[bold red]!! {status} !![/bold red] - " if "BLOCK" in status else ""
    
    console.print(Panel(
        f"""[bold yellow]{record_count} Records[/bold yellow]  │  [bold]Group:[/bold] {entry['group_id']}
        
[bold cyan]🏢 SEAT (Original)[/bold cyan]
  [bold white on blue] {entry['seat_college_name']} [/bold white on blue]
  [dim]State: {entry.get('seat_state', 'N/A')}  │  Address: {(entry.get('seat_address', '') or 'N/A')[:100]}...[/dim]

[bold cyan]🏛️ MASTER (Matched)[/bold cyan]
  [bold white on green] {entry.get('master_college_name', 'N/A') or 'NULL'} [/bold white on green]
  [dim]ID: {entry.get('matched_college_id', 'N/A')}  │  State: {entry.get('master_state', 'N/A')}  │  Address: {(entry.get('master_address', '') or 'N/A')[:100]}...[/dim]

[bold cyan]📊 ANALYSIS[/bold cyan]
  Status:  [{status_color}]{status}[/{status_color}]
  Reason:  {reason_hl}[italic]{entry.get('reason', 'N/A')}[/italic]
  Metrics: Confidence: [bold]{entry.get('confidence', 0):.1%}[/bold]  │  Name Sim: {entry.get('name_similarity', 0):.1%}
  Model:   {entry.get('model', 'N/A')}
""",
        title=f"[{status_color}]Group Review: {entry['seat_college_name'][:40]}[/{status_color}]",
        border_style=status_color,
        padding=(1, 2)
    ))


def add_alias(
    seat_name: str,
    master_name: str,
    master_college_id: str,
    seat_state: str = '',
    seat_address: str = '',
    confidence: float = 1.0,
    master_db_path: str = 'data/sqlite/master_data.db'
):
    """
    Add a college alias to master_data.db for future matching.
    
    This teaches the system that seat_name should match to master_name.
    Fetches master college details (name, state, address) from master tables.
    
    Columns stored:
    - original_name, original_state, original_address: Seat data (input)
    - alias_name, state_normalized, address_normalized: Master data (fetched)
    """
    conn = sqlite3.connect(master_db_path)
    conn.row_factory = sqlite3.Row
    
    # Check if alias already exists
    cursor = conn.execute("""
        SELECT id FROM college_aliases 
        WHERE original_name = ? AND master_college_id = ?
    """, (seat_name.upper().strip(), master_college_id))
    
    if cursor.fetchone():
        conn.close()
        return False  # Already exists
    
    # Fetch master college details from appropriate table
    master_state = None
    master_address = None
    master_normalized_name = master_name
    
    # Determine table based on master_college_id prefix
    if master_college_id.startswith('MED'):
        table = 'medical_colleges'
    elif master_college_id.startswith('DEN'):
        table = 'dental_colleges'
    elif master_college_id.startswith('DNB'):
        table = 'dnb_colleges'
    else:
        table = None
    
    if table:
        cursor = conn.execute(f"""
            SELECT 
                COALESCE(normalized_name, name) as name,
                COALESCE(normalized_state, state) as state,
                COALESCE(normalized_address, address) as address
            FROM {table}
            WHERE id = ?
        """, (master_college_id,))
        row = cursor.fetchone()
        if row:
            master_normalized_name = row['name'] or master_name
            master_state = row['state']
            master_address = row['address']
    
    # Insert with all columns filled
    conn.execute("""
        INSERT INTO college_aliases 
        (original_name, alias_name, master_college_id, 
         state_normalized, address_normalized, confidence,
         original_state, original_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        seat_name.upper().strip(),              # original_name (seat)
        master_normalized_name.upper().strip(), # alias_name (master)
        master_college_id,                      # master_college_id
        master_state.upper().strip() if master_state else None,    # state_normalized (master)
        master_address.upper().strip() if master_address else None, # address_normalized (master)
        confidence,
        seat_state.strip() if seat_state else None,    # original_state (seat)
        seat_address.strip() if seat_address else None # original_address (seat)
    ))
    conn.commit()
    conn.close()
    return True


def interactive_review(category: str = None, data_type: str = 'seat'):
    """Interactive review session with category filter, suggestions, and direct ID input.
    
    Args:
        category: Filter category ('approved', 'warn', 'reject', 'blocked', or None for all)
        data_type: 'seat' or 'counselling' - determines which database to use
    """
    audit = get_audit_logger(data_type=data_type)
    db_paths = get_db_paths(data_type)
    
    console.print(f"[dim]Mode: {data_type.upper()} | DB: {db_paths['data_db']}[/dim]")
    
    # Session stats
    session_stats = {
        'reviewed': 0,
        'aliases_created': 0,
        'force_matched': 0,
        'rejected': 0,
        'unblocked': 0,
        'skipped': 0,
        'start_time': datetime.now()
    }

    
    # Map category to status filters
    if category == 'approved':
        status_filter = ['MATCHED', 'ADDR_OK', 'NULL_ADDR_OK']
    elif category == 'warn':
        status_filter = ['NAME_WARN', 'ADDR_WARN']
    elif category == 'reject':
        status_filter = ['NAME_REJECTED', 'ADDR_REJECTED', 'STATE_MISMATCH', 'NULL_ADDR_REJECTED']
    elif category == 'blocked':
        status_filter = ['GUARDIAN_BLOCKED', 'STREAM_BLOCKED', 'STATE_BLOCKED', 'MULTI_CAMPUS_BLOCKED']
    else:
        # All warnings and rejections by default
        status_filter = ['NAME_WARN', 'ADDR_REJECTED', 'NAME_REJECTED', 'STATE_MISMATCH', 
                        'NULL_ADDR_REJECTED', 'ADDR_WARN']
    
    # Get entries needing review
    entries = audit.get_pending_review(status_filter=status_filter)
    
    if not entries:
        console.print(f"[green]✓ No {category or 'pending'} entries to review![/green]")
        return
    
    console.print(f"\n[bold]Found {len(entries)} {category or 'pending'} entries to review[/bold]\n")
    
    for i, entry in enumerate(entries):
        session_stats['reviewed'] += 1
        
        # Show session progress
        elapsed = (datetime.now() - session_stats['start_time']).seconds
        console.print(f"\n[dim]── Entry {i+1}/{len(entries)} │ Aliases: {session_stats['aliases_created']} │ {elapsed//60}m {elapsed%60}s ──[/dim]")
        
        show_entry(entry)
        
        # Determine entry type
        is_rejected = entry['status'] in ('NAME_REJECTED', 'ADDR_REJECTED', 'NULL_ADDR_REJECTED', 'STATE_MISMATCH')
        is_blocked = entry['status'] in ('GUARDIAN_BLOCKED', 'STREAM_BLOCKED', 'STATE_BLOCKED', 'MULTI_CAMPUS_BLOCKED')
        
        # Get and show suggestions for rejected or blocked entries
        if is_rejected or is_blocked:
            suggestions = get_college_suggestions(
                entry['seat_college_name'], 
                entry.get('seat_state', ''),
                limit=5
            )
            if suggestions:
                console.print("\n[bold cyan]🎯 Top Suggestions:[/bold cyan]")
                for idx, sugg in enumerate(suggestions, 1):
                    score_color = "green" if sugg['score'] >= 90 else "yellow" if sugg['score'] >= 80 else "red"
                    console.print(
                        f"  [{idx}] [{score_color}]{sugg['score']}%[/{score_color}] "
                        f"{sugg['name'][:50]} [dim]({sugg['id']} | {sugg['state']})[/dim]"
                    )
        
        # Different options based on status
        can_learn = entry.get('matched_college_id') and entry['status'] in (
            'NAME_REJECTED', 'ADDR_REJECTED', 'NULL_ADDR_REJECTED', 'STATE_MISMATCH',
            'NAME_WARN', 'ADDR_WARN'
        )
        
        console.print("\n[bold]Actions:[/bold]")
        if is_blocked:
            console.print("  [green]u[/green]=Unblock (force match)  [green]1-5[/green]=Select suggestion")
            console.print("  [green]a[/green]=Approve block  [dim]s[/dim]=Skip  [dim]q[/dim]=Quit")
        elif can_learn:
            console.print("  [cyan]l[/cyan]=Learn alias  [green]f[/green]=Force match  [green]a[/green]=Approve")
        elif is_rejected:
            console.print("  [green]1-5[/green]=Select suggestion  [green]a[/green]=Approve")
        else:
            console.print("  [green]a[/green]=Approve")
        if not is_blocked:
            console.print("  [red]r[/red]=Reject  [red]b[/red]=Block  [dim]s[/dim]=Skip  [dim]q[/dim]=Quit")
        console.print("  [cyan]MED/DEN/DNB####[/cyan]=Enter ID directly")
        console.print("  [magenta]g[/magenta]=🤖 Get AI Re-match (LLM + Guardian)")

        
        # Get user input (free text for ID input)
        choice = Prompt.ask("\n[bold]Action[/bold]", default="s")
        
        # Check if it's a direct ID input (MED, DEN, DNB prefix)
        if choice.upper().startswith(('MED', 'DEN', 'DNB')):
            college = lookup_college_by_id(choice)
            if college:
                console.print(f"\n[green]✅ Found: {college['name']}[/green]")
                console.print(f"   State: {college['state']}, ID: {college['id']}")
                
                if Confirm.ask("Create alias and match?", default=True):
                    added = add_alias(
                        seat_name=entry['seat_college_name'],
                        master_name=college['name'],
                        master_college_id=college['id'],
                        seat_state=entry.get('seat_state', ''),
                        seat_address=entry.get('seat_address', ''),
                        confidence=1.0,
                    )
                    if added:
                        update_group_match(entry['group_id'], college['id'], db_paths['data_db'])
                        audit.mark_reviewed(entry['group_id'], 'LEARN_ALIAS')
                        session_stats['aliases_created'] += 1
                        console.print(f"[cyan]📚 Alias created + group updated![/cyan]")
                    else:
                        console.print("[yellow]Alias already exists, updating group...[/yellow]")
                        update_group_match(entry['group_id'], college['id'], db_paths['data_db'])
                        audit.mark_reviewed(entry['group_id'], 'FORCE_MATCH')
                        session_stats['force_matched'] += 1
            else:
                console.print(f"[red]❌ ID '{choice}' not found[/red]")
            continue
        
        # Check if it's a suggestion number (1-5)
        if choice in ['1', '2', '3', '4', '5'] and is_rejected:
            idx = int(choice) - 1
            suggestions = get_college_suggestions(entry['seat_college_name'], entry.get('seat_state', ''), limit=5)
            if idx < len(suggestions):
                sugg = suggestions[idx]
                console.print(f"\n[green]Selected: {sugg['name']} ({sugg['id']})[/green]")
                
                added = add_alias(
                    seat_name=entry['seat_college_name'],
                    master_name=sugg['name'],
                    master_college_id=sugg['id'],
                    seat_state=entry.get('seat_state', ''),
                    seat_address=entry.get('seat_address', ''),
                    confidence=sugg['score'] / 100.0,
                )
                if added:
                    update_group_match(entry['group_id'], sugg['id'], db_paths['data_db'])
                    audit.mark_reviewed(entry['group_id'], 'LEARN_ALIAS')
                    session_stats['aliases_created'] += 1
                    console.print(f"[cyan]📚 Alias created + group updated![/cyan]")
                else:
                    console.print("[yellow]Alias already exists[/yellow]")
                    audit.mark_reviewed(entry['group_id'], 'APPROVE')
            continue
        
        # Standard actions
        if choice == 'q':
            console.print("[yellow]Review session ended.[/yellow]")
            break
        elif choice == 's':
            session_stats['skipped'] += 1
            console.print("[dim]Skipped[/dim]")
            continue
        elif choice == 'l' and can_learn:
            # Learn alias - add to college_aliases AND update group
            added = add_alias(
                seat_name=entry['seat_college_name'],
                master_name=entry['master_college_name'],
                master_college_id=entry['matched_college_id'],
                seat_state=entry.get('seat_state', ''),
                seat_address=entry.get('seat_address', ''),
                confidence=entry['name_similarity'],
            )
            if added:
                update_group_match(entry['group_id'], entry['matched_college_id'], db_paths['data_db'])
                audit.mark_reviewed(entry['group_id'], 'LEARN_ALIAS')
                session_stats['aliases_created'] += 1
                console.print(f"[cyan]📚 Learned alias + group updated![/cyan]")
            else:
                console.print("[yellow]Alias already exists[/yellow]")
                audit.mark_reviewed(entry['group_id'], 'APPROVE')
        elif choice == 'f' and entry.get('matched_college_id'):
            update_group_match(entry['group_id'], entry['matched_college_id'], db_paths['data_db'])
            audit.mark_reviewed(entry['group_id'], 'FORCE_MATCH')
            session_stats['force_matched'] += 1
            console.print(f"[green]✓ Group updated![/green]")
        elif choice == 'a':
            audit.mark_reviewed(entry['group_id'], 'APPROVE')
            console.print("[green]✓ Approved[/green]")
        elif choice == 'u' and is_blocked:
            # Unblock - force match with existing matched_college_id or prompt for ID
            if entry.get('matched_college_id'):
                update_group_match(entry['group_id'], entry['matched_college_id'], db_paths['data_db'])
                audit.mark_reviewed(entry['group_id'], 'UNBLOCK')
                session_stats['unblocked'] += 1
                console.print(f"[green]✅ Unblocked - group re-matched to {entry['matched_college_id']}[/green]")
            else:
                console.print("[yellow]No matched_college_id - use 1-5 or enter ID directly[/yellow]")
        elif choice == 'r':
            delink_group(entry['group_id'], db_paths['data_db'])
            audit.mark_reviewed(entry['group_id'], 'REJECT')
            invalidate_cache(entry['seat_college_name'])
            session_stats['rejected'] += 1
            console.print(f"[red]✗ Rejected - group delinked[/red]")
        elif choice == 'b':
            delink_group(entry['group_id'], db_paths['data_db'])
            if entry.get('master_college_name'):
                add_to_blocklist(
                    entry['seat_college_name'],
                    entry['master_college_name'],
                    f"Blocked via review: {entry.get('reason', '')}"
                )
            audit.mark_reviewed(entry['group_id'], 'BLOCK')
            invalidate_cache(entry['seat_college_name'])
            console.print(f"[red]⛔ Blocked - group delinked + added to blocklist[/red]")
        elif choice == 'g':
            # AI Re-match with LLM and Guardian
            console.print("\n[magenta]🤖 Calling AI for fresh match decision...[/magenta]")
            ai_result = ai_rematch_group(entry)
            
            if ai_result:
                # Display AI decision with XAI explanation
                conf = ai_result.get('confidence', 0)
                conf_color = "green" if conf >= 0.85 else "yellow" if conf >= 0.70 else "red"
                
                console.print(Panel.fit(
                    f"[bold]AI Match Decision[/bold]\n\n"
                    f"Matched ID: [bold]{ai_result.get('matched_college_id') or 'None'}[/bold]\n"
                    f"College: {ai_result.get('matched_college_name', 'N/A')[:50]}\n"
                    f"Confidence: [{conf_color}]{conf:.1%}[/{conf_color}]\n"
                    f"Reason: {ai_result.get('reason', 'N/A')[:80]}\n"
                    f"Model: [dim]{ai_result.get('model', 'N/A')}[/dim]",
                    title="🤖 LLM + Guardian",
                    border_style="magenta"
                ))
                
                # XAI Explanation breakdown
                if ai_result.get('explanation'):
                    console.print("\n[bold cyan]📊 Reasoning Breakdown:[/bold cyan]")
                    for exp in ai_result['explanation']:
                        console.print(f"  {exp['status']} {exp['factor']}: {exp['score']:.1%}")
                
                # Offer to apply the AI's suggestion
                if ai_result.get('matched_college_id'):
                    if Confirm.ask("\n[bold]Apply AI match?[/bold]", default=True):
                        added = add_alias(
                            seat_name=entry['seat_college_name'],
                            master_name=ai_result['matched_college_name'],
                            master_college_id=ai_result['matched_college_id'],
                            seat_state=entry.get('seat_state', ''),
                            seat_address=entry.get('seat_address', ''),
                            confidence=ai_result['confidence'],
                        )
                        if added:
                            update_group_match(entry['group_id'], ai_result['matched_college_id'], db_paths['data_db'])
                            audit.mark_reviewed(entry['group_id'], 'AI_MATCH')
                            session_stats['aliases_created'] += 1
                            console.print(f"[green]✅ AI match applied![/green]")
                        else:
                            update_group_match(entry['group_id'], ai_result['matched_college_id'], db_paths['data_db'])
                            audit.mark_reviewed(entry['group_id'], 'AI_MATCH')
                            session_stats['force_matched'] += 1
                            console.print(f"[green]✅ Group matched (alias exists)[/green]")
                else:
                    console.print("[yellow]AI found no suitable match.[/yellow]")
            else:
                console.print("[red]AI re-match failed. Check API connection.[/red]")

    
    # Show session summary
    elapsed = (datetime.now() - session_stats['start_time']).seconds
    console.print("\n[bold cyan]━━━ Session Summary ━━━[/bold cyan]")
    console.print(f"  Reviewed: {session_stats['reviewed']}")
    console.print(f"  [cyan]Aliases Created: {session_stats['aliases_created']}[/cyan]")
    console.print(f"  [green]Force Matched: {session_stats['force_matched']}[/green]")
    console.print(f"  [red]Rejected: {session_stats['rejected']}[/red]")
    console.print(f"  [green]Unblocked: {session_stats['unblocked']}[/green]")
    console.print(f"  Skipped: {session_stats['skipped']}")
    console.print(f"  Time: {elapsed//60}m {elapsed%60}s")
    console.print()
    
    # Prompt to propagate changes if any modifications were made
    total_changes = (session_stats['aliases_created'] + session_stats['force_matched'] + 
                     session_stats['rejected'] + session_stats['unblocked'])
    
    if total_changes > 0:
        console.print(f"[bold yellow]📤 {total_changes} changes pending propagation to {db_paths['record_table']}[/bold yellow]")
        if Confirm.ask("Propagate changes now?", default=True):
            console.print("[cyan]Propagating changes...[/cyan]")
            groups_updated, records_updated = propagate_group_matches(db_paths['data_db'])
            console.print(f"[green]✅ {groups_updated} groups propagated → {records_updated} records updated[/green]")
        else:
            console.print(f"[dim]Run 'python review_matches.py --mode {data_type} --propagate' later to apply changes[/dim]")


def show_pending(category: str = None):
    """Show entries pending review with category filter."""
    audit = get_audit_logger()
    
    # Map category to status filters
    if category == 'approved':
        status_filter = ['MATCHED', 'ADDR_OK', 'NULL_ADDR_OK']
        title = "Approved Matches"
    elif category == 'warn':
        status_filter = ['NAME_WARN', 'ADDR_WARN']
        title = "Warnings (Borderline)"
    elif category == 'reject':
        status_filter = ['NAME_REJECTED', 'ADDR_REJECTED', 'STATE_MISMATCH', 'NULL_ADDR_REJECTED']
        title = "Rejections"
    elif category == 'blocked':
        status_filter = ['GUARDIAN_BLOCKED', 'STREAM_BLOCKED', 'STATE_BLOCKED', 'MULTI_CAMPUS_BLOCKED']
        title = "Guardian Blocked"
    else:
        status_filter = None
        title = "All Pending"
    
    entries = audit.get_pending_review(status_filter=status_filter)
    
    if not entries:
        console.print(f"[green]✓ No {category or 'pending'} entries![/green]")
        return
    
    table = Table(title=f"{title} ({len(entries)} groups)", show_header=True)
    table.add_column("Group ID", style="cyan", width=10)
    table.add_column("Seat Name", width=30)
    table.add_column("Master Name", width=28)
    table.add_column("Records", justify="right")
    table.add_column("Sim%", justify="right")
    table.add_column("Status", width=16)
    
    for entry in entries[:50]:  # Show first 50
        status = entry['status']
        if 'REJECT' in status:
            status_color = "red"
        elif 'WARN' in status:
            status_color = "yellow"
        else:
            status_color = "green"
        
        table.add_row(
            str(entry.get('group_id', ''))[:10],
            entry.get('seat_college_name', '')[:28],
            (entry.get('master_college_name') or 'NULL')[:26],
            str(entry.get('record_count', 1)),
            f"{entry.get('name_similarity', 0):.0%}",
            f"[{status_color}]{status}[/{status_color}]"
        )
    
    if len(entries) > 50:
        table.add_row("...", f"({len(entries) - 50} more)", "", "", "", "")
    
    console.print(table)


def main():
    parser = argparse.ArgumentParser(description="Match Review CLI Tool (Group-Based)")
    parser.add_argument('--export', action='store_true', help='Export to CSV')
    parser.add_argument('--stats', action='store_true', help='Show statistics')
    parser.add_argument('--pending', action='store_true', help='Show pending reviews')
    parser.add_argument('--propagate', action='store_true', help='Propagate group matches to individual records')
    
    # Mode selection
    parser.add_argument('--mode', choices=['seat', 'counselling'], default='seat',
                       help='Data type: seat (default) or counselling')
    
    # Category filters
    parser.add_argument('--approved', action='store_true', help='Show/review approved matches')
    parser.add_argument('--warn', action='store_true', help='Show/review warnings (borderline)')
    parser.add_argument('--reject', action='store_true', help='Show/review rejections')
    parser.add_argument('--blocked', action='store_true', help='Show/review Guardian-blocked groups')
    
    parser.add_argument('--warnings-only', action='store_true', help='Export only warnings (deprecated, use --warn)')
    
    args = parser.parse_args()
    
    # Get database paths for selected mode
    data_type = args.mode
    db_paths = get_db_paths(data_type)
    
    console.print(f"[bold cyan]🔍 Match Review Tool (Group-Based)[/bold cyan]")
    console.print(f"[dim]Mode: {data_type.upper()} | DB: {db_paths['data_db']}[/dim]\\n")
    
    # Determine category
    category = None
    if args.approved:
        category = 'approved'
    elif args.warn:
        category = 'warn'
    elif args.reject:
        category = 'reject'
    elif args.blocked:
        category = 'blocked'
    
    if args.propagate:
        # Propagate group matches to individual records
        console.print("[bold]Propagating group matches to individual records...[/bold]")
        groups_updated, records_updated = propagate_group_matches(db_paths['data_db'])
        console.print(f"[green]✓ {groups_updated} groups propagated → {records_updated} records updated[/green]")

    elif args.export:
        status_filter = None
        if args.warnings_only or args.warn:
            status_filter = ['NAME_WARN', 'ADDR_WARN']
        elif args.reject:
            status_filter = ['NAME_REJECTED', 'ADDR_REJECTED', 'NULL_ADDR_REJECTED', 'STATE_MISMATCH']
        elif args.approved:
            status_filter = ['MATCHED', 'ADDR_OK', 'NULL_ADDR_OK']
        elif args.blocked:
            status_filter = ['GUARDIAN_BLOCKED', 'STREAM_BLOCKED', 'STATE_BLOCKED', 'MULTI_CAMPUS_BLOCKED']
        export_csv(status_filter)
    elif args.stats:
        show_stats()
    elif args.pending:
        show_pending(category)
    else:
        # Interactive mode
        console.print(f"""
[bold]Commands:[/bold]
  [cyan]l[/cyan] = Learn alias (add to college_aliases + update group)
  [cyan]1-5[/cyan] = Select from suggestions
  [cyan]MED/DEN/DNB####[/cyan] = Enter ID directly
  [green]f[/green] = Force match (update group with existing match)
  [green]a[/green] = Approve (mark as reviewed)
  [green]u[/green] = Unblock (for Guardian-blocked, force match + remove from blocklist)
  [red]r[/red] = Reject (remove group match + invalidate cache)
  [red]b[/red] = Block (remove match + add to blocklist)
  [dim]s[/dim] = Skip
  [dim]q[/dim] = Quit

[bold]Mode Selection:[/bold]
  --mode seat         Review Seat Data (default)
  --mode counselling  Review Counselling Data

[bold]Category Filters:[/bold]
  --approved  Review approved matches
  --warn      Review warnings (borderline 65-80%)
  --reject    Review rejections (<65% or address mismatch)
  --blocked   Review Guardian-blocked groups (STREAM/STATE/MULTI-CAMPUS blocks)

[bold]After Review:[/bold]
  python review_matches.py --mode {data_type} --propagate   # Apply changes to individual records
""")
        interactive_review(category, data_type)



if __name__ == "__main__":
    main()
