#!/bin/bash

# 🗑️ CLEAN EXISTING PARQUET FILES
echo "🗑️ Cleaning existing Parquet files..."

# Remove existing Parquet files
rm -f data/parquet/colleges.parquet
rm -f data/parquet/programs.parquet  
rm -f data/parquet/cutoffs.parquet
rm -f data/parquet/seat_data.parquet

# Remove old reports
rm -rf data/reports/unmatched-*

echo "✅ Cleanup completed"
echo "📁 Ready for fresh import"
