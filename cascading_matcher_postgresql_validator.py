"""
PostgreSQL Validation Wrapper for Cascading Hierarchical Matcher
PHASE 1: Prevents false matches at the database level without rewriting cascading matcher

This wrapper:
- Runs AFTER cascading matcher completes on SQLite
- Validates all college-state pairs against PostgreSQL master data
- Auto-clears false matches
- Provides data integrity report
"""

import logging
from db_manager import PostgreSQLManager, SeatDataValidator

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)


class CascadingMatcherValidator:
    """Validates cascading matcher results and prevents false matches"""

    def __init__(self, seat_db_url: str, master_db_url: str):
        """
        Initialize validator with PostgreSQL databases

        Args:
            seat_db_url: PostgreSQL URL for seat_data database
            master_db_url: PostgreSQL URL for master_data database
        """
        self.seat_db = PostgreSQLManager(seat_db_url, pool_size=5)
        self.master_db = PostgreSQLManager(master_db_url, pool_size=5)
        self.validator = SeatDataValidator(self.seat_db, self.master_db)
        self.results = {
            'total_records': 0,
            'matched_records': 0,
            'false_matches_found': 0,
            'false_matches_cleared': 0,
            'data_integrity_passed': False,
            'status': 'pending'
        }

    def get_match_statistics(self) -> dict:
        """Get current match statistics"""
        query = """
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN master_college_id IS NOT NULL THEN 1 END) as matched,
            COUNT(CASE WHEN master_college_id IS NULL THEN 1 END) as unmatched
        FROM seat_data
        """
        result = self.seat_db.fetch_one(query)
        return {
            'total': result['total'] if result else 0,
            'matched': result['matched'] if result else 0,
            'unmatched': result['unmatched'] if result else 0,
            'accuracy_percent': (
                (result['matched'] / result['total'] * 100)
                if result and result['total'] > 0 else 0
            )
        }

    def validate_and_cleanup(self, verbose: bool = True) -> dict:
        """
        Main validation pipeline:
        1. Get before statistics
        2. Find false matches
        3. Clear false matches
        4. Validate data integrity
        5. Return report

        Args:
            verbose: Print detailed report

        Returns:
            Validation results dictionary
        """
        logger.info("\n" + "="*100)
        logger.info("PHASE 1: POSTGRE SQL VALIDATION & CLEANUP")
        logger.info("="*100)

        # Step 1: Get before statistics
        before_stats = self.get_match_statistics()
        self.results['total_records'] = before_stats['total']
        self.results['matched_records'] = before_stats['matched']

        if verbose:
            logger.info(f"\n📊 Before Validation:")
            logger.info(f"   Total Records: {before_stats['total']:,}")
            logger.info(f"   Matched: {before_stats['matched']:,} ({before_stats['accuracy_percent']:.2f}%)")
            logger.info(f"   Unmatched: {before_stats['unmatched']:,}")

        # Step 2: Find false matches
        false_matches_count = self.validator.find_false_matches()
        self.results['false_matches_found'] = false_matches_count

        if verbose:
            if false_matches_count > 0:
                logger.warning(f"\n⚠️  Found {false_matches_count} false college-state matches")
            else:
                logger.info(f"\n✅ No false matches found")

        # Step 3: Clear false matches if any
        if false_matches_count > 0:
            cleared_count = self.validator.clear_false_matches()
            self.results['false_matches_cleared'] = cleared_count

            if verbose:
                logger.info(f"   Cleared: {cleared_count} records")

            # Verify cleanup
            remaining = self.validator.find_false_matches()
            if remaining == 0 and verbose:
                logger.info(f"   ✅ Verification: All false matches cleared")
            elif remaining > 0 and verbose:
                logger.warning(f"   ⚠️  {remaining} false matches still remaining")

        # Step 4: Validate data integrity
        if verbose:
            logger.info(f"\n🔍 Running Data Integrity Checks...")

        integrity_results = self.validator.validate_data_integrity()

        if integrity_results['false_matches'] == 0 and integrity_results['college_state_uniqueness']:
            self.results['data_integrity_passed'] = True
            if verbose:
                logger.info(f"   ✅ College-State Uniqueness: PASSED")
                logger.info(f"   ✅ False Matches: 0")
        else:
            self.results['data_integrity_passed'] = False
            if verbose:
                for issue in integrity_results['issues']:
                    logger.warning(f"   ❌ {issue}")

        # Step 5: Get after statistics
        after_stats = self.get_match_statistics()

        # Step 6: Final report
        self.results['status'] = 'success' if self.results['data_integrity_passed'] else 'warning'

        if verbose:
            logger.info(f"\n📊 After Validation:")
            logger.info(f"   Total Records: {after_stats['total']:,}")
            logger.info(f"   Matched: {after_stats['matched']:,} ({after_stats['accuracy_percent']:.2f}%)")
            logger.info(f"   Unmatched: {after_stats['unmatched']:,}")

        return self._generate_report(before_stats, after_stats)

    def _generate_report(self, before_stats, after_stats) -> dict:
        """Generate comprehensive validation report"""
        logger.info("\n" + "="*100)
        logger.info("VALIDATION REPORT")
        logger.info("="*100)

        logger.info(f"\n📋 Summary:")
        logger.info(f"   False Matches Found: {self.results['false_matches_found']}")
        logger.info(f"   False Matches Cleared: {self.results['false_matches_cleared']}")
        logger.info(f"   Data Integrity: {'✅ PASSED' if self.results['data_integrity_passed'] else '❌ FAILED'}")

        logger.info(f"\n📈 Match Statistics:")
        logger.info(f"   Before: {before_stats['matched']:,}/{before_stats['total']:,} ({before_stats['accuracy_percent']:.2f}%)")
        logger.info(f"   After:  {after_stats['matched']:,}/{after_stats['total']:,} ({after_stats['accuracy_percent']:.2f}%)")
        logger.info(f"   Change: {after_stats['matched'] - before_stats['matched']:+d} records")

        logger.info(f"\n✅ Status: {self.results['status'].upper()}")
        logger.info("="*100 + "\n")

        return self.results

    def add_constraints(self) -> bool:
        """Add PostgreSQL constraints to prevent future false matches"""
        try:
            logger.info("\n🔒 Adding PostgreSQL Constraints...")
            self.validator.add_college_state_constraint()
            logger.info("   ✅ College-state validation constraint added")
            return True
        except Exception as e:
            logger.error(f"   ❌ Error adding constraint: {e}")
            return False

    def close(self):
        """Close database connections"""
        self.seat_db.close_pool()
        self.master_db.close_pool()


if __name__ == "__main__":
    """Test the validation wrapper"""

    seat_db_url = "postgresql://kashyapanand@localhost:5432/seat_data"
    master_db_url = "postgresql://kashyapanand@localhost:5432/master_data"

    print("Initializing PostgreSQL Validation Wrapper...")
    validator = CascadingMatcherValidator(seat_db_url, master_db_url)

    try:
        # Add constraints
        validator.add_constraints()

        # Run validation and cleanup
        results = validator.validate_and_cleanup(verbose=True)

        print(f"\n✅ Validation Results: {results['status']}")
        if results['false_matches_found'] > 0:
            print(f"   - Cleared {results['false_matches_cleared']} false matches")
        if results['data_integrity_passed']:
            print(f"   - Data integrity: PASSED")

    finally:
        validator.close()
