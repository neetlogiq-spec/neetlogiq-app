#!/usr/bin/env python3
"""
Cascading Hierarchical Ensemble Matcher - PRIMARY MATCHING SYSTEM

This is the ONLY matching path. All other paths are disabled.

Architecture:
  STAGE 1: Pure Hierarchical (State → Course Stream → College Name → Address)
  STAGE 2: Hierarchical + RapidFuzz Fallback (on unmatched from Stage 1)
  STAGE 3: Hierarchical + Full Ensemble Fallback (on unmatched from Stage 2)

Each stage:
- Filters by state → preserves master_state_id
- Filters by course stream → preserves master_course_id
- Filters by college name (with fallback) → attempts master_college_id
- Validates with address (with fallback)

Course Stream Handling:
- Diploma and Medical as primary streams
- DNB as fallback stream (if diploma/medical not found)
"""

import sqlite3
import pandas as pd
import logging
from datetime import datetime
import traceback
import yaml
import os
from rapidfuzz import fuzz, process

# Try to import transformer models for Stage 3
try:
    from sentence_transformers import SentenceTransformer, util
    TRANSFORMER_AVAILABLE = True
except ImportError:
    TRANSFORMER_AVAILABLE = False
    logger.warning("sentence-transformers not available - Stage 3 will be disabled")

logging.basicConfig(level=logging.WARNING, format='%(message)s')  # Changed from INFO to WARNING
logger = logging.getLogger(__name__)


class CascadingHierarchicalEnsembleMatcher:
    """Implements clean 3-stage cascading hierarchical matching with config-aware DIPLOMA handling"""

    def __init__(self, seat_db_path='data/sqlite/seat_data.db', master_db_path='data/sqlite/master_data.db', config_path='config.yaml', verbose=False):
        self.seat_db_path = seat_db_path
        self.master_db_path = master_db_path
        self.config = self._load_config(config_path)
        self.diploma_dnb_only = set(self.config.get('diploma_courses', {}).get('dnb_only', []))
        self.diploma_overlapping = set(self.config.get('diploma_courses', {}).get('overlapping', []))
        # Verbose mode: False = clean progress bars, True = detailed logging
        self.verbose = verbose or self.config.get('logging', {}).get('verbose_matching', False)

    def _load_config(self, config_path):
        """Load configuration from YAML file"""
        try:
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    config = yaml.safe_load(f)
                    logger.info(f"✓ Loaded config from {config_path}")
                    return config
            else:
                logger.warning(f"Config file not found at {config_path}, using defaults")
                return {}
        except Exception as e:
            logger.warning(f"Error loading config: {e}, using defaults")
            return {}

    def _get_diploma_stream_filter(self, course_name_col):
        """Generate stream filter condition for DIPLOMA courses based on config

        Returns SQL condition for stream filtering:
        - dnb_only: Only DNB stream
        - overlapping: Both MEDICAL and DNB streams
        - medical_only (default): Only MEDICAL stream
        """
        return f"""
        (
            {course_name_col} IN ({', '.join([f"'{c}'" for c in self.diploma_dnb_only])})
            AND sccl.stream = 'DNB'
        )
        OR
        (
            {course_name_col} IN ({', '.join([f"'{c}'" for c in self.diploma_overlapping])})
            AND sccl.stream IN ('MEDICAL', 'DNB')
        )
        OR
        (
            {course_name_col} NOT IN ({', '.join([f"'{c}'" for c in self.diploma_dnb_only | self.diploma_overlapping])})
            AND {course_name_col} LIKE '%DIPLOMA%'
            AND sccl.stream = 'MEDICAL'
        )
        """

    def match_all_records_cascading(self, table_name='seat_data'):
        """Run the complete 3-stage cascading pipeline

        Supports both:
        - Seat Data: (state, course, college)
        - Counselling Data: (state, course, college, quota, category, level)

        The matcher automatically detects the data type and preserves all fields.
        """
        from rich.console import Console
        from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn
        from rich.panel import Panel
        from rich.table import Table as RichTable

        console = Console()

        # Show header only in verbose mode
        if self.verbose:
            print("\n" + "="*100)
            print("🎯 CASCADING HIERARCHICAL ENSEMBLE MATCHER")
            print(f"   TABLE: {table_name} | PRIMARY MATCHING SYSTEM")
            print("="*100)
            print()
        else:
            # Clean modern header
            console.print()
            console.print(Panel.fit(
                "[bold cyan]🎯 Cascading Hierarchical Matcher[/bold cyan]\n"
                f"[dim]Processing {table_name}[/dim]",
                border_style="cyan"
            ))

        results = {
            'total': 0,
            'stage1': {'matched': 0, 'percentage': 0},
            'stage2': {'matched': 0, 'percentage': 0},
            'stage3': {'matched': 0, 'percentage': 0},
            'final_matched': 0,
            'final_unmatched': 0,
            'accuracy': 0,
            'false_matches': 0,
            'execution_time': 0
        }

        start_time = datetime.now()

        # Get total record count
        conn = sqlite3.connect(self.seat_db_path)
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM {table_name}")
        results['total'] = cur.fetchone()[0]
        conn.close()

        try:
            # Create progress bar for clean UX
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                TextColumn("•"),
                TextColumn("[cyan]{task.fields[status]}"),
                TimeElapsedColumn(),
                console=console,
                transient=False
            ) as progress:

                # ===== STAGE 1: Pure Hierarchical =====
                task1 = progress.add_task(
                    "[cyan]Stage 1: Pure Hierarchical",
                    total=100,
                    status="Starting..."
                )

                if self.verbose:
                    print("STAGE 1: Pure Hierarchical Matching")
                    print("-" * 100)

                self._run_stage_1(table_name, 'none')
                results['stage1']['matched'] = self._count_matched(table_name)
                results['stage1']['percentage'] = (results['stage1']['matched'] / results['total']) * 100

                progress.update(task1, completed=100, status=f"✓ {results['stage1']['matched']:,} matched ({results['stage1']['percentage']:.1f}%)")

                if self.verbose:
                    print(f"  ✓ Matched: {results['stage1']['matched']:,} ({results['stage1']['percentage']:.2f}%)")
                    print()

                # ===== STAGE 2: Hierarchical + RapidFuzz =====
                unmatched_stage1 = results['total'] - results['stage1']['matched']
                task2 = progress.add_task(
                    "[yellow]Stage 2: + RapidFuzz",
                    total=100,
                    status=f"Processing {unmatched_stage1:,} unmatched..."
                )

                if self.verbose:
                    print("STAGE 2: Hierarchical + RapidFuzz Fallback")
                    print("-" * 100)

                self._run_stage_2(table_name, 'rapidfuzz')
                results['stage2']['matched'] = self._count_matched(table_name)
                stage2_additional = results['stage2']['matched'] - results['stage1']['matched']
                results['stage2']['percentage'] = (results['stage2']['matched'] / results['total']) * 100

                progress.update(task2, completed=100, status=f"✓ +{stage2_additional:,} matched")

                if self.verbose:
                    print(f"  ✓ Additional Matched: {stage2_additional:,}")
                    print(f"  ✓ Total Matched: {results['stage2']['matched']:,} ({results['stage2']['percentage']:.2f}%)")
                    print()

                # ===== STAGE 3: Hierarchical + Full Ensemble =====
                unmatched_stage2 = results['total'] - results['stage2']['matched']
                task3 = progress.add_task(
                    "[magenta]Stage 3: + Transformers",
                    total=100,
                    status=f"Processing {unmatched_stage2:,} unmatched..."
                )

                if self.verbose:
                    print("STAGE 3: Hierarchical + Full Ensemble Fallback")
                    print("-" * 100)

                self._run_stage_3(table_name, 'ensemble')
                results['stage3']['matched'] = self._count_matched(table_name)
                stage3_additional = results['stage3']['matched'] - results['stage2']['matched']
                results['stage3']['percentage'] = (results['stage3']['matched'] / results['total']) * 100

                progress.update(task3, completed=100, status=f"✓ +{stage3_additional:,} matched")

                if self.verbose:
                    print(f"  ✓ Additional Matched: {stage3_additional:,}")
                    print(f"  ✓ Total Matched: {results['stage3']['matched']:,} ({results['stage3']['percentage']:.2f}%)")
                    print()

                # ===== VALIDATION =====
                task4 = progress.add_task(
                    "[green]Validation",
                    total=100,
                    status="Checking integrity..."
                )

                if self.verbose:
                    print("VALIDATION: Data Integrity Checks")
                    print("-" * 100)

                violations = self._validate_matches(table_name)
                progress.update(task4, completed=100, status=f"✓ {violations} violations found")

            results['final_matched'] = results['stage3']['matched']
            results['final_unmatched'] = results['total'] - results['final_matched']
            results['accuracy'] = (results['final_matched'] / results['total']) * 100
            results['false_matches'] = violations

            end_time = datetime.now()
            results['execution_time'] = (end_time - start_time).total_seconds()

            # ===== SUMMARY =====
            if self.verbose:
                print()
                print("="*100)
                print("📊 CASCADING HIERARCHICAL ENSEMBLE - FINAL RESULTS")
                print("="*100)
                print()
                print(f"Total Records:        {results['total']:,}")
                print()
                print(f"Stage 1 (Pure):       {results['stage1']['matched']:,} ({results['stage1']['percentage']:.2f}%)")
                print(f"Stage 2 (+ Fuzzy):    {results['stage2']['matched']:,} ({results['stage2']['percentage']:.2f}%) [+{stage2_additional:,}]")
                print(f"Stage 3 (+ Ensemble): {results['stage3']['matched']:,} ({results['stage3']['percentage']:.2f}%) [+{stage3_additional:,}]")
                print()
                print(f"✅ Final Matched:     {results['final_matched']:,} ({results['accuracy']:.2f}%)")
                print(f"⏳ Unmatched:         {results['final_unmatched']:,}")
                print(f"❌ False Matches:     {results['false_matches']}")
                print()
                print(f"⏱️  Execution Time:    {results['execution_time']:.1f} seconds")
                print("="*100)
            else:
                # Clean modern summary table
                console.print()
                summary_table = RichTable(title="📊 Matching Results", show_header=True, header_style="bold cyan", border_style="cyan")
                summary_table.add_column("Stage", style="cyan", width=20)
                summary_table.add_column("Matched", justify="right", style="green")
                summary_table.add_column("Accuracy", justify="right", style="yellow")
                summary_table.add_column("Additional", justify="right", style="magenta")

                summary_table.add_row(
                    "Total Records",
                    f"{results['total']:,}",
                    "",
                    ""
                )
                summary_table.add_row("", "", "", "")  # Separator
                summary_table.add_row(
                    "Stage 1 (Hierarchical)",
                    f"{results['stage1']['matched']:,}",
                    f"{results['stage1']['percentage']:.1f}%",
                    ""
                )
                summary_table.add_row(
                    "Stage 2 (+ RapidFuzz)",
                    f"{results['stage2']['matched']:,}",
                    f"{results['stage2']['percentage']:.1f}%",
                    f"+{stage2_additional:,}"
                )
                summary_table.add_row(
                    "Stage 3 (+ Transformers)",
                    f"{results['stage3']['matched']:,}",
                    f"{results['stage3']['percentage']:.1f}%",
                    f"+{stage3_additional:,}"
                )
                summary_table.add_row("", "", "", "")  # Separator
                summary_table.add_row(
                    "[bold green]✅ Final Matched",
                    f"[bold green]{results['final_matched']:,}",
                    f"[bold green]{results['accuracy']:.1f}%",
                    ""
                )
                summary_table.add_row(
                    "[bold yellow]⏳ Unmatched",
                    f"[bold yellow]{results['final_unmatched']:,}",
                    "",
                    ""
                )
                summary_table.add_row(
                    f"[bold {'red' if violations > 0 else 'green'}]{'❌' if violations > 0 else '✅'} Violations",
                    f"[bold {'red' if violations > 0 else 'green'}]{violations}",
                    "",
                    ""
                )

                console.print(summary_table)
                console.print(f"\n[dim]⏱️  Execution Time: {results['execution_time']:.1f}s[/dim]")
                console.print()

            return results

        except Exception as e:
            logger.error(f"❌ Error in cascading matching: {e}")
            traceback.print_exc()
            return results

    def _run_stage_1(self, table_name, fallback_method):
        """STAGE 1: Pure Hierarchical - Proper state→stream→course→name→address filtering"""
        conn = sqlite3.connect(self.seat_db_path)
        cur = conn.cursor()

        try:
            # Attach master DB
            cur.execute("ATTACH DATABASE ? AS mdb", (self.master_db_path,))

            # LEVEL 1: STATE matching - Match to master states
            state_query = f"""
            UPDATE {table_name}
            SET master_state_id = (
                SELECT id FROM mdb.states
                WHERE normalized_name = {table_name}.normalized_state
                LIMIT 1
            )
            WHERE normalized_state IS NOT NULL AND master_state_id IS NULL;
            """
            cur.execute(state_query)

            # LEVEL 2: COURSE matching - Match to master courses
            course_query = f"""
            UPDATE {table_name}
            SET master_course_id = (
                SELECT c.id FROM mdb.courses c
                WHERE c.normalized_name = {table_name}.normalized_course_name
                LIMIT 1
            )
            WHERE normalized_course_name IS NOT NULL
              AND master_course_id IS NULL
              AND master_state_id IS NOT NULL;
            """
            cur.execute(course_query)

            # LEVEL 3: COLLEGE matching with proper hierarchy
            # STATE → STREAM → COURSE → COMPOSITE KEY → COLLEGE NAME + ADDRESS
            # Key principle: Use COMPOSITE KEY to get all distinct colleges (even with same name), then narrow by ADDRESS
            # This handles duplicate names in same state (e.g., 8 "DISTRICT HOSPITAL" in Karnataka with different addresses)

            # Get config-aware DIPLOMA stream filter
            diploma_filter = self._get_diploma_stream_filter(f'{table_name}.normalized_course_name')

            college_query = f"""
            UPDATE {table_name}
            SET master_college_id = (
                SELECT c.id
                FROM mdb.state_college_link scl
                JOIN mdb.colleges c ON c.id = scl.college_id
                WHERE c.composite_college_key LIKE {table_name}.normalized_college_name || ',%'
                  AND scl.state_id = {table_name}.master_state_id
                  -- Match address (keyword match) to narrow down to specific campus
                  AND INSTR(UPPER(COALESCE(scl.address, '')), UPPER(COALESCE({table_name}.normalized_address, ''))) > 0
                  -- CRITICAL: Only match colleges offering this course in this stream in this state
                  AND EXISTS (
                    SELECT 1 FROM mdb.state_course_college_link sccl
                    WHERE sccl.college_id = c.id
                      AND sccl.state_id = {table_name}.master_state_id
                      AND sccl.course_id = {table_name}.master_course_id
                      -- Stream filtering: Config-aware for DIPLOMA, hardcoded for others
                      AND (
                        ({table_name}.course_type = 'DENTAL' AND sccl.stream = 'DENTAL')
                        OR ({table_name}.course_type = 'DNB' AND sccl.stream = 'DNB')
                        OR ({table_name}.course_type = 'MEDICAL' AND sccl.stream = 'MEDICAL')
                        OR ({table_name}.course_type = 'DIPLOMA' AND ({diploma_filter}))
                      )
                  )
                LIMIT 1
            )
            WHERE master_state_id IS NOT NULL
              AND master_course_id IS NOT NULL
              AND master_college_id IS NULL
              AND normalized_college_name IS NOT NULL
              AND normalized_address IS NOT NULL;
            """
            cur.execute(college_query)

            conn.commit()

        finally:
            conn.close()

    def _run_stage_2(self, table_name, fallback_method):
        """STAGE 2: Hierarchical + RapidFuzz - RapidFuzz fuzzy matching for college names and addresses"""
        conn = sqlite3.connect(self.seat_db_path)

        try:
            # First ensure states and courses are matched (they should be from Stage 1)
            cur = conn.cursor()
            cur.execute("ATTACH DATABASE ? AS mdb", (self.master_db_path,))

            # Get unmatched records with matched state and course
            unmatched_query = f"""
            SELECT
                id, normalized_state, normalized_college_name, normalized_address,
                normalized_course_name, course_type, master_state_id, master_course_id
            FROM {table_name}
            WHERE master_state_id IS NOT NULL
              AND master_course_id IS NOT NULL
              AND master_college_id IS NULL
              AND normalized_college_name IS NOT NULL
              AND normalized_address IS NOT NULL
            """
            unmatched_records = pd.read_sql(unmatched_query, conn)

            if len(unmatched_records) == 0:
                logger.info("  ✓ No unmatched records for Stage 2")
                return

            logger.info(f"  ℹ️  Processing {len(unmatched_records):,} unmatched records with RapidFuzz...")

            # Get all candidate colleges with their details (including composite_college_key)
            candidates_query = """
            SELECT c.id, c.name, c.normalized_name, c.composite_college_key, scl.address, scl.state_id, sccl.stream, sccl.course_id
            FROM mdb.colleges c
            JOIN mdb.state_college_link scl ON c.id = scl.college_id
            JOIN mdb.state_course_college_link sccl ON c.id = sccl.college_id AND scl.state_id = sccl.state_id
            """
            candidates = pd.read_sql(candidates_query, conn)

            matches_found = 0

            # Process each unmatched record
            for idx, record in unmatched_records.iterrows():
                state_id = record['master_state_id']
                course_id = record['master_course_id']
                college_name = record['normalized_college_name']
                address = record['normalized_address']
                course_type = record['course_type']

                # Filter candidates by state and course
                state_candidates = candidates[
                    (candidates['state_id'] == state_id) &
                    (candidates['course_id'] == course_id)
                ]

                if len(state_candidates) == 0:
                    continue

                # Filter by stream compatibility
                stream_filter = self._get_stream_filter_for_course_type(course_type)
                state_candidates = state_candidates[state_candidates['stream'].isin(stream_filter)]

                if len(state_candidates) == 0:
                    continue

                # Try RapidFuzz matching on college names (80%+ threshold)
                best_match = None
                best_score = 0

                for _, candidate in state_candidates.iterrows():
                    # Extract name portion from composite_college_key (before first comma)
                    # This ensures we match against distinct colleges even with same name
                    composite_key = candidate.get('composite_college_key', '')
                    candidate_name = composite_key.split(',')[0] if composite_key else candidate['normalized_name']

                    # Fuzzy match college name
                    name_score = fuzz.token_set_ratio(college_name, candidate_name) / 100.0

                    if name_score >= 0.80:  # 80% threshold for college name
                        # Also check address similarity (75%+ threshold)
                        addr_score = fuzz.token_set_ratio(address, candidate['address'] or '') / 100.0

                        if addr_score >= 0.75:  # 75% threshold for address
                            combined_score = (name_score * 0.6) + (addr_score * 0.4)  # 60% name, 40% address

                            if combined_score > best_score:
                                best_score = combined_score
                                best_match = candidate['id']

                # Update if match found
                if best_match:
                    cur = conn.cursor()
                    cur.execute(f"""
                    UPDATE {table_name}
                    SET master_college_id = ?
                    WHERE id = ?
                    """, (best_match, record['id']))
                    matches_found += 1

            conn.commit()
            logger.info(f"  ✓ Stage 2 RapidFuzz: {matches_found:,} additional matches")

        except Exception as e:
            logger.error(f"Error in Stage 2: {e}")
            traceback.print_exc()
        finally:
            conn.close()

    def _get_stream_filter_for_course_type(self, course_type):
        """Get valid stream list for a course type"""
        if course_type == 'DENTAL':
            return ['DENTAL']
        elif course_type == 'DNB':
            return ['DNB']
        elif course_type == 'DIPLOMA':
            # Check config for DIPLOMA stream options
            if course_type in self.diploma_dnb_only:
                return ['DNB']
            elif course_type in self.diploma_overlapping:
                return ['MEDICAL', 'DNB']
            else:
                return ['MEDICAL', 'DNB']  # Default to both
        else:  # MEDICAL
            return ['MEDICAL']

    def _run_stage_3(self, table_name, fallback_method):
        """STAGE 3: Hierarchical + Transformer Embeddings - Semantic similarity matching"""
        if not TRANSFORMER_AVAILABLE:
            logger.warning("  ⚠️  sentence-transformers not available - Stage 3 skipped")
            return

        conn = sqlite3.connect(self.seat_db_path)

        try:
            cur = conn.cursor()
            cur.execute("ATTACH DATABASE ? AS mdb", (self.master_db_path,))

            # Get unmatched records with matched state and course
            unmatched_query = f"""
            SELECT
                id, normalized_state, normalized_college_name, normalized_address,
                normalized_course_name, course_type, master_state_id, master_course_id
            FROM {table_name}
            WHERE master_state_id IS NOT NULL
              AND master_course_id IS NOT NULL
              AND master_college_id IS NULL
              AND normalized_college_name IS NOT NULL
              AND normalized_address IS NOT NULL
            """
            unmatched_records = pd.read_sql(unmatched_query, conn)

            if len(unmatched_records) == 0:
                logger.info("  ✓ No unmatched records for Stage 3")
                return

            logger.info(f"  ℹ️  Processing {len(unmatched_records):,} unmatched records with Transformers...")

            # Initialize transformer model (lightweight model for speed)
            try:
                model = SentenceTransformer('all-MiniLM-L6-v2')
            except Exception as e:
                logger.warning(f"Could not load transformer model: {e}")
                return

            # Get all candidate colleges (including composite_college_key)
            candidates_query = """
            SELECT c.id, c.name, c.normalized_name, c.composite_college_key, scl.address, scl.state_id, sccl.stream, sccl.course_id
            FROM mdb.colleges c
            JOIN mdb.state_college_link scl ON c.id = scl.college_id
            JOIN mdb.state_course_college_link sccl ON c.id = sccl.college_id AND scl.state_id = sccl.state_id
            """
            candidates = pd.read_sql(candidates_query, conn)

            matches_found = 0

            # Process each unmatched record
            for idx, record in unmatched_records.iterrows():
                state_id = record['master_state_id']
                course_id = record['master_course_id']
                college_name = record['normalized_college_name']
                address = record['normalized_address']
                course_type = record['course_type']

                # Filter candidates by state and course
                state_candidates = candidates[
                    (candidates['state_id'] == state_id) &
                    (candidates['course_id'] == course_id)
                ]

                if len(state_candidates) == 0:
                    continue

                # Filter by stream compatibility
                stream_filter = self._get_stream_filter_for_course_type(course_type)
                state_candidates = state_candidates[state_candidates['stream'].isin(stream_filter)]

                if len(state_candidates) == 0:
                    continue

                # Compute embeddings for the input record
                input_text = f"{college_name} {address}"
                input_embedding = model.encode(input_text, convert_to_tensor=True)

                best_match = None
                best_score = 0

                # Compare with candidate embeddings
                for _, candidate in state_candidates.iterrows():
                    # Extract name portion from composite_college_key (before first comma)
                    # This ensures we match against distinct colleges even with same name
                    composite_key = candidate.get('composite_college_key', '')
                    candidate_name = composite_key.split(',')[0] if composite_key else candidate['normalized_name']

                    candidate_text = f"{candidate_name} {candidate['address'] or ''}"
                    candidate_embedding = model.encode(candidate_text, convert_to_tensor=True)

                    # Compute cosine similarity
                    similarity = util.cos_sim(input_embedding, candidate_embedding).item()

                    # Name matching threshold: 70%
                    name_similarity = util.cos_sim(
                        model.encode(college_name, convert_to_tensor=True),
                        model.encode(candidate_name, convert_to_tensor=True)
                    ).item()

                    # Address matching threshold: 60%
                    addr_similarity = util.cos_sim(
                        model.encode(address, convert_to_tensor=True),
                        model.encode(candidate['address'] or '', convert_to_tensor=True)
                    ).item()

                    if name_similarity >= 0.70 and addr_similarity >= 0.60:
                        combined_score = (name_similarity * 0.6) + (addr_similarity * 0.4)

                        if combined_score > best_score:
                            best_score = combined_score
                            best_match = candidate['id']

                # Update if match found
                if best_match:
                    cur = conn.cursor()
                    cur.execute(f"""
                    UPDATE {table_name}
                    SET master_college_id = ?
                    WHERE id = ?
                    """, (best_match, record['id']))
                    matches_found += 1

            conn.commit()
            logger.info(f"  ✓ Stage 3 Transformer: {matches_found:,} additional matches")

        except Exception as e:
            logger.error(f"Error in Stage 3: {e}")
            traceback.print_exc()
        finally:
            conn.close()

    def _count_matched(self, table_name):
        """Count records with master_college_id"""
        conn = sqlite3.connect(self.seat_db_path)
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM {table_name} WHERE master_college_id IS NOT NULL")
        count = cur.fetchone()[0]
        conn.close()
        return count

    def _validate_matches(self, table_name):
        """Validate data integrity with NULL-aware checking"""
        conn = sqlite3.connect(self.seat_db_path)
        cur = conn.cursor()

        violations = 0

        # Check 1: College-State uniqueness (only complete matches)
        logger.info("  ✓ Check 1: College-State Uniqueness...")
        cur.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT master_college_id, COUNT(DISTINCT master_state_id)
            FROM {table_name}
            WHERE master_college_id IS NOT NULL AND master_state_id IS NOT NULL
            GROUP BY master_college_id
            HAVING COUNT(DISTINCT master_state_id) > 1
        )""")
        violations_cs = cur.fetchone()[0]

        if violations_cs == 0:
            logger.info("    ✅ PASS: No college matched to multiple states")
        else:
            logger.info(f"    ⚠️  FAIL: {violations_cs} colleges matched to multiple states")
            violations += violations_cs

        # Check 2: College-Address uniqueness (only complete matches with address)
        logger.info("  ✓ Check 2: College-Address Uniqueness...")
        cur.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT master_college_id, master_state_id, COUNT(DISTINCT address)
            FROM {table_name}
            WHERE master_college_id IS NOT NULL AND master_state_id IS NOT NULL
              AND address IS NOT NULL
            GROUP BY master_college_id, master_state_id
            HAVING COUNT(DISTINCT address) > 1
        )""")
        violations_ca = cur.fetchone()[0]

        if violations_ca == 0:
            logger.info("    ✅ PASS: Each college in each state has unique address")
        else:
            logger.info(f"    ⚠️  WARNING: {violations_ca} college-state combos have multiple addresses")
            violations += violations_ca

        # Check 3: Expected row counts (complete vs incomplete)
        logger.info("  ✓ Check 3: Record Completeness...")
        cur.execute(f"""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN master_state_id IS NOT NULL AND master_course_id IS NOT NULL AND master_college_id IS NOT NULL THEN 1 END) as complete,
            COUNT(CASE WHEN master_state_id IS NULL OR master_course_id IS NULL OR master_college_id IS NULL THEN 1 END) as incomplete
        FROM {table_name}
        """)
        total, complete, incomplete = cur.fetchone()
        logger.info(f"    Total: {total:,}, Complete: {complete:,}, Incomplete: {incomplete:,}")

        conn.close()
        return violations


if __name__ == '__main__':
    matcher = CascadingHierarchicalEnsembleMatcher()
    results = matcher.match_all_records_cascading()

    print()
    print(f"Final Results Summary:")
    print(f"  Accuracy: {results['accuracy']:.2f}%")
    print(f"  Matched: {results['final_matched']:,} / {results['total']:,}")
    print(f"  Time: {results['execution_time']:.1f}s")
