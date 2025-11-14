#!/usr/bin/env python3
"""
Quick script to run the match & link pipeline with enhanced UX

Usage:
    python run_matching_clean.py              # Normal run with clean UX
    python run_matching_clean.py --verbose    # With verbose logging
    python run_matching_clean.py --debug      # With XAI explanations enabled
"""

import sys
import argparse
from match_and_link_ux_wrapper import match_and_link_with_ux
from recent import AdvancedSQLiteMatcher


def main():
    parser = argparse.ArgumentParser(
        description='Run College & Course Matching with Enhanced UX',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python run_matching_clean.py                    Run with clean output
  python run_matching_clean.py --verbose          Run with detailed logging
  python run_matching_clean.py --debug            Run with XAI explanations (50,000+ lines)
        '''
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging (shows more details)'
    )

    parser.add_argument(
        '--debug',
        action='store_true',
        help='Enable debug mode with XAI explanations (WARNING: produces 50,000+ lines)'
    )

    parser.add_argument(
        '--table',
        default='seat_data',
        help='Name of the seat data table (default: seat_data)'
    )

    args = parser.parse_args()

    # Initialize matcher
    print("🔄 Initializing matcher...", file=sys.stderr)
    matcher = AdvancedSQLiteMatcher()

    # Handle debug mode
    if args.debug:
        print("⚠️  Debug mode enabled - this will produce 50,000+ lines of output", file=sys.stderr)
        matcher.config['features']['log_xai_explanations'] = True
        verbose = True
    else:
        verbose = args.verbose

    # Run matching with enhanced UX
    match_and_link_with_ux(matcher, table_name=args.table, verbose=verbose)


if __name__ == '__main__':
    main()
