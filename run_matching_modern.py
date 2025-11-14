#!/usr/bin/env python3
"""
Modern Match & Link CLI
=======================

A sleek, modern command-line interface for running the match & link pipeline
with real-time progress tracking and beautiful output.

Usage:
    python run_matching_modern.py              Run with modern UX
    python run_matching_modern.py --verbose    Enable verbose logging
    python run_matching_modern.py --help       Show all options
"""

import sys
import argparse
from match_and_link_modern_ux import run_matching_modern, run_with_live_dashboard
from recent import AdvancedSQLiteMatcher


def main():
    parser = argparse.ArgumentParser(
        prog='College & Course Matcher',
        description='Modern, real-time matching pipeline for colleges and courses',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python run_matching_modern.py                    Standard modern UX
  python run_matching_modern.py --verbose          With detailed logging
  python run_matching_modern.py --dashboard        Live updating dashboard

Colors & Icons:
  🚀 = Starting process
  ✓  = Success/Complete
  ⏳ = In progress
  ❌ = Failed/Error
  ⚠  = Warning
  📊 = Statistics
  ✨ = Highlights/Results
        '''
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging for debugging'
    )

    parser.add_argument(
        '--dashboard',
        action='store_true',
        help='Show live updating dashboard (experimental)'
    )

    parser.add_argument(
        '--table',
        default='seat_data',
        help='Name of the seat data table (default: seat_data)'
    )

    parser.add_argument(
        '--theme',
        choices=['modern', 'clean', 'detailed'],
        default='modern',
        help='Display theme (default: modern)'
    )

    args = parser.parse_args()

    # Initialize matcher
    print("🔄 Initializing matcher...", file=sys.stderr)
    matcher = AdvancedSQLiteMatcher()

    # Handle verbose mode
    if args.verbose:
        print("📝 Verbose mode enabled", file=sys.stderr)
        print()

    # Run with selected interface
    try:
        if args.dashboard:
            print("📊 Dashboard mode (experimental)", file=sys.stderr)
            run_with_live_dashboard(matcher, table_name=args.table)
        else:
            run_matching_modern(matcher, table_name=args.table)
    except KeyboardInterrupt:
        print("\n\n❌ Matching interrupted by user", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
