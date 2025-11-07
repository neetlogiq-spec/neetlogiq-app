import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import TypesenseManager from './typesense-manager';

export interface UnmatchedCollege {
  id: string;
  stagingName: string;
  matchConfidence: number;
  matchMethod: string;
  distance: number;
  suggestedMatches: Array<{
    id: string;
    name: string;
    fullName?: string;
    state: string;
    city?: string;
    confidence: number;
    source: 'typesense' | 'fuzzy';
  }>;
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'manual_match';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  finalMatchId?: string;
}

export interface UnmatchedCourse {
  id: string;
  stagingName: string;
  matchConfidence: number;
  matchMethod: string;
  distance: number;
  suggestedMatches: Array<{
    id: string;
    name: string;
    type: string;
    confidence: number;
    source: 'typesense' | 'fuzzy';
  }>;
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'manual_match';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  finalMatchId?: string;
}

export interface ReviewSummary {
  totalUnmatchedColleges: number;
  totalUnmatchedCourses: number;
  pendingReviews: number;
  completedReviews: number;
  reviewProgress: number;
}

export class ManualReviewManager {
  private dataDir: string;
  private stagingDir: string;
  private db: Database.Database | null = null;
  private typesenseManager: TypesenseManager;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.stagingDir = path.join(this.dataDir, 'staging');
    this.typesenseManager = new TypesenseManager();
  }

  /**
   * Initialize manual review system
   */
  async initialize(): Promise<void> {
    console.log('🔍 Initializing manual review system...');
    
    // Initialize Typesense
    await this.typesenseManager.initialize();
    
    // Initialize database connection
    const dbPath = path.join(this.stagingDir, 'staging.db');
    if (fs.existsSync(dbPath)) {
      this.db = new Database(dbPath);
      console.log('✅ Connected to staging database for manual review');
    } else {
      throw new Error('Staging database not found. Please run AIQ import first.');
    }
  }

  /**
   * Generate manual review data for unmatched colleges
   */
  async generateCollegeReviewData(): Promise<UnmatchedCollege[]> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('📋 Generating college review data...');

    // Get unmatched colleges from staging database
    const unmatchedColleges = this.db.prepare(`
      SELECT * FROM staging_college_matches 
      WHERE unified_college_id IS NULL OR match_method = 'manual'
      ORDER BY match_confidence DESC
    `).all() as any[];

    const reviewData: UnmatchedCollege[] = [];

    for (const college of unmatchedColleges) {
      // Get suggested matches using Typesense
      const typesenseMatches = await this.typesenseManager.searchColleges(college.staging_college_name, 5);
      
      // Get fuzzy matches from unified database
      const fuzzyMatches = await this.getFuzzyCollegeMatches(college.staging_college_name);

      const suggestedMatches = [
        ...typesenseMatches.map(match => ({
          id: match.document.id,
          name: match.document.name,
          fullName: match.document.fullName,
          state: match.document.state,
          city: match.document.city,
          confidence: match.score,
          source: 'typesense' as const
        })),
        ...fuzzyMatches.map(match => ({
          id: match.id,
          name: match.name,
          fullName: match.fullName,
          state: match.state,
          city: match.city,
          confidence: match.confidence,
          source: 'fuzzy' as const
        }))
      ].sort((a, b) => b.confidence - a.confidence).slice(0, 5);

      const reviewItem: UnmatchedCollege = {
        id: college.id,
        stagingName: college.staging_college_name,
        matchConfidence: college.match_confidence || 0,
        matchMethod: college.match_method || 'manual',
        distance: college.distance || 999,
        suggestedMatches,
        reviewStatus: 'pending',
        reviewedBy: undefined,
        reviewedAt: undefined,
        notes: undefined,
        finalMatchId: undefined
      };

      reviewData.push(reviewItem);
    }

    // Save review data to file
    const reviewFilePath = path.join(this.stagingDir, 'manual_review_colleges.json');
    fs.writeFileSync(reviewFilePath, JSON.stringify(reviewData, null, 2));
    
    console.log(`✅ Generated review data for ${reviewData.length} unmatched colleges`);
    return reviewData;
  }

  /**
   * Generate manual review data for unmatched courses
   */
  async generateCourseReviewData(): Promise<UnmatchedCourse[]> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('📋 Generating course review data...');

    // Get unmatched courses from staging database
    const unmatchedCourses = this.db.prepare(`
      SELECT * FROM staging_course_matches 
      WHERE unified_course_id IS NULL OR match_method = 'manual'
      ORDER BY match_confidence DESC
    `).all() as any[];

    const reviewData: UnmatchedCourse[] = [];

    for (const course of unmatchedCourses) {
      // Get suggested matches using Typesense
      const typesenseMatches = await this.typesenseManager.searchCourses(course.staging_course_name, 5);
      
      // Get fuzzy matches from unified database
      const fuzzyMatches = await this.getFuzzyCourseMatches(course.staging_course_name);

      const suggestedMatches = [
        ...typesenseMatches.map(match => ({
          id: match.document.id,
          name: match.document.name,
          type: match.document.type,
          confidence: match.score,
          source: 'typesense' as const
        })),
        ...fuzzyMatches.map(match => ({
          id: match.id,
          name: match.name,
          type: match.type,
          confidence: match.confidence,
          source: 'fuzzy' as const
        }))
      ].sort((a, b) => b.confidence - a.confidence).slice(0, 5);

      const reviewItem: UnmatchedCourse = {
        id: course.id,
        stagingName: course.staging_course_name,
        matchConfidence: course.match_confidence || 0,
        matchMethod: course.match_method || 'manual',
        distance: course.distance || 999,
        suggestedMatches,
        reviewStatus: 'pending',
        reviewedBy: undefined,
        reviewedAt: undefined,
        notes: undefined,
        finalMatchId: undefined
      };

      reviewData.push(reviewItem);
    }

    // Save review data to file
    const reviewFilePath = path.join(this.stagingDir, 'manual_review_courses.json');
    fs.writeFileSync(reviewFilePath, JSON.stringify(reviewData, null, 2));
    
    console.log(`✅ Generated review data for ${reviewData.length} unmatched courses`);
    return reviewData;
  }

  /**
   * Get fuzzy college matches from unified database
   */
  private async getFuzzyCollegeMatches(stagingName: string): Promise<any[]> {
    try {
      const collegesPath = path.join(this.dataDir, 'unified_colleges.json');
      if (!fs.existsSync(collegesPath)) return [];

      const collegesData = JSON.parse(fs.readFileSync(collegesPath, 'utf8'));
      const colleges = collegesData.data || collegesData;

      // Simple fuzzy matching using string similarity
      const matches = colleges.map((college: any) => {
        const similarity = this.calculateSimilarity(stagingName, college.name);
        return {
          ...college,
          confidence: similarity
        };
      }).filter((match: any) => match.confidence > 0.3)
        .sort((a: any, b: any) => b.confidence - a.confidence)
        .slice(0, 3);

      return matches;
    } catch (error: any) {
      console.error('❌ Failed to get fuzzy college matches:', error);
      return [];
    }
  }

  /**
   * Get fuzzy course matches from unified database
   */
  private async getFuzzyCourseMatches(stagingName: string): Promise<any[]> {
    try {
      const coursesPath = path.join(this.dataDir, 'unified_courses.json');
      if (!fs.existsSync(coursesPath)) return [];

      const coursesData = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));
      const courses = coursesData.data || coursesData;

      // Simple fuzzy matching using string similarity
      const matches = courses.map((course: any) => {
        const similarity = this.calculateSimilarity(stagingName, course.name);
        return {
          ...course,
          confidence: similarity
        };
      }).filter((match: any) => match.confidence > 0.3)
        .sort((a: any, b: any) => b.confidence - a.confidence)
        .slice(0, 3);

      return matches;
    } catch (error: any) {
      console.error('❌ Failed to get fuzzy course matches:', error);
      return [];
    }
  }

  /**
   * Calculate string similarity
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().replace(/[^\w\s]/g, '');
    const s2 = str2.toLowerCase().replace(/[^\w\s]/g, '');
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get review summary
   */
  async getReviewSummary(): Promise<ReviewSummary> {
    const collegesPath = path.join(this.stagingDir, 'manual_review_colleges.json');
    const coursesPath = path.join(this.stagingDir, 'manual_review_courses.json');

    let totalUnmatchedColleges = 0;
    let totalUnmatchedCourses = 0;
    let pendingReviews = 0;
    let completedReviews = 0;

    if (fs.existsSync(collegesPath)) {
      const collegesData = JSON.parse(fs.readFileSync(collegesPath, 'utf8'));
      totalUnmatchedColleges = collegesData.length;
      pendingReviews += collegesData.filter((c: UnmatchedCollege) => c.reviewStatus === 'pending').length;
      completedReviews += collegesData.filter((c: UnmatchedCollege) => c.reviewStatus !== 'pending').length;
    }

    if (fs.existsSync(coursesPath)) {
      const coursesData = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));
      totalUnmatchedCourses = coursesData.length;
      pendingReviews += coursesData.filter((c: UnmatchedCourse) => c.reviewStatus === 'pending').length;
      completedReviews += coursesData.filter((c: UnmatchedCourse) => c.reviewStatus !== 'pending').length;
    }

    const totalReviews = pendingReviews + completedReviews;
    const reviewProgress = totalReviews > 0 ? (completedReviews / totalReviews) * 100 : 0;

    return {
      totalUnmatchedColleges,
      totalUnmatchedCourses,
      pendingReviews,
      completedReviews,
      reviewProgress
    };
  }

  /**
   * Export review data for manual review
   */
  async exportReviewData(): Promise<{ colleges: UnmatchedCollege[], courses: UnmatchedCourse[] }> {
    const collegesPath = path.join(this.stagingDir, 'manual_review_colleges.json');
    const coursesPath = path.join(this.stagingDir, 'manual_review_courses.json');

    const colleges = fs.existsSync(collegesPath) 
      ? JSON.parse(fs.readFileSync(collegesPath, 'utf8'))
      : [];
    
    const courses = fs.existsSync(coursesPath) 
      ? JSON.parse(fs.readFileSync(coursesPath, 'utf8'))
      : [];

    return { colleges, courses };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default ManualReviewManager;
