/**
 * Data Store - Client-side data management with O(1) lookups
 * Loads master data once and provides efficient access for client-side joins
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type College = {
  id: string;
  name: string;
  short_name: string;
  type: 'MEDICAL' | 'DENTAL' | 'DNB';
  state: string;
  city: string;
  address: string;
  management: 'GOVERNMENT' | 'PRIVATE' | 'DEEMED';
  established: number | null;
  website: string;
  university: string;
};

export type Course = {
  id: string;
  name: string;
  short_name: string;
  level: 'UG' | 'PG' | 'DIPLOMA';
  domain: 'MEDICAL' | 'DENTAL' | 'DNB';
  duration_years: number;
  description: string;
};

export type State = {
  id: string;
  name: string;
  code: string;
  region: string;
};

export type Category = {
  id: string;
  name: string;
  type: 'GENERAL' | 'RESERVED' | 'PWD';
};

export type Quota = {
  id: string;
  name: string;
  type: 'CENTRAL' | 'STATE' | 'PRIVATE' | 'DEEMED';
};

export type Cutoff = {
  id: string;
  college_id: string;
  course_id: string;
  quota_id: string;
  category_id: string;
  opening_rank: number;
  closing_rank: number;
  year: number;
  round: number;
  source: string;
  level: string;
};

export type EnrichedCutoff = Cutoff & {
  college?: College;
  course?: Course;
  quota?: Quota;
  category?: Category;
};

export type SeatAvailability = {
  id: string;
  college_id: string;
  course_id: string;
  category_id: string;
  quota_id: string;
  total_seats: number;
  available_seats: number;
  filled_seats: number;
  status: 'OPEN' | 'FILLED' | 'WAITLIST';
  last_updated: string;
};

export type CollegeSummary = {
  id: string;
  name: string;
  short_name: string;
  type: string;
  state: string;
  city: string;
  management: string;
  established: number | null;
  stats: {
    total_seats?: number;
    courses_offered?: number;
    years_active?: number[];
  };
  courses: Array<{
    course_id: string;
    total_seats: number;
    best_rank_ever?: number;
  }>;
  cutoff_trends: Record<string, Record<string, Record<string, { opening: number; closing: number }>>>;
  seat_availability: Record<string, { total: number; available: number; filled: number; status: string }>;
  highlights: {
    best_overall_rank?: number;
  };
};

export type CollegeTrend = {
  college_id: string;
  college_name: string;
  yearly_trends: Record<string, {
    total_seats: number;
    courses_offered: number;
    total_admissions: number;
    best_rank: number | null;
    courses: Record<string, {
      categories: Record<string, {
        opening: number;
        closing: number;
        candidates: number;
      }>;
    }>;
  }>;
};

// ============================================================================
// DATA STORE CLASS
// ============================================================================

class DataStore {
  // Master data maps (O(1) lookup)
  private colleges = new Map<string, College>();
  private courses = new Map<string, Course>();
  private states = new Map<string, State>();
  private categories = new Map<string, Category>();
  private quotas = new Map<string, Quota>();

  // Cache for loaded partitions and files
  private partitionCache = new Map<string, Cutoff[]>();
  private summaryCache = new Map<string, CollegeSummary>();
  private trendCache = new Map<string, CollegeTrend>();

  // Initialization state
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize the data store by loading master data
   * This should be called once on app startup
   */
  async initialize(): Promise<void> {
    // Return existing initialization if in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.initialized) {
      return Promise.resolve();
    }

    this.initPromise = this._loadMasterData();
    await this.initPromise;
    this.initialized = true;

    return Promise.resolve();
  }

  /**
   * Load all master data files in parallel
   */
  private async _loadMasterData(): Promise<void> {
    try {
      const [collegesData, coursesData, statesData, categoriesData, quotasData] =
        await Promise.all([
          fetch('/data/master/colleges.json').then(r => r.json()),
          fetch('/data/master/courses.json').then(r => r.json()),
          fetch('/data/master/states.json').then(r => r.json()),
          fetch('/data/master/categories.json').then(r => r.json()),
          fetch('/data/master/quotas.json').then(r => r.json()),
        ]);

      // Convert to Maps for O(1) lookup
      this.colleges = new Map(Object.entries(collegesData));
      this.courses = new Map(Object.entries(coursesData));
      this.states = new Map(Object.entries(statesData));
      this.categories = new Map(Object.entries(categoriesData));
      this.quotas = new Map(Object.entries(quotasData));

      console.log('✅ Data store initialized:', {
        colleges: this.colleges.size,
        courses: this.courses.size,
        states: this.states.size,
        categories: this.categories.size,
        quotas: this.quotas.size,
      });
    } catch (error) {
      console.error('❌ Failed to initialize data store:', error);
      throw error;
    }
  }

  /**
   * Check if data store is ready
   */
  isReady(): boolean {
    return this.initialized;
  }

  // ============================================================================
  // MASTER DATA GETTERS (O(1) lookup)
  // ============================================================================

  getCollege(id: string): College | undefined {
    return this.colleges.get(id);
  }

  getCourse(id: string): Course | undefined {
    return this.courses.get(id);
  }

  getState(id: string): State | undefined {
    return this.states.get(id);
  }

  getCategory(id: string): Category | undefined {
    return this.categories.get(id);
  }

  getQuota(id: string): Quota | undefined {
    return this.quotas.get(id);
  }

  getAllColleges(): College[] {
    return Array.from(this.colleges.values());
  }

  getAllCourses(): Course[] {
    return Array.from(this.courses.values());
  }

  getAllStates(): State[] {
    return Array.from(this.states.values());
  }

  getAllCategories(): Category[] {
    return Array.from(this.categories.values());
  }

  getAllQuotas(): Quota[] {
    return Array.from(this.quotas.values());
  }

  // ============================================================================
  // PARTITION LOADING (WITH CACHE)
  // ============================================================================

  /**
   * Load a cutoff partition (e.g., "AIQ-2024-PG")
   * Uses cache to avoid re-loading
   */
  async loadPartition(partitionName: string): Promise<Cutoff[]> {
    // Check cache first
    if (this.partitionCache.has(partitionName)) {
      return this.partitionCache.get(partitionName)!;
    }

    try {
      const response = await fetch(`/data/cutoffs/${partitionName}.json`);
      const data: Cutoff[] = await response.json();

      // Cache partition (limit cache size to 3 most recent)
      this.partitionCache.set(partitionName, data);
      if (this.partitionCache.size > 3) {
        const firstKey = this.partitionCache.keys().next().value;
        this.partitionCache.delete(firstKey);
      }

      return data;
    } catch (error) {
      console.error(`Failed to load partition ${partitionName}:`, error);
      return [];
    }
  }

  /**
   * Load and enrich cutoffs with master data
   */
  async loadEnrichedCutoffs(partitionName: string): Promise<EnrichedCutoff[]> {
    const cutoffs = await this.loadPartition(partitionName);

    return cutoffs.map(cutoff => ({
      ...cutoff,
      college: this.getCollege(cutoff.college_id),
      course: this.getCourse(cutoff.course_id),
      quota: this.getQuota(cutoff.quota_id),
      category: this.getCategory(cutoff.category_id),
    }));
  }

  // ============================================================================
  // COLLEGE SUMMARY & TRENDS
  // ============================================================================

  /**
   * Load college summary (for compare page)
   */
  async loadCollegeSummary(collegeId: string): Promise<CollegeSummary | null> {
    // Check cache
    if (this.summaryCache.has(collegeId)) {
      return this.summaryCache.get(collegeId)!;
    }

    try {
      const response = await fetch(`/data/colleges/summaries/${collegeId}.json`);
      const summary: CollegeSummary = await response.json();

      this.summaryCache.set(collegeId, summary);
      return summary;
    } catch (error) {
      console.error(`Failed to load summary for ${collegeId}:`, error);
      return null;
    }
  }

  /**
   * Load multiple college summaries (for compare page)
   */
  async loadMultipleSummaries(collegeIds: string[]): Promise<CollegeSummary[]> {
    const summaries = await Promise.all(
      collegeIds.map(id => this.loadCollegeSummary(id))
    );

    return summaries.filter((s): s is CollegeSummary => s !== null);
  }

  /**
   * Load college trend data (10-year history)
   */
  async loadCollegeTrend(collegeId: string): Promise<CollegeTrend | null> {
    // Check cache
    if (this.trendCache.has(collegeId)) {
      return this.trendCache.get(collegeId)!;
    }

    try {
      const response = await fetch(`/data/trends/college-trends/${collegeId}.json`);
      const trend: CollegeTrend = await response.json();

      this.trendCache.set(collegeId, trend);
      return trend;
    } catch (error) {
      console.error(`Failed to load trend for ${collegeId}:`, error);
      return null;
    }
  }

  // ============================================================================
  // SEARCH & FILTER HELPERS
  // ============================================================================

  /**
   * Search colleges by name
   */
  searchColleges(query: string): College[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllColleges().filter(college =>
      college.name.toLowerCase().includes(lowerQuery) ||
      college.short_name.toLowerCase().includes(lowerQuery) ||
      college.city.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Filter colleges by state
   */
  filterCollegesByState(stateId: string): College[] {
    return this.getAllColleges().filter(college => college.state === stateId);
  }

  /**
   * Filter colleges by type
   */
  filterCollegesByType(type: string): College[] {
    return this.getAllColleges().filter(college => college.type === type);
  }

  /**
   * Filter colleges by management
   */
  filterCollegesByManagement(management: string): College[] {
    return this.getAllColleges().filter(college => college.management === management);
  }

  /**
   * Search courses by name
   */
  searchCourses(query: string): Course[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllCourses().filter(course =>
      course.name.toLowerCase().includes(lowerQuery) ||
      course.short_name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Filter courses by domain
   */
  filterCoursesByDomain(domain: string): Course[] {
    return this.getAllCourses().filter(course => course.domain === domain);
  }

  /**
   * Filter courses by level
   */
  filterCoursesByLevel(level: string): Course[] {
    return this.getAllCourses().filter(course => course.level === level);
  }

  // ============================================================================
  // CLIENT-SIDE JOIN OPERATIONS
  // ============================================================================

  /**
   * Enrich cutoffs with college names for display
   */
  enrichCutoffsWithNames(cutoffs: Cutoff[]): Array<Cutoff & {
    collegeName?: string;
    courseName?: string;
    categoryName?: string;
    quotaName?: string;
  }> {
    return cutoffs.map(cutoff => ({
      ...cutoff,
      collegeName: this.getCollege(cutoff.college_id)?.name,
      courseName: this.getCourse(cutoff.course_id)?.name,
      categoryName: this.getCategory(cutoff.category_id)?.name,
      quotaName: this.getQuota(cutoff.quota_id)?.name,
    }));
  }

  /**
   * Filter cutoffs by college state (using master data join)
   */
  filterCutoffsByState(cutoffs: Cutoff[], stateId: string): Cutoff[] {
    return cutoffs.filter(cutoff => {
      const college = this.getCollege(cutoff.college_id);
      return college?.state === stateId;
    });
  }

  /**
   * Filter cutoffs by course domain (using master data join)
   */
  filterCutoffsByCourseDomain(cutoffs: Cutoff[], domain: string): Cutoff[] {
    return cutoffs.filter(cutoff => {
      const course = this.getCourse(cutoff.course_id);
      return course?.domain === domain;
    });
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.partitionCache.clear();
    this.summaryCache.clear();
    this.trendCache.clear();
    console.log('🗑️  All caches cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      partitions: this.partitionCache.size,
      summaries: this.summaryCache.size,
      trends: this.trendCache.size,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const dataStore = new DataStore();

// Auto-initialize if running in browser
if (typeof window !== 'undefined') {
  // Initialize in background, but don't block
  dataStore.initialize().catch(error => {
    console.error('Failed to initialize data store:', error);
  });
}
