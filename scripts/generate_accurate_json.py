#!/usr/bin/env python3
"""
NeetLogIQ Data Generation Script
Generates JSON files from SQLite databases for the NeetLogIQ platform
"""

import os
import json
import sqlite3
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AccurateJSONGenerator:
    def __init__(self, db_dir: str = "data/sqlite", output_dir: str = "data/json"):
        self.db_dir = Path(db_dir)
        self.output_dir = Path(output_dir)
        self.master_db_path = self.db_dir / "master_data.db"
        self.counselling_db_path = self.db_dir / "counselling_data_partitioned.db"
        self.seat_db_path = self.db_dir / "seat_data.db"  # Using seat_data.db as seat_data_live.db is empty
        
        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize connections
        self.master_conn = None
        self.counselling_conn = None
        self.seat_conn = None
        
        # Cache for master data
        self.master_cache = {
            'states': {},
            'categories': {},
            'quotas': {},
            'colleges': {},
            'courses': {},
            'state_name_to_id': {},
            'state_mappings': {}
        }
        
        # Statistics
        self.stats = {
            'total_colleges': 0,
            'total_courses': 0,
            'total_counselling_records': 0,
            'total_seat_records': 0,
            'generated_files': []
        }
    
    def _initialize_connections(self):
        """Initialize database connections"""
        try:
            self.master_conn = sqlite3.connect(str(self.master_db_path))
            self.counselling_conn = sqlite3.connect(str(self.counselling_db_path))
            self.seat_conn = sqlite3.connect(str(self.seat_db_path))
            
            # Set row factory to access columns by name
            self.master_conn.row_factory = sqlite3.Row
            self.counselling_conn.row_factory = sqlite3.Row
            self.seat_conn.row_factory = sqlite3.Row
            
            logger.info("Database connections initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize database connections: {e}")
            return False
    
    def _load_master_data(self):
        """Load master data into cache"""
        try:
            # Load states
            cursor = self.master_conn.execute("SELECT id, name FROM states")
            for row in cursor:
                self.master_cache['states'][row['id']] = row['name']
                self.master_cache['state_name_to_id'][row['name'].upper()] = row['id']
            
            # Load categories
            cursor = self.master_conn.execute("SELECT id, name FROM categories")
            for row in cursor:
                self.master_cache['categories'][row['id']] = row['name']
            
            # Load quotas
            cursor = self.master_conn.execute("SELECT id, name FROM quotas")
            for row in cursor:
                self.master_cache['quotas'][row['id']] = row['name']
            
            # Load colleges
            cursor = self.master_conn.execute("SELECT id, name, state, college_type FROM colleges")
            for row in cursor:
                self.master_cache['colleges'][row['id']] = {
                    'name': row['name'],
                    'state': row['state'],
                    'college_type': row['college_type']
                }
            
            # Load courses
            cursor = self.master_conn.execute("SELECT id, name FROM courses")
            for row in cursor:
                self.master_cache['courses'][row['id']] = row['name']
            
            # Load state mappings
            cursor = self.master_conn.execute("SELECT raw_state, normalized_state FROM state_mappings")
            for row in cursor:
                self.master_cache['state_mappings'][row['raw_state'].upper()] = row['normalized_state']
            
            logger.info("Master data loaded into cache successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load master data: {e}")
            return False
    
    def _get_state_name(self, state_id: str) -> str:
        """Get state name from ID"""
        if state_id and state_id.startswith('STATE'):
            return self.master_cache['states'].get(state_id, state_id)
        return state_id
    
    def _get_category_name(self, category_id: str) -> str:
        """Get category name from ID"""
        return self.master_cache['categories'].get(category_id, category_id)
    
    def _get_quota_name(self, quota_id: str) -> str:
        """Get quota name from ID"""
        return self.master_cache['quotas'].get(quota_id, quota_id)
    
    def _get_course_name(self, course_id: str) -> str:
        """Get course name from ID"""
        return self.master_cache['courses'].get(course_id, course_id)
    
    def _derive_stream_from_college(self, college_id: str) -> str:
        """Derive stream from college ID"""
        if college_id.startswith('MED'):
            return 'MEDICAL'
        elif college_id.startswith('DEN'):
            return 'DENTAL'
        elif college_id.startswith('DNB'):
            return 'DNB'
        return 'UNKNOWN'
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for search"""
        if not text:
            return ""
        return text.lower().replace(' ', '').replace('-', '').replace('_', '')
    
    def _check_college_has_state_ids(self, college_id: str) -> bool:
        """Check if a college has any counselling records with state IDs linked"""
        try:
            query = """
                SELECT COUNT(*) as count
                FROM counselling_records 
                WHERE master_college_id = ? AND master_state_id IS NOT NULL
                LIMIT 1
            """
            
            cursor = self.counselling_conn.execute(query, (college_id,))
            result = cursor.fetchone()
            
            return result['count'] > 0 if result else False
            
        except Exception as e:
            logger.error(f"Error checking state IDs for college {college_id}: {str(e)}")
            return False
    
    def _generate_master_data(self) -> str:
        """Generate master data JSON file"""
        logger.info("Generating master data...")
        
        master_data = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'version': '1.0',
                'description': 'Master data for NeetLogIQ platform'
            },
            'states': [],
            'categories': [],
            'quotas': [],
            'colleges': [],
            'courses': []
        }
        
        # Add states
        for state_id, state_name in self.master_cache['states'].items():
            master_data['states'].append({
                'id': state_id,
                'name': state_name
            })
        
        # Add categories
        for category_id, category_name in self.master_cache['categories'].items():
            master_data['categories'].append({
                'id': category_id,
                'name': category_name
            })
        
        # Add quotas
        for quota_id, quota_name in self.master_cache['quotas'].items():
            master_data['quotas'].append({
                'id': quota_id,
                'name': quota_name
            })
        
        # Add colleges - ALL colleges, not just those with state IDs
        for college_id, college_data in self.master_cache['colleges'].items():
            # Get state name from master data
            state_name = college_data['state']
            
            # Find state ID from state name
            state_id = None
            
            # First try direct match
            for sid, sname in self.master_cache['states'].items():
                if sname.upper() == state_name.upper():
                    state_id = sid
                    break
            
            # If not found, try state mappings
            if not state_id:
                normalized_state = self.master_cache['state_mappings'].get(state_name.upper())
                if normalized_state:
                    for sid, sname in self.master_cache['states'].items():
                        if sname.upper() == normalized_state.upper():
                            state_id = sid
                            break
            
            # If still not found, use a placeholder
            if not state_id:
                state_id = f"UNKNOWN_{college_id}"
                logger.warning(f"State ID not found for state name: {state_name}, using placeholder: {state_id}")
            
            stream = self._derive_stream_from_college(college_id)
            
            college_entry = {
                'id': college_id,
                'name': college_data['name'],
                'normalized_name': self._normalize_text(college_data['name']),
                'state_id': state_id,
                'state_name': state_name,
                'college_type': college_data['college_type'],
                'stream': stream,
                'address': '', # No address in master_data.db, so empty
                'established_year': None # No established_year in master_data.db, so None
            }
            master_data['colleges'].append(college_entry)
        
        # Add courses
        for course_id, course_name in self.master_cache['courses'].items():
            course_entry = {
                'id': course_id,
                'name': course_name,
                'normalized_name': self._normalize_text(course_name)
            }
            master_data['courses'].append(course_entry)
        
        # Update statistics
        self.stats['total_colleges'] = len(master_data['colleges'])
        self.stats['total_courses'] = len(master_data['courses'])
        
        # Write to file
        output_path = self.output_dir / "master-data.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(master_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Generated master data with {len(master_data['colleges'])} colleges and {len(master_data['courses'])} courses")
        self.stats['generated_files'].append(str(output_path))
        
        return str(output_path)
    
    def _generate_hierarchical_cutoff_data(self) -> List[str]:
        """Generate hierarchical cutoff data JSON files"""
        logger.info("Generating hierarchical cutoff data...")
        
        generated_files = []
        
        try:
            # Get all unique years and levels
            query = """
                SELECT DISTINCT 
                    year,
                    level_normalized
                FROM counselling_records
                WHERE is_matched = 1 AND master_state_id IS NOT NULL
                ORDER BY year DESC, level_normalized
            """
            
            cursor = self.counselling_conn.execute(query)
            year_levels = cursor.fetchall()
            
            for year_level in year_levels:
                year = year_level['year']
                level = year_level['level_normalized']
                
                # Initialize hierarchical structure
                hierarchical_data = {
                    'metadata': {
                        'generated_at': datetime.now().isoformat(),
                        'year': year,
                        'level': level,
                        'description': f"Hierarchical cutoff data for {level} counselling {year}"
                    },
                    'data': {}
                }
                
                # Get all records for this year and level
                records_query = """
                    SELECT 
                        master_college_id,
                        master_course_id,
                        master_category_id,
                        master_quota_id,
                        master_state_id,
                        all_india_rank,
                        source_normalized,
                        round_normalized
                    FROM counselling_records
                    WHERE year = ? 
                        AND level_normalized = ?
                        AND is_matched = 1 
                        AND master_state_id IS NOT NULL
                    ORDER BY master_state_id, master_college_id, master_course_id, round_normalized, master_quota_id, master_category_id, all_india_rank
                """
                
                cursor = self.counselling_conn.execute(records_query, (year, level))
                records = cursor.fetchall()
                
                if not records:
                    continue
                
                # Build hierarchical structure
                for record in records:
                    college_id = record['master_college_id']
                    course_id = record['master_course_id']
                    category_id = record['master_category_id']
                    quota_id = record['master_quota_id']
                    state_id = record['master_state_id']
                    rank = record['all_india_rank']
                    source = record['source_normalized']
                    round_num = record['round_normalized']
                    
                    # Get names from master data
                    college_data = self.master_cache['colleges'].get(college_id, {})
                    college_name = college_data.get('name', 'Unknown')
                    state_name = self._get_state_name(state_id)
                    course_name = self._get_course_name(course_id)
                    category_name = self._get_category_name(category_id)
                    quota_name = self._get_quota_name(quota_id)
                    
                    # Build hierarchy: year -> level -> state -> college -> course -> round -> quota -> category -> ranks
                    # State level
                    if state_id not in hierarchical_data['data']:
                        hierarchical_data['data'][state_id] = {
                            'state_name': state_name,
                            'colleges': {}
                        }
                    
                    # College level
                    if college_id not in hierarchical_data['data'][state_id]['colleges']:
                        hierarchical_data['data'][state_id]['colleges'][college_id] = {
                            'college_name': college_name,
                            'college_type': college_data.get('college_type', 'Unknown'),
                            'stream': self._derive_stream_from_college(college_id),
                            'courses': {}
                        }
                    
                    # Course level
                    if course_id not in hierarchical_data['data'][state_id]['colleges'][college_id]['courses']:
                        hierarchical_data['data'][state_id]['colleges'][college_id]['courses'][course_id] = {
                            'course_name': course_name,
                            'rounds': {}
                        }
                    
                    # Round level
                    if round_num not in hierarchical_data['data'][state_id]['colleges'][college_id]['courses'][course_id]['rounds']:
                        hierarchical_data['data'][state_id]['colleges'][college_id]['courses'][course_id]['rounds'][round_num] = {
                            'counselling_body': source,
                            'quotas': {}
                        }
                    
                    # Quota level
                    if quota_id not in hierarchical_data['data'][state_id]['colleges'][college_id]['courses'][course_id]['rounds'][round_num]['quotas']:
                        hierarchical_data['data'][state_id]['colleges'][college_id]['courses'][course_id]['rounds'][round_num]['quotas'][quota_id] = {
                            'quota_name': quota_name,
                            'categories': {}
                        }
                    
                    # Category level
                    if category_id not in hierarchical_data['data'][state_id]['colleges'][college_id]['courses'][course_id]['rounds'][round_num]['quotas'][quota_id]['categories']:
                        hierarchical_data['data'][state_id]['colleges'][college_id]['courses'][course_id]['rounds'][round_num]['quotas'][quota_id]['categories'][category_id] = {
                            'category_name': category_name,
                            'ranks': []
                        }
                    
                    # Add rank
                    hierarchical_data['data'][state_id]['colleges'][college_id]['courses'][course_id]['rounds'][round_num]['quotas'][quota_id]['categories'][category_id]['ranks'].append(rank)
                
                # Calculate opening and closing ranks for each category
                for state_id, state_data in hierarchical_data['data'].items():
                    for college_id, college_data in state_data['colleges'].items():
                        for course_id, course_data in college_data['courses'].items():
                            for round_num, round_data in course_data['rounds'].items():
                                for quota_id, quota_data in round_data['quotas'].items():
                                    for category_id, category_data in quota_data['categories'].items():
                                        ranks = category_data['ranks']
                                        if ranks:
                                            category_data['opening_rank'] = min(ranks)
                                            category_data['closing_rank'] = max(ranks)
                                            category_data['total_seats'] = len(ranks)
                
                # Write to file
                filename = f"hierarchical-cutoffs/{level}-{year}.json"
                output_path = self.output_dir / filename
                output_path.parent.mkdir(parents=True, exist_ok=True)
                
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(hierarchical_data, f, indent=2, ensure_ascii=False)
                
                generated_files.append(str(output_path))
                self.stats['total_counselling_records'] += len(records)
                logger.info(f"Generated hierarchical cutoff data: {filename} with {len(records)} records")
            
            return generated_files
            
        except Exception as e:
            logger.error(f"Failed to generate hierarchical cutoff data: {str(e)}")
            return []
    
    def _generate_flattened_cutoff_data(self) -> List[str]:
        """Generate flattened cutoff data JSON files"""
        logger.info("Generating flattened cutoff data...")
        
        generated_files = []
        
        try:
            # Get all unique years and levels
            query = """
                SELECT DISTINCT 
                    year,
                    level_normalized
                FROM counselling_records
                WHERE is_matched = 1 AND master_state_id IS NOT NULL
                ORDER BY year DESC, level_normalized
            """
            
            cursor = self.counselling_conn.execute(query)
            year_levels = cursor.fetchall()
            
            for year_level in year_levels:
                year = year_level['year']
                level = year_level['level_normalized']
                
                # Initialize flattened structure
                flattened_data = {
                    'metadata': {
                        'generated_at': datetime.now().isoformat(),
                        'year': year,
                        'level': level,
                        'description': f"Flattened cutoff data for {level} counselling {year}"
                    },
                    'data': []
                }
                
                # Get all records for this year and level
                records_query = """
                    SELECT 
                        master_college_id,
                        master_course_id,
                        master_category_id,
                        master_quota_id,
                        master_state_id,
                        all_india_rank,
                        source_normalized,
                        round_normalized
                    FROM counselling_records
                    WHERE year = ? 
                        AND level_normalized = ?
                        AND is_matched = 1 
                        AND master_state_id IS NOT NULL
                    ORDER BY master_state_id, master_college_id, master_course_id, round_normalized, master_quota_id, master_category_id, all_india_rank
                """
                
                cursor = self.counselling_conn.execute(records_query, (year, level))
                records = cursor.fetchall()
                
                if not records:
                    continue
                
                # Group records by college, course, round, quota, and category
                grouped_records = {}
                
                for record in records:
                    college_id = record['master_college_id']
                    course_id = record['master_course_id']
                    category_id = record['master_category_id']
                    quota_id = record['master_quota_id']
                    state_id = record['master_state_id']
                    rank = record['all_india_rank']
                    source = record['source_normalized']
                    round_num = record['round_normalized']
                    
                    # Create a unique key for grouping
                    group_key = f"{college_id}_{course_id}_{round_num}_{quota_id}_{category_id}"
                    
                    if group_key not in grouped_records:
                        # Get names from master data
                        college_data = self.master_cache['colleges'].get(college_id, {})
                        college_name = college_data.get('name', 'Unknown')
                        state_name = self._get_state_name(state_id)
                        course_name = self._get_course_name(course_id)
                        category_name = self._get_category_name(category_id)
                        quota_name = self._get_quota_name(quota_id)
                        
                        grouped_records[group_key] = {
                            'college_id': college_id,
                            'college_name': college_name,
                            'college_type': college_data.get('college_type', 'Unknown'),
                            'stream': self._derive_stream_from_college(college_id),
                            'state_id': state_id,
                            'state_name': state_name,
                            'course_id': course_id,
                            'course_name': course_name,
                            'round': round_num,
                            'counselling_body': source,
                            'quota_id': quota_id,
                            'quota_name': quota_name,
                            'category_id': category_id,
                            'category_name': category_name,
                            'ranks': []
                        }
                    
                    # Add rank to the group
                    grouped_records[group_key]['ranks'].append(rank)
                
                # Calculate opening and closing ranks and add to flattened data
                for group_data in grouped_records.values():
                    ranks = group_data['ranks']
                    if ranks:
                        group_data['opening_rank'] = min(ranks)
                        group_data['closing_rank'] = max(ranks)
                        group_data['total_seats'] = len(ranks)
                    
                    # Add to flattened data array
                    flattened_data['data'].append(group_data)
                
                # Write to file
                filename = f"flattened-cutoffs/{level}-{year}.json"
                output_path = self.output_dir / filename
                output_path.parent.mkdir(parents=True, exist_ok=True)
                
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(flattened_data, f, indent=2, ensure_ascii=False)
                
                generated_files.append(str(output_path))
                logger.info(f"Generated flattened cutoff data: {filename} with {len(flattened_data['data'])} records")
            
            return generated_files
            
        except Exception as e:
            logger.error(f"Failed to generate flattened cutoff data: {str(e)}")
            return []
    
    def _generate_college_counselling_analysis(self) -> List[str]:
        """Generate college counselling analysis JSON files"""
        logger.info("Generating college counselling analysis...")
        
        generated_files = []
        
        try:
            # Start with ALL colleges from master data
            for college_id in self.master_cache['colleges']:
                # Get counselling data for this college (if any)
                query = """
                    SELECT 
                        source_normalized,
                        level_normalized,
                        year,
                        round_normalized,
                        master_course_id,
                        master_category_id,
                        master_quota_id,
                        master_state_id,
                        all_india_rank
                    FROM counselling_records
                    WHERE master_college_id = ? 
                        AND is_matched = 1 
                        AND master_state_id IS NOT NULL
                    ORDER BY year DESC, source_normalized, level_normalized, round_normalized, all_india_rank
                """
                
                cursor = self.counselling_conn.execute(query, (college_id,))
                records = cursor.fetchall()
                
                # Even if no counselling records, create a basic analysis file
                # Group by counselling body, level, and year
                counselling_data = {}
                for record in records:
                    source = record['source_normalized']
                    level = record['level_normalized']
                    year = str(record['year'])
                    state_id = record['master_state_id']
                    
                    if source not in counselling_data:
                        counselling_data[source] = {}
                    if level not in counselling_data[source]:
                        counselling_data[source][level] = {}
                    if year not in counselling_data[source][level]:
                        counselling_data[source][level][year] = {
                            'rounds': {},
                            'courses': {},
                            'categories': {},
                            'quotas': {},
                            'states': {}
                        }
                    
                    round_num = record['round_normalized']
                    course_id = record['master_course_id']
                    category_id = record['master_category_id']
                    quota_id = record['master_quota_id']
                    rank = record['all_india_rank']
                    
                    # Initialize round data if not exists
                    if round_num not in counselling_data[source][level][year]['rounds']:
                        counselling_data[source][level][year]['rounds'][round_num] = {
                            'records': [],
                            'quota_category_breakdown': {}
                        }
                    
                    # Add record
                    counselling_data[source][level][year]['rounds'][round_num]['records'].append({
                        'course_id': course_id,
                        'category_id': category_id,
                        'quota_id': quota_id,
                        'state_id': state_id,
                        'rank': rank
                    })
                    
                    # Track courses
                    if course_id:
                        course_name = self._get_course_name(course_id)
                        if course_id not in counselling_data[source][level][year]['courses']:
                            counselling_data[source][level][year]['courses'][course_id] = {
                                'name': course_name,
                                'records': []
                            }
                        counselling_data[source][level][year]['courses'][course_id]['records'].append({
                            'round': round_num,
                            'category_id': category_id,
                            'quota_id': quota_id,
                            'state_id': state_id,
                            'rank': rank
                        })
                    
                    # Track categories
                    if category_id:
                        category_name = self._get_category_name(category_id)
                        if category_id not in counselling_data[source][level][year]['categories']:
                            counselling_data[source][level][year]['categories'][category_id] = {
                                'name': category_name,
                                'records': []
                            }
                        counselling_data[source][level][year]['categories'][category_id]['records'].append({
                            'round': round_num,
                            'course_id': course_id,
                            'quota_id': quota_id,
                            'state_id': state_id,
                            'rank': rank
                        })
                    
                    # Track quotas
                    if quota_id:
                        quota_name = self._get_quota_name(quota_id)
                        if quota_id not in counselling_data[source][level][year]['quotas']:
                            counselling_data[source][level][year]['quotas'][quota_id] = {
                                'name': quota_name,
                                'records': []
                            }
                        counselling_data[source][level][year]['quotas'][quota_id]['records'].append({
                            'round': round_num,
                            'course_id': course_id,
                            'category_id': category_id,
                            'state_id': state_id,
                            'rank': rank
                        })
                    
                    # Track states
                    if state_id:
                        state_name = self._get_state_name(state_id)
                        if state_id not in counselling_data[source][level][year]['states']:
                            counselling_data[source][level][year]['states'][state_id] = {
                                'name': state_name,
                                'records': []
                            }
                        counselling_data[source][level][year]['states'][state_id]['records'].append({
                            'round': round_num,
                            'course_id': course_id,
                            'category_id': category_id,
                            'quota_id': quota_id,
                            'rank': rank
                        })
                    
                    # Build quota-category breakdown
                    quota_category_key = f"{quota_id}_{category_id}"
                    if quota_category_key not in counselling_data[source][level][year]['rounds'][round_num]['quota_category_breakdown']:
                        counselling_data[source][level][year]['rounds'][round_num]['quota_category_breakdown'][quota_category_key] = {
                            'quota_id': quota_id,
                            'category_id': category_id,
                            'state_id': state_id,
                            'seat_count': 0
                        }
                    
                    counselling_data[source][level][year]['rounds'][round_num]['quota_category_breakdown'][quota_category_key]['seat_count'] += 1
                
                # Create JSON structure
                college_data = self.master_cache['colleges'].get(college_id, {})
                college_name = college_data.get('name', 'Unknown')
                state_name = college_data.get('state', 'Unknown')
                
                college_analysis = {
                    'metadata': {
                        'generated_at': datetime.now().isoformat(),
                        'college_id': college_id,
                        'college_name': college_name,
                        'state': state_name,
                        'total_records': len(records),
                        'has_counselling_data': len(records) > 0
                    },
                    'counselling_data': counselling_data
                }
                
                # Write to file
                filename = f"counselling-analysis/{college_id}.json"
                output_path = self.output_dir / filename
                output_path.parent.mkdir(parents=True, exist_ok=True)
                
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(college_analysis, f, indent=2, ensure_ascii=False)
                
                generated_files.append(str(output_path))
                if len(records) > 0:
                    logger.info(f"Generated college analysis: {filename} with {len(records)} records")
                else:
                    logger.debug(f"Generated college analysis: {filename} with no counselling data")
            
            return generated_files
            
        except Exception as e:
            logger.error(f"Failed to generate college counselling analysis: {str(e)}")
            return []
    
    def _generate_seat_data(self) -> str:
        """Generate seat data JSON file"""
        logger.info("Generating seat data...")
        
        try:
            # Get all seat records with master IDs
            query = """
                SELECT 
                    master_college_id,
                    master_course_id,
                    master_state_id,
                    seats
                FROM seat_data
                WHERE master_college_id IS NOT NULL 
                    AND master_course_id IS NOT NULL
                    AND master_state_id IS NOT NULL
            """
            
            cursor = self.seat_conn.execute(query)
            records = cursor.fetchall()
            
            if not records:
                logger.warning("No seat data found with master IDs")
                return None
            
            # Group by college
            seat_data = {}
            for record in records:
                college_id = record['master_college_id']
                course_id = record['master_course_id']
                state_id = record['master_state_id']
                seats = record['seats']
                
                if college_id not in seat_data:
                    college_name = self.master_cache['colleges'].get(college_id, {}).get('name', 'Unknown')
                    state_name = self._get_state_name(state_id)
                    seat_data[college_id] = {
                        'college_name': college_name,
                        'state_id': state_id,
                        'state_name': state_name,
                        'courses': {}
                    }
                
                if course_id not in seat_data[college_id]['courses']:
                    course_name = self._get_course_name(course_id)
                    seat_data[college_id]['courses'][course_id] = {
                        'course_name': course_name,
                        'seats': 0
                    }
                
                seat_data[college_id]['courses'][course_id]['seats'] += seats
            
            # Create JSON structure
            seat_json = {
                'metadata': {
                    'generated_at': datetime.now().isoformat(),
                    'total_colleges': len(seat_data),
                    'total_records': len(records)
                },
                'data': seat_data
            }
            
            # Write to file
            output_path = self.output_dir / "seat-data.json"
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(seat_json, f, indent=2, ensure_ascii=False)
            
            self.stats['total_seat_records'] = len(records)
            logger.info(f"Generated seat data with {len(seat_data)} colleges and {len(records)} records")
            self.stats['generated_files'].append(str(output_path))
            
            return str(output_path)
            
        except Exception as e:
            logger.error(f"Failed to generate seat data: {str(e)}")
            return None
    
    def _generate_search_indices(self) -> str:
        """Generate search indices JSON file"""
        logger.info("Generating search indices...")
        
        search_data = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'description': 'Search indices for NeetLogIQ platform'
            },
            'colleges': [],
            'courses': []
        }
        
        # Add college search indices - ALL colleges, not just those with state IDs
        for college_id, college_data in self.master_cache['colleges'].items():
            # Get state name from master data
            state_name = college_data['state']
            
            # Find state ID from state name
            state_id = None
            
            # First try direct match
            for sid, sname in self.master_cache['states'].items():
                if sname.upper() == state_name.upper():
                    state_id = sid
                    break
            
            # If not found, try state mappings
            if not state_id:
                normalized_state = self.master_cache['state_mappings'].get(state_name.upper())
                if normalized_state:
                    for sid, sname in self.master_cache['states'].items():
                        if sname.upper() == normalized_state.upper():
                            state_id = sid
                            break
            
            # If still not found, use a placeholder
            if not state_id:
                state_id = f"UNKNOWN_{college_id}"
            
            stream = self._derive_stream_from_college(college_id)
            
            college_entry = {
                'id': college_id,
                'name': college_data['name'],
                'normalized_name': self._normalize_text(college_data['name']),
                'state_id': state_id,
                'state_name': state_name,
                'college_type': college_data['college_type'],
                'stream': stream,
                'search_terms': [
                    college_data['name'].lower(),
                    self._normalize_text(college_data['name']),
                    state_name.lower(),
                    college_data['college_type'].lower(),
                    stream.lower()
                ]
            }
            search_data['colleges'].append(college_entry)
        
        # Add course search indices
        for course_id, course_name in self.master_cache['courses'].items():
            course_entry = {
                'id': course_id,
                'name': course_name,
                'normalized_name': self._normalize_text(course_name),
                'search_terms': [
                    course_name.lower(),
                    self._normalize_text(course_name)
                ]
            }
            search_data['courses'].append(course_entry)
        
        # Write to file
        output_path = self.output_dir / "search-indices.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(search_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Generated search indices with {len(search_data['colleges'])} colleges and {len(search_data['courses'])} courses")
        self.stats['generated_files'].append(str(output_path))
        
        return str(output_path)
    
    def _generate_summary_report(self) -> str:
        """Generate summary report"""
        logger.info("Generating summary report...")
        
        summary = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'description': 'Summary report for NeetLogIQ data generation'
            },
            'statistics': self.stats,
            'generated_files': self.stats['generated_files']
        }
        
        # Write to file
        output_path = self.output_dir / "generation-summary.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Generated summary report: {output_path}")
        return str(output_path)
    
    def generate_all_data(self):
        """Generate all data files"""
        logger.info("Starting generation of all data files...")
        
        try:
            # Initialize connections
            if not self._initialize_connections():
                return False
            
            # Load master data
            if not self._load_master_data():
                return False
            
            # Generate all data files
            self._generate_master_data()
            self._generate_hierarchical_cutoff_data()
            self._generate_flattened_cutoff_data()
            self._generate_college_counselling_analysis()
            self._generate_seat_data()
            self._generate_search_indices()
            self._generate_summary_report()
            
            # Close connections
            self.master_conn.close()
            self.counselling_conn.close()
            self.seat_conn.close()
            
            logger.info("Data generation completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Data generation failed: {str(e)}")
            return False

if __name__ == "__main__":
    logger.info("Starting NeetLogIQ data generation...")
    
    generator = AccurateJSONGenerator()
    success = generator.generate_all_data()
    
    if success:
        logger.info("NeetLogIQ data generation completed successfully")
    else:
        logger.error("NeetLogIQ data generation failed")
