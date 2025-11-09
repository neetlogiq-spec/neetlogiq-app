"""
PostgreSQL Database Manager for NeetLogIQ
Replaces SQLite with PostgreSQL for better reliability and constraint validation
"""

import psycopg2
from psycopg2 import sql, pool
from psycopg2.extras import RealDictCursor
import logging
from contextlib import contextmanager
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class PostgreSQLManager:
    """PostgreSQL connection manager with constraint validation"""

    def __init__(self, db_url: str, pool_size: int = 5):
        """
        Initialize PostgreSQL connection pool

        Args:
            db_url: PostgreSQL connection URL (e.g., postgresql://user:pass@host:5432/dbname)
            pool_size: Maximum number of connections in pool
        """
        self.db_url = db_url
        self.pool = None
        self._initialize_pool(pool_size)

    def _initialize_pool(self, pool_size: int):
        """Initialize connection pool"""
        try:
            self.pool = psycopg2.pool.SimpleConnectionPool(1, pool_size, self.db_url)
            logger.info(f"PostgreSQL connection pool initialized (size={pool_size})")
        except psycopg2.Error as e:
            logger.error(f"Failed to initialize PostgreSQL pool: {e}")
            raise

    @contextmanager
    def get_connection(self):
        """Get a connection from the pool"""
        conn = None
        try:
            conn = self.pool.getconn()
            conn.autocommit = True
            yield conn
        except psycopg2.Error as e:
            logger.error(f"Database connection error: {e}")
            raise
        finally:
            if conn:
                self.pool.putconn(conn)

    @contextmanager
    def get_cursor(self, commit=True):
        """Get a cursor with automatic commit/rollback"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            try:
                yield cursor
                if commit:
                    conn.commit()
            except Exception as e:
                conn.rollback()
                logger.error(f"Database error (rolled back): {e}")
                raise

    def execute(self, query: str, params: tuple = None, fetch: bool = False) -> Any:
        """Execute query and optionally fetch results"""
        with self.get_cursor(commit=not fetch) as cursor:
            cursor.execute(query, params)
            if fetch:
                return cursor.fetchall()
            return cursor.rowcount

    def execute_many(self, query: str, params_list: List[tuple]) -> int:
        """Execute multiple queries (batch insert/update)"""
        with self.get_cursor() as cursor:
            for params in params_list:
                cursor.execute(query, params)
            return cursor.rowcount

    def fetch_one(self, query: str, params: tuple = None) -> Optional[Dict]:
        """Fetch single row"""
        with self.get_cursor(commit=False) as cursor:
            cursor.execute(query, params)
            return cursor.fetchone()

    def fetch_all(self, query: str, params: tuple = None) -> List[Dict]:
        """Fetch all rows"""
        with self.get_cursor(commit=False) as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()

    def close_pool(self):
        """Close all connections in pool"""
        if self.pool:
            self.pool.closeall()
            logger.info("PostgreSQL connection pool closed")


class SeatDataValidator:
    """Validation constraints for seat_data table"""

    def __init__(self, seat_db: PostgreSQLManager, master_db: PostgreSQLManager):
        self.seat_db = seat_db
        self.master_db = master_db

    def add_college_state_constraint(self):
        """
        PostgreSQL doesn't support CHECK constraints with subqueries.
        Instead, we'll use application-level validation (see find_false_matches).

        Note: For truly bulletproof constraints, you'd need:
        - PostgreSQL trigger with FOREIGN TABLE, or
        - Copy master tables into seat_data database

        For now, we use post-INSERT validation.
        """
        logger.info("✅ Application-level validation ready (no CHECK constraint needed)")

    def validate_college_state_match(self, college_id: str, state_id: str) -> bool:
        """Check if college exists in given state (using master_db)"""
        query = """
        SELECT COUNT(*) as count
        FROM state_college_link
        WHERE college_id = %s AND state_id = %s
        """
        result = self.master_db.fetch_one(query, (college_id, state_id))
        return result and result['count'] > 0 if result else False

    def find_false_matches(self) -> int:
        """
        Find all records where college_id doesn't exist in matched state_id

        Algorithm:
        1. Get list of matched seat_data records
        2. For each, check if college exists in state (via master_db)
        3. Count mismatches

        Returns count of false matches found
        """
        # Get all matched records
        query = """
        SELECT master_college_id, master_state_id
        FROM seat_data
        WHERE master_college_id IS NOT NULL AND master_state_id IS NOT NULL
        """
        matched_records = self.seat_db.fetch_all(query)

        if not matched_records:
            return 0

        # Check each match against master database
        false_count = 0
        check_query = """
        SELECT COUNT(*) as count
        FROM state_college_link
        WHERE college_id = %s AND state_id = %s
        """

        for record in matched_records:
            result = self.master_db.fetch_one(check_query, (record['master_college_id'], record['master_state_id']))
            if not result or result['count'] == 0:
                false_count += 1

        return false_count

    def clear_false_matches(self) -> int:
        """
        Clear all false college-state matches by finding mismatches and clearing them.

        Algorithm:
        1. Get all matched records
        2. Check each against master database
        3. Clear the ones that don't exist

        Returns number of records cleared
        """
        # Get all matched records
        query = """
        SELECT id, master_college_id, master_state_id
        FROM seat_data
        WHERE master_college_id IS NOT NULL AND master_state_id IS NOT NULL
        """
        matched_records = self.seat_db.fetch_all(query)

        if not matched_records:
            return 0

        # Check each match and collect IDs to clear
        check_query = """
        SELECT COUNT(*) as count
        FROM state_college_link
        WHERE college_id = %s AND state_id = %s
        """
        ids_to_clear = []

        for record in matched_records:
            result = self.master_db.fetch_one(check_query, (record['master_college_id'], record['master_state_id']))
            if not result or result['count'] == 0:
                ids_to_clear.append(record['id'])

        if not ids_to_clear:
            return 0

        # Clear all false matches in one update
        placeholders = ','.join(['%s'] * len(ids_to_clear))
        clear_query = f"""
        UPDATE seat_data
        SET master_college_id = NULL,
            college_match_score = 0
        WHERE id IN ({placeholders})
        """

        rowcount = self.seat_db.execute(clear_query, tuple(ids_to_clear))
        if rowcount > 0:
            logger.warning(f"⚠️ Cleared {rowcount} false matches")
        return rowcount

    def validate_data_integrity(self) -> Dict[str, Any]:
        """Run comprehensive data integrity checks"""
        results = {
            'false_matches': 0,
            'college_state_uniqueness': True,
            'issues': []
        }

        # Check for false matches
        results['false_matches'] = self.find_false_matches()
        if results['false_matches'] > 0:
            results['issues'].append(f"Found {results['false_matches']} false college-state matches")

        # Check college-state uniqueness
        uniqueness_query = """
        SELECT master_college_id, COUNT(DISTINCT master_state_id) as state_count
        FROM seat_data
        WHERE master_college_id IS NOT NULL
        GROUP BY master_college_id
        HAVING COUNT(DISTINCT master_state_id) > 1
        """
        cross_state = self.seat_db.fetch_all(uniqueness_query)
        if cross_state:
            results['college_state_uniqueness'] = False
            results['issues'].append(
                f"Found {len(cross_state)} colleges matched to multiple states"
            )

        return results


def test_postgresql_connection(db_url: str) -> bool:
    """Test PostgreSQL connection"""
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        conn.close()
        logger.info("✅ PostgreSQL connection test passed")
        return True
    except psycopg2.Error as e:
        logger.error(f"❌ PostgreSQL connection test failed: {e}")
        return False


if __name__ == "__main__":
    # Test PostgreSQL setup
    logging.basicConfig(level=logging.INFO)

    seat_db_url = "postgresql://kashyapanand@localhost:5432/seat_data"
    master_db_url = "postgresql://kashyapanand@localhost:5432/master_data"

    print("Testing PostgreSQL connections...")
    if test_postgresql_connection(seat_db_url):
        print("✅ Seat data database: OK")
    if test_postgresql_connection(master_db_url):
        print("✅ Master data database: OK")
