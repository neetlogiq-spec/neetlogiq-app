import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface YearData {
  year: string;
  counsellingBodies: string[];
  levels: string[];
  rounds: number[];
}

interface AvailableYearsResponse {
  years: string[];
  yearData: YearData[];
  latestYear: string;
}

export const useAvailableYears = () => {
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [yearData, setYearData] = useState<YearData[]>([]);
  const [latestYear, setLatestYear] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvailableYears = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Get distinct years from cutoffs table
        // We can't do distinct easily with simple select, so we'll fetch all years (lightweight column) 
        // or rely on a known range if the table is too big. 
        // For accurate data, let's use a distinct-like query or aggregation if possible.
        // Since we don't have a 'years' table, we will query distinct years using a specialized generic query or 
        // fallback to checking a probable range (2020-2026) for existence.
        
        const probableYears = ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019'];
        const detectedYears: string[] = [];
        const detectedYearData: YearData[] = [];

        // Check each year in parallel
        await Promise.all(probableYears.map(async (year) => {
          // Check if any data exists for this year
          const { count, error: yearError } = await supabase
            .from('cutoffs')
            .select('*', { count: 'exact', head: true })
            .eq('year', parseInt(year));

          if (yearError || !count) return;

          detectedYears.push(year);

          const yearInfo: YearData = {
            year,
            counsellingBodies: [],
            levels: [],
            rounds: []
          };

          // 2. Probe details for this year in parallel
          const probes = [
            // Check Levels
            supabase.from('cutoffs').select('*', { count: 'exact', head: true }).eq('year', parseInt(year)).eq('level', 'UG').then(r => r.count ? 'UG' : null),
            supabase.from('cutoffs').select('*', { count: 'exact', head: true }).eq('year', parseInt(year)).eq('level', 'PG').then(r => r.count ? 'PG' : null),
            supabase.from('cutoffs').select('*', { count: 'exact', head: true }).eq('year', parseInt(year)).eq('level', 'DEN').then(r => r.count ? 'DEN' : null),
            
            // Check Sources (Counselling Bodies) - Simplified check
            supabase.from('cutoffs').select('*', { count: 'exact', head: true }).eq('year', parseInt(year)).eq('source', 'AIQ').then(r => r.count ? 'AIQ' : null),
            supabase.from('cutoffs').select('*', { count: 'exact', head: true }).eq('year', parseInt(year)).in('source', ['State', 'KEA', 'TN', 'MH']).then(r => r.count ? 'State' : null), // Generic check for State data
            supabase.from('cutoffs').select('*', { count: 'exact', head: true }).eq('year', parseInt(year)).eq('source', 'KEA').then(r => r.count ? 'KEA' : null),

            // Check Rounds (1-6)
            supabase.from('cutoffs').select('*', { count: 'exact', head: true }).eq('year', parseInt(year)).eq('round', 1).then(r => r.count ? 1 : null),
            supabase.from('cutoffs').select('*', { count: 'exact', head: true }).eq('year', parseInt(year)).eq('round', 2).then(r => r.count ? 2 : null),
            supabase.from('cutoffs').select('*', { count: 'exact', head: true }).eq('year', parseInt(year)).eq('round', 3).then(r => r.count ? 3 : null),
            supabase.from('cutoffs').select('*', { count: 'exact', head: true }).eq('year', parseInt(year)).eq('round', 4).then(r => r.count ? 4 : null),
            supabase.from('cutoffs').select('*', { count: 'exact', head: true }).eq('year', parseInt(year)).eq('round', 5).then(r => r.count ? 5 : null),
            supabase.from('cutoffs').select('*', { count: 'exact', head: true }).eq('year', parseInt(year)).eq('round', 6).then(r => r.count ? 6 : null),
          ];

          const results = await Promise.all(probes);
          
          // Process Levels
          if (results[0]) yearInfo.levels.push('UG');
          if (results[1]) yearInfo.levels.push('PG');
          if (results[2]) yearInfo.levels.push('DEN');

          // Process Bodies
          if (results[3]) yearInfo.counsellingBodies.push('AIQ');
          if (results[4] && !yearInfo.counsellingBodies.includes('State')) yearInfo.counsellingBodies.push('State'); 
          // Note: State might cover KEA, but we check KEA explicitly too if needed
          if (results[5] && !yearInfo.counsellingBodies.includes('KEA')) yearInfo.counsellingBodies.push('KEA');

          // Process Rounds
          for (let i = 6; i < 12; i++) {
            if (results[i]) yearInfo.rounds.push(results[i] as number);
          }

          detectedYearData.push(yearInfo);
        }));

        // Sort years in descending order
        detectedYears.sort((a, b) => b.localeCompare(a));
        detectedYearData.sort((a, b) => b.year.localeCompare(a.year));
        
        setAvailableYears(detectedYears);
        setYearData(detectedYearData);
        setLatestYear(detectedYears[0] || '');
        
      } catch (err) {
        console.error('Failed to fetch available years:', err);
        setError('Failed to load available years');
        
        // Fallback to minimal default
        const fallbackYears = ['2024'];
        setAvailableYears(fallbackYears);
        setLatestYear(fallbackYears[0]);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableYears();
  }, []);

  return {
    availableYears,
    yearData,
    latestYear,
    loading,
    error
  };
};

// Helper function to get available options for a specific year
export const useYearOptions = (year: string) => {
  const { yearData } = useAvailableYears();
  
  const yearInfo = yearData.find(y => y.year === year);
  
  return {
    counsellingBodies: yearInfo?.counsellingBodies || [],
    levels: yearInfo?.levels || [],
    rounds: yearInfo?.rounds || []
  };
};

