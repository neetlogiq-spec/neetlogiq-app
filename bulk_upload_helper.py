"""
Bulk Data Upload Helper Script
Handles trigger management for efficient bulk imports to counselling_records

Usage:
    python bulk_upload_helper.py --action before   # Run before bulk import
    python bulk_upload_helper.py --action after    # Run after bulk import
    python bulk_upload_helper.py --action status   # Check current status
"""

import os
import argparse
import time
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Missing Supabase credentials in environment")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def execute_sql(sql: str, description: str):
    """Execute raw SQL via Supabase"""
    print(f"\n⏳ {description}...")
    start = time.time()
    try:
        result = supabase.rpc('exec_sql', {'sql': sql}).execute()
        elapsed = time.time() - start
        print(f"✅ {description} completed in {elapsed:.1f}s")
        return result
    except Exception as e:
        print(f"❌ Error: {e}")
        # Try alternate method - direct postgrest
        try:
            result = supabase.postgrest.rpc('exec_sql', {'sql': sql}).execute()
            elapsed = time.time() - start
            print(f"✅ {description} completed in {elapsed:.1f}s")
            return result
        except Exception as e2:
            print(f"❌ Alternate method also failed: {e2}")
            print(f"💡 Run this SQL manually in Supabase SQL Editor:\n{sql}")
            return None


def before_bulk_import():
    """Prepare for bulk import by disabling trigger"""
    print("\n" + "="*60)
    print("🚀 PREPARING FOR BULK IMPORT")
    print("="*60)
    
    sql = """
    -- Disable the trigger temporarily
    DROP TRIGGER IF EXISTS refresh_aggregated_cutoffs_trigger ON counselling_records;
    """
    
    print("\n📋 SQL to run in Supabase SQL Editor:")
    print("-"*40)
    print(sql)
    print("-"*40)
    
    print("\n✅ Trigger disabled. You can now safely run your bulk import.")
    print("⚠️  After import completes, run: python bulk_upload_helper.py --action after")


def after_bulk_import():
    """Refresh views and re-enable trigger after bulk import"""
    print("\n" + "="*60)
    print("🔄 POST-IMPORT PROCESSING")
    print("="*60)
    
    steps = [
        ("Refresh materialized view (aggregated_cutoffs)", 
         "REFRESH MATERIALIZED VIEW aggregated_cutoffs;"),
        
        ("Refresh partition distinct values",
         "SELECT refresh_partition_distinct_values();"),
        
        ("Re-enable trigger",
         """
         CREATE TRIGGER refresh_aggregated_cutoffs_trigger
           AFTER INSERT OR UPDATE OR DELETE ON counselling_records
           FOR EACH STATEMENT
           EXECUTE FUNCTION refresh_aggregated_cutoffs();
         """),
        
        ("Verify counts",
         """
         SELECT 
           (SELECT COUNT(*) FROM counselling_records) as counselling_records,
           (SELECT COUNT(*) FROM aggregated_cutoffs) as aggregated_cutoffs,
           (SELECT COUNT(*) FROM partition_distinct_values) as partitions;
         """)
    ]
    
    print("\n📋 Run these SQL commands in Supabase SQL Editor (in order):")
    print("-"*60)
    
    for i, (desc, sql) in enumerate(steps, 1):
        print(f"\n-- Step {i}: {desc}")
        print(sql.strip())
    
    print("-"*60)
    print("\n✅ After running all steps, your data is fully synced!")


def check_status():
    """Check current status of tables and triggers"""
    print("\n" + "="*60)
    print("📊 CURRENT STATUS CHECK")
    print("="*60)
    
    sql = """
    -- Check row counts
    SELECT 
      'counselling_records' as table_name, 
      COUNT(*) as row_count 
    FROM counselling_records
    UNION ALL
    SELECT 
      'aggregated_cutoffs' as table_name, 
      COUNT(*) as row_count 
    FROM aggregated_cutoffs
    UNION ALL
    SELECT 
      'partition_distinct_values' as table_name, 
      COUNT(*) as row_count 
    FROM partition_distinct_values;
    
    -- Check trigger status
    SELECT 
      trigger_name, 
      event_manipulation, 
      action_timing
    FROM information_schema.triggers 
    WHERE event_object_table = 'counselling_records';
    
    -- Check distinct values
    SELECT 
      partition_key,
      array_length(state_ids, 1) as states,
      array_length(course_ids, 1) as courses,
      array_length(quota_ids, 1) as quotas,
      array_length(category_ids, 1) as categories,
      array_length(managements, 1) as managements,
      updated_at
    FROM partition_distinct_values;
    """
    
    print("\n📋 Run this SQL in Supabase SQL Editor to check status:")
    print("-"*60)
    print(sql)
    print("-"*60)


def main():
    parser = argparse.ArgumentParser(description="Bulk Upload Helper for Counselling Records")
    parser.add_argument(
        "--action", 
        choices=["before", "after", "status"],
        required=True,
        help="Action to perform: before (disable trigger), after (refresh & re-enable), status (check)"
    )
    
    args = parser.parse_args()
    
    print(f"\n📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if args.action == "before":
        before_bulk_import()
    elif args.action == "after":
        after_bulk_import()
    elif args.action == "status":
        check_status()


if __name__ == "__main__":
    main()
