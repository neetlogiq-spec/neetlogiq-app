#!/usr/bin/env python3
"""
Match and Link - Cascading Hierarchical Ensemble Pipeline
Main entry point for the cascading matching system.

Usage:
    # Match seat_data with validation
    python3 scripts/match_and_link_cascading.py --table seat_data

    # Match counselling_data
    python3 scripts/match_and_link_cascading.py --table counselling_data

    # Skip validation
    python3 scripts/match_and_link_cascading.py --table seat_data --no-validate

Features:
    - Stage 1: Pure hierarchical matching (97.80% accuracy)
    - Stage 2: Hierarchical + RapidFuzz fallback (98.58% accuracy)
    - Stage 3: Hierarchical + Full Ensemble fallback (98.99% accuracy)
    - Validation: Automatic false match detection
    - ~99% accuracy with 5-8 minute execution
"""

import argparse
import logging
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.database import PostgreSQLManager
from lib.matching import CascadingHierarchicalEnsemblePipeline
import yaml

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MatchAndLinkPipeline:
    """Main matching and linking pipeline with cascading"""

    def __init__(self, config_path: str = 'config.yaml'):
        """Initialize pipeline"""
        self.config = self._load_config(config_path)
        self.seat_db = None
        self.master_db = None

    def _load_config(self, config_path: str) -> dict:
        """Load configuration from YAML"""
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            logger.info(f"✓ Loaded config from {config_path}")
            return config
        except FileNotFoundError:
            logger.error(f"Config file not found: {config_path}")
            sys.exit(1)
        except yaml.YAMLError as e:
            logger.error(f"Error parsing config: {e}")
            sys.exit(1)

    def _initialize_databases(self):
        """Initialize database connections"""
        pg_config = self.config.get('database', {})

        if not pg_config.get('use_postgresql', False):
            logger.error("PostgreSQL not enabled in config.yaml")
            sys.exit(1)

        pg_urls = pg_config.get('postgresql_urls', {})

        # Initialize seat_data connection
        seat_url = pg_urls.get('seat_data')
        if not seat_url:
            logger.error("seat_data PostgreSQL URL not found in config")
            sys.exit(1)

        try:
            self.seat_db = PostgreSQLManager(seat_url)
            logger.info("✓ Connected to seat_data database")
        except Exception as e:
            logger.error(f"Failed to connect to seat_data: {e}")
            sys.exit(1)

        # Initialize master_data connection
        master_url = pg_urls.get('master_data')
        if not master_url:
            logger.error("master_data PostgreSQL URL not found in config")
            sys.exit(1)

        try:
            self.master_db = PostgreSQLManager(master_url)
            logger.info("✓ Connected to master_data database")
        except Exception as e:
            logger.error(f"Failed to connect to master_data: {e}")
            sys.exit(1)

    def run(self, table_name: str = 'seat_data', validate: bool = True):
        """
        Run the cascading hierarchical matching pipeline.

        Args:
            table_name: Table to match (seat_data or counselling_data)
            validate: Whether to run validation

        Returns:
            Exit code (0 = success, 1 = failure)
        """
        try:
            # Initialize databases
            self._initialize_databases()

            # Create cascading pipeline
            pipeline = CascadingHierarchicalEnsemblePipeline(
                self.seat_db,
                self.master_db,
                self.config
            )

            # Run matching
            results = pipeline.run(table_name, validate=validate)

            # Print final summary
            logger.info(f"\n✅ MATCHING PIPELINE COMPLETE")
            logger.info(f"   Table: {table_name}")
            logger.info(f"   Final Matched: {results['final_matched']:,} ({results['accuracy']:.2f}%)")
            logger.info(f"   Final Unmatched: {results['final_unmatched']:,}")
            logger.info(f"   False Matches Cleared: {results['false_matches']}")
            logger.info(f"   Total Time: {results['execution_time']:.1f}s")

            return 0

        except Exception as e:
            logger.error(f"Error during matching: {e}")
            import traceback
            traceback.print_exc()
            return 1

        finally:
            # Close database connections
            if self.seat_db:
                self.seat_db.close()
            if self.master_db:
                self.master_db.close()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Cascading Hierarchical Ensemble Matching Pipeline',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Stages:
  Stage 1: Pure Hierarchical (STATE → STREAM → COURSE → NAME → ADDRESS)
  Stage 2: Hierarchical + RapidFuzz (for unmatched from Stage 1)
  Stage 3: Hierarchical + Full Ensemble (for unmatched from Stage 2)

Expected Results:
  Stage 1: 97.80% accuracy (~3-4 minutes)
  Stage 2: 98.58% accuracy (~1-2 minutes additional)
  Stage 3: 98.99% accuracy (~2-3 minutes additional)
  Total: 99% accuracy, 0 false matches, ~5-8 minutes

Examples:
  # Match seat_data (16K records, ~20 seconds)
  python3 scripts/match_and_link_cascading.py --table seat_data

  # Match counselling_data (400K records, ~8 minutes)
  python3 scripts/match_and_link_cascading.py --table counselling_data

  # Skip validation (faster but may have false matches)
  python3 scripts/match_and_link_cascading.py --table seat_data --no-validate

  # Use custom config
  python3 scripts/match_and_link_cascading.py --config /path/to/config.yaml --table seat_data
        '''
    )

    parser.add_argument(
        '--table',
        default='seat_data',
        choices=['seat_data', 'counselling_data'],
        help='Table to match (default: seat_data)'
    )

    parser.add_argument(
        '--no-validate',
        action='store_true',
        help='Skip validation step (may allow false matches)'
    )

    parser.add_argument(
        '--config',
        default='config.yaml',
        help='Path to config.yaml file (default: config.yaml)'
    )

    args = parser.parse_args()

    # Run pipeline
    pipeline = MatchAndLinkPipeline(args.config)
    exit_code = pipeline.run(
        table_name=args.table,
        validate=not args.no_validate
    )

    sys.exit(exit_code)


if __name__ == '__main__':
    main()
