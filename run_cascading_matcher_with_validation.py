#!/usr/bin/env python3
"""
PHASE 1 INTEGRATION: Cascading Matcher + PostgreSQL Validation

Workflow:
1. Run cascading matcher on SQLite (existing code - unchanged)
2. Validate results against PostgreSQL (new validation layer)
3. Auto-clear false matches
4. Generate data integrity report

This approach:
- ✅ No changes to cascading matcher code
- ✅ Prevents false matches at validation layer
- ✅ Works with existing SQLite infrastructure
- ✅ Ready for Phase 2 migration to full PostgreSQL
"""

import logging
import sys
from cascading_hierarchical_ensemble_matcher import CascadingHierarchicalEnsembleMatcher
from cascading_matcher_postgresql_validator import CascadingMatcherValidator

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)


def run_cascading_matcher_with_validation(
    seat_db_path: str = 'data/sqlite/seat_data.db',
    master_db_path: str = 'data/sqlite/master_data.db',
    seat_db_url: str = "postgresql://kashyapanand@localhost:5432/seat_data",
    master_db_url: str = "postgresql://kashyapanand@localhost:5432/master_data",
    validate_only: bool = False
):
    """
    Run cascading matcher with PostgreSQL validation layer

    Args:
        seat_db_path: SQLite seat_data database path
        master_db_path: SQLite master_data database path
        seat_db_url: PostgreSQL seat_data URL
        master_db_url: PostgreSQL master_data URL
        validate_only: If True, skip cascading matcher and only validate
    """

    print("\n" + "="*100)
    print("CASCADING MATCHER WITH POSTGRE SQL VALIDATION (PHASE 1)")
    print("="*100)

    try:
        # Step 1: Run cascading matcher (SQLite)
        if not validate_only:
            logger.info("\n" + "="*100)
            logger.info("STAGE 1: Running Cascading Hierarchical Ensemble Matcher (SQLite)")
            logger.info("="*100)

            matcher = CascadingHierarchicalEnsembleMatcher(seat_db_path, master_db_path)
            results = matcher.match_all_records_cascading(table_name='seat_data')

            logger.info(f"\n✅ Cascading Matcher Complete:")
            logger.info(f"   Matched: {results['final_matched']:,} ({results['accuracy']:.2f}%)")
            logger.info(f"   Unmatched: {results['final_unmatched']:,}")
            logger.info(f"   Time: {results['execution_time']:.1f}s")
        else:
            logger.info("\nValidation-only mode: Skipping cascading matcher")

        # Step 2: PostgreSQL validation & cleanup
        logger.info("\n" + "="*100)
        logger.info("STAGE 2: PostgreSQL Validation & False Match Cleanup")
        logger.info("="*100)

        validator = CascadingMatcherValidator(seat_db_url, master_db_url)

        try:
            # Add PostgreSQL constraints (one-time setup)
            validator.add_constraints()

            # Validate and cleanup false matches
            validation_results = validator.validate_and_cleanup(verbose=True)

            # Check final status
            if validation_results['data_integrity_passed']:
                logger.info("\n" + "="*100)
                logger.info("✅ PHASE 1 COMPLETE - DATA INTEGRITY VERIFIED")
                logger.info("="*100)
                logger.info(f"\n✅ All {validation_results['total_records']:,} records validated")
                logger.info(f"✅ {validation_results['false_matches_cleared']} false matches cleared")
                logger.info(f"✅ College-state uniqueness constraint applied")
                logger.info(f"✅ Ready for production use or Phase 2 migration\n")
                return validation_results
            else:
                logger.error("\n" + "="*100)
                logger.error("❌ PHASE 1 FAILED - DATA INTEGRITY ISSUES")
                logger.error("="*100)
                logger.error(f"\nPlease review the issues above before proceeding")
                return validation_results

        finally:
            validator.close()

    except Exception as e:
        logger.error(f"\n❌ Error during matching and validation: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    # Run with validation
    validate_only = "--validate-only" in sys.argv

    if validate_only:
        logger.info("Running in validation-only mode (no cascading matcher)")

    results = run_cascading_matcher_with_validation(validate_only=validate_only)

    if results and results['data_integrity_passed']:
        sys.exit(0)  # Success
    else:
        sys.exit(1)  # Failure
