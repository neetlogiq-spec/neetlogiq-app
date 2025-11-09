#!/usr/bin/env python3
"""
Database Migrations
Creates and manages database schemas for matching system.
"""

import logging
from typing import List
from .postgres_manager import PostgreSQLManager

logger = logging.getLogger(__name__)


class DatabaseMigrations:
    """Handles database schema creation and migrations"""

    def __init__(self, db_manager: PostgreSQLManager):
        """Initialize migrations handler"""
        self.db = db_manager

    def create_seat_data_schema(self):
        """Create schema for seat_data table"""
        schema_sql = """
        CREATE TABLE IF NOT EXISTS seat_data (
            id SERIAL PRIMARY KEY,
            master_state_id VARCHAR(50),
            master_course_id VARCHAR(50),
            normalized_college_name TEXT,
            normalized_address TEXT,
            master_college_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_seat_state_course
            ON seat_data(master_state_id, master_course_id)
            WHERE master_college_id IS NULL;

        CREATE INDEX IF NOT EXISTS idx_seat_college_name
            ON seat_data(normalized_college_name)
            WHERE master_college_id IS NULL;

        CREATE INDEX IF NOT EXISTS idx_seat_unmatched
            ON seat_data(master_college_id) WHERE master_college_id IS NULL;
        """

        try:
            self.db.execute_query(schema_sql)
            logger.info("✓ Created seat_data schema")
        except Exception as e:
            logger.error(f"✗ Failed to create seat_data schema: {e}")
            raise

    def create_counselling_data_schema(self):
        """Create schema for counselling_data table"""
        schema_sql = """
        CREATE TABLE IF NOT EXISTS counselling_data (
            id SERIAL PRIMARY KEY,
            master_state_id VARCHAR(50),
            master_course_id VARCHAR(50),
            normalized_college_name TEXT,
            normalized_address TEXT,
            master_college_id INTEGER,
            quota VARCHAR(50),
            category VARCHAR(50),
            level VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_counselling_state_course
            ON counselling_data(master_state_id, master_course_id)
            WHERE master_college_id IS NULL;

        CREATE INDEX IF NOT EXISTS idx_counselling_unmatched
            ON counselling_data(master_college_id) WHERE master_college_id IS NULL;
        """

        try:
            self.db.execute_query(schema_sql)
            logger.info("✓ Created counselling_data schema")
        except Exception as e:
            logger.error(f"✗ Failed to create counselling_data schema: {e}")
            raise

    def create_master_schema(self):
        """Create schema for master reference tables"""
        schema_sql = """
        CREATE TABLE IF NOT EXISTS colleges (
            id INTEGER PRIMARY KEY,
            name TEXT,
            normalized_name TEXT,
            state VARCHAR(50)
        );

        CREATE TABLE IF NOT EXISTS state_college_link (
            college_id INTEGER,
            state_id VARCHAR(50),
            address TEXT,
            PRIMARY KEY (college_id, state_id)
        );

        CREATE TABLE IF NOT EXISTS state_course_college_link (
            college_id INTEGER,
            state_id VARCHAR(50),
            course_id VARCHAR(50),
            PRIMARY KEY (college_id, state_id, course_id)
        );

        CREATE TABLE IF NOT EXISTS states (
            id VARCHAR(50) PRIMARY KEY,
            name TEXT,
            normalized_name TEXT
        );

        CREATE TABLE IF NOT EXISTS courses (
            id VARCHAR(50) PRIMARY KEY,
            name TEXT,
            normalized_name TEXT,
            course_type VARCHAR(50)
        );

        CREATE INDEX IF NOT EXISTS idx_colleges_name
            ON colleges(normalized_name);

        CREATE INDEX IF NOT EXISTS idx_state_college_link_college
            ON state_college_link(college_id);

        CREATE INDEX IF NOT EXISTS idx_state_course_college
            ON state_course_college_link(college_id, state_id);
        """

        try:
            self.db.execute_query(schema_sql)
            logger.info("✓ Created master reference schema")
        except Exception as e:
            logger.error(f"✗ Failed to create master schema: {e}")
            raise

    def create_matching_results_table(self):
        """Create table for storing matching results"""
        schema_sql = """
        CREATE TABLE IF NOT EXISTS matching_results (
            id SERIAL PRIMARY KEY,
            source_table VARCHAR(50),
            record_id INTEGER,
            master_college_id INTEGER,
            matched_at TIMESTAMP,
            stage INTEGER,
            confidence_score REAL,
            notes TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_results_record
            ON matching_results(source_table, record_id);

        CREATE INDEX IF NOT EXISTS idx_results_college
            ON matching_results(master_college_id);
        """

        try:
            self.db.execute_query(schema_sql)
            logger.info("✓ Created matching_results schema")
        except Exception as e:
            logger.error(f"✗ Failed to create matching_results schema: {e}")
            raise

    def create_all_schemas(self):
        """Create all required schemas"""
        logger.info("Creating database schemas...")
        self.create_master_schema()
        self.create_seat_data_schema()
        self.create_counselling_data_schema()
        self.create_matching_results_table()
        logger.info("✓ All schemas created successfully")
