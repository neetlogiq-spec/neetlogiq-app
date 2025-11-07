/**
 * Static Cutoffs Service
 * Handles client-side filtering and progressive loading
 * No Cloudflare Workers needed!
 */

export interface CutoffRecord {
  id: string;
  college_id: string;
  college_name: string;
  course_id: string;
  course_name: string;
  year: number;
  round: number;
  category: string;
  opening_rank: number;
  closing_rank: number;
  total_seats: number;
  stream: string;
  level: string;
  state_id: string;
  category_id: string;
  quota_id: string;
}

export interface FilterOptions {
  college_name?: string;
  course_name?: string;
  state?: string;
  category?: string;
  quota?: string;
  year?: number;
  round?: number;
  min_rank?: number;
  max_rank?: number;
}

export class StaticCutoffsService {
  private cache: Map<string, CutoffRecord[]> = new Map();
  private loadedRounds: Set<string> = new Set();

  /**
   * Load priority rounds (1 & 2) for a stream
   * This is the initial load - fast and small (50-100 KB)
   */
  async loadPriorityRounds(stream: string): Promise<CutoffRecord[]> {
    const cacheKey = `${stream}_priority`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Load from static JSON file
      const response = await fetch(`/data/cutoffs/${stream}_priority.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to load priority data for ${stream}`);
      }

      const data: CutoffRecord[] = await response.json();
      
      // Cache the results
      this.cache.set(cacheKey, data);
      this.loadedRounds.add(cacheKey);
      
      return data;
    } catch (error) {
      console.error(`Error loading priority rounds for ${stream}:`, error);
      return [];
    }
  }

  /**
   * Load additional rounds on demand
   * This happens when user wants to see more data
   */
  async loadAdditionalRound(stream: string, round: number): Promise<CutoffRecord[]> {
    const cacheKey = `${stream}_round_${round}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Load from static JSON file (20-30 KB per round)
      const response = await fetch(`/data/cutoffs/${stream}_round_${round}.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to load round ${round} for ${stream}`);
      }

      const data: CutoffRecord[] = await response.json();
      
      // Cache the results
      this.cache.set(cacheKey, data);
      this.loadedRounds.add(cacheKey);
      
      return data;
    } catch (error) {
      console.error(`Error loading round ${round} for ${stream}:`, error);
      return [];
    }
  }

  /**
   * Load all available data for a stream (optimized)
   */
  async loadAllData(stream: string): Promise<CutoffRecord[]> {
    const allData: CutoffRecord[] = [];

    // Load priority rounds
    const priorityData = await this.loadPriorityRounds(stream);
    allData.push(...priorityData);

    // Load additional rounds (3-10) on demand
    for (let round = 3; round <= 10; round++) {
      const roundData = await this.loadAdditionalRound(stream, round);
      allData.push(...roundData);
    }

    return allData;
  }

  /**
   * Filter cutoff data client-side
   * This is fast for in-memory data!
   */
  filterCutoffs(data: CutoffRecord[], filters: FilterOptions): CutoffRecord[] {
    return data.filter(record => {
      // Filter by college name
      if (filters.college_name && !record.college_name.toLowerCase().includes(filters.college_name.toLowerCase())) {
        return false;
      }

      // Filter by course name
      if (filters.course_name && !record.course_name.toLowerCase().includes(filters.course_name.toLowerCase())) {
        return false;
      }

      // Filter by category
      if (filters.category && record.category !== filters.category) {
        return false;
      }

      // Filter by year
      if (filters.year && record.year !== filters.year) {
        return false;
      }

      // Filter by round
      if (filters.round && record.round !== filters.round) {
        return false;
      }

      // Filter by rank range
      if (filters.min_rank && record.closing_rank > filters.min_rank) {
        return false;
      }

      if (filters.max_rank && record.opening_rank < filters.max_rank) {
        return false;
      }

      return true;
    });
  }

  /**
   * Search across all cutoff records
   */
  searchCutoffs(data: CutoffRecord[], searchTerm: string): CutoffRecord[] {
    if (!searchTerm) return data;

    const term = searchTerm.toLowerCase();
    
    return data.filter(record => 
      record.college_name.toLowerCase().includes(term) ||
      record.course_name.toLowerCase().includes(term) ||
      record.category.toLowerCase().includes(term)
    );
  }

  /**
   * Sort cutoff data
   */
  sortCutoffs(data: CutoffRecord[], sortBy: string, order: 'asc' | 'desc' = 'asc'): CutoffRecord[] {
    const sorted = [...data].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'college_name':
          comparison = a.college_name.localeCompare(b.college_name);
          break;
        case 'course_name':
          comparison = a.course_name.localeCompare(b.course_name);
          break;
        case 'closing_rank':
          comparison = a.closing_rank - b.closing_rank;
          break;
        case 'opening_rank':
          comparison = a.opening_rank - b.opening_rank;
          break;
        case 'total_seats':
          comparison = a.total_seats - b.total_seats;
          break;
        case 'round':
          comparison = a.round - b.round;
          break;
        case 'year':
          comparison = a.year - b.year;
          break;
        default:
          return 0;
      }

      return order === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }

  /**
   * Get statistics for filtered data
   */
  getStatistics(data: CutoffRecord[]): {
    totalRecords: number;
    uniqueColleges: number;
    uniqueCourses: number;
    avgClosingRank: number;
    minClosingRank: number;
    maxClosingRank: number;
  } {
    if (data.length === 0) {
      return {
        totalRecords: 0,
        uniqueColleges: 0,
        uniqueCourses: 0,
        avgClosingRank: 0,
        minClosingRank: 0,
        maxClosingRank: 0,
      };
    }

    const uniqueColleges = new Set(data.map(r => r.college_id)).size;
    const uniqueCourses = new Set(data.map(r => r.course_id)).size;
    const closingRanks = data.map(r => r.closing_rank);
    const avgClosingRank = closingRanks.reduce((a, b) => a + b, 0) / closingRanks.length;
    const minClosingRank = Math.min(...closingRanks);
    const maxClosingRank = Math.max(...closingRanks);

    return {
      totalRecords: data.length,
      uniqueColleges,
      uniqueCourses,
      avgClosingRank: Math.round(avgClosingRank),
      minClosingRank,
      maxClosingRank,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.loadedRounds.clear();
  }

  /**
   * Get loaded rounds info
   */
  getLoadedRounds(): string[] {
    return Array.from(this.loadedRounds);
  }
}

// Export singleton instance
export const staticCutoffsService = new StaticCutoffsService();
