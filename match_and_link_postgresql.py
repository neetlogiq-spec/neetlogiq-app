#!/usr/bin/env python3
"""
PostgreSQL End-to-End Matching Pipeline (PHASE 2)

Combines:
- Cascading Hierarchical Ensemble Matcher (PostgreSQL native)
- PostgreSQL Validation Layer (ensures 100% data integrity)

This is the primary entry point for PHASE 2 (full PostgreSQL migration).
"""

import logging
import sys
from cascading_hierarchical_ensemble_matcher_pg import CascadingHierarchicalEnsembleMatcherPG
from cascading_matcher_postgresql_validator import CascadingMatcherValidator

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)


class PostgreSQLMatchingPipeline:
    """Complete PostgreSQL matching pipeline with validation"""

    def __init__(self, seat_db_url: str, master_db_url: str, config_path='config.yaml'):
        """Initialize PostgreSQL pipeline"""
        self.seat_db_url = seat_db_url
        self.master_db_url = master_db_url
        self.config_path = config_path

    def run_complete_matching_pipeline(self, table_name='seat_data', validate=True):
        """
        Run complete matching pipeline:
        1. Cascading matcher (PostgreSQL native)
        2. PostgreSQL validation & cleanup
        3. Final integrity report
        """

        print("\n" + "="*100)
        print("🚀 PHASE 2: POSTGRE SQL END-TO-END MATCHING PIPELINE")
        print("="*100)
        print()

        try:
            # ========== STAGE 1: CASCADING MATCHER ==========
            logger.info("\n" + "="*100)
            logger.info("STAGE 1: Cascading Hierarchical Ensemble Matcher")
            logger.info("="*100)

            matcher = CascadingHierarchicalEnsembleMatcherPG(
                self.seat_db_url,
                self.master_db_url,
                self.config_path
            )

            match_results = matcher.match_all_records_cascading(table_name)

            logger.info(f"\n✅ Cascading Matcher Complete:")
            logger.info(f"   Matched: {match_results['final_matched']:,} ({match_results['accuracy']:.2f}%)")
            logger.info(f"   Unmatched: {match_results['final_unmatched']:,}")
            logger.info(f"   Time: {match_results['execution_time']:.1f}s")

            # ========== STAGE 2: POSTGRE SQL VALIDATION ==========
            if validate:
                logger.info("\n" + "="*100)
                logger.info("STAGE 2: PostgreSQL Validation & Cleanup")
                logger.info("="*100)

                validator = CascadingMatcherValidator(self.seat_db_url, self.master_db_url)

                try:
                    validation_results = validator.validate_and_cleanup(verbose=True)

                    # Check final status
                    if validation_results['data_integrity_passed']:
                        logger.info("\n" + "="*100)
                        logger.info("✅ PHASE 2 COMPLETE - PRODUCTION READY")
                        logger.info("="*100)
                        logger.info(f"\n📊 Final Statistics:")
                        logger.info(f"   Total Records: {validation_results['total_records']:,}")
                        logger.info(f"   Matched: {validation_results['matched_records']:,}")
                        logger.info(f"   False Matches: {validation_results['false_matches_found']}")
                        logger.info(f"   Cleared: {validation_results['false_matches_cleared']}")
                        logger.info(f"   Data Integrity: ✅ PASSED")
                        logger.info()

                        return {
                            'status': 'success',
                            'match_results': match_results,
                            'validation_results': validation_results
                        }
                    else:
                        logger.error("\n" + "="*100)
                        logger.error("❌ PHASE 2 FAILED - DATA INTEGRITY ISSUES")
                        logger.error("="*100)
                        logger.error(f"\nPlease review the issues above")
                        return {
                            'status': 'failed',
                            'match_results': match_results,
                            'validation_results': validation_results
                        }

                finally:
                    validator.close()
            else:
                logger.info("\n✅ MATCHING COMPLETE (validation skipped)")
                return {
                    'status': 'success',
                    'match_results': match_results,
                    'validation_results': None
                }

        except Exception as e:
            logger.error(f"\n❌ Error during matching pipeline: {e}")
            import traceback
            traceback.print_exc()
            return {'status': 'error', 'error': str(e)}


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='PostgreSQL End-to-End Matching Pipeline')
    parser.add_argument('--table', default='seat_data', help='Table to match (default: seat_data)')
    parser.add_argument('--validate', action='store_true', default=True, help='Run validation step')
    parser.add_argument('--no-validate', action='store_false', dest='validate', help='Skip validation step')

    args = parser.parse_args()

    # Database URLs
    seat_db_url = "postgresql://kashyapanand@localhost:5432/seat_data"
    master_db_url = "postgresql://kashyapanand@localhost:5432/master_data"

    # Run pipeline
    pipeline = PostgreSQLMatchingPipeline(seat_db_url, master_db_url)
    results = pipeline.run_complete_matching_pipeline(
        table_name=args.table,
        validate=args.validate
    )

    # Exit with appropriate code
    if results['status'] == 'success':
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
