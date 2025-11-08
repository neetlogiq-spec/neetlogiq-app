/**
 * Configuration-Driven Metadata Service
 *
 * This service reads static JSON files generated at build time to provide
 * 100% data-driven configuration. No hardcoded values!
 *
 * All metadata is automatically generated from the actual data in Parquet files,
 * so the frontend automatically adapts to new data without code changes.
 */

interface YearMetadata {
  years: number[];
  latest: number;
  oldest: number;
  count: number;
  generated: string;
}

interface RoundMetadata {
  rounds: Record<number, number[]>;
  generated: string;
}

interface FilterOptions {
  categories: string[];
  quotas: string[];
  streams: string[];
  counsellingBodies: string[];
  generated: string;
}

interface CollegeMetadata {
  colleges: Array<{
    college_id: string;
    college_name: string;
    college_type: string;
    stream: string;
    state_id: string;
    state_name: string;
    city?: string;
  }>;
  count: number;
  generated: string;
}

interface CourseMetadata {
  courses: Array<{
    course_id: string;
    course_name: string;
    course_code: string;
    level: string;
    stream: string;
    duration_years?: number;
    degree_type?: string;
  }>;
  count: number;
  generated: string;
}

interface StateMetadata {
  states: Array<{
    state_id: string;
    state_name: string;
    state_code: string;
    zone: string;
  }>;
  count: number;
  generated: string;
}

interface Statistics {
  colleges: {
    total: number;
    byStream: Array<{ stream: string; count: number }>;
    byState: Array<{ state_name: string; count: number }>;
  };
  courses: {
    total: number;
    byStream: Array<{ stream: string; count: number }>;
    byLevel: Array<{ level: string; count: number }>;
  };
  cutoffs: {
    totalRecords: number;
    byYear: Array<{ year: number; count: number }>;
    byStream: Array<{ stream: string; count: number }>;
  };
  generated: string;
}

export class ConfigMetadataService {
  private cache: Map<string, any> = new Map();
  private cacheExpiry: number = 3600000; // 1 hour

  /**
   * Fetch metadata from static JSON files
   */
  private async fetchMetadata<T>(path: string): Promise<T> {
    const cacheKey = `metadata:${path}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const response = await fetch(`/data/metadata/${path}.json`);

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${path}`);
      }

      const data = await response.json();

      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.error(`Error fetching metadata ${path}:`, error);
      throw error;
    }
  }

  /**
   * Get available years (auto-detected from data)
   */
  async getAvailableYears(): Promise<number[]> {
    const metadata = await this.fetchMetadata<YearMetadata>('available-years');
    return metadata.years;
  }

  /**
   * Get latest year
   */
  async getLatestYear(): Promise<number> {
    const metadata = await this.fetchMetadata<YearMetadata>('available-years');
    return metadata.latest;
  }

  /**
   * Get available rounds for a specific year
   */
  async getAvailableRounds(year: number): Promise<number[]> {
    const metadata = await this.fetchMetadata<RoundMetadata>('available-rounds');
    return metadata.rounds[year] || [];
  }

  /**
   * Get all available rounds across all years
   */
  async getAllAvailableRounds(): Promise<Record<number, number[]>> {
    const metadata = await this.fetchMetadata<RoundMetadata>('available-rounds');
    return metadata.rounds;
  }

  /**
   * Get filter options (categories, quotas, etc.)
   */
  async getFilterOptions(): Promise<FilterOptions> {
    return this.fetchMetadata<FilterOptions>('filter-options');
  }

  /**
   * Get available categories
   */
  async getCategories(): Promise<string[]> {
    const options = await this.getFilterOptions();
    return options.categories;
  }

  /**
   * Get available quotas
   */
  async getQuotas(): Promise<string[]> {
    const options = await this.getFilterOptions();
    return options.quotas;
  }

  /**
   * Get available streams
   */
  async getStreams(): Promise<string[]> {
    const options = await this.getFilterOptions();
    return options.streams;
  }

  /**
   * Get available counselling bodies
   */
  async getCounsellingBodies(): Promise<string[]> {
    const options = await this.getFilterOptions();
    return options.counsellingBodies;
  }

  /**
   * Get colleges index (all colleges)
   */
  async getCollegesIndex(): Promise<CollegeMetadata> {
    return this.fetchMetadata<CollegeMetadata>('colleges-index');
  }

  /**
   * Get colleges for a specific stream
   */
  async getCollegesByStream(stream: string): Promise<CollegeMetadata> {
    return this.fetchMetadata<CollegeMetadata>(`colleges-${stream}`);
  }

  /**
   * Get courses index (all courses)
   */
  async getCoursesIndex(): Promise<CourseMetadata> {
    return this.fetchMetadata<CourseMetadata>('courses-index');
  }

  /**
   * Get courses for a specific stream
   */
  async getCoursesByStream(stream: string): Promise<CourseMetadata> {
    return this.fetchMetadata<CourseMetadata>(`courses-${stream}`);
  }

  /**
   * Get states index
   */
  async getStatesIndex(): Promise<StateMetadata> {
    return this.fetchMetadata<StateMetadata>('states-index');
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<Statistics> {
    return this.fetchMetadata<Statistics>('statistics');
  }

  /**
   * Get search index for client-side search
   */
  async getSearchIndex(): Promise<any[]> {
    const data = await this.fetchMetadata<any>('search-index');
    return data.index;
  }

  /**
   * Clear cache (useful after data updates)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if data is up to date by comparing versions
   */
  async checkForUpdates(): Promise<{
    hasUpdates: boolean;
    currentVersion: string;
    latestVersion: string;
  }> {
    try {
      // Fetch latest manifest
      const manifest = await fetch('/data/manifest.json').then(r => r.json());
      const latestVersion = manifest.version;

      // Get current version from localStorage
      const currentVersion = localStorage.getItem('dataVersion') || 'unknown';

      const hasUpdates = latestVersion !== currentVersion;

      if (hasUpdates) {
        console.log(`Data update detected: ${currentVersion} → ${latestVersion}`);
      }

      return {
        hasUpdates,
        currentVersion,
        latestVersion
      };
    } catch (error) {
      console.error('Error checking for updates:', error);
      return {
        hasUpdates: false,
        currentVersion: 'unknown',
        latestVersion: 'unknown'
      };
    }
  }

  /**
   * Update local version and clear cache
   */
  async updateToLatestVersion(): Promise<void> {
    const { latestVersion } = await this.checkForUpdates();

    // Clear all caches
    this.clearCache();

    // Clear browser caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    // Clear localStorage data caches (but keep user preferences)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('cutoffs:') || key.startsWith('colleges:') || key.startsWith('courses:'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Update version
    localStorage.setItem('dataVersion', latestVersion);

    console.log(`Updated to version ${latestVersion}`);
  }
}

// Singleton instance
let configMetadataService: ConfigMetadataService | null = null;

export function getConfigMetadataService(): ConfigMetadataService {
  if (!configMetadataService) {
    configMetadataService = new ConfigMetadataService();
  }
  return configMetadataService;
}
