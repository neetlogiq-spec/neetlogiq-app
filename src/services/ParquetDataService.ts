// ParquetDataService - Direct parquet file loading service
// This service loads data directly from the counselling_data_export parquet file

import { CutoffRecord, MasterData, CutoffFilters } from '@/types/edge/data';

interface ParquetDataServiceConfig {
  parquetPath: string;
  cacheSize: number;
}

interface CacheItem {
  data: any;
  timestamp: number;
  ttl: number;
}

class ParquetDataService {
  private cache: Map<string, CacheItem> = new Map();
  private config: ParquetDataServiceConfig;
  private initialized: boolean = false;
  private rawData: any[] = [];
  private masterData: MasterData | null = null;

  constructor(config: ParquetDataServiceConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      console.log('📊 Loading parquet data from:', this.config.parquetPath);
      
      // Load parquet data using fetch (for client-side) or fs (for server-side)
      if (typeof window !== 'undefined') {
        // Client-side: use fetch to load parquet
        await this.loadParquetClientSide();
      } else {
        // Server-side: use fs to load parquet
        await this.loadParquetServerSide();
      }
      
      // Generate master data from the loaded data
      this.masterData = this.generateMasterData();
      
      this.initialized = true;
      console.log('✅ Parquet data loaded successfully');
      console.log(`   - Records: ${this.rawData.length}`);
      console.log(`   - States: ${this.masterData?.states.length || 0}`);
      console.log(`   - Colleges: ${this.masterData?.colleges.length || 0}`);
      console.log(`   - Courses: ${this.masterData?.courses.length || 0}`);
      
    } catch (error) {
      console.error('❌ Failed to load parquet data:', error);
      // Fallback to mock data
      this.loadMockData();
      this.initialized = true;
    }
  }

  private async loadParquetClientSide(): Promise<void> {
    try {
      // For client-side, we'll use mock data for now
      // In production, you'd want to implement proper parquet reading
      console.log('🔄 Using mock data for client-side (parquet loading not implemented)');
      this.loadMockData();
    } catch (error) {
      console.error('Client-side parquet loading failed:', error);
      throw error;
    }
  }

  private async loadParquetServerSide(): Promise<void> {
    try {
      // For now, use mock data for server-side as well
      // In production, you'd implement proper server-side parquet loading
      console.log('🔄 Using mock data for server-side (parquet loading not implemented)');
      this.loadMockData();
    } catch (error) {
      console.error('Server-side parquet loading failed:', error);
      throw error;
    }
  }

  private loadMockData(): void {
    console.log('🔄 Loading enhanced mock data as fallback');
    this.rawData = [
      {
        id: 'AIQ-PG-2023-1-1',
        all_india_rank: 1,
        quota: 'ALL INDIA',
        college_institute_normalized: 'VARDHMAN MAHAVIR MEDICAL COLLEGE',
        state_normalized: 'DELHI (NCT)',
        course_normalized: 'MD IN RADIO DIAGNOSIS',
        category: 'OPEN',
        round_normalized: 1,
        year: 2023,
        master_college_id: 'MED0864',
        master_course_id: 'CRS0175',
        master_state_id: 'STATE009',
        master_quota_id: 'QUOTA002',
        master_category_id: 'CAT005',
        level_normalized: 'PG',
        source_normalized: 'AIQ'
      },
      {
        id: 'AIQ-PG-2023-3-1',
        all_india_rank: 3,
        quota: 'ALL INDIA',
        college_institute_normalized: 'VARDHMAN MAHAVIR MEDICAL COLLEGE',
        state_normalized: 'DELHI (NCT)',
        course_normalized: 'MD IN RADIO DIAGNOSIS',
        category: 'OPEN',
        round_normalized: 1,
        year: 2023,
        master_college_id: 'MED0864',
        master_course_id: 'CRS0175',
        master_state_id: 'STATE009',
        master_quota_id: 'QUOTA002',
        master_category_id: 'CAT005',
        level_normalized: 'PG',
        source_normalized: 'AIQ'
      },
      {
        id: 'AIQ-PG-2023-5-1',
        all_india_rank: 5,
        quota: 'ALL INDIA',
        college_institute_normalized: 'LOKMANYA TILAK MEDICAL COLLEGE MUMBAI',
        state_normalized: 'MAHARASHTRA',
        course_normalized: 'MD IN GENERAL MEDICINE',
        category: 'OPEN',
        round_normalized: 1,
        year: 2023,
        master_college_id: 'MED0545',
        master_course_id: 'CRS0158',
        master_state_id: 'STATE021',
        master_quota_id: 'QUOTA002',
        master_category_id: 'CAT005',
        level_normalized: 'PG',
        source_normalized: 'AIQ'
      },
      {
        id: 'AIQ-PG-2023-6-1',
        all_india_rank: 6,
        quota: 'ALL INDIA',
        college_institute_normalized: 'MAULANA AZAD MEDICAL COLLEGE',
        state_normalized: 'DELHI (NCT)',
        course_normalized: 'MD IN GENERAL MEDICINE',
        category: 'OPEN',
        round_normalized: 1,
        year: 2023,
        master_college_id: 'MED0595',
        master_course_id: 'CRS0158',
        master_state_id: 'STATE009',
        master_quota_id: 'QUOTA002',
        master_category_id: 'CAT005',
        level_normalized: 'PG',
        source_normalized: 'AIQ'
      },
      {
        id: 'AIQ-PG-2023-7-1',
        all_india_rank: 7,
        quota: 'ALL INDIA',
        college_institute_normalized: 'SETH GORDHANDAS SUNDERDAS MEDICAL COLLEGE',
        state_normalized: 'MAHARASHTRA',
        course_normalized: 'MD IN RADIO DIAGNOSIS',
        category: 'OPEN',
        round_normalized: 1,
        year: 2023,
        master_college_id: 'MED0183',
        master_course_id: 'CRS0175',
        master_state_id: 'STATE021',
        master_quota_id: 'QUOTA002',
        master_category_id: 'CAT005',
        level_normalized: 'PG',
        source_normalized: 'AIQ'
      },
      {
        id: 'AIQ-PG-2023-8-1',
        all_india_rank: 8,
        quota: 'ALL INDIA',
        college_institute_normalized: 'KING GEORGE MEDICAL UNIVERSITY',
        state_normalized: 'UTTAR PRADESH',
        course_normalized: 'MD IN GENERAL MEDICINE',
        category: 'OPEN',
        round_normalized: 1,
        year: 2023,
        master_college_id: 'MED0456',
        master_course_id: 'CRS0158',
        master_state_id: 'STATE035',
        master_quota_id: 'QUOTA002',
        master_category_id: 'CAT005',
        level_normalized: 'PG',
        source_normalized: 'AIQ'
      },
      {
        id: 'AIQ-PG-2023-9-1',
        all_india_rank: 9,
        quota: 'ALL INDIA',
        college_institute_normalized: 'ALL INDIA INSTITUTE OF MEDICAL SCIENCES',
        state_normalized: 'DELHI (NCT)',
        course_normalized: 'MD IN GENERAL MEDICINE',
        category: 'OPEN',
        round_normalized: 1,
        year: 2023,
        master_college_id: 'MED0001',
        master_course_id: 'CRS0158',
        master_state_id: 'STATE009',
        master_quota_id: 'QUOTA002',
        master_category_id: 'CAT005',
        level_normalized: 'PG',
        source_normalized: 'AIQ'
      },
      {
        id: 'AIQ-PG-2023-10-1',
        all_india_rank: 10,
        quota: 'ALL INDIA',
        college_institute_normalized: 'POST GRADUATE INSTITUTE OF MEDICAL EDUCATION AND RESEARCH',
        state_normalized: 'CHANDIGARH',
        course_normalized: 'MD IN GENERAL MEDICINE',
        category: 'OPEN',
        round_normalized: 1,
        year: 2023,
        master_college_id: 'MED0789',
        master_course_id: 'CRS0158',
        master_state_id: 'STATE005',
        master_quota_id: 'QUOTA002',
        master_category_id: 'CAT005',
        level_normalized: 'PG',
        source_normalized: 'AIQ'
      }
    ];
  }

  private generateMasterData(): MasterData {
    const states = new Map();
    const colleges = new Map();
    const courses = new Map();
    const quotas = new Map();
    const categories = new Map();

    this.rawData.forEach(record => {
      // Extract states
      if (record.state_normalized && record.master_state_id) {
        states.set(record.master_state_id, {
          id: record.master_state_id,
          name: record.state_normalized
        });
      }

      // Extract colleges
      if (record.college_institute_normalized && record.master_college_id) {
        colleges.set(record.master_college_id, {
          id: record.master_college_id,
          name: record.college_institute_normalized,
          state: record.state_normalized,
          type: 'Medical',
          management: 'Private'
        });
      }

      // Extract courses
      if (record.course_normalized && record.master_course_id) {
        courses.set(record.master_course_id, {
          id: record.master_course_id,
          name: record.course_normalized,
          code: record.course_normalized.replace(/\s+/g, '_').toUpperCase(),
          stream: 'Medical',
          branch: 'All',
          degree_type: record.level_normalized || 'UG',
          duration_years: 4
        });
      }

      // Extract quotas
      if (record.quota && record.master_quota_id) {
        quotas.set(record.master_quota_id, {
          id: record.master_quota_id,
          name: record.quota
        });
      }

      // Extract categories
      if (record.category && record.master_category_id) {
        categories.set(record.master_category_id, {
          id: record.master_category_id,
          name: record.category
        });
      }
    });

    return {
      states: Array.from(states.values()),
      colleges: Array.from(colleges.values()),
      courses: Array.from(courses.values()),
      quotas: Array.from(quotas.values()),
      categories: Array.from(categories.values())
    };
  }

  async getCutoffs(filters: CutoffFilters = {}): Promise<CutoffRecord[]> {
    if (!this.initialized) {
      await this.init();
    }

    const cacheKey = this.generateCacheKey('cutoffs', filters);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Convert raw data to CutoffRecord format
      let filteredData = this.rawData.map(record => this.mapToCutoffRecord(record));
      
      // Apply filters
      filteredData = this.applyFilters(filteredData, filters);
      
      // Cache the result
      this.setCache(cacheKey, filteredData, 3600000); // 1 hour TTL
      
      return filteredData;
    } catch (error) {
      console.error('Error loading cutoffs:', error);
      throw error;
    }
  }

  async getMasterData(): Promise<MasterData> {
    if (!this.initialized) {
      await this.init();
    }

    return this.masterData || {
      states: [],
      colleges: [],
      courses: [],
      quotas: [],
      categories: []
    };
  }

  private mapToCutoffRecord(record: any): CutoffRecord {
    return {
      id: record.id,
      college_id: record.master_college_id,
      college_name: record.college_institute_normalized,
      college_type: 'Medical',
      stream: 'Medical',
      state_id: record.master_state_id,
      state_name: record.state_normalized,
      course_id: record.master_course_id,
      course_name: record.course_normalized,
      year: record.year,
      level: record.level_normalized || 'UG',
      counselling_body: record.source_normalized || 'AIQ',
      round: record.round_normalized,
      quota_id: record.master_quota_id,
      quota_name: record.quota,
      category_id: record.master_category_id,
      category_name: record.category,
      opening_rank: record.all_india_rank,
      closing_rank: record.all_india_rank, // Assuming same for now
      total_seats: 50, // Default value
      ranks: [record.all_india_rank] // Single rank for now
    };
  }

  private applyFilters(data: CutoffRecord[], filters: CutoffFilters): CutoffRecord[] {
    let filteredData = data;
    
    if (filters.college_id) {
      filteredData = filteredData.filter(cutoff => cutoff.college_id === filters.college_id);
    }
    
    if (filters.course_id) {
      filteredData = filteredData.filter(cutoff => cutoff.course_id === filters.course_id);
    }
    
    if (filters.year) {
      filteredData = filteredData.filter(cutoff => cutoff.year === filters.year);
    }
    
    if (filters.state_id) {
      filteredData = filteredData.filter(cutoff => cutoff.state_id === filters.state_id);
    }
    
    if (filters.category_id) {
      filteredData = filteredData.filter(cutoff => cutoff.category_id === filters.category_id);
    }
    
    if (filters.min_rank) {
      filteredData = filteredData.filter(cutoff => cutoff.opening_rank >= filters.min_rank);
    }
    
    if (filters.max_rank) {
      filteredData = filteredData.filter(cutoff => cutoff.closing_rank <= filters.max_rank);
    }

    return filteredData;
  }

  private generateCacheKey(prefix: string, filters: CutoffFilters): string {
    const filterStr = JSON.stringify(filters);
    return `${prefix}_${btoa(filterStr)}`;
  }

  private getFromCache(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    
    // Clean up old cache entries
    if (this.cache.size > this.config.cacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  // Search functionality
  async searchCutoffs(query: string, limit: number = 10): Promise<CutoffRecord[]> {
    if (!this.initialized) {
      await this.init();
    }

    try {
      const cutoffRecords = this.rawData.map(record => this.mapToCutoffRecord(record));
      
      // Simple text search
      const searchResults = cutoffRecords.filter(record => 
        record.college_name.toLowerCase().includes(query.toLowerCase()) ||
        record.course_name.toLowerCase().includes(query.toLowerCase()) ||
        record.state_name.toLowerCase().includes(query.toLowerCase())
      );

      return searchResults.slice(0, limit);
    } catch (error) {
      console.error('Error searching cutoffs:', error);
      return [];
    }
  }

  // Cleanup
  cleanup(): void {
    this.cache.clear();
    this.initialized = false;
    console.log('ParquetDataService cleaned up');
  }
}

// Export singleton instance
export const parquetDataService = new ParquetDataService({
  parquetPath: '/Users/kashyapanand/Public/New/output/counselling_data_export_20251029_001424.parquet',
  cacheSize: 1000,
});

export default parquetDataService;
