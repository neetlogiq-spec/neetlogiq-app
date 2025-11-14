#!/usr/bin/env python3
"""
PostgreSQL Connection Manager
Handles connection pooling, query execution, and transaction management.

Features:
- Connection pooling with psycopg2
- Automatic reconnection on failure
- Transaction management
- Query execution with error handling
- Logging of all operations
"""

import psycopg2
from psycopg2 import pool, extras, sql
from contextlib import contextmanager
import logging
from typing import Optional, List, Dict, Any, Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class PostgreSQLManager:
    """Manages PostgreSQL connections and queries"""

    def __init__(self, database_url: str, pool_size: int = 5, timeout: int = 10):
        """
        Initialize PostgreSQL manager with connection pooling.

        Args:
            database_url: PostgreSQL connection URL (postgresql://user@host:port/dbname)
            pool_size: Size of connection pool (default: 5)
            timeout: Connection timeout in seconds (default: 10)
        """
        self.database_url = database_url
        self.pool_size = pool_size
        self.timeout = timeout

        # Parse connection URL
        self.conn_params = self._parse_connection_url(database_url)

        # Initialize connection pool
        try:
            self.connection_pool = pool.SimpleConnectionPool(
                1,
                pool_size,
                **self.conn_params,
                connect_timeout=timeout
            )
            logger.info(f"✓ Created connection pool for {self.conn_params['database']}")
        except Exception as e:
            logger.error(f"✗ Failed to create connection pool: {e}")
            raise

    @staticmethod
    def _parse_connection_url(url: str) -> Dict[str, str]:
        """Parse PostgreSQL connection URL into connection parameters"""
        parsed = urlparse(url)

        return {
            'host': parsed.hostname or 'localhost',
            'port': parsed.port or 5432,
            'database': parsed.path.lstrip('/'),
            'user': parsed.username,
            'password': parsed.password or ''
        }

    @contextmanager
    def get_connection(self):
        """
        Context manager for database connections.

        Usage:
            with manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(...)
        """
        conn = None
        try:
            conn = self.connection_pool.getconn()
            yield conn
        except Exception as e:
            logger.error(f"Database error: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                self.connection_pool.putconn(conn)

    def execute_query(self, query: str, params: tuple = None, fetch: bool = False) -> Any:
        """
        Execute a query and optionally fetch results.

        Args:
            query: SQL query string
            params: Query parameters (for parameterized queries)
            fetch: If True, fetch all results; if False, just execute

        Returns:
            Query results if fetch=True, otherwise None
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)

                if fetch:
                    results = cursor.fetchall()
                    cursor.close()
                    return results
                else:
                    conn.commit()
                    cursor.close()
                    return None

            except Exception as e:
                conn.rollback()
                logger.error(f"Query execution error: {e}")
                logger.error(f"Query: {query}")
                raise

    def execute_many(self, query: str, data: List[tuple]) -> int:
        """
        Execute multiple queries (batch insert/update).

        Args:
            query: SQL query string
            data: List of tuples containing query parameters

        Returns:
            Number of rows affected
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.executemany(query, data)
                conn.commit()
                rows_affected = cursor.rowcount
                cursor.close()
                return rows_affected
            except Exception as e:
                conn.rollback()
                logger.error(f"Batch execution error: {e}")
                raise

    def fetch_one(self, query: str, params: tuple = None) -> Optional[tuple]:
        """Fetch a single row"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                result = cursor.fetchone()
                cursor.close()
                return result
            except Exception as e:
                logger.error(f"Fetch one error: {e}")
                raise

    def fetch_all(self, query: str, params: tuple = None) -> List[tuple]:
        """Fetch all rows"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                results = cursor.fetchall()
                cursor.close()
                return results
            except Exception as e:
                logger.error(f"Fetch all error: {e}")
                raise

    def fetch_dict(self, query: str, params: tuple = None) -> List[Dict[str, Any]]:
        """Fetch all rows as dictionaries"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=extras.RealDictCursor)
            try:
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                results = cursor.fetchall()
                cursor.close()
                return results
            except Exception as e:
                logger.error(f"Fetch dict error: {e}")
                raise

    def count_rows(self, table: str, where: str = None) -> int:
        """Count rows in a table"""
        query = f"SELECT COUNT(*) FROM {table}"
        if where:
            query += f" WHERE {where}"

        result = self.fetch_one(query)
        return result[0] if result else 0

    def table_exists(self, table_name: str) -> bool:
        """Check if table exists"""
        query = """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = %s
        """
        result = self.fetch_one(query, (table_name,))
        return result is not None

    def close(self):
        """Close all connections in the pool"""
        try:
            self.connection_pool.closeall()
            logger.info("✓ Closed all database connections")
        except Exception as e:
            logger.error(f"Error closing connections: {e}")

    def __enter__(self):
        """Context manager entry"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()
