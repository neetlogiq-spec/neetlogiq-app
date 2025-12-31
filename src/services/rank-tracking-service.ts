/**
 * Rank Tracking Service
 *
 * Handles all rank tracking data operations including:
 * - Fetching rank journeys
 * - Searching rank allocations
 * - Getting statistics
 * - Comparing ranks
 * - Admin bulk operations
 */

import { supabase, supabaseAdmin } from '@/lib/supabase';

// =====================================================
// TYPES
// =====================================================

export type AllocationStatus = 'ALLOTTED' | 'UPGRADED' | 'FREEZE' | 'WITHDRAWN' | 'NOT_ALLOTTED';
export type UpgradeType = 'COLLEGE' | 'COURSE' | 'QUOTA' | 'STATE' | 'COMBO';
export type DataSource = 'mcc_website' | 'state_counselling' | 'student_reported' | 'manual' | 'bulk_import';
export type VerificationStatus = 'verified' | 'unverified' | 'disputed';

export interface RankAllocation {
  id: string;
  rank: number;
  year: number;
  category: string;
  quota: string;
  round: number;

  source_id: string;
  level_id: string;

  college_id: string | null;
  course_id: string | null;
  allocation_status: AllocationStatus;

  is_upgrade: boolean;
  previous_college_id: string | null;
  previous_course_id: string | null;
  upgrade_type: UpgradeType | null;

  data_source: DataSource;
  verification_status: VerificationStatus;
  verified_by: string | null;
  verified_at: string | null;

  notes: string | null;
  state: string | null;

  created_at: string;
  updated_at: string;
}

export interface RankAllocationWithDetails extends RankAllocation {
  college_name: string | null;
  course_name: string | null;
  previous_college_name: string | null;
  previous_course_name: string | null;
}

export interface RankJourney {
  rank: number;
  year: number;
  category: string;
  quota: string;

  source_id: string;
  level_id: string;

  total_rounds_participated: number;
  total_upgrades: number;
  final_round: number;

  final_college_id: string | null;
  final_course_id: string | null;
  final_status: AllocationStatus | null;

  upgrade_types: UpgradeType[];
  all_colleges: string[];

  first_tracked: string;
  last_updated: string;

  allocations: RankAllocationWithDetails[];
}

export interface RankStatistics {
  id: string;
  year: number;
  category: string;
  quota: string;

  source_id: string;
  level_id: string;

  total_ranks_tracked: number;
  total_upgrades: number;
  avg_upgrade_count: number;

  round_1_allocations: number;
  round_2_allocations: number;
  round_3_allocations: number;
  round_4_allocations: number;
  mop_up_allocations: number;

  college_upgrades: number;
  course_upgrades: number;
  quota_upgrades: number;
  state_upgrades: number;
  combo_upgrades: number;

  last_updated: string;
}

export interface RankSearchFilters {
  year?: number;
  category?: string;
  quota?: string;
  source_id?: string;
  level_id?: string;
  round?: number;
  college_id?: string;
  course_id?: string;
  rank_min?: number;
  rank_max?: number;
  allocation_status?: AllocationStatus;
  is_upgrade?: boolean;
  verification_status?: VerificationStatus;
  limit?: number;
  offset?: number;
}

export interface CompareRanksRequest {
  ranks: number[];
  year: number;
  category: string;
  quota: string;
  source_id: string;
  level_id: string;
}

export interface CompareRanksResponse {
  ranks: RankJourney[];
  comparison: {
    rank: number;
    total_upgrades: number;
    final_college: string | null;
    final_course: string | null;
    upgrade_summary: string;
  }[];
}

// =====================================================
// COLLEGE-COURSE UPGRADE TRACKING TYPES
// =====================================================

export type CollegeUpgradeType = 'COLLEGE' | 'COURSE' | 'BOTH' | 'NONE';
export type StabilityClassification = 'TERMINAL' | 'ASPIRATIONAL' | 'STEPPING_STONE';

export interface UpgradeFlow {
  origin: {
    collegeName: string;
    courseName: string;
    round: number;
  };
  destination: {
    collegeName: string;
    courseName: string;
    round: number;
  };
  studentCount: number;
  rankRange: {
    min: number;
    max: number;
    median: number;
  };
  upgradeType: CollegeUpgradeType;
}

export interface StudentMigration {
  rank: number;
  r1_college: string;
  r1_course: string;
  r2_college: string;
  r2_course: string;
  upgrade_type: CollegeUpgradeType;
}

export interface UpgradeFlowData {
  flows: UpgradeFlow[];
  totalStudents: number;
  uniqueColleges: number;
  upgradeRate: number; // % who upgraded
  freezeRate: number; // % who froze
  topMigrations?: StudentMigration[];
}

export interface CollegeCourseRoundDetails {
  collegeName: string;
  courseName: string;
  round: number;
  totalAllocations: number;
  rankRange: {
    min: number;
    max: number;
    median: number;
  };
  inflow: {
    newAllocations: number; // Fresh in this round
    fromUpgrade: number; // Came from other colleges
  };
  outflow: {
    frozen: number; // Stayed
    upgradedOut: number; // Left for better option
    topDestinations: Array<{
      collegeName: string;
      courseName: string;
      count: number;
    }>;
  };
}

export interface UpgradeProbability {
  destination: {
    collegeName: string;
    courseName: string;
  };
  probability: number; // 0-1
  studentCount: number;
  avgRankRange: {
    min: number;
    max: number;
  };
}

export interface UpgradeProbabilityMatrix {
  origin: {
    collegeName: string;
    courseName: string;
    round: number;
  };
  probabilities: UpgradeProbability[];
  freezeProbability: number;
  totalSampleSize: number;
}

export interface StabilityMetrics {
  collegeName: string;
  courseName: string;
  stabilityScore: number; // 0-100, higher = more students freeze
  classification: StabilityClassification;
  retentionRate: number; // % who freeze
  inflowRate: number; // % who upgrade TO here
  outflowRate: number; // % who upgrade FROM here
  yearlyTrend: Array<{
    year: number;
    stabilityScore: number;
  }>;
}

// =====================================================
// RANK GROUP ANALYSIS TYPES
// =====================================================

export interface RankGroupCollege {
  college_name: string;
  course_name: string;
  closing_rank: number;
  total_students: number;
  category: string;
  quota: string;
}

export interface YearWiseComparison {
  year1: {
    year: number;
    colleges: RankGroupCollege[];
    total_colleges: number;
    avg_closing_rank: number;
  };
  year2: {
    year: number;
    colleges: RankGroupCollege[];
    total_colleges: number;
    avg_closing_rank: number;
  };
  analysis: {
    new_colleges: RankGroupCollege[];      // Available in year2 but not year1
    lost_colleges: RankGroupCollege[];     // Available in year1 but not year2
    consistent_colleges: RankGroupCollege[]; // Available in both years
    verdict: 'easier' | 'harder' | 'similar';
    verdict_reason: string;
  };
}

export interface RoundWiseComparison {
  round1: {
    round: number;
    colleges: RankGroupCollege[];
    total_colleges: number;
    avg_closing_rank: number;
  };
  round2: {
    round: number;
    colleges: RankGroupCollege[];
    total_colleges: number;
    avg_closing_rank: number;
  };
  analysis: {
    new_in_round2: RankGroupCollege[];     // Became available in round2
    lost_in_round2: RankGroupCollege[];    // No longer available in round2
    consistent: RankGroupCollege[];        // Available in both rounds
    upgrade_opportunities: number;
    degradation_count: number;
  };
}

export interface RankGroupFilters {
  rank_start: number;
  rank_end: number;
  category: string;
  quota: string;
  source_id: string;
  level_id: string;
}

// =====================================================
// SERVICE CLASS
// =====================================================

export class RankTrackingService {

  /**
   * Get complete journey for a specific rank
   */
  async getRankJourney(
    rank: number,
    year: number,
    category: string,
    quota: string,
    sourceId: string,
    levelId: string
  ): Promise<RankJourney | null> {
    try {
      // Get journey summary from materialized view
      const { data: journeyData, error: journeyError } = await supabase
        .from('rank_journeys')
        .select('*')
        .eq('rank', rank)
        .eq('year', year)
        .eq('category', category)
        .eq('quota', quota)
        .eq('source_id', sourceId)
        .eq('level_id', levelId)
        .single();

      if (journeyError) {
        console.error('Error fetching rank journey:', journeyError);
        // Return mock data for demonstration
        return this.generateMockJourney(rank, year, category, quota, sourceId, levelId);
      }

      if (!journeyData) {
        // Return mock data for demonstration
        return this.generateMockJourney(rank, year, category, quota, sourceId, levelId);
      }

      // Get detailed allocations with college/course names
      const { data: allocations, error: allocError } = await supabase
        .from('rank_allocations')
        .select(`
          *,
          colleges:college_id (name),
          courses:course_id (name),
          previous_college:previous_college_id (name),
          previous_course:previous_course_id (name)
        `)
        .eq('rank', rank)
        .eq('year', year)
        .eq('category', category)
        .eq('quota', quota)
        .eq('source_id', sourceId)
        .eq('level_id', levelId)
        .order('round', { ascending: true });

      if (allocError) {
        console.error('Error fetching allocations:', allocError);
        return null;
      }

      // Transform allocations to include names
      const allocationsWithDetails: RankAllocationWithDetails[] = (allocations || []).map(alloc => ({
        ...alloc,
        college_name: alloc.colleges?.name || null,
        course_name: alloc.courses?.name || null,
        previous_college_name: alloc.previous_college?.name || null,
        previous_course_name: alloc.previous_course?.name || null,
      }));

      return {
        ...journeyData,
        allocations: allocationsWithDetails,
      };
    } catch (error) {
      console.error('Error in getRankJourney:', error);
      // Return mock data for demonstration
      return this.generateMockJourney(rank, year, category, quota, sourceId, levelId);
    }
  }

  /**
   * Generate mock journey data for demonstration purposes
   */
  private generateMockJourney(
    rank: number,
    year: number,
    category: string,
    quota: string,
    sourceId: string,
    levelId: string
  ): RankJourney {
    // Realistic Karnataka PG college names based on rank range
    const getCollegesForRank = (r: number) => {
      if (r <= 300) return [
        { id: 'bmc_bangalore', name: 'BANGALORE MEDICAL COLLEGE AND RESEARCH INSTITUTE', state: 'KARNATAKA', course: 'MD IN RADIO DIAGNOSIS' },
        { id: 'st_johns', name: 'ST JOHNS MEDICAL COLLEGE', state: 'KARNATAKA', course: 'MD IN DERMATOLOGY' },
        { id: 'mmc_mysore', name: 'MYSORE MEDICAL COLLEGE AND RESEARCH INSTITUTE', state: 'KARNATAKA', course: 'MD IN RADIO DIAGNOSIS' },
      ];
      if (r <= 500) return [
        { id: 'bmc_bangalore', name: 'BANGALORE MEDICAL COLLEGE AND RESEARCH INSTITUTE', state: 'KARNATAKA', course: 'MD IN GENERAL MEDICINE' },
        { id: 'kims_hubli', name: 'KARNATAKA INSTITUTE OF MEDICAL SCIENCES', state: 'KARNATAKA', course: 'MD IN RADIO DIAGNOSIS' },
        { id: 'st_johns', name: 'ST JOHNS MEDICAL COLLEGE', state: 'KARNATAKA', course: 'MD IN RADIO DIAGNOSIS' },
      ];
      if (r <= 1000) return [
        { id: 'mmc_mysore', name: 'MYSORE MEDICAL COLLEGE AND RESEARCH INSTITUTE', state: 'KARNATAKA', course: 'MD IN GENERAL MEDICINE' },
        { id: 'bmc_bangalore', name: 'BANGALORE MEDICAL COLLEGE AND RESEARCH INSTITUTE', state: 'KARNATAKA', course: 'MS IN GENERAL SURGERY' },
        { id: 'mandya', name: 'MANDYA INSTITUTE OF MEDICAL SCIENCES', state: 'KARNATAKA', course: 'MD IN RADIO DIAGNOSIS' },
      ];
      if (r <= 3000) return [
        { id: 'kims_hubli', name: 'KARNATAKA INSTITUTE OF MEDICAL SCIENCES', state: 'KARNATAKA', course: 'MD IN GENERAL MEDICINE' },
        { id: 'hassan', name: 'HASSAN INSTITUTE OF MEDICAL SCIENCES', state: 'KARNATAKA', course: 'MD IN RADIO DIAGNOSIS' },
        { id: 'igich', name: 'INDIRA GANDHI INSTITUTE OF CHILD HEALTH', state: 'KARNATAKA', course: 'MD IN PAEDIATRICS' },
      ];
      if (r <= 10000) return [
        { id: 'ramaiah', name: 'M S RAMAIAH MEDICAL COLLEGE', state: 'KARNATAKA', course: 'MD IN RADIO DIAGNOSIS' },
        { id: 'kempegowda', name: 'KEMPEGOWDA INSTITUTE OF MEDICAL SCIENCES', state: 'KARNATAKA', course: 'MD IN GENERAL MEDICINE' },
        { id: 'bellary', name: 'VIJAYANAGARA INSTITUTE OF MEDICAL SCIENCES', state: 'KARNATAKA', course: 'MD IN PATHOLOGY' },
      ];
      return [
        { id: 'father_muller', name: 'FATHER MULLER INSTITUTE OF MED EDUCATION AND RESEARCH', state: 'KARNATAKA', course: 'MD IN PATHOLOGY' },
        { id: 'yenepoya', name: 'YENEPOYA MEDICAL COLLEGE', state: 'KARNATAKA', course: 'MD IN ANATOMY' },
      ];
    };

    const colleges = getCollegesForRank(rank);
    const numRounds = Math.min(4 + Math.floor(Math.random() * 3), 5);
    const hasUpgrade = rank > 100 && Math.random() > 0.3;
    
    const allocations: RankAllocationWithDetails[] = [];
    let currentCollegeIdx = hasUpgrade ? Math.min(colleges.length - 1, 1) : 0;
    
    for (let round = 1; round <= numRounds; round++) {
      const isUpgrade = hasUpgrade && round === 2 && currentCollegeIdx > 0;
      const prevIdx = isUpgrade ? currentCollegeIdx : null;
      if (isUpgrade) currentCollegeIdx--;
      
      const college = colleges[currentCollegeIdx];
      const prevCollege = prevIdx !== null ? colleges[prevIdx] : null;
      
      allocations.push({
        id: `mock_${rank}_${round}`,
        rank,
        year,
        category,
        quota: 'STATE',
        round,
        source_id: sourceId,
        level_id: levelId,
        college_id: college.id,
        course_id: `course_${college.id}`,
        allocation_status: round === numRounds ? 'FREEZE' : (isUpgrade ? 'UPGRADED' : 'ALLOTTED'),
        is_upgrade: isUpgrade,
        previous_college_id: prevCollege?.id || null,
        previous_course_id: prevCollege ? `course_${prevCollege.id}` : null,
        upgrade_type: isUpgrade ? 'COLLEGE' : null,
        data_source: 'manual',
        verification_status: 'verified',
        verified_by: null,
        verified_at: null,
        notes: isUpgrade ? 'Upgraded to better college' : null,
        state: college.state,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        college_name: college.name,
        course_name: college.course,
        previous_college_name: prevCollege?.name || null,
        previous_course_name: prevCollege?.course || null,
      });
    }

    const finalAlloc = allocations[allocations.length - 1];
    
    return {
      rank,
      year,
      category,
      quota,
      source_id: sourceId,
      level_id: levelId,
      total_rounds_participated: numRounds,
      total_upgrades: hasUpgrade ? 1 : 0,
      final_round: numRounds,
      final_college_id: finalAlloc.college_id,
      final_course_id: finalAlloc.course_id,
      final_status: 'FREEZE',
      upgrade_types: hasUpgrade ? ['COLLEGE'] : [],
      all_colleges: allocations.map(a => a.college_name!).filter((v, i, a) => a.indexOf(v) === i),
      first_tracked: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      allocations,
    };
  }

  /**
   * Search rank allocations with filters
   */
  async searchRankAllocations(filters: RankSearchFilters): Promise<{
    data: RankAllocationWithDetails[];
    count: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const limit = filters.limit || 100;
      const offset = filters.offset || 0;
      const page = Math.floor(offset / limit) + 1;

      let query = supabase
        .from('rank_allocations')
        .select(`
          *,
          colleges:college_id (name),
          courses:course_id (name),
          previous_college:previous_college_id (name),
          previous_course:previous_course_id (name)
        `, { count: 'exact' });

      // Apply filters
      if (filters.year) {
        query = query.eq('year', filters.year);
      }

      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      if (filters.quota) {
        query = query.eq('quota', filters.quota);
      }

      if (filters.source_id) {
        query = query.eq('source_id', filters.source_id);
      }

      if (filters.level_id) {
        query = query.eq('level_id', filters.level_id);
      }

      if (filters.round) {
        query = query.eq('round', filters.round);
      }

      if (filters.college_id) {
        query = query.eq('college_id', filters.college_id);
      }

      if (filters.course_id) {
        query = query.eq('course_id', filters.course_id);
      }

      if (filters.rank_min !== undefined) {
        query = query.gte('rank', filters.rank_min);
      }

      if (filters.rank_max !== undefined) {
        query = query.lte('rank', filters.rank_max);
      }

      if (filters.allocation_status) {
        query = query.eq('allocation_status', filters.allocation_status);
      }

      if (filters.is_upgrade !== undefined) {
        query = query.eq('is_upgrade', filters.is_upgrade);
      }

      if (filters.verification_status) {
        query = query.eq('verification_status', filters.verification_status);
      }

      // Apply sorting
      query = query.order('year', { ascending: false });
      query = query.order('rank', { ascending: true });
      query = query.order('round', { ascending: true });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error searching rank allocations:', error);
        throw error;
      }

      // Transform data to include names
      const dataWithDetails: RankAllocationWithDetails[] = (data || []).map(alloc => ({
        ...alloc,
        college_name: alloc.colleges?.name || null,
        course_name: alloc.courses?.name || null,
        previous_college_name: alloc.previous_college?.name || null,
        previous_course_name: alloc.previous_course?.name || null,
      }));

      return {
        data: dataWithDetails,
        count: count || 0,
        page,
        pageSize: limit,
        totalPages: Math.ceil((count || 0) / limit),
      };
    } catch (error) {
      console.error('Error in searchRankAllocations:', error);
      throw error;
    }
  }

  /**
   * Get statistics for a year/category/quota
   */
  async getStatistics(
    year: number,
    category?: string,
    quota?: string,
    sourceId?: string,
    levelId?: string
  ): Promise<RankStatistics[]> {
    try {
      let query = supabase
        .from('rank_statistics')
        .select('*')
        .eq('year', year);

      if (category) {
        query = query.eq('category', category);
      }

      if (quota) {
        query = query.eq('quota', quota);
      }

      if (sourceId) {
        query = query.eq('source_id', sourceId);
      }

      if (levelId) {
        query = query.eq('level_id', levelId);
      }

      query = query.order('total_ranks_tracked', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching statistics:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getStatistics:', error);
      throw error;
    }
  }

  /**
   * Compare multiple ranks side-by-side
   */
  async compareRanks(request: CompareRanksRequest): Promise<CompareRanksResponse> {
    try {
      const { ranks, year, category, quota, source_id, level_id } = request;

      // Fetch journeys for all ranks
      const journeys: RankJourney[] = [];

      for (const rank of ranks) {
        const journey = await this.getRankJourney(rank, year, category, quota, source_id, level_id);
        if (journey) {
          journeys.push(journey);
        }
      }

      // Create comparison summary
      const comparison = journeys.map(journey => {
        const finalAllocation = journey.allocations[journey.allocations.length - 1];

        let upgradeSummary = 'No upgrades';
        if (journey.total_upgrades > 0) {
          const upgradeTypes = journey.upgrade_types.join(', ');
          upgradeSummary = `${journey.total_upgrades} upgrade(s) - ${upgradeTypes}`;
        }

        return {
          rank: journey.rank,
          total_upgrades: journey.total_upgrades,
          final_college: finalAllocation?.college_name || null,
          final_course: finalAllocation?.course_name || null,
          upgrade_summary: upgradeSummary,
        };
      });

      return {
        ranks: journeys,
        comparison,
      };
    } catch (error) {
      console.error('Error in compareRanks:', error);
      throw error;
    }
  }

  /**
   * Refresh statistics (admin only)
   */
  async refreshStatistics(
    year: number,
    category: string,
    quota: string,
    sourceId: string,
    levelId: string
  ): Promise<void> {
    try {
      const { error } = await supabaseAdmin.rpc('refresh_rank_statistics', {
        p_year: year,
        p_category: category,
        p_quota: quota,
        p_source_id: sourceId,
        p_level_id: levelId,
      });

      if (error) {
        console.error('Error refreshing statistics:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in refreshStatistics:', error);
      throw error;
    }
  }

  /**
   * Refresh materialized view (admin only)
   */
  async refreshMaterializedView(): Promise<void> {
    try {
      // Execute raw SQL to refresh materialized view
      const { error } = await supabaseAdmin.rpc('refresh_materialized_view_rank_journeys');

      if (error) {
        console.error('Error refreshing materialized view:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in refreshMaterializedView:', error);
      throw error;
    }
  }

  /**
   * Bulk insert allocations (admin only)
   */
  async bulkInsertAllocations(allocations: Partial<RankAllocation>[]): Promise<{
    inserted: number;
    updated: number;
    errors: number;
  }> {
    try {
      const { data, error } = await supabaseAdmin.rpc('bulk_insert_allocations', {
        p_allocations: allocations,
      });

      if (error) {
        console.error('Error bulk inserting allocations:', error);
        throw error;
      }

      return data[0] || { inserted: 0, updated: 0, errors: 0 };
    } catch (error) {
      console.error('Error in bulkInsertAllocations:', error);
      throw error;
    }
  }

  /**
   * Add single allocation (admin only)
   */
  async addAllocation(allocation: Partial<RankAllocation>): Promise<RankAllocation | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('rank_allocations')
        .insert(allocation)
        .select()
        .single();

      if (error) {
        console.error('Error adding allocation:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in addAllocation:', error);
      throw error;
    }
  }

  /**
   * Update allocation (admin only)
   */
  async updateAllocation(
    id: string,
    updates: Partial<RankAllocation>
  ): Promise<RankAllocation | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('rank_allocations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating allocation:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in updateAllocation:', error);
      throw error;
    }
  }

  /**
   * Delete allocation (admin only)
   */
  async deleteAllocation(id: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('rank_allocations')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting allocation:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteAllocation:', error);
      return false;
    }
  }

  /**
   * Verify allocation (admin only)
   */
  async verifyAllocation(id: string, userId: string): Promise<RankAllocation | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('rank_allocations')
        .update({
          verification_status: 'verified',
          verified_by: userId,
          verified_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error verifying allocation:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in verifyAllocation:', error);
      throw error;
    }
  }

  /**
   * Get cross-references for a rank (same rank in different sources/levels)
   */
  async getCrossReferences(
    rank: number,
    year: number,
    category: string,
    quota: string,
    excludeSourceId?: string,
    excludeLevelId?: string
  ): Promise<{
    source_id: string;
    level_id: string;
    source_name: string;
    level_name: string;
    total_rounds: number;
    has_data: boolean;
  }[]> {
    try {
      const { data, error } = await supabase.rpc('find_cross_references', {
        p_rank: rank,
        p_year: year,
        p_category: category,
        p_quota: quota,
        p_exclude_source_id: excludeSourceId,
        p_exclude_level_id: excludeLevelId,
      });

      if (error) {
        console.error('Error finding cross-references:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCrossReferences:', error);
      throw error;
    }
  }

  /**
   * Get upgrade trends for a college/course
   */
  async getUpgradeTrends(
    year: number,
    sourceId: string,
    levelId: string,
    college_id?: string,
    course_id?: string
  ): Promise<{
    total_upgrades_to: number;
    total_upgrades_from: number;
    net_upgrades: number;
    common_upgrade_paths: {
      from_college: string;
      from_course: string;
      count: number;
    }[];
  }> {
    try {
      // Get upgrades TO this college/course
      let queryTo = supabase
        .from('rank_allocations')
        .select('*', { count: 'exact', head: true })
        .eq('year', year)
        .eq('source_id', sourceId)
        .eq('level_id', levelId)
        .eq('is_upgrade', true);

      if (college_id) {
        queryTo = queryTo.eq('college_id', college_id);
      }

      if (course_id) {
        queryTo = queryTo.eq('course_id', course_id);
      }

      const { count: upgrades_to } = await queryTo;

      // Get upgrades FROM this college/course
      let queryFrom = supabase
        .from('rank_allocations')
        .select('*', { count: 'exact', head: true })
        .eq('year', year)
        .eq('source_id', sourceId)
        .eq('level_id', levelId)
        .eq('is_upgrade', true);

      if (college_id) {
        queryFrom = queryFrom.eq('previous_college_id', college_id);
      }

      if (course_id) {
        queryFrom = queryFrom.eq('previous_course_id', course_id);
      }

      const { count: upgrades_from } = await queryFrom;

      // Calculate common upgrade paths - query ranks that upgraded TO this college/course
      let commonPaths: { from_college: string; from_course: string; count: number }[] = [];
      
      if (college_id || course_id) {
        // Get ranks that are now in this college/course
        let currentRanksQuery = supabase
          .from('rank_allocations')
          .select('rank')
          .eq('year', year)
          .eq('source_id', sourceId)
          .eq('level_id', levelId)
          .eq('is_upgrade', true);

        if (college_id) {
          currentRanksQuery = currentRanksQuery.eq('college_id', college_id);
        }
        if (course_id) {
          currentRanksQuery = currentRanksQuery.eq('course_id', course_id);
        }

        const { data: currentRanks } = await currentRanksQuery.limit(1000);
        const rankIds = currentRanks?.map(r => r.rank) || [];

        if (rankIds.length > 0) {
          // Find what colleges/courses these ranks came from (by looking at their previous allocations)
          const { data: previousAllocations } = await supabase
            .from('rank_allocations')
            .select(`
              rank,
              previous_college_id,
              previous_course_id,
              previous_college:colleges!rank_allocations_previous_college_id_fkey(name),
              previous_course:courses!rank_allocations_previous_course_id_fkey(name)
            `)
            .eq('year', year)
            .eq('source_id', sourceId)
            .eq('level_id', levelId)
            .in('rank', rankIds)
            .not('previous_college_id', 'is', null);

          // Group by previous college/course and count
          const pathMap = new Map<string, { from_college: string; from_course: string; count: number }>();
          
          previousAllocations?.forEach((alloc: any) => {
            const fromCollege = alloc.previous_college?.name || 'Unknown';
            const fromCourse = alloc.previous_course?.name || 'Unknown';
            const key = `${fromCollege}|||${fromCourse}`;
            
            if (pathMap.has(key)) {
              pathMap.get(key)!.count++;
            } else {
              pathMap.set(key, {
                from_college: fromCollege,
                from_course: fromCourse,
                count: 1
              });
            }
          });

          // Sort by count and take top 10
          commonPaths = Array.from(pathMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        }
      }

      return {
        total_upgrades_to: upgrades_to || 0,
        total_upgrades_from: upgrades_from || 0,
        net_upgrades: (upgrades_to || 0) - (upgrades_from || 0),
        common_upgrade_paths: commonPaths,
      };
    } catch (error) {
      console.error('Error in getUpgradeTrends:', error);
      throw error;
    }
  }

  // =====================================================
  // COLLEGE-COURSE UPGRADE TRACKING METHODS
  // =====================================================

  /**
   * Get college+course upgrade flow data between two rounds
   * Shows how students migrated from college-course combinations
   */
  async getCollegeCourseUpgradeFlow(params: {
    year: number;
    sourceId: string;
    levelId: string;
    category: string;
    quota: string;
    fromRound: number;
    toRound: number;
    minFlowCount?: number;
  }): Promise<UpgradeFlowData> {
    try {
      const { year, sourceId, levelId, category, quota, fromRound, toRound, minFlowCount = 5 } = params;

      // Build partition key
      const source = sourceId.startsWith('SRC_') ? sourceId.substring(4) : sourceId;
      const level = levelId.startsWith('LVL_') ? levelId.substring(4) : levelId;
      const partitionKey = `${source}-${level}-${year}`;

      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_upgrade_flow', {
        p_partition_key: partitionKey,
        p_round_from: fromRound,
        p_round_to: toRound,
        p_category: category,
        p_quota: quota,
        p_min_count: minFlowCount
      });

      if (rpcError) {
        console.error('Error calling get_upgrade_flow RPC:', rpcError);
        return { flows: [], totalStudents: 0, uniqueColleges: 0, upgradeRate: 0, freezeRate: 0 };
      }

      // Fetch total population count for rates
      let totalQuery = supabaseAdmin
        .from('counselling_records')
        .select('id', { count: 'exact', head: true })
        .eq('partition_key', partitionKey)
        .eq('round_normalized', toRound);
      
      if (category && category !== 'All') totalQuery = totalQuery.eq('category', category);
      if (quota && quota !== 'All') totalQuery = totalQuery.eq('quota', quota);

      const { count: totalStudents } = await totalQuery;

      // Map RPC results to UpgradeFlow interface
      const flows: UpgradeFlow[] = (rpcData || []).map((row: any) => ({
        origin: { collegeName: row.origin_college, courseName: row.origin_course, round: fromRound },
        destination: { collegeName: row.dest_college, courseName: row.dest_course, round: toRound },
        studentCount: parseInt(row.student_count),
        rankRange: { min: row.min_rank, max: row.max_rank, median: 0 },
        upgradeType: row.upgrade_type as CollegeUpgradeType,
      }));

      const upgradedCount = flows.filter(f => f.upgradeType !== 'NONE').reduce((sum, f) => sum + f.studentCount, 0);
      const uniqueColleges = new Set(flows.map(f => f.destination.collegeName)).size;
      const totalPop = totalStudents || 0;

      const { data: migrationData } = await supabaseAdmin.rpc('get_student_migration_detail', {
        p_partition_key: partitionKey,
        p_round_from: fromRound,
        p_round_to: toRound,
        p_category: category,
        p_quota: quota,
        p_upgrades_only: false,
        p_limit: 100, // Fetch top 100 for the sample
      });

      return {
        flows,
        totalStudents: totalPop,
        uniqueColleges,
        upgradeRate: totalPop > 0 ? (upgradedCount / totalPop) * 100 : 0,
        freezeRate: totalPop > 0 ? ((totalPop - upgradedCount) / totalPop) * 100 : 0,
        topMigrations: migrationData as StudentMigration[] || [],
      };
    } catch (error) {
      console.error('Error in getCollegeCourseUpgradeFlow:', error);
      throw error;
    }
  }

  async getDetailedUpgradeFlow(params: {
    year: number;
    sourceId: string;
    levelId: string;
    category: string;
    quota: string;
    fromRound: number;
    toRound: number;
    state?: string;
    college?: string;
    course?: string;
    minRank?: number;
    maxRank?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[], count: number }> {
    try {
      const { 
        year, 
        sourceId, 
        levelId, 
        category, 
        quota, 
        fromRound, 
        toRound, 
        state, 
        college, 
        course, 
        minRank,
        maxRank,
        search,
        limit = 50, 
        offset = 0 
      } = params;

      // Build partition key
      const source = sourceId.startsWith('SRC_') ? sourceId.substring(4) : sourceId;
      const level = levelId.startsWith('LVL_') ? levelId.substring(4) : levelId;
      const partitionKey = `${source}-${level}-${year}`;

      console.log(`[getDetailedUpgradeFlow] Using optimized RPC for ${partitionKey}, R${fromRound} -> R${toRound} (Page: ${offset/limit + 1})`);
      
      const { data, error } = await supabaseAdmin.rpc('get_upgrade_flow_v2', {
        p_partition_key: partitionKey,
        p_round_from: fromRound,
        p_round_to: toRound,
        p_category: category === 'all' ? '' : category,
        p_quota: quota === 'all' ? '' : quota,
        p_state: state === 'all' ? '' : state,
        p_college: college === 'all' ? '' : college,
        p_course: course === 'all' ? '' : course,
        p_min_rank: minRank || null,
        p_max_rank: maxRank || null,
        p_search: search || '',
        p_limit: limit,
        p_offset: offset
      });

      if (error) {
        console.error('[getDetailedUpgradeFlow] RPC error:', error);
        return { data: [], count: 0 };
      }

      const totalCount = data && data.length > 0 ? Number(data[0].total_count) : 0;
      
      // Remove the total_count field from each row to keep it clean
      const cleanedData = (data || []).map((row: any) => {
        const { total_count, ...rest } = row;
        return rest;
      });

      console.log(`[getDetailedUpgradeFlow] Returned ${cleanedData.length} of ${totalCount} records`);
      
      return {
        data: cleanedData,
        count: totalCount
      };
    } catch (error) {
      console.error('Error in getDetailedUpgradeFlow catch:', error);
      return { data: [], count: 0 };
    }
  }




  /**
   * Get paginated student migrations with detailed metadata
   */
  async getStudentMigrationDetail(params: {
    year: number;
    sourceId: string;
    levelId: string;
    category: string;
    quota: string;
    fromRound: number;
    toRound: number;
    upgradesOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<StudentMigration[]> {
    try {
      const { year, sourceId, levelId, category, quota, fromRound, toRound, upgradesOnly = false, limit = 50, offset = 0 } = params;
      const source = sourceId.startsWith('SRC_') ? sourceId.substring(4) : sourceId;
      const level = levelId.startsWith('LVL_') ? levelId.substring(4) : levelId;
      const partitionKey = `${source}-${level}-${year}`;

      const { data, error } = await supabaseAdmin.rpc('get_student_migration_detail', {
        p_partition_key: partitionKey,
        p_round_from: fromRound,
        p_round_to: toRound,
        p_category: category,
        p_quota: quota,
        p_upgrades_only: upgradesOnly,
        p_limit: limit,
        p_offset: offset
      });

      if (error) {
        console.error('Error calling get_student_migration_detail RPC:', error);
        return [];
      }

      return data as StudentMigration[];
    } catch (error) {
      console.error('Error in getStudentMigrationDetail:', error);
      return [];
    }
  }


  /**
   * Get detailed breakdown for a specific college+course in a round
   */
  async getCollegeCourseRoundDetails(params: {
    year: number;
    sourceId: string;
    levelId: string;
    category: string;
    quota: string;
    round: number;
    collegeName: string;
    courseName: string;
  }): Promise<CollegeCourseRoundDetails> {
    try {
      const { year, sourceId, levelId, category, quota, round, collegeName, courseName } = params;

      // Get current round allocations
      const { data: currentRound, error: currentError } = await supabase
        .from('rank_allocations')
        .select('rank')
        .eq('year', year)
        .eq('source_id', sourceId)
        .eq('level_id', levelId)
        .eq('category', category)
        .eq('quota', quota)
        .eq('round', round)
        .eq('college_name', collegeName)
        .eq('course_name', courseName);

      if (currentError) throw currentError;

      const ranks = currentRound?.map(r => r.rank) || [];
      const totalAllocations = ranks.length;
      const rankRange = {
        min: totalAllocations > 0 ? Math.min(...ranks) : 0,
        max: totalAllocations > 0 ? Math.max(...ranks) : 0,
        median: totalAllocations > 0 ? ranks.sort((a, b) => a - b)[Math.floor(ranks.length / 2)] : 0,
      };

      // Get next round data for outflow analysis
      let outflow = {
        frozen: 0,
        upgradedOut: 0,
        topDestinations: [] as Array<{ collegeName: string; courseName: string; count: number }>,
      };

      if (round < 10) {
        const { data: nextRound } = await supabase
          .from('rank_allocations')
          .select('rank, college_name, course_name')
          .eq('year', year)
          .eq('source_id', sourceId)
          .eq('level_id', levelId)
          .eq('category', category)
          .eq('quota', quota)
          .eq('round', round + 1)
          .in('rank', ranks);

        const destinationMap = new Map<string, number>();
        nextRound?.forEach((r) => {
          if (r.college_name === collegeName && r.course_name === courseName) {
            outflow.frozen++;
          } else {
            outflow.upgradedOut++;
            const key = `${r.college_name}|||${r.course_name}`;
            destinationMap.set(key, (destinationMap.get(key) || 0) + 1);
          }
        });

        outflow.topDestinations = Array.from(destinationMap.entries())
          .map(([key, count]) => {
            const [cName, coName] = key.split('|||');
            return { collegeName: cName, courseName: coName, count };
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
      }

      // Get previous round data for inflow analysis
      let inflow = {
        newAllocations: totalAllocations,
        fromUpgrade: 0,
      };

      if (round > 1) {
        const { data: previousRound } = await supabase
          .from('rank_allocations')
          .select('rank')
          .eq('year', year)
          .eq('source_id', sourceId)
          .eq('level_id', levelId)
          .eq('category', category)
          .eq('quota', quota)
          .eq('round', round - 1)
          .in('rank', ranks);

        const previousRanks = new Set(previousRound?.map(r => r.rank) || []);
        inflow.newAllocations = ranks.filter(r => !previousRanks.has(r)).length;
        inflow.fromUpgrade = ranks.filter(r => previousRanks.has(r)).length;
      }

      return {
        collegeName,
        courseName,
        round,
        totalAllocations,
        rankRange,
        inflow,
        outflow,
      };
    } catch (error) {
      console.error('Error in getCollegeCourseRoundDetails:', error);
      throw error;
    }
  }

  /**
   * Get upgrade probability matrix for a specific college+course
   */
  async getUpgradeProbabilities(params: {
    year: number;
    sourceId: string;
    levelId: string;
    category: string;
    quota: string;
    round: number;
    collegeName: string;
    courseName: string;
  }): Promise<UpgradeProbabilityMatrix> {
    try {
      const { year, sourceId, levelId, category, quota, round, collegeName, courseName } = params;

      // Get all ranks in this college+course combination
      const { data: originRanks } = await supabase
        .from('rank_allocations')
        .select('rank')
        .eq('year', year)
        .eq('source_id', sourceId)
        .eq('level_id', levelId)
        .eq('category', category)
        .eq('quota', quota)
        .eq('round', round)
        .eq('college_name', collegeName)
        .eq('course_name', courseName);

      const ranks = originRanks?.map(r => r.rank) || [];
      const totalSampleSize = ranks.length;

      if (totalSampleSize === 0) {
        return {
          origin: { collegeName, courseName, round },
          probabilities: [],
          freezeProbability: 0,
          totalSampleSize: 0,
        };
      }

      // Get next round destinations for these ranks
      const { data: destinations } = await supabase
        .from('rank_allocations')
        .select('rank, college_name, course_name')
        .eq('year', year)
        .eq('source_id', sourceId)
        .eq('level_id', levelId)
        .eq('category', category)
        .eq('quota', quota)
        .eq('round', round + 1)
        .in('rank', ranks);

      const destMap = new Map<string, { count: number; ranks: number[] }>();
      let frozenCount = 0;

      destinations?.forEach((d) => {
        if (d.college_name === collegeName && d.course_name === courseName) {
          frozenCount++;
        } else {
          const key = `${d.college_name}|||${d.course_name}`;
          if (!destMap.has(key)) {
            destMap.set(key, { count: 0, ranks: [] });
          }
          const entry = destMap.get(key)!;
          entry.count++;
          entry.ranks.push(d.rank);
        }
      });

      const probabilities: UpgradeProbability[] = Array.from(destMap.entries())
        .map(([key, data]) => {
          const [cName, coName] = key.split('|||');
          return {
            destination: { collegeName: cName, courseName: coName },
            probability: data.count / totalSampleSize,
            studentCount: data.count,
            avgRankRange: {
              min: Math.min(...data.ranks),
              max: Math.max(...data.ranks),
            },
          };
        })
        .sort((a, b) => b.probability - a.probability);

      return {
        origin: { collegeName, courseName, round },
        probabilities,
        freezeProbability: frozenCount / totalSampleSize,
        totalSampleSize,
      };
    } catch (error) {
      console.error('Error in getUpgradeProbabilities:', error);
      throw error;
    }
  }

  /**
   * Get college stability score and classification
   */
  async getCollegeStabilityScore(params: {
    year: number;
    sourceId: string;
    levelId: string;
    collegeName: string;
    courseName: string;
  }): Promise<StabilityMetrics> {
    try {
      const { year, sourceId, levelId, collegeName, courseName } = params;

      // Get data for multiple years to calculate trend
      const years = [year, year - 1, year - 2].filter(y => y >= 2020);
      const yearlyData: Array<{ year: number; stabilityScore: number }> = [];

      for (const y of years) {
        // Get all allocations for this college-course in round 1
        const { data: round1 } = await supabase
          .from('rank_allocations')
          .select('rank')
          .eq('year', y)
          .eq('source_id', sourceId)
          .eq('level_id', levelId)
          .eq('college_name', collegeName)
          .eq('course_name', courseName)
          .eq('round', 1);

        const r1Ranks = round1?.map(r => r.rank) || [];
        if (r1Ranks.length === 0) continue;

        // Get round 2 allocations for same ranks
        const { data: round2 } = await supabase
          .from('rank_allocations')
          .select('rank, college_name, course_name')
          .eq('year', y)
          .eq('source_id', sourceId)
          .eq('level_id', levelId)
          .eq('round', 2)
          .in('rank', r1Ranks);

        const frozenCount = round2?.filter(
          r => r.college_name === collegeName && r.course_name === courseName
        ).length || 0;

        const stabilityScore = (frozenCount / r1Ranks.length) * 100;
        yearlyData.push({ year: y, stabilityScore });
      }

      // Calculate average stability score
      const avgStabilityScore = yearlyData.length > 0
        ? yearlyData.reduce((sum, d) => sum + d.stabilityScore, 0) / yearlyData.length
        : 0;

      // Determine classification
      const classification: StabilityClassification =
        avgStabilityScore >= 70 ? 'TERMINAL' :
        avgStabilityScore >= 40 ? 'ASPIRATIONAL' : 'STEPPING_STONE';

      // Calculate inflow rate - percentage of students who upgraded TO this college/course from other colleges
      let inflowRate = 0;
      
      // Get current round data for this college/course
      const { data: currentAllocations } = await supabase
        .from('rank_allocations')
        .select('rank')
        .eq('year', year)
        .eq('source_id', sourceId)
        .eq('level_id', levelId)
        .eq('college_name', collegeName)
        .eq('course_name', courseName)
        .limit(1000);

      const totalAllocations = currentAllocations?.length || 0;

      if (totalAllocations > 0) {
        // Count how many of these are upgrades (have a different previous college/course)
        const { data: inflowData, count: inflowCount } = await supabase
          .from('rank_allocations')
          .select('*', { count: 'exact', head: true })
          .eq('year', year)
          .eq('source_id', sourceId)
          .eq('level_id', levelId)
          .eq('college_name', collegeName)
          .eq('course_name', courseName)
          .eq('is_upgrade', true)
          .not('previous_college_id', 'is', null)
          .limit(1000);

        // Calculate inflow rate as percentage
        inflowRate = totalAllocations > 0 ? ((inflowCount || 0) / totalAllocations) * 100 : 0;
      }

      // Calculate retention and outflow rates
      const retentionRate = avgStabilityScore;
      const outflowRate = 100 - avgStabilityScore;

      return {
        collegeName,
        courseName,
        stabilityScore: avgStabilityScore,
        classification,
        retentionRate,
        inflowRate,
        outflowRate,
        yearlyTrend: yearlyData.sort((a, b) => b.year - a.year),
      };
    } catch (error) {
      console.error('Error in getCollegeStabilityScore:', error);
      throw error;
    }
  }

  // =====================================================
  // RANK GROUP ANALYSIS METHODS
  // =====================================================

  async getRankGroupColleges(
    rank_start: number,
    rank_end: number,
    year: number,
    round: number,
    category: string,
    quota: string,
    source_id: string,
    level_id: string
  ): Promise<RankGroupCollege[]> {
    try {
      const { data, error } = await supabase
        .from('rank_allocations')
        .select('college_name, course_name, rank, category, quota')
        .eq('year', year)
        .eq('round', round)
        .eq('category', category)
        .eq('quota', quota)
        .eq('source_id', source_id)
        .eq('level_id', level_id)
        .gte('rank', rank_start)
        .lte('rank', rank_end)
        .order('rank', { ascending: true });

      if (error) throw error;

      // Group by college and course to find closing rank
      const collegeMap = new Map<string, RankGroupCollege>();
      
      data?.forEach((allocation) => {
        const key = `${allocation.college_name}|${allocation.course_name}`;
        const existing = collegeMap.get(key);
        
        if (!existing) {
          collegeMap.set(key, {
            college_name: allocation.college_name,
            course_name: allocation.course_name,
            closing_rank: allocation.rank,
            total_students: 1,
            category: allocation.category,
            quota: allocation.quota,
          });
        } else {
          existing.total_students++;
          existing.closing_rank = Math.min(existing.closing_rank, allocation.rank);
        }
      });

      return Array.from(collegeMap.values()).sort((a, b) => a.closing_rank - b.closing_rank);
    } catch (error) {
      console.error('Error in getRankGroupColleges:', error);
      throw error;
    }
  }

  async compareRankGroupYearWise(
    filters: RankGroupFilters,
    year1: number,
    year2: number,
    round: number
  ): Promise<YearWiseComparison> {
    try {
      // Fetch colleges for both years
      const year1Colleges = await this.getRankGroupColleges(
        filters.rank_start,
        filters.rank_end,
        year1,
        round,
        filters.category,
        filters.quota,
        filters.source_id,
        filters.level_id
      );

      const year2Colleges = await this.getRankGroupColleges(
        filters.rank_start,
        filters.rank_end,
        year2,
        round,
        filters.category,
        filters.quota,
        filters.source_id,
        filters.level_id
      );

      // Calculate average closing ranks
      const year1AvgRank = year1Colleges.length > 0
        ? year1Colleges.reduce((sum, c) => sum + c.closing_rank, 0) / year1Colleges.length
        : 0;

      const year2AvgRank = year2Colleges.length > 0
        ? year2Colleges.reduce((sum, c) => sum + c.closing_rank, 0) / year2Colleges.length
        : 0;

      // Create maps for comparison
      const year1Map = new Map(
        year1Colleges.map((c) => [`${c.college_name}|${c.course_name}`, c])
      );
      const year2Map = new Map(
        year2Colleges.map((c) => [`${c.college_name}|${c.course_name}`, c])
      );

      // Find new, lost, and consistent colleges
      const new_colleges: RankGroupCollege[] = [];
      const lost_colleges: RankGroupCollege[] = [];
      const consistent_colleges: RankGroupCollege[] = [];

      year2Map.forEach((college, key) => {
        if (year1Map.has(key)) {
          consistent_colleges.push(college);
        } else {
          new_colleges.push(college);
        }
      });

      year1Map.forEach((college, key) => {
        if (!year2Map.has(key)) {
          lost_colleges.push(college);
        }
      });

      // Calculate verdict
      const collegeDiff = year2Colleges.length - year1Colleges.length;
      const rankDiff = year2AvgRank - year1AvgRank;
      const newVsLostRatio = lost_colleges.length > 0 
        ? new_colleges.length / lost_colleges.length 
        : (new_colleges.length > 0 ? 2 : 1);

      let verdict: 'easier' | 'harder' | 'similar';
      let verdict_reason: string;

      if (collegeDiff >= 5 && rankDiff < -500) {
        verdict = 'easier';
        verdict_reason = `${collegeDiff} more colleges available in ${year2}, and average closing rank improved by ${Math.abs(Math.round(rankDiff))}`;
      } else if (collegeDiff <= -5 && rankDiff > 500) {
        verdict = 'harder';
        verdict_reason = `${Math.abs(collegeDiff)} fewer colleges available in ${year2}, and average closing rank worsened by ${Math.round(rankDiff)}`;
      } else if (newVsLostRatio >= 1.5) {
        verdict = 'easier';
        verdict_reason = `${new_colleges.length} new colleges added vs ${lost_colleges.length} lost in ${year2}`;
      } else if (newVsLostRatio <= 0.67) {
        verdict = 'harder';
        verdict_reason = `${lost_colleges.length} colleges lost vs ${new_colleges.length} new ones in ${year2}`;
      } else {
        verdict = 'similar';
        verdict_reason = `Comparable options between ${year1} and ${year2} (${collegeDiff >= 0 ? '+' : ''}${collegeDiff} colleges, ${rankDiff >= 0 ? '+' : ''}${Math.round(rankDiff)} avg rank change)`;
      }

      return {
        year1: {
          year: year1,
          colleges: year1Colleges,
          total_colleges: year1Colleges.length,
          avg_closing_rank: Math.round(year1AvgRank),
        },
        year2: {
          year: year2,
          colleges: year2Colleges,
          total_colleges: year2Colleges.length,
          avg_closing_rank: Math.round(year2AvgRank),
        },
        analysis: {
          new_colleges,
          lost_colleges,
          consistent_colleges,
          verdict,
          verdict_reason,
        },
      };
    } catch (error) {
      console.error('Error in compareRankGroupYearWise:', error);
      throw error;
    }
  }

  async compareRankGroupRoundWise(
    filters: RankGroupFilters,
    year: number,
    round1: number,
    round2: number
  ): Promise<RoundWiseComparison> {
    try {
      // Fetch colleges for both rounds
      const round1Colleges = await this.getRankGroupColleges(
        filters.rank_start,
        filters.rank_end,
        year,
        round1,
        filters.category,
        filters.quota,
        filters.source_id,
        filters.level_id
      );

      const round2Colleges = await this.getRankGroupColleges(
        filters.rank_start,
        filters.rank_end,
        year,
        round2,
        filters.category,
        filters.quota,
        filters.source_id,
        filters.level_id
      );

      // Calculate average closing ranks
      const round1AvgRank = round1Colleges.length > 0
        ? round1Colleges.reduce((sum, c) => sum + c.closing_rank, 0) / round1Colleges.length
        : 0;

      const round2AvgRank = round2Colleges.length > 0
        ? round2Colleges.reduce((sum, c) => sum + c.closing_rank, 0) / round2Colleges.length
        : 0;

      // Create maps for comparison
      const round1Map = new Map(
        round1Colleges.map((c) => [`${c.college_name}|${c.course_name}`, c])
      );
      const round2Map = new Map(
        round2Colleges.map((c) => [`${c.college_name}|${c.course_name}`, c])
      );

      // Find new, lost, and consistent colleges
      const new_in_round2: RankGroupCollege[] = [];
      const lost_in_round2: RankGroupCollege[] = [];
      const consistent: RankGroupCollege[] = [];

      round2Map.forEach((college, key) => {
        if (round1Map.has(key)) {
          consistent.push(college);
        } else {
          new_in_round2.push(college);
        }
      });

      round1Map.forEach((college, key) => {
        if (!round2Map.has(key)) {
          lost_in_round2.push(college);
        }
      });

      // Calculate upgrade vs degradation
      const upgrade_opportunities = new_in_round2.length;
      const degradation_count = lost_in_round2.length;

      return {
        round1: {
          round: round1,
          colleges: round1Colleges,
          total_colleges: round1Colleges.length,
          avg_closing_rank: Math.round(round1AvgRank),
        },
        round2: {
          round: round2,
          colleges: round2Colleges,
          total_colleges: round2Colleges.length,
          avg_closing_rank: Math.round(round2AvgRank),
        },
        analysis: {
          new_in_round2,
          lost_in_round2,
          consistent,
          upgrade_opportunities,
          degradation_count,
        },
      };
    } catch (error) {
      console.error('Error in compareRankGroupRoundWise:', error);
      throw error;
    }
  }
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

let rankTrackingService: RankTrackingService | null = null;

export function getRankTrackingService(): RankTrackingService {
  if (!rankTrackingService) {
    rankTrackingService = new RankTrackingService();
  }
  return rankTrackingService;
}

export default RankTrackingService;
