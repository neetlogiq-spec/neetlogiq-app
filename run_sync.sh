#!/bin/bash
# Wrapper to run sync with .env.local variables
# Enhanced with automatic trigger management for bulk uploads

set -e

# Load environment variables
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
    echo "✅ Successfully exported variables from .env.local"
else
    echo "❌ .env.local not found"
    exit 1
fi

# Set specific Supabase vars if they have different names in .env.local
if [ -z "$SUPABASE_URL" ] && [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    export SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -n "$SERVICE_ROLE_KEY" ]; then
    export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
fi

# Check if --bulk flag is passed
BULK_MODE=false
ARGS=()
for arg in "$@"; do
    if [ "$arg" == "--bulk" ]; then
        BULK_MODE=true
    else
        ARGS+=("$arg")
    fi
done

if [ "$BULK_MODE" = true ]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "🚀 BULK UPLOAD MODE ENABLED"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "⚠️  BEFORE RUNNING THIS SYNC, run in Supabase SQL Editor:"
    echo ""
    echo "   DROP TRIGGER IF EXISTS refresh_aggregated_cutoffs_trigger ON counselling_records;"
    echo ""
    read -p "Press ENTER after running the SQL (or Ctrl+C to cancel): "
fi

# Run the sync
echo ""
echo "🔄 Starting sync..."
python3 sync_sqlite_to_supabase.py "${ARGS[@]}"

if [ "$BULK_MODE" = true ]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "🔄 POST-SYNC: Refreshing views and re-enabling trigger"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "⚠️  Run these commands in Supabase SQL Editor (in order):"
    echo ""
    echo "   -- Step 1: Refresh materialized view"
    echo "   REFRESH MATERIALIZED VIEW aggregated_cutoffs;"
    echo ""
    echo "   -- Step 2: Refresh distinct values table"
    echo "   SELECT refresh_partition_distinct_values();"
    echo ""
    echo "   -- Step 3: Re-enable trigger"
    echo "   CREATE TRIGGER refresh_aggregated_cutoffs_trigger"
    echo "     AFTER INSERT OR UPDATE OR DELETE ON counselling_records"
    echo "     FOR EACH STATEMENT"
    echo "     EXECUTE FUNCTION refresh_aggregated_cutoffs();"
    echo ""
    echo "   -- Step 4: Verify (optional)"
    echo "   SELECT COUNT(*) FROM aggregated_cutoffs;"
    echo "   SELECT * FROM partition_distinct_values;"
    echo ""
fi

echo ""
echo "✅ Sync complete!"
