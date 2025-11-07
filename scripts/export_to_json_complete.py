#!/usr/bin/env python3
"""
Complete JSON Export System
Exports SQLite databases to optimized JSON structure for static deployment

This script creates:
1. Master data files (colleges, courses, states, etc.)
2. College summaries with pre-aggregated stats
3. Trend files (10-year historical data)
4. Partitioned cutoff data
5. Seat availability data
6. Search indices
"""

import sqlite3
import json
import os
from pathlib import Path
from collections import defaultdict
from datetime import datetime
import re

# Configuration
BASE_DIR = Path(__file__).parent.parent
SQLITE_DIR = BASE_DIR / 'data' / 'sqlite'
OUTPUT_DIR = BASE_DIR / 'public' / 'data'

# Database paths
MASTER_DB = SQLITE_DIR / 'master_data.db'
COUNSELLING_DB = SQLITE_DIR / 'counselling_data_partitioned.db'
SEAT_DB = SQLITE_DIR / 'seat_data.db'

# Output directories
MASTER_OUTPUT = OUTPUT_DIR / 'master'
COLLEGES_OUTPUT = OUTPUT_DIR / 'colleges'
SUMMARIES_OUTPUT = COLLEGES_OUTPUT / 'summaries'
DETAILS_OUTPUT = COLLEGES_OUTPUT / 'details'
CUTOFFS_OUTPUT = OUTPUT_DIR / 'cutoffs'
SEATS_OUTPUT = OUTPUT_DIR / 'seats'
TRENDS_OUTPUT = OUTPUT_DIR / 'trends'
COLLEGE_TRENDS_OUTPUT = TRENDS_OUTPUT / 'college-trends'
COURSE_TRENDS_OUTPUT = TRENDS_OUTPUT / 'course-trends'
STATE_TRENDS_OUTPUT = TRENDS_OUTPUT / 'state-trends'
INDICES_OUTPUT = OUTPUT_DIR / 'indices'

def create_directories():
    """Create all necessary output directories"""
    dirs = [
        MASTER_OUTPUT, SUMMARIES_OUTPUT, DETAILS_OUTPUT,
        CUTOFFS_OUTPUT, SEATS_OUTPUT,
        COLLEGE_TRENDS_OUTPUT, COURSE_TRENDS_OUTPUT, STATE_TRENDS_OUTPUT,
        INDICES_OUTPUT
    ]
    for dir_path in dirs:
        dir_path.mkdir(parents=True, exist_ok=True)
    print(f"✅ Created output directories in {OUTPUT_DIR}")

def export_master_data():
    """Export master reference data (colleges, courses, states, categories, quotas)"""
    print("\n📋 Exporting Master Data...")

    conn = sqlite3.connect(MASTER_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Export Colleges (all types combined)
    print("  → Exporting colleges...")
    colleges = {}

    # Get all tables that contain colleges
    tables = ['medical_colleges', 'dental_colleges', 'dnb_colleges']

    for table in tables:
        try:
            query = f"SELECT * FROM {table}"
            cursor.execute(query)
            rows = cursor.fetchall()

            for row in rows:
                college_id = row['id'] if 'id' in row.keys() else f"COL{len(colleges)+1:04d}"
                colleges[college_id] = {
                    'id': college_id,
                    'name': row['name'] if 'name' in row.keys() else '',
                    'short_name': row['short_name'] if 'short_name' in row.keys() else row['name'],
                    'type': table.replace('_colleges', '').upper(),
                    'state': row['state'] if 'state' in row.keys() else '',
                    'city': row['city'] if 'city' in row.keys() else '',
                    'address': row['address'] if 'address' in row.keys() else '',
                    'management': row['management'] if 'management' in row.keys() else 'GOVERNMENT',
                    'established': row['established_year'] if 'established_year' in row.keys() else None,
                    'website': row['website'] if 'website' in row.keys() else '',
                    'university': row['university'] if 'university' in row.keys() else '',
                }
            print(f"     • {table}: {len(rows)} colleges")
        except sqlite3.OperationalError as e:
            print(f"     ⚠️  Warning: Could not read {table}: {e}")

    with open(MASTER_OUTPUT / 'colleges.json', 'w', encoding='utf-8') as f:
        json.dump(colleges, f, indent=2, ensure_ascii=False)
    print(f"  ✅ Exported {len(colleges)} colleges → colleges.json")

    # Export Courses
    print("  → Exporting courses...")
    courses = {}
    try:
        cursor.execute("SELECT * FROM courses")
        rows = cursor.fetchall()

        for row in rows:
            course_id = row['id'] if 'id' in row.keys() else row['name']
            courses[course_id] = {
                'id': course_id,
                'name': row['name'],
                'short_name': row['short_name'] if 'short_name' in row.keys() else row['name'],
                'level': row['level'] if 'level' in row.keys() else 'UG',
                'domain': row['domain'] if 'domain' in row.keys() else 'MEDICAL',
                'duration_years': row['duration_years'] if 'duration_years' in row.keys() else 3,
                'description': row['description'] if 'description' in row.keys() else '',
            }
    except sqlite3.OperationalError as e:
        print(f"     ⚠️  Warning: Could not read courses: {e}")

    with open(MASTER_OUTPUT / 'courses.json', 'w', encoding='utf-8') as f:
        json.dump(courses, f, indent=2, ensure_ascii=False)
    print(f"  ✅ Exported {len(courses)} courses → courses.json")

    # Export States
    print("  → Exporting states...")
    states = {}

    # Extract unique states from colleges
    unique_states = set()
    for college in colleges.values():
        if college['state']:
            unique_states.add(college['state'])

    for state_name in sorted(unique_states):
        # Generate state code from name
        state_id = state_name.replace(' ', '_').replace('&', 'and').upper()[:10]
        states[state_id] = {
            'id': state_id,
            'name': state_name,
            'code': state_id,
            'region': '',
        }

    with open(MASTER_OUTPUT / 'states.json', 'w', encoding='utf-8') as f:
        json.dump(states, f, indent=2, ensure_ascii=False)
    print(f"  ✅ Exported {len(states)} states → states.json")

    # Export Categories
    print("  → Exporting categories...")
    categories = {
        'OPEN': {'id': 'OPEN', 'name': 'Open Category', 'type': 'GENERAL'},
        'OBC': {'id': 'OBC', 'name': 'Other Backward Classes', 'type': 'RESERVED'},
        'SC': {'id': 'SC', 'name': 'Scheduled Caste', 'type': 'RESERVED'},
        'ST': {'id': 'ST', 'name': 'Scheduled Tribe', 'type': 'RESERVED'},
        'EWS': {'id': 'EWS', 'name': 'Economically Weaker Section', 'type': 'RESERVED'},
        'PWD': {'id': 'PWD', 'name': 'Person with Disability', 'type': 'PWD'},
    }

    with open(MASTER_OUTPUT / 'categories.json', 'w', encoding='utf-8') as f:
        json.dump(categories, f, indent=2, ensure_ascii=False)
    print(f"  ✅ Exported {len(categories)} categories → categories.json")

    # Export Quotas
    print("  → Exporting quotas...")
    quotas = {
        'AIQ': {'id': 'AIQ', 'name': 'All India Quota', 'type': 'CENTRAL'},
        'STATE': {'id': 'STATE', 'name': 'State Quota', 'type': 'STATE'},
        'MANAGEMENT': {'id': 'MANAGEMENT', 'name': 'Management Quota', 'type': 'PRIVATE'},
        'NRI': {'id': 'NRI', 'name': 'NRI Quota', 'type': 'PRIVATE'},
        'DEEMED': {'id': 'DEEMED', 'name': 'Deemed University', 'type': 'DEEMED'},
    }

    with open(MASTER_OUTPUT / 'quotas.json', 'w', encoding='utf-8') as f:
        json.dump(quotas, f, indent=2, ensure_ascii=False)
    print(f"  ✅ Exported {len(quotas)} quotas → quotas.json")

    conn.close()

    return colleges, courses, states, categories, quotas

def export_counselling_cutoffs():
    """Export partitioned counselling cutoff data"""
    print("\n📊 Exporting Counselling Cutoffs...")

    conn = sqlite3.connect(COUNSELLING_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get all unique partitions (source-year-level combinations)
    try:
        query = """
            SELECT DISTINCT source, year, level
            FROM counselling_records
            ORDER BY year DESC, source, level
        """
        cursor.execute(query)
        partitions = cursor.fetchall()

        print(f"  Found {len(partitions)} partitions")

        for partition in partitions:
            source = partition['source']
            year = partition['year']
            level = partition['level']
            partition_name = f"{source}-{year}-{level}"

            # Export partition data
            query = """
                SELECT
                    id,
                    master_college_id as college_id,
                    master_course_id as course_id,
                    quota,
                    category,
                    all_india_rank as opening_rank,
                    all_india_rank as closing_rank,
                    year,
                    round
                FROM counselling_records
                WHERE source = ? AND year = ? AND level = ?
                ORDER BY all_india_rank
            """
            cursor.execute(query, (source, year, level))
            rows = cursor.fetchall()

            cutoffs = []
            for i, row in enumerate(rows):
                cutoffs.append({
                    'id': f"{partition_name}-{i+1:06d}",
                    'college_id': row['college_id'],
                    'course_id': row['course_id'],
                    'quota_id': row['quota'] if row['quota'] else 'AIQ',
                    'category_id': row['category'] if row['category'] else 'OPEN',
                    'opening_rank': row['opening_rank'],
                    'closing_rank': row['closing_rank'],
                    'year': row['year'],
                    'round': row['round'] if row['round'] else 1,
                    'source': source,
                    'level': level,
                })

            # Write partition file
            output_file = CUTOFFS_OUTPUT / f"{partition_name}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(cutoffs, f, ensure_ascii=False)

            file_size = output_file.stat().st_size / (1024 * 1024)
            print(f"  ✅ {partition_name}: {len(cutoffs):,} records ({file_size:.2f} MB)")

    except sqlite3.OperationalError as e:
        print(f"  ⚠️  Warning: Could not export cutoffs: {e}")

    conn.close()

def export_seat_availability():
    """Export current seat availability data"""
    print("\n💺 Exporting Seat Availability...")

    conn = sqlite3.connect(SEAT_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        query = """
            SELECT
                id,
                master_college_id as college_id,
                master_course_id as course_id,
                category,
                quota,
                total_seats,
                available_seats,
                status,
                last_updated
            FROM seat_availability
            ORDER BY college_id, course_id
        """
        cursor.execute(query)
        rows = cursor.fetchall()

        seats = []
        for row in rows:
            seats.append({
                'id': row['id'],
                'college_id': row['college_id'],
                'course_id': row['course_id'],
                'category_id': row['category'],
                'quota_id': row['quota'],
                'total_seats': row['total_seats'],
                'available_seats': row['available_seats'],
                'filled_seats': row['total_seats'] - row['available_seats'],
                'status': row['status'],
                'last_updated': row['last_updated'],
            })

        with open(SEATS_OUTPUT / 'current.json', 'w', encoding='utf-8') as f:
            json.dump(seats, f, ensure_ascii=False)

        file_size = (SEATS_OUTPUT / 'current.json').stat().st_size / (1024 * 1024)
        print(f"  ✅ Exported {len(seats):,} seat records ({file_size:.2f} MB)")

    except sqlite3.OperationalError as e:
        print(f"  ⚠️  Warning: Could not export seat data: {e}")

    conn.close()

def generate_college_summaries(colleges):
    """Generate pre-aggregated college summary files for compare page"""
    print("\n🏥 Generating College Summaries...")

    conn_counselling = sqlite3.connect(COUNSELLING_DB)
    conn_counselling.row_factory = sqlite3.Row
    cursor_counselling = conn_counselling.cursor()

    conn_seats = sqlite3.connect(SEAT_DB)
    conn_seats.row_factory = sqlite3.Row
    cursor_seats = conn_seats.cursor()

    count = 0
    for college_id, college_data in colleges.items():
        summary = {
            'id': college_id,
            'name': college_data['name'],
            'short_name': college_data['short_name'],
            'type': college_data['type'],
            'state': college_data['state'],
            'city': college_data['city'],
            'management': college_data['management'],
            'established': college_data['established'],
            'stats': {},
            'courses': [],
            'cutoff_trends': {},
            'seat_availability': {},
            'highlights': {},
        }

        # Get cutoff data for this college
        try:
            query = """
                SELECT
                    master_course_id as course_id,
                    category,
                    year,
                    MIN(all_india_rank) as opening_rank,
                    MAX(all_india_rank) as closing_rank
                FROM counselling_records
                WHERE master_college_id = ?
                GROUP BY master_course_id, category, year
                ORDER BY year DESC, master_course_id, category
            """
            cursor_counselling.execute(query, (college_id,))
            cutoff_rows = cursor_counselling.fetchall()

            # Organize cutoffs by course and year
            cutoffs_by_course = defaultdict(lambda: defaultdict(dict))
            courses_offered = set()
            years_active = set()
            best_rank = float('inf')

            for row in cutoff_rows:
                course_id = row['course_id']
                category = row['category'] or 'OPEN'
                year = row['year']

                courses_offered.add(course_id)
                years_active.add(year)

                if row['opening_rank'] and row['opening_rank'] < best_rank:
                    best_rank = row['opening_rank']

                cutoffs_by_course[course_id][str(year)][category] = {
                    'opening': row['opening_rank'],
                    'closing': row['closing_rank'],
                }

            summary['cutoff_trends'] = dict(cutoffs_by_course)
            summary['stats']['years_active'] = sorted(list(years_active), reverse=True)
            summary['stats']['courses_offered'] = len(courses_offered)
            summary['highlights']['best_overall_rank'] = best_rank if best_rank != float('inf') else None

        except sqlite3.OperationalError:
            pass

        # Get seat data for this college
        try:
            query = """
                SELECT
                    master_course_id as course_id,
                    SUM(total_seats) as total_seats,
                    SUM(available_seats) as available_seats,
                    status
                FROM seat_availability
                WHERE master_college_id = ?
                GROUP BY master_course_id
            """
            cursor_seats.execute(query, (college_id,))
            seat_rows = cursor_seats.fetchall()

            total_seats = 0
            for row in seat_rows:
                course_id = row['course_id']
                summary['seat_availability'][course_id] = {
                    'total': row['total_seats'],
                    'available': row['available_seats'],
                    'filled': row['total_seats'] - row['available_seats'],
                    'status': row['status'],
                }
                total_seats += row['total_seats']

            summary['stats']['total_seats'] = total_seats

        except sqlite3.OperationalError:
            pass

        # Add course details
        for course_id in courses_offered:
            course_summary = {
                'course_id': course_id,
                'total_seats': summary['seat_availability'].get(course_id, {}).get('total', 0),
            }

            # Get best rank for this course
            if course_id in cutoffs_by_course:
                all_ranks = []
                for year_data in cutoffs_by_course[course_id].values():
                    for cat_data in year_data.values():
                        if cat_data.get('opening'):
                            all_ranks.append(cat_data['opening'])

                if all_ranks:
                    course_summary['best_rank_ever'] = min(all_ranks)

            summary['courses'].append(course_summary)

        # Write summary file
        output_file = SUMMARIES_OUTPUT / f"{college_id}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False)

        count += 1
        if count % 100 == 0:
            print(f"  → Processed {count}/{len(colleges)} colleges...")

    conn_counselling.close()
    conn_seats.close()

    print(f"  ✅ Generated {count} college summaries")

def generate_college_trends(colleges):
    """Generate 10-year trend files for each college"""
    print("\n📈 Generating College Trends...")

    conn = sqlite3.connect(COUNSELLING_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    count = 0
    for college_id, college_data in colleges.items():
        try:
            # Get all historical data for this college
            query = """
                SELECT
                    year,
                    master_course_id as course_id,
                    category,
                    quota,
                    MIN(all_india_rank) as opening_rank,
                    MAX(all_india_rank) as closing_rank,
                    COUNT(*) as candidates
                FROM counselling_records
                WHERE master_college_id = ?
                GROUP BY year, master_course_id, category, quota
                ORDER BY year DESC
            """
            cursor.execute(query, (college_id,))
            rows = cursor.fetchall()

            if not rows:
                continue

            # Organize by year
            yearly_trends = defaultdict(lambda: {
                'total_seats': 0,
                'courses_offered': 0,
                'total_admissions': 0,
                'best_rank': float('inf'),
                'courses': defaultdict(lambda: {'categories': {}})
            })

            courses_per_year = defaultdict(set)

            for row in rows:
                year = str(row['year'])
                course_id = row['course_id']
                category = row['category'] or 'OPEN'

                courses_per_year[year].add(course_id)

                yearly_trends[year]['total_admissions'] += row['candidates']
                if row['opening_rank'] and row['opening_rank'] < yearly_trends[year]['best_rank']:
                    yearly_trends[year]['best_rank'] = row['opening_rank']

                yearly_trends[year]['courses'][course_id]['categories'][category] = {
                    'opening': row['opening_rank'],
                    'closing': row['closing_rank'],
                    'candidates': row['candidates'],
                }

            # Set courses_offered count
            for year in yearly_trends:
                yearly_trends[year]['courses_offered'] = len(courses_per_year[year])
                yearly_trends[year]['courses'] = dict(yearly_trends[year]['courses'])
                if yearly_trends[year]['best_rank'] == float('inf'):
                    yearly_trends[year]['best_rank'] = None

            trend_data = {
                'college_id': college_id,
                'college_name': college_data['name'],
                'yearly_trends': dict(yearly_trends),
            }

            # Write trend file
            output_file = COLLEGE_TRENDS_OUTPUT / f"{college_id}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(trend_data, f, ensure_ascii=False)

            count += 1
            if count % 100 == 0:
                print(f"  → Processed {count} colleges...")

        except sqlite3.OperationalError:
            pass

    conn.close()
    print(f"  ✅ Generated {count} college trend files")

def generate_search_indices(colleges, courses):
    """Generate pre-computed search indices"""
    print("\n🔍 Generating Search Indices...")

    # Index: Colleges by state
    colleges_by_state = defaultdict(list)
    for college_id, college in colleges.items():
        if college['state']:
            colleges_by_state[college['state']].append(college_id)

    with open(INDICES_OUTPUT / 'colleges-by-state.json', 'w', encoding='utf-8') as f:
        json.dump(dict(colleges_by_state), f, ensure_ascii=False)
    print(f"  ✅ Created colleges-by-state index ({len(colleges_by_state)} states)")

    # Index: Colleges by type
    colleges_by_type = defaultdict(list)
    for college_id, college in colleges.items():
        colleges_by_type[college['type']].append(college_id)

    with open(INDICES_OUTPUT / 'colleges-by-type.json', 'w', encoding='utf-8') as f:
        json.dump(dict(colleges_by_type), f, ensure_ascii=False)
    print(f"  ✅ Created colleges-by-type index ({len(colleges_by_type)} types)")

    # Index: Courses by domain
    courses_by_domain = defaultdict(list)
    for course_id, course in courses.items():
        courses_by_domain[course['domain']].append(course_id)

    with open(INDICES_OUTPUT / 'courses-by-domain.json', 'w', encoding='utf-8') as f:
        json.dump(dict(courses_by_domain), f, ensure_ascii=False)
    print(f"  ✅ Created courses-by-domain index ({len(courses_by_domain)} domains)")

    # Metadata
    metadata = {
        'last_updated': datetime.now().isoformat(),
        'total_colleges': len(colleges),
        'total_courses': len(courses),
        'version': '1.0.0',
    }

    with open(INDICES_OUTPUT / 'metadata.json', 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"  ✅ Created metadata file")

def main():
    """Main export function"""
    print("\n" + "="*60)
    print("🚀 COMPLETE JSON EXPORT SYSTEM")
    print("="*60)

    # Create directory structure
    create_directories()

    # Export master data
    colleges, courses, states, categories, quotas = export_master_data()

    # Export relational data
    export_counselling_cutoffs()
    export_seat_availability()

    # Generate aggregated data
    generate_college_summaries(colleges)
    generate_college_trends(colleges)

    # Generate search indices
    generate_search_indices(colleges, courses)

    # Summary
    print("\n" + "="*60)
    print("✅ EXPORT COMPLETE!")
    print("="*60)
    print(f"\nOutput directory: {OUTPUT_DIR}")
    print(f"\nGenerated files:")
    print(f"  • Master data: {len(list(MASTER_OUTPUT.glob('*.json')))} files")
    print(f"  • College summaries: {len(list(SUMMARIES_OUTPUT.glob('*.json')))} files")
    print(f"  • College trends: {len(list(COLLEGE_TRENDS_OUTPUT.glob('*.json')))} files")
    print(f"  • Cutoff partitions: {len(list(CUTOFFS_OUTPUT.glob('*.json')))} files")
    print(f"  • Seat data: {len(list(SEATS_OUTPUT.glob('*.json')))} files")
    print(f"  • Search indices: {len(list(INDICES_OUTPUT.glob('*.json')))} files")

    # Calculate total size
    total_size = 0
    for file in OUTPUT_DIR.rglob('*.json'):
        total_size += file.stat().st_size

    print(f"\nTotal size: {total_size / (1024 * 1024):.2f} MB")
    print("\n✨ Ready for deployment!")

if __name__ == '__main__':
    main()
