/**
 * ID-Based Data Resolution Service
 *
 * Handles linking between:
 * - Master Data (source of truth for display names)
 * - Seat Data (capacity information)
 * - Counselling Data (actual cutoffs)
 *
 * Example:
 * Master Data: { college_id: "DNB1185", college_name: "MAL SUPER SPECIALITY HOSPITAL" }
 * Counselling Data: { college_id: "DNB1185", college_name: "MAL SSH", closing_rank: 450 }
 * Result: Display "MAL SUPER SPECIALITY HOSPITAL" with closing_rank 450
 */

import { ParquetDataService } from '@/lib/database/parquet-service';
import { StreamType, shouldShowForStream } from '@/contexts/StreamContext';

export interface MasterCollege {
  college_id: string;
  college_name: string;
  college_type: string;
  stream: string;
  state_id: string;
  state_name: string;
  city?: string;
  district?: string;
  established_year?: number;
  ownership?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
}

export interface MasterCourse {
  course_id: string;
  course_name: string;
  course_code: string;
  level: string;
  stream: string;
  duration_years?: number;
  degree_type?: string;
}

export interface SeatData {
  college_id: string;
  course_id: string;
  category_id: string;
  quota_id: string;
  year: number;
  total_seats: number;
  reserved_seats?: number;
}

export interface CounsellingData {
  college_id: string;
  course_id: string;
  category_id: string;
  quota_id: string;
  year: number;
  round: number;
  opening_rank?: number;
  closing_rank?: number;
  seats_filled?: number;
}

export interface EnrichedCutoffData extends CounsellingData {
  // Master data fields (for display)
  college_name: string;
  college_type: string;
  state_name: string;
  city?: string;
  course_name: string;
  course_code: string;
  level: string;

  // Seat data fields (for context)
  total_seats?: number;
  reserved_seats?: number;

  // Computed fields
  seat_utilization?: number; // seats_filled / total_seats
}

export class IdBasedDataService {
  private parquetService: ParquetDataService;
  private masterCollegesCache: Map<string, MasterCollege> = new Map();
  private masterCoursesCache: Map<string, MasterCourse> = new Map();
  private cacheExpiry: number = 3600000; // 1 hour
  private lastCacheTime: number = 0;

  constructor() {
    this.parquetService = new ParquetDataService();
  }

  /**
   * Load master data into memory cache
   * This should be called once at startup or when master data changes
   */
  async loadMasterData(): Promise<void> {
    const now = Date.now();

    // Skip if cache is still valid
    if (now - this.lastCacheTime < this.cacheExpiry) {
      return;
    }

    console.log('Loading master data into cache...');

    try {
      // Load master colleges
      const colleges = await this.parquetService.queryMasterColleges();
      this.masterCollegesCache.clear();

      for (const college of colleges) {
        this.masterCollegesCache.set(college.college_id, college);
      }

      // Load master courses
      const courses = await this.parquetService.queryMasterCourses();
      this.masterCoursesCache.clear();

      for (const course of courses) {
        this.masterCoursesCache.set(course.course_id, course);
      }

      this.lastCacheTime = now;

      console.log(
        `Master data loaded: ${this.masterCollegesCache.size} colleges, ${this.masterCoursesCache.size} courses`
      );
    } catch (error) {
      console.error('Failed to load master data:', error);
      throw error;
    }
  }

  /**
   * Get enriched cutoff data with master data names
   * Automatically filters by selected stream (unless isDeveloper is true)
   */
  async getEnrichedCutoffs(params: {
    stream: string;
    year: number;
    round: number;
    selectedStream?: StreamType | null; // User's selected stream for filtering
    isDeveloper?: boolean; // Developer accounts bypass filtering
    filters?: {
      college_id?: string;
      course_id?: string;
      category_id?: string;
      quota_id?: string;
      state_id?: string;
      rank?: { min?: number; max?: number };
    };
  }): Promise<EnrichedCutoffData[]> {
    // Ensure master data is loaded
    await this.loadMasterData();

    // Fetch counselling data
    const counsellingData = await this.parquetService.queryCutoffs(params);

    // Fetch seat data (optional, for additional context)
    const seatData = await this.getSeatData(params.stream, params.year);
    const seatDataMap = new Map(
      seatData.map(s => [`${s.college_id}:${s.course_id}:${s.category_id}:${s.quota_id}`, s])
    );

    // Enrich counselling data with master data
    const enrichedData: EnrichedCutoffData[] = counsellingData.map(cutoff => {
      const college = this.masterCollegesCache.get(cutoff.college_id);
      const course = this.masterCoursesCache.get(cutoff.course_id);
      const seat = seatDataMap.get(
        `${cutoff.college_id}:${cutoff.course_id}:${cutoff.category_id}:${cutoff.quota_id}`
      );

      // Calculate seat utilization
      const seat_utilization = seat && seat.total_seats && cutoff.seats_filled
        ? (cutoff.seats_filled / seat.total_seats) * 100
        : undefined;

      return {
        ...cutoff,

        // Master data (for display)
        college_name: college?.college_name || `Unknown (${cutoff.college_id})`,
        college_type: college?.college_type || 'Unknown',
        state_name: college?.state_name || 'Unknown',
        city: college?.city,
        course_name: course?.course_name || `Unknown (${cutoff.course_id})`,
        course_code: course?.course_code || cutoff.course_id,
        level: course?.level || 'Unknown',

        // Seat data (for context)
        total_seats: seat?.total_seats,
        reserved_seats: seat?.reserved_seats,

        // Computed fields
        seat_utilization
      };
    });

    // Filter by selected stream if provided (skip for developers)
    if (params.selectedStream && !params.isDeveloper) {
      return enrichedData.filter(item => {
        const college = this.masterCollegesCache.get(item.college_id);
        return college && shouldShowForStream(college.stream, params.selectedStream);
      });
    }

    // Developers see all data without filtering
    return enrichedData;
  }

  /**
   * Get college details with linked data
   */
  async getCollegeDetails(college_id: string): Promise<{
    master: MasterCollege;
    seatData: SeatData[];
    cutoffHistory: CounsellingData[];
  } | null> {
    await this.loadMasterData();

    const master = this.masterCollegesCache.get(college_id);
    if (!master) {
      return null;
    }

    // Get all seat data for this college
    const seatData = await this.parquetService.querySeatData({
      college_id
    });

    // Get cutoff history for this college (last 3 years)
    const currentYear = new Date().getFullYear();
    const cutoffHistory = await this.parquetService.queryCutoffs({
      stream: master.stream,
      year: currentYear,
      round: 1,
      filters: { college_id }
    });

    return {
      master,
      seatData,
      cutoffHistory
    };
  }

  /**
   * Get course details with linked data
   */
  async getCourseDetails(course_id: string): Promise<{
    master: MasterCourse;
    seatData: SeatData[];
    cutoffHistory: CounsellingData[];
  } | null> {
    await this.loadMasterData();

    const master = this.masterCoursesCache.get(course_id);
    if (!master) {
      return null;
    }

    // Get all seat data for this course
    const seatData = await this.parquetService.querySeatData({
      course_id
    });

    // Get cutoff history for this course
    const currentYear = new Date().getFullYear();
    const cutoffHistory = await this.parquetService.queryCutoffs({
      stream: master.stream,
      year: currentYear,
      round: 1,
      filters: { course_id }
    });

    return {
      master,
      seatData,
      cutoffHistory
    };
  }

  /**
   * Compare colleges using ID-based data
   */
  async compareColleges(college_ids: string[]): Promise<{
    colleges: Array<{
      master: MasterCollege;
      cutoffs: EnrichedCutoffData[];
      avgClosingRank: number;
      totalSeats: number;
    }>;
  }> {
    await this.loadMasterData();

    const currentYear = new Date().getFullYear();
    const colleges = [];

    for (const college_id of college_ids) {
      const master = this.masterCollegesCache.get(college_id);
      if (!master) continue;

      // Get cutoffs for this college
      const cutoffs = await this.getEnrichedCutoffs({
        stream: master.stream,
        year: currentYear,
        round: 1,
        filters: { college_id }
      });

      // Calculate average closing rank
      const validRanks = cutoffs
        .map(c => c.closing_rank)
        .filter((r): r is number => r !== undefined && r !== null);

      const avgClosingRank = validRanks.length > 0
        ? validRanks.reduce((sum, rank) => sum + rank, 0) / validRanks.length
        : 0;

      // Calculate total seats
      const totalSeats = cutoffs.reduce(
        (sum, c) => sum + (c.total_seats || 0),
        0
      );

      colleges.push({
        master,
        cutoffs,
        avgClosingRank,
        totalSeats
      });
    }

    return { colleges };
  }

  /**
   * Get trend data for a college over multiple years
   */
  async getCollegeTrends(
    college_id: string,
    years: number[]
  ): Promise<{
    college: MasterCollege;
    trends: Array<{
      year: number;
      avgClosingRank: number;
      totalSeats: number;
      courses: number;
    }>;
  } | null> {
    await this.loadMasterData();

    const college = this.masterCollegesCache.get(college_id);
    if (!college) return null;

    const trends = [];

    for (const year of years) {
      const cutoffs = await this.getEnrichedCutoffs({
        stream: college.stream,
        year,
        round: 1,
        filters: { college_id }
      });

      const validRanks = cutoffs
        .map(c => c.closing_rank)
        .filter((r): r is number => r !== undefined && r !== null);

      const avgClosingRank = validRanks.length > 0
        ? validRanks.reduce((sum, rank) => sum + rank, 0) / validRanks.length
        : 0;

      const totalSeats = cutoffs.reduce(
        (sum, c) => sum + (c.total_seats || 0),
        0
      );

      trends.push({
        year,
        avgClosingRank,
        totalSeats,
        courses: new Set(cutoffs.map(c => c.course_id)).size
      });
    }

    return {
      college,
      trends: trends.sort((a, b) => a.year - b.year)
    };
  }

  /**
   * Search colleges by name and return master data
   */
  async searchColleges(query: string, stream?: string): Promise<MasterCollege[]> {
    await this.loadMasterData();

    const queryLower = query.toLowerCase();
    const results: MasterCollege[] = [];

    for (const college of this.masterCollegesCache.values()) {
      if (stream && college.stream !== stream) continue;

      const nameLower = college.college_name.toLowerCase();
      if (
        nameLower.includes(queryLower) ||
        college.college_id.toLowerCase().includes(queryLower) ||
        college.city?.toLowerCase().includes(queryLower) ||
        college.state_name.toLowerCase().includes(queryLower)
      ) {
        results.push(college);
      }
    }

    return results;
  }

  /**
   * Get seat data for a specific year
   */
  private async getSeatData(stream: string, year: number): Promise<SeatData[]> {
    return this.parquetService.querySeatData({
      stream,
      year
    });
  }

  /**
   * Clear cache (useful when master data is updated)
   */
  clearCache(): void {
    this.masterCollegesCache.clear();
    this.masterCoursesCache.clear();
    this.lastCacheTime = 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      colleges: this.masterCollegesCache.size,
      courses: this.masterCoursesCache.size,
      lastUpdated: new Date(this.lastCacheTime).toISOString(),
      cacheAge: Date.now() - this.lastCacheTime
    };
  }
}

// Singleton instance
let idBasedDataService: IdBasedDataService | null = null;

export function getIdBasedDataService(): IdBasedDataService {
  if (!idBasedDataService) {
    idBasedDataService = new IdBasedDataService();
  }
  return idBasedDataService;
}
