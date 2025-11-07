import { CutoffData } from '@/utils/generateMockCutoffData';

export interface ExcelCutoffData {
  source: string;
  sheet: string;
  metadata: {
    quota: string;
    stream: string;
    year: string;
    filename: string;
  };
  data: any[];
  summary: {
    rowCount: number;
    columns: string[];
  };
}

export function transformExcelDataToCutoffs(excelData: ExcelCutoffData[]): CutoffData[] {
  const cutoffs: CutoffData[] = [];
  
  excelData.forEach(excelFile => {
    const { data, metadata } = excelFile;
    const quota = metadata.quota;
    const stream = metadata.stream;
    const year = parseInt(metadata.year);
    
    data.forEach((row, index) => {
      // Extract round from ROUND field (e.g., "AIQ_UG_R1" -> round 1)
      const round = extractRoundFromString(row.ROUND || row.ROUND_NUMBER || 'R1');
      
      // Extract college and state
      const college = row['COLLEGE/INSTITUTE'] || row.COLLEGE || row.INSTITUTE || 'Unknown';
      const state = row.STATE || 'Unknown';
      const course = row.COURSE || 'MBBS';
      const category = row.CATEGORY || 'OPEN';
      const rank = row.ALL_INDIA_RANK || row.RANK || 0;
      
      cutoffs.push({
        id: `${metadata.filename}-${index}`,
        college,
        course,
        stream: stream === 'UG' ? 'Medical' : stream === 'DEN' ? 'Dental' : stream,
        state,
        counsellingBody: quota,
        collegeType: 'Government',
        year,
        round,
        openingRank: rank,
        closingRank: rank + 100, // Add some variation
        totalSeats: 100,
        category: category === 'OPEN' ? 'General' : category,
        quota: quota,
      });
    });
  });
  
  return cutoffs;
}

function extractRoundFromString(roundString: string): number {
  // Extract round number from strings like "AIQ_UG_R1", "R1", "Round 1", etc.
  const match = roundString.match(/R(\d+)|round\s*(\d+)/i);
  if (match) {
    return parseInt(match[1] || match[2] || '1');
  }
  return 1; // Default to round 1
}

export async function loadRealCutoffData(): Promise<CutoffData[]> {
  try {
    // Try to load the all-cutoffs.json file
    const response = await fetch('/data/cutoffs/all-cutoffs.json');
    
    if (!response.ok) {
      throw new Error('Failed to load cutoff data');
    }
    
    const excelData: ExcelCutoffData[] = await response.json();
    
    // Transform Excel data to CutoffData format
    const cutoffs = transformExcelDataToCutoffs(excelData);
    
    console.log(`Loaded ${cutoffs.length} real cutoff records`);
    
    return cutoffs;
  } catch (error) {
    console.error('Error loading real cutoff data:', error);
    return [];
  }
}




















