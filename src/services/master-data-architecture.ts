/**
 * Master Data Architecture for NeetLogIQ
 * Single source of truth with normalized, standardized data
 * All imports must reference master data entities
 */

interface MasterDataEntity {
  id: number;
  name: string;
  normalized_name: string;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
  version: number;
  created_by?: string;
  updated_by?: string;
}

interface MasterState extends MasterDataEntity {
  code: string; // AP, MH, TN, etc.
  region?: string; // South, North, etc.
}


interface MasterCollege extends MasterDataEntity {
  short_name?: string;
  state_id: number;
  management: 'GOVERNMENT' | 'PRIVATE' | 'TRUST' | 'CORPORATION';
  location?: string;
  address?: string;
  establishment_year?: number;
  university_affiliation?: string; // Simple text field instead of foreign key
  // Matching aids
  alternate_names?: string[]; // Common variations
  keywords?: string[]; // For fuzzy matching
}

interface MasterCourse extends MasterDataEntity {
  code: string; // MBBS, MD_GM, BDS, etc.
  domain: 'MEDICAL' | 'DENTAL' | 'DNB';
  level: 'UG' | 'PG';
  duration_years: number;
  full_name?: string; // "Doctor of Medicine in General Medicine"
}

interface MasterCategory extends MasterDataEntity {
  code: string; // GEN, OBC, SC, ST, EWS, PWD
  is_reservation: boolean;
  reservation_percentage?: number;
}

interface MasterQuota extends MasterDataEntity {
  code: string; // AIQ, STATE, MGMT
  description?: string;
}

interface ImportMatchResult {
  master_id: number;
  confidence: number;
  match_method: 'EXACT' | 'FUZZY' | 'MANUAL' | 'CREATED';
  raw_value: string;
  matched_value: string;
}

interface ImportValidationError {
  row_number: number;
  field: string;
  raw_value: string;
  error_type: 'NO_MATCH' | 'AMBIGUOUS_MATCH' | 'INVALID_FORMAT' | 'REQUIRED_FIELD' | 'DUPLICATE_DETECTED' | 'LOW_CONFIDENCE';
  suggested_action: string;
  confidence_score?: number;
  potential_matches?: Array<{id: number; name: string; confidence: number}>;
}

interface AuditTrail {
  id: number;
  table_name: string;
  record_id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT_MATCH';
  old_values?: any;
  new_values?: any;
  raw_input?: string;
  match_confidence?: number;
  match_method?: string;
  user_id?: string;
  timestamp: Date;
  import_batch_id?: string;
}

interface PendingReview {
  id: number;
  type: 'NEW_ENTRY' | 'LOW_CONFIDENCE' | 'DUPLICATE' | 'AMBIGUOUS';
  entity_type: 'STATE' | 'COLLEGE' | 'COURSE' | 'CATEGORY' | 'QUOTA';
  raw_data: any;
  suggested_master_data?: any;
  potential_matches?: Array<{id: number; name: string; confidence: number}>;
  confidence_score?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: Date;
  reviewed_at?: Date;
  reviewed_by?: string;
  review_notes?: string;
  import_batch_id: string;
}

interface ImportBatch {
  id: string;
  type: 'COLLEGE_COURSE' | 'COUNSELLING';
  total_records: number;
  processed_records: number;
  successful_matches: number;
  validation_errors: number;
  pending_reviews: number;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  started_at: Date;
  completed_at?: Date;
  file_name?: string;
  progress_percentage: number;
}

export class MasterDataManager {
  // In-memory caches for fast lookup during import
  private masterStates: Map<string, MasterState> = new Map();
  private masterColleges: Map<string, MasterCollege> = new Map();
  private masterCourses: Map<string, MasterCourse> = new Map();
  private masterCategories: Map<string, MasterCategory> = new Map();
  private masterQuotas: Map<string, MasterQuota> = new Map();

  // Fuzzy matching helpers
  private collegeKeywords: Map<string, number[]> = new Map(); // keyword -> college_ids
  private courseAliases: Map<string, number> = new Map(); // alias -> course_id
  
  // Review and audit systems
  private pendingReviews: Map<number, PendingReview> = new Map();
  private currentBatch: ImportBatch | null = null;
  
  // Configuration
  private readonly LOW_CONFIDENCE_THRESHOLD = 0.8;
  private readonly MIN_MATCH_THRESHOLD = 0.7;

  constructor() {
    this.initializeMasterData();
  }

  private async initializeMasterData(): Promise<void> {
    console.log('🏗️ Initializing Master Data Architecture...');
    
    // Load all master data from database into memory for fast lookups
    await this.loadMasterStates();
    await this.loadMasterColleges();
    await this.loadMasterCourses();
    await this.loadMasterCategories();
    await this.loadMasterQuotas();
    
    // Build search indexes
    await this.buildSearchIndexes();
    
    console.log('✅ Master Data loaded and indexed');
  }

  /**
   * Import college/course data with master data validation
   */
  async importCollegeCourseData(
    rawData: Array<{
      state: string;
      college_institute: string;
      address?: string;
      university_affiliation?: string;
      management?: string;
      course: string;
      seats: number;
    }>,
    fileName?: string,
    progressCallback?: (progress: number, status: string) => void
  ): Promise<{
    success: boolean;
    batch_id: string;
    imported_records: number;
    validation_errors: ImportValidationError[];
    pending_reviews: number;
    duplicate_flags: number;
    low_confidence_matches: number;
  }> {
    
    // Create import batch
    const batchId = this.generateBatchId();
    this.currentBatch = {
      id: batchId,
      type: 'COLLEGE_COURSE',
      total_records: rawData.length,
      processed_records: 0,
      successful_matches: 0,
      validation_errors: 0,
      pending_reviews: 0,
      status: 'PROCESSING',
      started_at: new Date(),
      file_name: fileName,
      progress_percentage: 0
    };
    
    console.log(`📊 Starting college/course data import [Batch: ${batchId}] with master data validation...`);
    
    const validationErrors: ImportValidationError[] = [];
    const importedRecords: any[] = [];
    let duplicateFlags = 0;
    let lowConfidenceMatches = 0;
    let pendingReviewsCount = 0;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 1;

      // Update progress
      const progress = Math.floor((i / rawData.length) * 100);
      if (progressCallback && i % 100 === 0) {
        progressCallback(progress, `Processing row ${i + 1}/${rawData.length}`);
      }
      this.currentBatch!.processed_records = i + 1;
      this.currentBatch!.progress_percentage = progress;

      try {
        // Step 1: Normalize and match state
        const stateMatch = await this.matchStateWithValidation(this.normalize(row.state), batchId, rowNumber);
        if (!stateMatch) {
          const pendingReview = await this.createPendingReview({
            type: 'NEW_ENTRY',
            entity_type: 'STATE',
            raw_data: { name: row.state },
            import_batch_id: batchId
          });
          pendingReviewsCount++;
          validationErrors.push({
            row_number: rowNumber,
            field: 'state',
            raw_value: row.state,
            error_type: 'NO_MATCH',
            suggested_action: `Queued for review: Add '${this.normalize(row.state)}' to master_states table`
          });
          continue;
        }
        
        // Check for low confidence state match
        if (stateMatch.confidence < this.LOW_CONFIDENCE_THRESHOLD) {
          lowConfidenceMatches++;
          await this.createPendingReview({
            type: 'LOW_CONFIDENCE',
            entity_type: 'STATE',
            raw_data: { name: row.state },
            confidence_score: stateMatch.confidence,
            potential_matches: [{ id: stateMatch.master_id, name: stateMatch.matched_value, confidence: stateMatch.confidence }],
            import_batch_id: batchId
          });
        }

        // Step 2: Normalize and match college
        const collegeMatch = await this.matchCollege(
          this.normalize(row.college_institute),
          stateMatch.master_id
        );
        
        if (!collegeMatch) {
          // Flag for manual review - might be new college
          validationErrors.push({
            row_number: rowNumber,
            field: 'college_institute',
            raw_value: row.college_institute,
            error_type: 'NO_MATCH',
            suggested_action: `Review and potentially add '${this.normalize(row.college_institute)}' to master_colleges`
          });
          continue;
        }

        // Step 3: Normalize and match course
        const courseMatch = await this.matchCourse(this.normalize(row.course));
        if (!courseMatch) {
          validationErrors.push({
            row_number: rowNumber,
            field: 'course',
            raw_value: row.course,
            error_type: 'NO_MATCH',
            suggested_action: `Add '${this.normalize(row.course)}' to master_courses table`
          });
          continue;
        }

        // Step 4: Create import record with master IDs
        const importRecord = {
          master_college_id: collegeMatch.master_id,
          master_course_id: courseMatch.master_id,
          master_state_id: stateMatch.master_id,
          university_affiliation: this.normalize(row.university_affiliation || ''),
          seats: row.seats,
          management: this.normalize(row.management || ''),
          raw_data: row, // Keep original for audit
          match_confidence: Math.min(
            collegeMatch.confidence,
            courseMatch.confidence,
            stateMatch.confidence
          )
        };

        importedRecords.push(importRecord);

      } catch (error) {
        validationErrors.push({
          row_number: rowNumber,
          field: 'general',
          raw_value: JSON.stringify(row),
          error_type: 'INVALID_FORMAT',
          suggested_action: `Review data format: ${error}`
        });
      }
    }

    console.log(`✅ Import validation complete:`);
    console.log(`   Processed: ${rawData.length} rows`);
    console.log(`   Valid: ${importedRecords.length} records`);
    console.log(`   Errors: ${validationErrors.length} issues`);

    return {
      success: validationErrors.length === 0,
      imported_records: importedRecords.length,
      validation_errors: validationErrors,
      new_master_entries: newMasterEntries
    };
  }

  /**
   * Import counselling data with master data validation
   */
  async importCounsellingData(rawData: Array<{
    college_institute: string;
    state: string;
    course: string;
    category: string;
    quota: string;
    round: string;
    year: number;
    rank: number;
  }>): Promise<{
    success: boolean;
    imported_records: number;
    validation_errors: ImportValidationError[];
  }> {
    
    console.log('🎯 Starting counselling data import with master data validation...');
    
    const validationErrors: ImportValidationError[] = [];
    const importedRecords: any[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 1;

      try {
        // Extract college name using pattern-based extraction
        const extractedCollege = this.extractCollegeNameFromCounsellingData(row.college_institute);
        
        // Match against master data
        const collegeMatch = await this.matchCollege(extractedCollege, null);
        const courseMatch = await this.matchCourse(this.normalize(row.course));
        const categoryMatch = await this.matchCategory(this.normalize(row.category));
        const quotaMatch = await this.matchQuota(this.normalize(row.quota));
        const stateMatch = await this.matchState(this.normalize(row.state));

        // Validate all required matches
        const missingMatches = [];
        if (!collegeMatch) missingMatches.push('college');
        if (!courseMatch) missingMatches.push('course');
        if (!categoryMatch) missingMatches.push('category');
        if (!quotaMatch) missingMatches.push('quota');
        if (!stateMatch) missingMatches.push('state');

        if (missingMatches.length > 0) {
          validationErrors.push({
            row_number: rowNumber,
            field: missingMatches.join(', '),
            raw_value: `${row.college_institute} | ${row.course}`,
            error_type: 'NO_MATCH',
            suggested_action: `Review master data for: ${missingMatches.join(', ')}`
          });
          continue;
        }

        // Create counselling record with master IDs
        const counsellingRecord = {
          master_college_id: collegeMatch!.master_id,
          master_course_id: courseMatch!.master_id,
          master_category_id: categoryMatch!.master_id,
          master_quota_id: quotaMatch!.master_id,
          master_state_id: stateMatch!.master_id,
          round: row.round,
          year: row.year,
          opening_rank: row.rank, // Will be processed for opening/closing
          closing_rank: row.rank,
          raw_college_name: row.college_institute,
          match_confidence: Math.min(
            collegeMatch!.confidence,
            courseMatch!.confidence,
            categoryMatch!.confidence,
            quotaMatch!.confidence,
            stateMatch!.confidence
          )
        };

        importedRecords.push(counsellingRecord);

      } catch (error) {
        validationErrors.push({
          row_number: rowNumber,
          field: 'general',
          raw_value: JSON.stringify(row),
          error_type: 'INVALID_FORMAT',
          suggested_action: `Review data format: ${error}`
        });
      }
    }

    return {
      success: validationErrors.length < rawData.length * 0.1, // Allow 10% errors
      imported_records: importedRecords.length,
      validation_errors: validationErrors
    };
  }

  /**
   * Master data matching methods
   */
  private async matchState(normalizedName: string): Promise<ImportMatchResult | null> {
    // Exact match first
    if (this.masterStates.has(normalizedName)) {
      const state = this.masterStates.get(normalizedName)!;
      return {
        master_id: state.id,
        confidence: 1.0,
        match_method: 'EXACT',
        raw_value: normalizedName,
        matched_value: state.name
      };
    }

    // Try code match
    for (const state of this.masterStates.values()) {
      if (state.code === normalizedName) {
        return {
          master_id: state.id,
          confidence: 0.9,
          match_method: 'EXACT',
          raw_value: normalizedName,
          matched_value: state.name
        };
      }
    }

    // Fuzzy match
    for (const state of this.masterStates.values()) {
      if (this.fuzzyMatch(normalizedName, state.normalized_name) > 0.8) {
        return {
          master_id: state.id,
          confidence: 0.8,
          match_method: 'FUZZY',
          raw_value: normalizedName,
          matched_value: state.name
        };
      }
    }

    return null;
  }

  private async matchCollege(normalizedName: string, stateId: number | null): Promise<ImportMatchResult | null> {
    // Filter by state if provided
    const candidateColleges = stateId 
      ? Array.from(this.masterColleges.values()).filter(c => c.state_id === stateId)
      : Array.from(this.masterColleges.values());

    // Exact match
    for (const college of candidateColleges) {
      if (college.normalized_name === normalizedName) {
        return {
          master_id: college.id,
          confidence: 1.0,
          match_method: 'EXACT',
          raw_value: normalizedName,
          matched_value: college.name
        };
      }
    }

    // Fuzzy match
    let bestMatch: ImportMatchResult | null = null;
    let bestScore = 0;

    for (const college of candidateColleges) {
      const score = this.fuzzyMatch(normalizedName, college.normalized_name);
      if (score > bestScore && score > 0.7) {
        bestScore = score;
        bestMatch = {
          master_id: college.id,
          confidence: score,
          match_method: 'FUZZY',
          raw_value: normalizedName,
          matched_value: college.name
        };
      }
    }

    return bestMatch;
  }

  private async matchCourse(normalizedName: string): Promise<ImportMatchResult | null> {
    // Check exact match
    if (this.masterCourses.has(normalizedName)) {
      const course = this.masterCourses.get(normalizedName)!;
      return {
        master_id: course.id,
        confidence: 1.0,
        match_method: 'EXACT',
        raw_value: normalizedName,
        matched_value: course.name
      };
    }

    // Check aliases
    if (this.courseAliases.has(normalizedName)) {
      const courseId = this.courseAliases.get(normalizedName)!;
      const course = Array.from(this.masterCourses.values()).find(c => c.id === courseId);
      if (course) {
        return {
          master_id: course.id,
          confidence: 0.9,
          match_method: 'EXACT',
          raw_value: normalizedName,
          matched_value: course.name
        };
      }
    }

    return null;
  }

  private async matchCategory(normalizedName: string): Promise<ImportMatchResult | null> {
    for (const category of this.masterCategories.values()) {
      if (category.normalized_name === normalizedName || category.code === normalizedName) {
        return {
          master_id: category.id,
          confidence: 1.0,
          match_method: 'EXACT',
          raw_value: normalizedName,
          matched_value: category.name
        };
      }
    }
    return null;
  }

  private async matchQuota(normalizedName: string): Promise<ImportMatchResult | null> {
    for (const quota of this.masterQuotas.values()) {
      if (quota.normalized_name === normalizedName || quota.code === normalizedName) {
        return {
          master_id: quota.id,
          confidence: 1.0,
          match_method: 'EXACT',
          raw_value: normalizedName,
          matched_value: quota.name
        };
      }
    }
    return null;
  }


  /**
   * Utility methods
   */
  private normalize(text: string): string {
    return text.toUpperCase().trim().replace(/\s+/g, ' ');
  }

  private extractCollegeNameFromCounsellingData(fullText: string): string {
    // Use the pattern-based extraction we developed
    const parts = fullText.split(',');
    return this.normalize(parts[0]?.trim() || '');
  }

  private fuzzyMatch(str1: string, str2: string): number {
    // Simplified Jaccard similarity
    const words1 = new Set(str1.split(' '));
    const words2 = new Set(str2.split(' '));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  /**
   * Enhanced matching methods with validation and audit
   */
  private async matchStateWithValidation(normalizedName: string, batchId: string, rowNumber: number): Promise<ImportMatchResult | null> {
    const match = await this.matchState(normalizedName);
    if (match) {
      // Record audit trail
      await this.recordAuditTrail({
        table_name: 'master_states',
        record_id: match.master_id,
        action: 'IMPORT_MATCH',
        raw_input: normalizedName,
        match_confidence: match.confidence,
        match_method: match.match_method,
        import_batch_id: batchId
      });
    }
    return match;
  }

  private async matchCollegeWithValidation(
    normalizedName: string, 
    stateId: number | null, 
    batchId: string, 
    rowNumber: number
  ): Promise<ImportMatchResult | null> {
    // Check for duplicates first
    const duplicates = await this.detectDuplicateCollege(normalizedName, stateId);
    if (duplicates.length > 0) {
      await this.createPendingReview({
        type: 'DUPLICATE',
        entity_type: 'COLLEGE',
        raw_data: { name: normalizedName, state_id: stateId },
        potential_matches: duplicates,
        import_batch_id: batchId
      });
      return null; // Will be handled in review
    }

    const match = await this.matchCollege(normalizedName, stateId);
    if (match) {
      await this.recordAuditTrail({
        table_name: 'master_colleges',
        record_id: match.master_id,
        action: 'IMPORT_MATCH',
        raw_input: normalizedName,
        match_confidence: match.confidence,
        match_method: match.match_method,
        import_batch_id: batchId
      });
    }
    return match;
  }

  /**
   * Pending Review Management
   */
  private async createPendingReview(reviewData: Omit<PendingReview, 'id' | 'status' | 'created_at'>): Promise<PendingReview> {
    const review: PendingReview = {
      id: Date.now(), // In real app, would be auto-increment from DB
      ...reviewData,
      status: 'PENDING',
      created_at: new Date()
    };
    
    this.pendingReviews.set(review.id, review);
    console.log(`⚠️ Created pending review [${review.id}]: ${review.type} for ${review.entity_type}`);
    return review;
  }

  async getPendingReviews(entityType?: string, status?: string): Promise<PendingReview[]> {
    let reviews = Array.from(this.pendingReviews.values());
    
    if (entityType) {
      reviews = reviews.filter(r => r.entity_type === entityType);
    }
    if (status) {
      reviews = reviews.filter(r => r.status === status);
    }
    
    return reviews.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  async approvePendingReview(reviewId: number, userId: string, notes?: string): Promise<boolean> {
    const review = this.pendingReviews.get(reviewId);
    if (!review) return false;

    review.status = 'APPROVED';
    review.reviewed_at = new Date();
    review.reviewed_by = userId;
    review.review_notes = notes;

    // If it's a new entry, create the master record
    if (review.type === 'NEW_ENTRY') {
      await this.createMasterRecord(review.entity_type, review.suggested_master_data || review.raw_data, userId);
    }

    console.log(`✅ Approved pending review [${reviewId}] by ${userId}`);
    return true;
  }

  async rejectPendingReview(reviewId: number, userId: string, notes?: string): Promise<boolean> {
    const review = this.pendingReviews.get(reviewId);
    if (!review) return false;

    review.status = 'REJECTED';
    review.reviewed_at = new Date();
    review.reviewed_by = userId;
    review.review_notes = notes;

    console.log(`❌ Rejected pending review [${reviewId}] by ${userId}`);
    return true;
  }

  /**
   * Duplicate Detection
   */
  private async detectDuplicateCollege(normalizedName: string, stateId: number | null): Promise<Array<{id: number; name: string; confidence: number}>> {
    const duplicates: Array<{id: number; name: string; confidence: number}> = [];
    
    const candidateColleges = stateId 
      ? Array.from(this.masterColleges.values()).filter(c => c.state_id === stateId)
      : Array.from(this.masterColleges.values());

    for (const college of candidateColleges) {
      const similarity = this.fuzzyMatch(normalizedName, college.normalized_name);
      if (similarity > 0.9) { // Very high similarity suggests duplicate
        duplicates.push({
          id: college.id,
          name: college.name,
          confidence: similarity
        });
      }
    }

    return duplicates;
  }

  /**
   * Audit Trail Management
   */
  private async recordAuditTrail(auditData: Omit<AuditTrail, 'id' | 'timestamp'>): Promise<void> {
    const audit: AuditTrail = {
      id: Date.now(), // In real app, would be auto-increment from DB
      ...auditData,
      timestamp: new Date()
    };
    
    // In real implementation, save to database
    console.log(`📝 Audit: ${audit.action} on ${audit.table_name}[${audit.record_id}]`);
  }

  async getAuditTrail(entityType: string, recordId?: number, limit = 100): Promise<AuditTrail[]> {
    // In real implementation, query from database
    // This is a placeholder
    return [];
  }

  /**
   * Master Data CRUD with Version Control
   */
  async createMasterRecord(entityType: string, data: any, userId: string): Promise<number> {
    const normalizedData = {
      ...data,
      normalized_name: this.normalize(data.name),
      version: 1,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
      is_active: true
    };

    // In real implementation, save to appropriate master table
    const newId = Date.now(); // Placeholder ID
    
    await this.recordAuditTrail({
      table_name: `master_${entityType.toLowerCase()}`,
      record_id: newId,
      action: 'CREATE',
      new_values: normalizedData,
      user_id: userId
    });

    console.log(`➕ Created new master ${entityType}: ${data.name} [ID: ${newId}]`);
    return newId;
  }

  async updateMasterRecord(entityType: string, recordId: number, data: any, userId: string): Promise<boolean> {
    // In real implementation, fetch current record, increment version, update
    const currentRecord = {}; // Placeholder - fetch from DB
    const updatedData = {
      ...data,
      normalized_name: this.normalize(data.name),
      version: (currentRecord as any).version + 1,
      updated_by: userId,
      updated_at: new Date()
    };

    await this.recordAuditTrail({
      table_name: `master_${entityType.toLowerCase()}`,
      record_id: recordId,
      action: 'UPDATE',
      old_values: currentRecord,
      new_values: updatedData,
      user_id: userId
    });

    console.log(`📝 Updated master ${entityType}[${recordId}] by ${userId}`);
    return true;
  }

  /**
   * Batch Management
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getBatchStatus(batchId: string): Promise<ImportBatch | null> {
    if (this.currentBatch && this.currentBatch.id === batchId) {
      return this.currentBatch;
    }
    // In real implementation, fetch from database
    return null;
  }

  async getAllBatches(limit = 50): Promise<ImportBatch[]> {
    // In real implementation, fetch from database
    return this.currentBatch ? [this.currentBatch] : [];
  }

  // Placeholder methods - would load from actual database
  private async loadMasterStates(): Promise<void> {
    // Load from database and populate this.masterStates
  }

  private async loadMasterColleges(): Promise<void> {
    // Load from database and populate this.masterColleges
  }

  private async loadMasterCourses(): Promise<void> {
    // Load from database and populate this.masterCourses
  }

  private async loadMasterCategories(): Promise<void> {
    // Load from database and populate this.masterCategories
  }

  private async loadMasterQuotas(): Promise<void> {
    // Load from database and populate this.masterQuotas
  }

  private async buildSearchIndexes(): Promise<void> {
    // Build fuzzy matching indexes
  }

  /**
   * Get all colleges from master data for hierarchical filtering
   */
  async getAllColleges(): Promise<MasterCollege[]> {
    return Array.from(this.masterColleges.values());
  }

  /**
   * Get all states from master data
   */
  async getAllStates(): Promise<MasterState[]> {
    return Array.from(this.masterStates.values());
  }

  /**
   * Get all courses from master data
   */
  async getAllCourses(): Promise<MasterCourse[]> {
    return Array.from(this.masterCourses.values());
  }

  /**
   * Get all categories from master data
   */
  async getAllCategories(): Promise<MasterCategory[]> {
    return Array.from(this.masterCategories.values());
  }

  /**
   * Get all quotas from master data
   */
  async getAllQuotas(): Promise<MasterQuota[]> {
    return Array.from(this.masterQuotas.values());
  }
}
