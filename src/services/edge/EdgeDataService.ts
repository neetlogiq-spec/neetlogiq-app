// EdgeDataService - High-performance data processing using PostgreSQL via Supabase
// This service provides multi-level caching and database optimization

import { CutoffRecord, MasterData, CutoffFilters } from '@/types/edge/data';
import { supabaseDataService } from '@/services/supabase-data-service';

interface EdgeDataServiceConfig {
  dataPath: string;
  cacheSize: number;
}

interface CacheItem {
  data: any;
  timestamp: number;
  ttl: number;
}

class EdgeDataService {
  private cache: Map<string, CacheItem> = new Map();
  private config: EdgeDataServiceConfig;
  private initialized: boolean = false;

  constructor(config: EdgeDataServiceConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    console.log('EdgeDataService initialized with SQLite backend');
    this.initialized = true;
  }

  async getCutoffs(filters: CutoffFilters = {}): Promise<CutoffRecord[]> {
    if (!this.initialized) {
      await this.init();
    }

    try {
      // Convert EdgeDataService filters to SupabaseDataService filters
      const supabaseFilters = {
        collegeId: filters.college_id,
        courseId: filters.course_id,
        year: filters.year,
        category: filters.category_id,
        quota: filters.quota_id,
        state: filters.state_id,
        round: filters.round,
        limit: 1000
      };

      const result = await supabaseDataService.searchCutoffs(supabaseFilters);

      // Map Supabase cutoff format to CutoffRecord format
      return result.data.map((cutoff: any) => ({
        id: cutoff.id,
        college_id: cutoff.college_id,
        college_name: cutoff.college_name || '',
        college_type: cutoff.college_type || 'Medical',
        stream: cutoff.stream || 'Medical',
        state_id: cutoff.state || '',
        state_name: cutoff.state || '',
        course_id: cutoff.course_id,
        course_name: cutoff.course_name || '',
        year: cutoff.year,
        level: cutoff.level || 'UG',
        counselling_body: cutoff.source || 'AIQ',
        round: cutoff.round,
        quota_id: cutoff.quota || '',
        quota_name: cutoff.quota || '',
        category_id: cutoff.category || '',
        category_name: cutoff.category || '',
        opening_rank: cutoff.opening_rank,
        closing_rank: cutoff.closing_rank,
        total_seats: cutoff.total_seats || 0,
        ranks: []
      }));
    } catch (error) {
      console.error('Error loading cutoffs from Supabase:', error);
      // Fallback to mock data
      return await this.loadCutoffData(filters);
    }
  }

  async getMasterData(): Promise<MasterData> {
    if (!this.initialized) {
      await this.init();
    }

    try {
      const masterData = await supabaseDataService.getMasterData();

      // Map to expected format
      return {
        states: masterData.states.map((state: any) => ({
          id: state,
          name: state
        })),
        categories: masterData.categories.map((cat: any) => ({
          id: cat,
          name: cat
        })),
        quotas: masterData.quotas.map((quota: any) => ({
          id: quota,
          name: quota
        })),
        courses: [],
        colleges: masterData.colleges.map((college: any) => ({
          ...college,
          type: college.type || 'Medical',
          management: college.management_type || 'Government',
          university_affiliation: '',
          website: '',
          address: `${college.city}, ${college.state}`,
          established_year: 2000,
          recognition: 'MCI'
        }))
      };
    } catch (error) {
      console.error('Error loading master data from Supabase:', error);
      // Fallback to mock data
      return await this.loadMasterData();
    }
  }

  private async loadCutoffData(filters: CutoffFilters): Promise<CutoffRecord[]> {
    try {
      // For now, return mock data with proper ID structure
      // In production, this would query the counselling_data_partitioned.db
      const mockCutoffs: CutoffRecord[] = [
        {
          id: 'CUTOFF_001',
          college_id: 'MED0001',
          college_name: 'A J INSTITUTE OF MEDICAL SCIENCES AND RESEARCH CENTRE',
          college_type: 'Medical',
          stream: 'Medical',
          state_id: 'KAR001',
          state_name: 'Karnataka',
          course_id: 'CRS0001',
          course_name: 'ALL PG COURSES',
          year: 2024,
          level: 'PG',
          counselling_body: 'AIQ',
          round: 1,
          quota_id: 'QUOTA001',
          quota_name: 'All India',
          category_id: 'CAT001',
          category_name: 'General',
          opening_rank: 1,
          closing_rank: 100,
          total_seats: 50,
          ranks: [1, 5, 10, 25, 50, 75, 100]
        },
        {
          id: 'CUTOFF_002',
          college_id: 'MED0002',
          college_name: 'AARUPADAI VEEDU MEDICAL COLLEGE',
          college_type: 'Medical',
          stream: 'Medical',
          state_id: 'PUD001',
          state_name: 'Puducherry',
          course_id: 'CRS0002',
          course_name: 'BDS',
          year: 2024,
          level: 'UG',
          counselling_body: 'AIQ',
          round: 1,
          quota_id: 'QUOTA001',
          quota_name: 'All India',
          category_id: 'CAT001',
          category_name: 'General',
          opening_rank: 101,
          closing_rank: 200,
          total_seats: 30,
          ranks: [101, 120, 150, 180, 200]
        }
      ];

      // Apply filters
      let filteredData = mockCutoffs;
      
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
    } catch (error) {
      console.error('Error loading cutoff data:', error);
      return [];
    }
  }

  private async loadMasterData(): Promise<MasterData> {
    try {
      // For now, return mock data with proper ID structure
      // In production, this would query the master_data.db
      const mockMasterData: MasterData = {
        states: [
          { id: 'KAR001', name: 'Karnataka' },
          { id: 'PUD001', name: 'Puducherry' },
          { id: 'CHG001', name: 'Chattisgarh' },
          { id: 'ORI001', name: 'Orissa' },
          { id: 'JAM001', name: 'Jammu and Kashmir' }
        ],
        categories: [
          { id: 'CAT001', name: 'General' },
          { id: 'CAT002', name: 'OBC' },
          { id: 'CAT003', name: 'SC' },
          { id: 'CAT004', name: 'ST' },
          { id: 'CAT005', name: 'EWS' }
        ],
        quotas: [
          { id: 'QUOTA001', name: 'All India' },
          { id: 'QUOTA002', name: 'State' },
          { id: 'QUOTA003', name: 'Management' }
        ],
        courses: [
          { id: 'CRS0001', name: 'ALL PG COURSES', code: 'ALL_PG', stream: 'Medical', branch: 'All', degree_type: 'PG', duration_years: 3 },
          { id: 'CRS0002', name: 'BDS', code: 'BDS', stream: 'Dental', branch: 'Dental', degree_type: 'UG', duration_years: 4 },
          { id: 'CRS0003', name: 'DIPLOMA IN ANAESTHESIOLOGY', code: 'DIP_ANAE', stream: 'Medical', branch: 'Anaesthesiology', degree_type: 'Diploma', duration_years: 2 },
          { id: 'CRS0004', name: 'DIPLOMA IN BACTERIOLOGY', code: 'DIP_BACT', stream: 'Medical', branch: 'Microbiology', degree_type: 'Diploma', duration_years: 2 },
          { id: 'CRS0005', name: 'DIPLOMA IN CHILD HEALTH/ PAEDIATRICS', code: 'DIP_PAED', stream: 'Medical', branch: 'Paediatrics', degree_type: 'Diploma', duration_years: 2 }
        ],
        colleges: [
          { id: 'MED0001', name: 'A J INSTITUTE OF MEDICAL SCIENCES AND RESEARCH CENTRE', state: 'Karnataka', city: 'Bangalore', type: 'Medical', management: 'Private', university_affiliation: 'Rajiv Gandhi University', website: 'https://ajims.edu.in', address: 'Bangalore, Karnataka', established_year: 2015, recognition: 'MCI' },
          { id: 'MED0002', name: 'AARUPADAI VEEDU MEDICAL COLLEGE', state: 'Puducherry', city: 'Puducherry', type: 'Medical', management: 'Private', university_affiliation: 'Pondicherry University', website: 'https://avmc.edu.in', address: 'Puducherry', established_year: 2010, recognition: 'MCI' },
          { id: 'MED0003', name: 'ABHISHEK I MISHRA MEMORIAL MEDICAL COLLEGE AND RESEARCH', state: 'Chattisgarh', city: 'Raipur', type: 'Medical', management: 'Private', university_affiliation: 'Pt. Deendayal Upadhyay Memorial Health Sciences University', website: 'https://aimmcr.edu.in', address: 'Raipur, Chattisgarh', established_year: 2018, recognition: 'MCI' },
          { id: 'MED0004', name: 'ACHARYA HARIHAR REGIONAL CANCER CENTRE', state: 'Orissa', city: 'Cuttack', type: 'Medical', management: 'Government', university_affiliation: 'Utkal University', website: 'https://ahrc.edu.in', address: 'Cuttack, Orissa', established_year: 2005, recognition: 'MCI' },
          { id: 'MED0005', name: 'ACHARYA SHRI CHANDER COLLEGE OF MEDICAL SCIENCES', state: 'Jammu and Kashmir', city: 'Jammu', type: 'Medical', management: 'Private', university_affiliation: 'University of Jammu', website: 'https://ascms.edu.in', address: 'Jammu, J&K', established_year: 2012, recognition: 'MCI' }
        ]
      };

      return mockMasterData;
    } catch (error) {
      console.error('Error loading master data:', error);
      return {
        states: [],
        categories: [],
        quotas: [],
        courses: [],
        colleges: []
      };
    }
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

  // Search functionality using Supabase
  async searchCutoffs(query: string, limit: number = 10): Promise<CutoffRecord[]> {
    try {
      // Simple search - could be enhanced with full-text search
      const filters = { limit };
      const result = await supabaseDataService.searchCutoffs(filters);

      // Filter results by query
      const filtered = result.data.filter((cutoff: any) =>
        cutoff.college_name?.toLowerCase().includes(query.toLowerCase()) ||
        cutoff.course_name?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, limit);

      // Map to expected format
      return filtered.map((cutoff: any) => ({
        id: cutoff.id,
        college_id: cutoff.college_id,
        college_name: cutoff.college_name || '',
        college_type: cutoff.college_type || 'Medical',
        stream: cutoff.stream || 'Medical',
        state_id: cutoff.state || '',
        state_name: cutoff.state || '',
        course_id: cutoff.course_id,
        course_name: cutoff.course_name || '',
        year: cutoff.year,
        level: cutoff.level || 'UG',
        counselling_body: cutoff.source || 'AIQ',
        round: cutoff.round,
        quota_id: cutoff.quota || '',
        quota_name: cutoff.quota || '',
        category_id: cutoff.category || '',
        category_name: cutoff.category || '',
        opening_rank: cutoff.opening_rank,
        closing_rank: cutoff.closing_rank,
        total_seats: cutoff.total_seats || 0,
        ranks: []
      }));
    } catch (error) {
      console.error('Error searching cutoffs:', error);
      return [];
    }
  }

  // Cleanup
  cleanup(): void {
    this.cache.clear();
    this.initialized = false;
    console.log('EdgeDataService cleaned up');
  }
}

// Export singleton instance
export const edgeDataService = new EdgeDataService({
  dataPath: '/data/sqlite',
  cacheSize: 1000,
});

export default edgeDataService;
