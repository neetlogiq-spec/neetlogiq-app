import sqlite3
import json
import uuid
import pandas as pd
import os
from datetime import datetime

class DatabaseManager:
    def __init__(self, db_path=None):
        # Use persistent storage by default
        if db_path is None:
            import os
            from pathlib import Path
            data_dir = Path(__file__).parent.parent.parent / "data"
            data_dir.mkdir(exist_ok=True)
            db_path = str(data_dir / "processor.db")
        self.db_path = db_path
        self.conn = None
        self.cursor = None
        self.connect()

    def connect(self):
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.init_tables()

    def get_cursor(self):
        return self.conn.cursor()

    def init_tables(self):
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS processed_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT,
                table_name TEXT,
                course_column TEXT,
                upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS processed_courses (
                id TEXT PRIMARY KEY, 
                file TEXT, 
                original TEXT, 
                suggested TEXT,
                score INTEGER, 
                status TEXT, 
                final TEXT, 
                source_table TEXT, 
                source_id TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                user TEXT,
                action TEXT,
                details TEXT,
                record_id TEXT
            )
        """)
        cursor.execute("CREATE TABLE IF NOT EXISTS _metadata (key TEXT PRIMARY KEY, value TEXT)")
        self.conn.commit()
        cursor.close()

    def load_file(self, file_path, course_col=None):
        try:
            file_name = os.path.basename(file_path)
            if file_path.endswith(".csv"):
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path, engine="openpyxl")
            
            # Normalize columns
            df.columns = [str(c).strip() for c in df.columns]
            
            if not course_col:
                # Auto-detect course column
                possible_cols = ["COURSES", "COURSE", "COURSE_NAME", "SPECIALTY", "SUBJECT", "DISCIPLINE"]
                upper_cols = {c.upper(): c for c in df.columns}
                found_col = next((c for c in possible_cols if c in upper_cols), None)
                if found_col:
                    course_col = upper_cols[found_col]
            
            if not course_col or course_col not in df.columns:
                raise ValueError(f"Course column not found in {file_name}")

            # Prepare data for insertion
            table_name = "file_" + str(uuid.uuid4()).replace("-", "_")
            df.to_sql(table_name, self.conn, index=False, if_exists='replace')
            
            # Record file metadata
            cursor = self.conn.cursor()
            cursor.execute("INSERT INTO processed_files (filename, table_name, course_column) VALUES (?, ?, ?)",
                              (file_name, table_name, course_col))
            self.conn.commit()
            cursor.close()
            
            return table_name, course_col, file_name
        except Exception as e:
            raise e

    def get_processed_data(self, limit=None, offset=0, filters=None):
        query = "SELECT id, file, original, suggested, score, status, final FROM processed_courses"
        params = []
        conditions = []
        
        if filters:
            if filters.get("status") and filters["status"] != "All":
                conditions.append("status = ?")
                params.append(filters["status"])
            
            if filters.get("search"):
                search = f"%{filters['search'].upper()}%"
                conditions.append("(original LIKE ? OR suggested LIKE ? OR final LIKE ?)")
                params.extend([search, search, search])
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
            
        if limit:
            query += f" LIMIT {limit} OFFSET {offset}"
            
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        data = cursor.fetchall()
        cursor.close()
        return data

    def get_stats(self):
        try:
            cursor = self.conn.cursor()
            total = cursor.execute("SELECT COUNT(*) FROM processed_courses").fetchone()[0]
            auto = cursor.execute("SELECT COUNT(*) FROM processed_courses WHERE status='Auto-Matched'").fetchone()[0]
            possible = cursor.execute("SELECT COUNT(*) FROM processed_courses WHERE status='Possible Match'").fetchone()[0]
            dnm = total - auto - possible
            cursor.close()
            return {"total": total, "auto": auto, "possible": possible, "dnm": dnm}
        except:
            return {"total": 0, "auto": 0, "possible": 0, "dnm": 0}

    def update_record(self, record_id, updates):
        set_clause = ", ".join([f"{k}=?" for k in updates.keys()])
        values = list(updates.values())
        values.append(record_id)
        
        cursor = self.conn.cursor()
        cursor.execute(f"UPDATE processed_courses SET {set_clause} WHERE id=?", values)
        self.conn.commit()
        cursor.close()

    def log_action(self, user, action, details, record_id=None):
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO audit_log (user, action, details, record_id)
            VALUES (?, ?, ?, ?)
        """, (user, action, json.dumps(details), record_id))
        self.conn.commit()
        cursor.close()

    def close(self):
        if self.conn:
            self.conn.close()
