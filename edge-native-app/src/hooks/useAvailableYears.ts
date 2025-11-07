import { useState, useEffect } from 'react';

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

        // First, try to get years from counselling body statistics
        try {
          const response = await fetch('/data/json/counselling-body-statistics.json');
          if (response.ok) {
            const data = await response.json();
            
            // Extract unique years from the data
            const years = new Set<string>();
            const yearDataMap = new Map<string, YearData>();
            
            Object.entries(data.counselling_bodies).forEach(([counsellingBody, bodyData]: [string, any]) => {
              Object.entries(bodyData.years).forEach(([year, yearData]: [string, any]) => {
                years.add(year);
                
                if (!yearDataMap.has(year)) {
                  yearDataMap.set(year, {
                    year,
                    counsellingBodies: [],
                    levels: [],
                    rounds: []
                  });
                }
                
                const yearInfo = yearDataMap.get(year)!;
                
                // Add counselling body if not already present
                if (!yearInfo.counsellingBodies.includes(counsellingBody)) {
                  yearInfo.counsellingBodies.push(counsellingBody);
                }
                
                // Add level if not already present
                if (!yearInfo.levels.includes(yearData.level)) {
                  yearInfo.levels.push(yearData.level);
                }
                
                // Add rounds
                Object.keys(yearData.rounds).forEach(round => {
                  const roundNum = parseInt(round);
                  if (!yearInfo.rounds.includes(roundNum)) {
                    yearInfo.rounds.push(roundNum);
                  }
                });
              });
            });
            
            // Convert to array and sort in descending order
            const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));
            const sortedYearData = Array.from(yearDataMap.values()).sort((a, b) => b.year.localeCompare(a.year));
            
            setAvailableYears(sortedYears);
            setYearData(sortedYearData);
            setLatestYear(sortedYears[0] || '');
            setLoading(false);
            return;
          }
        } catch (error) {
          console.warn('Could not load from counselling-body-statistics.json, trying file scan approach');
        }

        // Fallback: Scan for available counselling files
        // This approach requires a manifest file or server endpoint to list files
        // For now, we'll use a predefined list of common patterns
        const commonYears = ['2025', '2024', '2023', '2022', '2021', '2020'];
        const detectedYears: string[] = [];
        const detectedYearData: YearData[] = [];
        
        // Check for each year by trying to load a representative file
        for (const year of commonYears) {
          const yearInfo: YearData = {
            year,
            counsellingBodies: [],
            levels: [],
            rounds: []
          };
          
          let yearHasData = false;
          
          // Check for AIQ UG data
          try {
            const response = await fetch(`/data/json/cutoffs/AIQ-${year}-UG-R1.json`);
            if (response.ok) {
              yearHasData = true;
              if (!yearInfo.counsellingBodies.includes('AIQ')) {
                yearInfo.counsellingBodies.push('AIQ');
              }
              if (!yearInfo.levels.includes('UG')) {
                yearInfo.levels.push('UG');
              }
              
              // Try to determine available rounds
              for (let round = 1; round <= 5; round++) {
                try {
                  const roundResponse = await fetch(`/data/json/cutoffs/AIQ-${year}-UG-R${round}.json`);
                  if (roundResponse.ok && !yearInfo.rounds.includes(round)) {
                    yearInfo.rounds.push(round);
                  }
                } catch (e) {
                  // Round doesn't exist, stop checking further rounds
                  break;
                }
              }
            }
          } catch (e) {
            // File doesn't exist
          }
          
          // Check for KEA UG data
          try {
            const response = await fetch(`/data/json/cutoffs/KEA-${year}-UG-R1.json`);
            if (response.ok) {
              yearHasData = true;
              if (!yearInfo.counsellingBodies.includes('KEA')) {
                yearInfo.counsellingBodies.push('KEA');
              }
              if (!yearInfo.levels.includes('UG')) {
                yearInfo.levels.push('UG');
              }
              
              // Try to determine available rounds
              for (let round = 1; round <= 5; round++) {
                try {
                  const roundResponse = await fetch(`/data/json/cutoffs/KEA-${year}-UG-R${round}.json`);
                  if (roundResponse.ok && !yearInfo.rounds.includes(round)) {
                    yearInfo.rounds.push(round);
                  }
                } catch (e) {
                  // Round doesn't exist, stop checking further rounds
                  break;
                }
              }
            }
          } catch (e) {
            // File doesn't exist
          }
          
          // Check for AIQ PG data
          try {
            const response = await fetch(`/data/json/cutoffs/AIQ-${year}-PG-R1.json`);
            if (response.ok) {
              yearHasData = true;
              if (!yearInfo.counsellingBodies.includes('AIQ')) {
                yearInfo.counsellingBodies.push('AIQ');
              }
              if (!yearInfo.levels.includes('PG')) {
                yearInfo.levels.push('PG');
              }
              
              // Try to determine available rounds
              for (let round = 1; round <= 5; round++) {
                try {
                  const roundResponse = await fetch(`/data/json/cutoffs/AIQ-${year}-PG-R${round}.json`);
                  if (roundResponse.ok && !yearInfo.rounds.includes(round)) {
                    yearInfo.rounds.push(round);
                  }
                } catch (e) {
                  // Round doesn't exist, stop checking further rounds
                  break;
                }
              }
            }
          } catch (e) {
            // File doesn't exist
          }
          
          // Check for KEA PG data
          try {
            const response = await fetch(`/data/json/cutoffs/KEA-${year}-PG-R1.json`);
            if (response.ok) {
              yearHasData = true;
              if (!yearInfo.counsellingBodies.includes('KEA')) {
                yearInfo.counsellingBodies.push('KEA');
              }
              if (!yearInfo.levels.includes('PG')) {
                yearInfo.levels.push('PG');
              }
              
              // Try to determine available rounds
              for (let round = 1; round <= 5; round++) {
                try {
                  const roundResponse = await fetch(`/data/json/cutoffs/KEA-${year}-PG-R${round}.json`);
                  if (roundResponse.ok && !yearInfo.rounds.includes(round)) {
                    yearInfo.rounds.push(round);
                  }
                } catch (e) {
                  // Round doesn't exist, stop checking further rounds
                  break;
                }
              }
            }
          } catch (e) {
            // File doesn't exist
          }
          
          // Check for AIQ DEN data
          try {
            const response = await fetch(`/data/json/cutoffs/AIQ-${year}-DEN-R1.json`);
            if (response.ok) {
              yearHasData = true;
              if (!yearInfo.counsellingBodies.includes('AIQ')) {
                yearInfo.counsellingBodies.push('AIQ');
              }
              if (!yearInfo.levels.includes('DEN')) {
                yearInfo.levels.push('DEN');
              }
              
              // Try to determine available rounds
              for (let round = 1; round <= 5; round++) {
                try {
                  const roundResponse = await fetch(`/data/json/cutoffs/AIQ-${year}-DEN-R${round}.json`);
                  if (roundResponse.ok && !yearInfo.rounds.includes(round)) {
                    yearInfo.rounds.push(round);
                  }
                } catch (e) {
                  // Round doesn't exist, stop checking further rounds
                  break;
                }
              }
            }
          } catch (e) {
            // File doesn't exist
          }
          
          // Check for KEA DEN data
          try {
            const response = await fetch(`/data/json/cutoffs/KEA-${year}-DEN-R1.json`);
            if (response.ok) {
              yearHasData = true;
              if (!yearInfo.counsellingBodies.includes('KEA')) {
                yearInfo.counsellingBodies.push('KEA');
              }
              if (!yearInfo.levels.includes('DEN')) {
                yearInfo.levels.push('DEN');
              }
              
              // Try to determine available rounds
              for (let round = 1; round <= 5; round++) {
                try {
                  const roundResponse = await fetch(`/data/json/cutoffs/KEA-${year}-DEN-R${round}.json`);
                  if (roundResponse.ok && !yearInfo.rounds.includes(round)) {
                    yearInfo.rounds.push(round);
                  }
                } catch (e) {
                  // Round doesn't exist, stop checking further rounds
                  break;
                }
              }
            }
          } catch (e) {
            // File doesn't exist
          }
          
          if (yearHasData) {
            detectedYears.push(year);
            detectedYearData.push(yearInfo);
          }
        }
        
        // Sort years in descending order
        detectedYears.sort((a, b) => b.localeCompare(a));
        detectedYearData.sort((a, b) => b.year.localeCompare(a.year));
        
        setAvailableYears(detectedYears);
        setYearData(detectedYearData);
        setLatestYear(detectedYears[0] || '');
        
      } catch (err) {
        console.error('Failed to fetch available years:', err);
        setError('Failed to load available years');
        
        // Fallback to hardcoded years
        const fallbackYears = ['2024', '2023', '2022', '2021', '2020'];
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

