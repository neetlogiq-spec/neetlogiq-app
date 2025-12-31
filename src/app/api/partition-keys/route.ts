/**
 * Partition Keys API
 * Returns available data partitions from counselling_records
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const client = supabaseAdmin || supabase;

    // Get distinct partition keys from counselling_records
    // Using the partition_key column which is already formatted as SOURCE-LEVEL-YEAR
    const { data, error } = await client
      .from('counselling_records')
      .select('partition_key, source_normalized, level_normalized, year')
      .order('year', { ascending: false });

    if (error) {
      console.error('Error fetching partition keys:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch partition keys' },
        { status: 500 }
      );
    }

    // Get unique partition keys
    const partitionMap = new Map<string, { 
      partition_key: string;
      source_normalized: string; 
      level_normalized: string; 
      year: number 
    }>();
    
    for (const row of data || []) {
      if (row.partition_key && row.source_normalized && row.level_normalized && row.year) {
        if (!partitionMap.has(row.partition_key)) {
          partitionMap.set(row.partition_key, {
            partition_key: row.partition_key,
            source_normalized: row.source_normalized,
            level_normalized: row.level_normalized,
            year: row.year
          });
        }
      }
    }

    // Convert to array with display labels
    const partitions = Array.from(partitionMap.values()).map(partition => {
      // Create human-readable label (e.g., "AIQ PG 2024")
      const label = `${partition.source_normalized} ${partition.level_normalized} ${partition.year}`;
      
      return {
        id: partition.partition_key,
        label,
        source: partition.source_normalized,
        level: partition.level_normalized,
        year: partition.year
      };
    });

    // Sort by year desc, then source, then level
    partitions.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      if (a.source !== b.source) return a.source.localeCompare(b.source);
      return a.level.localeCompare(b.level);
    });

    return NextResponse.json({
      success: true,
      partitions
    });

  } catch (error) {
    console.error('Error in partition-keys API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
