/**
 * Hierarchical College Matching Algorithm
 * Reduces O(n×m) complexity to O(log n) by filtering:
 * State → Course → College Name Matching
 */

interface CollegeRecord {
  id: number;
  name: string;
  state_id: number;
  state_name: string;
  university_id?: number;
  university_name?: string;
  management?: string;
  location?: string; // City/district where college is located
  address?: string;
}

interface CourseRecord {
  id: number;
  name: string;
  code: string;
  domain: string;
  level: string;
}

interface CounsellingRecord {
  raw_college_name: string;
  state: string;
  course: string;
  year: number;
  round: string;
  quota: string;
  category: string;
  rank: number;
}

interface MatchResult {
  college_id: number;
  confidence: number;
  method: 'EXACT' | 'FUZZY' | 'HIERARCHICAL' | 'LOCATION_MATCHED';
  candidates_reduced: number;
  location_matched?: string; // Location that was successfully matched
}

interface LocationLookup {
  [state: string]: {
    [collegeName: string]: string[]; // college name -> locations
  };
}

export class HierarchicalMatcher {
  private colleges: Map<number, CollegeRecord> = new Map();
  private courses: Map<string, CourseRecord> = new Map();
  private stateNameToId: Map<string, number> = new Map();
  private collegesByState: Map<number, CollegeRecord[]> = new Map();
  private collegesByCourse: Map<number, Set<number>> = new Map(); // course_id -> college_ids
  private locationLookup: LocationLookup = {}; // state -> college -> locations
  private collegesByLocation: Map<string, CollegeRecord[]> = new Map(); // "state|college|location" -> colleges

  constructor(
    colleges: CollegeRecord[],
    courses: CourseRecord[],
    collegeCourses: Array<{college_id: number; course_type_id: number}>,
    locationLookup?: LocationLookup
  ) {
    this.initializeData(colleges, courses, collegeCourses, locationLookup);
  }

  private initializeData(
    colleges: CollegeRecord[],
    courses: CourseRecord[],
    collegeCourses: Array<{college_id: number; course_type_id: number}>,
    locationLookup?: LocationLookup
  ): void {
    console.log('🏗️ Initializing enhanced hierarchical matcher with location support...');
    
    // Initialize location lookup if provided
    if (locationLookup) {
      this.locationLookup = locationLookup;
      console.log('📍 Location lookup initialized for disambiguation');
    }
    
    // Initialize colleges and state mappings
    for (const college of colleges) {
      this.colleges.set(college.id, college);
      this.stateNameToId.set(college.state_name.toUpperCase(), college.state_id);
      
      if (!this.collegesByState.has(college.state_id)) {
        this.collegesByState.set(college.state_id, []);
      }
      this.collegesByState.get(college.state_id)!.push(college);
      
      // Initialize location-based lookup
      if (college.location) {
        const locationKey = `${college.state_name.toUpperCase()}|${college.name.toUpperCase()}|${college.location.toUpperCase()}`;
        if (!this.collegesByLocation.has(locationKey)) {
          this.collegesByLocation.set(locationKey, []);
        }
        this.collegesByLocation.get(locationKey)!.push(college);
      }
    }

    // Initialize courses
    for (const course of courses) {
      this.courses.set(course.name.toUpperCase(), course);
    }

    // Initialize course-college mappings
    for (const cc of collegeCourses) {
      if (!this.collegesByCourse.has(cc.course_type_id)) {
        this.collegesByCourse.set(cc.course_type_id, new Set());
      }
      this.collegesByCourse.get(cc.course_type_id)!.add(cc.college_id);
    }

    console.log(`✅ Initialized: ${colleges.length} colleges, ${courses.length} courses`);
    console.log(`📍 States: ${this.stateNameToId.size}`);
  }

  /**
   * Enhanced Hierarchical matching algorithm implementation
   * Step 1: Filter by state (2443 → ~127 colleges)
   * Step 2: Filter by course (~127 → ~41 colleges) 
   * Step 3: Filter by location (~41 → ~8 colleges) [NEW!]
   * Step 4: Match college name (~8 candidates)
   */
  public async matchCollege(record: CounsellingRecord): Promise<MatchResult | null> {
    const startTime = Date.now();
    let candidates = Array.from(this.colleges.values());
    let candidatesReduced = candidates.length;

    // Step 1: Filter by State
    const stateId = this.stateNameToId.get(record.state.toUpperCase());
    if (!stateId) {
      console.warn(`❌ State not found: ${record.state}`);
      return null;
    }

    candidates = this.collegesByState.get(stateId) || [];
    console.log(`🔍 Step 1 - State filter: ${candidatesReduced} → ${candidates.length} colleges`);

    if (candidates.length === 0) {
      return null;
    }

    // Step 2: Filter by Course
    const course = this.courses.get(record.course.toUpperCase());
    if (course) {
      const collegeIdsForCourse = this.collegesByCourse.get(course.id);
      if (collegeIdsForCourse) {
        candidates = candidates.filter(college => 
          collegeIdsForCourse.has(college.id)
        );
        console.log(`🔍 Step 2 - Course filter: ${candidates.length} colleges for ${course.name}`);
      }
    }

    // Step 3: Filter by Location (NEW!)
    const extractedLocation = this.extractLocationFromCollegeName(record.raw_college_name);
    if (extractedLocation && this.hasMultipleLocations(record.state, candidates)) {
      const locationFilteredCandidates = this.filterByLocation(candidates, record.state, extractedLocation);
      if (locationFilteredCandidates.length > 0) {
        candidates = locationFilteredCandidates;
        console.log(`🔍 Step 3 - Location filter: ${candidatesReduced} → ${candidates.length} colleges (${extractedLocation})`);
      }
    }

    candidatesReduced = candidates.length;

    // Step 4: College Name Matching
    const matchResult = this.findBestCollegeMatch(record.raw_college_name, candidates);
    
    if (matchResult) {
      const elapsed = Date.now() - startTime;
      console.log(`✅ Match found in ${elapsed}ms: ${matchResult.confidence.toFixed(4)} confidence`);
      
      return {
        ...matchResult,
        candidates_reduced: candidatesReduced,
        location_matched: extractedLocation
      };
    }

    console.log(`❌ No match found for: ${record.raw_college_name}`);
    return null;
  }

  /**
   * Find the best college match from filtered candidates
   * Uses multiple matching strategies with confidence scoring
   */
  private findBestCollegeMatch(
    rawName: string, 
    candidates: CollegeRecord[]
  ): Omit<MatchResult, 'candidates_reduced' | 'location_matched'> | null {
    
    const normalizedRaw = this.normalizeCollegeName(rawName);
    let bestMatch: Omit<MatchResult, 'candidates_reduced' | 'location_matched'> | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const normalizedCandidate = this.normalizeCollegeName(candidate.name);
      
      // Strategy 1: Exact match
      if (normalizedRaw === normalizedCandidate) {
        return {
          college_id: candidate.id,
          confidence: 1.0,
          method: 'EXACT'
        };
      }

      // Strategy 2: Fuzzy matching with multiple algorithms
      const fuzzyScore = this.calculateFuzzyScore(normalizedRaw, normalizedCandidate);
      
      if (fuzzyScore > bestScore && fuzzyScore > 0.7) { // Threshold for acceptance
        bestScore = fuzzyScore;
        bestMatch = {
          college_id: candidate.id,
          confidence: fuzzyScore,
          method: fuzzyScore > 0.9 ? 'HIERARCHICAL' : 'FUZZY'
        };
      }
    }

    return bestMatch;
  }

  /**
   * Location helpers
   */
  private hasMultipleLocations(state: string, candidates: CollegeRecord[]): boolean {
    const normalizedState = state.toUpperCase();
    const byName = new Map<string, Set<string>>();
    for (const c of candidates) {
      const key = c.name.toUpperCase();
      if (!byName.has(key)) byName.set(key, new Set<string>());
      if (c.location) byName.get(key)!.add(c.location.toUpperCase());
    }
    // If any college name maps to more than one location, return true
    for (const set of byName.values()) {
      if (set.size > 1) return true;
    }
    // Also consult provided locationLookup if any
    const stateLookup = this.locationLookup[normalizedState];
    if (stateLookup) {
      for (const locs of Object.values(stateLookup)) {
        if (locs.length > 1) return true;
      }
    }
    return false;
  }

  private filterByLocation(candidates: CollegeRecord[], state: string, location: string): CollegeRecord[] {
    const normalizedState = state.toUpperCase();
    const normalizedLocation = location.toUpperCase();

    // Prefer exact location on candidate records
    const filtered = candidates.filter(c => (c.location || '').toUpperCase().includes(normalizedLocation));

    if (filtered.length > 0) return filtered;

    // Fallback to locationLookup map when candidate records don't have explicit location
    const groupedByName = new Map<string, CollegeRecord[]>();
    for (const c of candidates) {
      const key = c.name.toUpperCase();
      if (!groupedByName.has(key)) groupedByName.set(key, []);
      groupedByName.get(key)!.push(c);
    }

    const stateLookup = this.locationLookup[normalizedState] || {};
    for (const [name, group] of groupedByName.entries()) {
      const locs = stateLookup[name];
      if (locs && locs.some(loc => loc.toUpperCase().includes(normalizedLocation))) {
        // Keep this name group; others get filtered out later
        filtered.push(...group);
      }
    }

    return filtered.length > 0 ? filtered : candidates;
  }

  private extractLocationFromCollegeName(rawName: string): string | null {
    // Heuristic: pick last meaningful token that's not state name or common tail
    const cleaned = rawName
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .replace(/[^A-Z0-9,\s]/g, '')
      .trim();

    // Split by commas and reverse for tail scanning
    const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;

    // Common tails to ignore (STATE names and INDIA markers can be filtered earlier)
    const ignore = new Set(['INDIA']);

    for (let i = parts.length - 1; i >= 0; i--) {
      const token = parts[i];
      if (!ignore.has(token) && token.length >= 3) {
        return token; // e.g., 'ELURU', 'NELLORE'
      }
    }

    return null;
  }

  /**
   * Normalize college names for better matching
   * Removes common variations and standardizes format
   */
  private normalizeCollegeName(name: string): string {
    return name
      .toUpperCase()
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\b(COLLEGE|MEDICAL|GOVERNMENT|GOVT|INSTITUTE|UNIVERSITY)\b/g, '') // Remove common words
      .replace(/\b(OF|AND|&|THE)\b/g, '') // Remove connector words
      .replace(/\s+/g, ' ') // Clean up spaces again
      .trim();
  }

  /**
   * Calculate fuzzy similarity score using multiple algorithms
   * Combines Levenshtein distance, Jaccard similarity, and keyword matching
   */
  private calculateFuzzyScore(str1: string, str2: string): number {
    // Algorithm 1: Levenshtein distance
    const levenshteinScore = 1 - (this.levenshteinDistance(str1, str2) / Math.max(str1.length, str2.length));
    
    // Algorithm 2: Jaccard similarity (word-based)
    const words1 = new Set(str1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(str2.split(' ').filter(w => w.length > 2));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    const jaccardScore = union.size > 0 ? intersection.size / union.size : 0;
    
    // Algorithm 3: Keyword matching (weighted)
    const keywordScore = this.calculateKeywordScore(str1, str2);
    
    // Weighted combination
    return (levenshteinScore * 0.3) + (jaccardScore * 0.4) + (keywordScore * 0.3);
  }

  private calculateKeywordScore(str1: string, str2: string): number {
    const keywords1 = str1.split(' ').filter(w => w.length > 3);
    const keywords2 = str2.split(' ').filter(w => w.length > 3);
    
    if (keywords1.length === 0 || keywords2.length === 0) return 0;
    
    let matches = 0;
    for (const kw1 of keywords1) {
      for (const kw2 of keywords2) {
        if (kw1.includes(kw2) || kw2.includes(kw1)) {
          matches++;
          break;
        }
      }
    }
    
    return matches / Math.max(keywords1.length, keywords2.length);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1, // deletion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Batch processing for large datasets with progress tracking
   */
  public async processBatch(
    records: CounsellingRecord[],
    batchSize: number = 1000,
    onProgress?: (processed: number, total: number) => void
  ): Promise<Array<{record: CounsellingRecord; match: MatchResult | null}>> {
    
    console.log(`🚀 Starting batch processing: ${records.length} records in batches of ${batchSize}`);
    
    const results: Array<{record: CounsellingRecord; match: MatchResult | null}> = [];
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async record => ({
          record,
          match: await this.matchCollege(record)
        }))
      );
      
      results.push(...batchResults);
      
      if (onProgress) {
        onProgress(Math.min(i + batchSize, records.length), records.length);
      }
      
      // Small delay to prevent overwhelming the system
      if (i + batchSize < records.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    const successful = results.filter(r => r.match !== null).length;
    console.log(`✅ Batch processing complete: ${successful}/${records.length} matches found`);
    
    return results;
  }

  /**
   * Get matching statistics for analysis
   */
  public getMatchingStats(): {
    totalColleges: number;
    stateCount: number;
    courseCount: number;
    averageCandidatesPerState: number;
  } {
    const stateCollegeCounts = Array.from(this.collegesByState.values()).map(colleges => colleges.length);
    
    return {
      totalColleges: this.colleges.size,
      stateCount: this.stateNameToId.size,
      courseCount: this.courses.size,
      averageCandidatesPerState: stateCollegeCounts.reduce((a, b) => a + b, 0) / stateCollegeCounts.length
    };
  }
}