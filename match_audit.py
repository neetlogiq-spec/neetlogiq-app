#!/usr/bin/env python3
"""
Match Audit Logger and CSV Export

Collects match decisions during processing and exports to CSV for review.
Enables tracking of warnings, rejections, and successful matches.
"""

import csv
import os
import sqlite3
import logging
from datetime import datetime
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field, asdict

logger = logging.getLogger(__name__)


@dataclass
class MatchAuditEntry:
    """Single match decision for audit - now group-based."""
    group_id: str  # From group_matching_queue
    seat_college_name: str
    seat_state: str
    seat_address: str
    matched_college_id: Optional[str]
    master_college_name: Optional[str]
    master_state: Optional[str]
    master_address: Optional[str]
    confidence: float
    name_similarity: float
    status: str  # MATCHED, NAME_WARN, NAME_REJECTED, ADDR_REJECTED, NO_MATCH, etc.
    reason: str
    model: str
    record_count: int = 1  # How many individual records this group affects
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    reviewed: bool = False
    review_action: Optional[str] = None  # APPROVE, REJECT, BLOCK, LEARN_ALIAS


class MatchAuditLogger:
    """
    Collects and exports match decisions for human review.
    Now works at GROUP level (one entry per unique college name/state combo).
    
    Usage:
        audit = MatchAuditLogger()
        audit.log_group(group_id, ...)
        audit.export_csv("audit_2024.csv")
    """
    
    def __init__(self, db_path: str = 'data/sqlite/match_audit.db'):
        self.db_path = db_path
        self.entries: List[MatchAuditEntry] = []
        self._init_db()
    
    def _init_db(self):
        """Initialize SQLite database for persistent audit log."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        
        # Create new table with group_id
        conn.execute("""
            CREATE TABLE IF NOT EXISTS match_audit_v2 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id TEXT NOT NULL,
                seat_college_name TEXT,
                seat_state TEXT,
                seat_address TEXT,
                matched_college_id TEXT,
                master_college_name TEXT,
                master_state TEXT,
                master_address TEXT,
                confidence REAL,
                name_similarity REAL,
                status TEXT,
                reason TEXT,
                model TEXT,
                record_count INTEGER DEFAULT 1,
                timestamp TEXT,
                reviewed INTEGER DEFAULT 0,
                review_action TEXT,
                batch_id TEXT,
                UNIQUE(group_id, status)
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_v2_status ON match_audit_v2(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_v2_reviewed ON match_audit_v2(reviewed)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_v2_group ON match_audit_v2(group_id)")
        conn.commit()
        conn.close()
    
    def log_match(
        self,
        group_id: str,
        seat_college_name: str,
        seat_state: str,
        seat_address: str,
        matched_college_id: Optional[str],
        master_college_name: Optional[str],
        master_state: Optional[str],
        master_address: Optional[str],
        confidence: float,
        name_similarity: float,
        status: str,
        reason: str,
        model: str = "",
        batch_id: str = "",
        record_count: int = 1,
    ):
        """Log a match decision for a GROUP (not individual record)."""
        entry = MatchAuditEntry(
            group_id=str(group_id),
            seat_college_name=seat_college_name or "",
            seat_state=seat_state or "",
            seat_address=seat_address or "",
            matched_college_id=matched_college_id,
            master_college_name=master_college_name or "",
            master_state=master_state or "",
            master_address=master_address or "",
            confidence=confidence,
            name_similarity=name_similarity,
            status=status,
            reason=reason,
            model=model,
            record_count=record_count,
        )
        self.entries.append(entry)
        
        # Persist to database (upsert - update if exists)
        self._save_entry(entry, batch_id)
    
    def _save_entry(self, entry: MatchAuditEntry, batch_id: str = ""):
        """Save entry to database using UPSERT (group_id + status unique)."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            INSERT INTO match_audit_v2 
            (group_id, seat_college_name, seat_state, seat_address,
             matched_college_id, master_college_name, master_state, master_address,
             confidence, name_similarity, status, reason, model, record_count, timestamp, batch_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(group_id, status) DO UPDATE SET
                matched_college_id = excluded.matched_college_id,
                confidence = excluded.confidence,
                name_similarity = excluded.name_similarity,
                reason = excluded.reason,
                timestamp = excluded.timestamp
        """, (
            entry.group_id, entry.seat_college_name, entry.seat_state, entry.seat_address,
            entry.matched_college_id, entry.master_college_name, entry.master_state, entry.master_address,
            entry.confidence, entry.name_similarity, entry.status, entry.reason,
            entry.model, entry.record_count, entry.timestamp, batch_id
        ))
        conn.commit()
        conn.close()
    
    def export_csv(
        self,
        filepath: str = None,
        status_filter: List[str] = None,
        include_reviewed: bool = True,
    ) -> str:
        """
        Export audit log to CSV.
        
        Args:
            filepath: Output path (default: auto-generated)
            status_filter: Only include these statuses (e.g., ['NAME_WARN', 'ADDR_REJECTED'])
            include_reviewed: Include already-reviewed entries
            
        Returns:
            Path to exported CSV
        """
        if not filepath:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filepath = f"data/exports/match_audit_{timestamp}.csv"
        
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Query from database for comprehensive export
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        
        query = "SELECT * FROM match_audit_v2 WHERE 1=1"
        params = []
        
        if status_filter:
            placeholders = ','.join('?' * len(status_filter))
            query += f" AND status IN ({placeholders})"
            params.extend(status_filter)
        
        if not include_reviewed:
            query += " AND reviewed = 0"
        
        query += " ORDER BY timestamp DESC"
        
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            logger.warning("No entries to export")
            return filepath
        
        # Write CSV
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            
            # Header
            writer.writerow([
                'group_id', 'seat_college_name', 'seat_state', 'seat_address',
                'matched_college_id', 'master_college_name', 'master_state', 'master_address',
                'confidence', 'name_similarity', 'status', 'reason', 'model', 'record_count',
                'timestamp', 'reviewed', 'review_action'
            ])
            
            # Data
            for row in rows:
                writer.writerow([
                    row['group_id'], row['seat_college_name'], row['seat_state'], row['seat_address'],
                    row['matched_college_id'], row['master_college_name'], row['master_state'], row['master_address'],
                    f"{row['confidence']:.1%}", f"{row['name_similarity']:.1%}", row['status'], row['reason'],
                    row['model'], row['record_count'], row['timestamp'], 'Yes' if row['reviewed'] else 'No', row['review_action'] or ''
                ])
        
        logger.info(f"Exported {len(rows)} entries to {filepath}")
        return filepath
    
    def get_pending_review(self, status_filter: List[str] = None) -> List[Dict]:
        """Get entries pending review."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        
        query = "SELECT * FROM match_audit_v2 WHERE reviewed = 0"
        params = []
        
        if status_filter:
            placeholders = ','.join('?' * len(status_filter))
            query += f" AND status IN ({placeholders})"
            params.extend(status_filter)
        
        query += " ORDER BY record_count DESC, name_similarity DESC"
        
        cursor = conn.execute(query, params)
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return rows
    
    def mark_reviewed(self, group_id: str, action: str):
        """
        Mark a group entry as reviewed.
        
        Args:
            group_id: Group ID to mark
            action: APPROVE, REJECT, BLOCK, or LEARN_ALIAS
        """
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            UPDATE match_audit_v2 
            SET reviewed = 1, review_action = ?
            WHERE group_id = ? AND reviewed = 0
        """, (action, group_id))
        conn.commit()
        conn.close()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get audit statistics."""
        conn = sqlite3.connect(self.db_path)
        
        stats = {}
        
        # Total counts by status
        cursor = conn.execute("""
            SELECT status, COUNT(*) as count, SUM(record_count) as records
            FROM match_audit_v2 
            GROUP BY status
        """)
        stats['by_status'] = {row[0]: {'groups': row[1], 'records': row[2] or 0} for row in cursor.fetchall()}
        
        # Review progress
        cursor = conn.execute("""
            SELECT 
                SUM(CASE WHEN reviewed = 1 THEN 1 ELSE 0 END) as reviewed,
                SUM(CASE WHEN reviewed = 1 THEN record_count ELSE 0 END) as reviewed_records,
                COUNT(*) as total,
                SUM(record_count) as total_records
            FROM match_audit_v2
        """)
        row = cursor.fetchone()
        stats['reviewed_groups'] = row[0] or 0
        stats['reviewed_records'] = row[1] or 0
        stats['total_groups'] = row[2] or 0
        stats['total_records'] = row[3] or 0
        stats['pending_groups'] = stats['total_groups'] - stats['reviewed_groups']
        
        conn.close()
        return stats
    
    def print_summary(self):
        """Print audit summary to console."""
        from rich.console import Console
        from rich.table import Table
        
        console = Console()
        stats = self.get_stats()
        
        table = Table(title="📋 Match Audit Summary (Group-Based)", show_header=True)
        table.add_column("Status", style="cyan")
        table.add_column("Groups", justify="right")
        table.add_column("Records", justify="right")
        
        for status, counts in stats['by_status'].items():
            style = "green" if status == "MATCHED" else "yellow" if "WARN" in status else "red"
            table.add_row(
                f"[{style}]{status}[/{style}]", 
                str(counts['groups']),
                str(int(counts['records']))
            )
        
        table.add_row("─" * 20, "─" * 6, "─" * 7)
        table.add_row("[bold]Total[/bold]", str(stats['total_groups']), str(int(stats['total_records'])))
        table.add_row("Reviewed", str(stats['reviewed_groups']), str(int(stats['reviewed_records'])))
        table.add_row("[yellow]Pending[/yellow]", str(stats['pending_groups']), "")
        
        console.print(table)


# Singleton instances per data_type
_audit_loggers: Dict[str, MatchAuditLogger] = {}


def get_audit_logger(data_type: str = 'seat') -> MatchAuditLogger:
    """Get or create audit logger for specified data type.
    
    Args:
        data_type: 'seat' or 'counselling'
        
    Returns:
        MatchAuditLogger instance for the specified data type
    """
    global _audit_loggers
    
    if data_type not in _audit_loggers:
        if data_type == 'counselling':
            db_path = 'data/sqlite/match_audit_counselling.db'
        else:
            db_path = 'data/sqlite/match_audit.db'  # Keep original name for seat
        _audit_loggers[data_type] = MatchAuditLogger(db_path=db_path)
    
    return _audit_loggers[data_type]

