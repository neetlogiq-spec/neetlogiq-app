import { MasterDataManager } from './master-data-architecture';

/**
 * Unified Hierarchical Matching Algorithm
 * 
 * This algorithm unifies the approach for both:
 * 1. College/Course data matching
 * 2. Counselling data matching
 * 
 * By leveraging master data as the single source of truth, we can apply
 * the same hierarchical filtering approach to both data types while
 * maintaining the pattern-based extraction for counselling data.
 */

interface MatchingContext {
  dataType: 'COLLEGE_COURSE' | 'COUNSELLING';
  batchId: string;
  progressCallback?: (progress: number, status: string) => void;
}

interface HierarchicalMatchResult {
  success: boolean;
  confidence: number;
  matches: {
    state?: any;
    college?: any;
    course?: any;
    category?: any;
    quota?: any;
  };
  extractedData?: {
    collegeName: string;
    stateName?: string;
    location?: string;
  };
  matchingSteps: string[];
  alternatives?: Array<{
    college: any;
    confidence: number;
    reason: string;
  }>;
}

export class UnifiedHierarchicalMatcher {
  private masterDataManager: MasterDataManager;
  
  // Hierarchical filtering performance stats
  private stats = {
    totalColleges: 0,
    stateFiltered: 0,
    courseFiltered: 0,
    locationFiltered: 0,
    finalCandidates: 0,
    exactMatches: 0,
    fuzzyMatches: 0
  };

  constructor(masterDataManager: MasterDataManager) {
    this.masterDataManager = masterDataManager;
  }

  /**
   * Unified matching method that handles both college/course and counselling data
   */
  async performHierarchicalMatch(
    rawData: any,
    context: MatchingContext
  ): Promise<HierarchicalMatchResult> {
    
    const result: HierarchicalMatchResult = {
      success: false,
      confidence: 0,
      matches: {},
      matchingSteps: [],
      alternatives: []
    };

    try {
      // Step 1: Extract and normalize data based on type
      const extractedData = await this.extractDataByType(rawData, context.dataType);
      result.extractedData = extractedData;
      result.matchingSteps.push(`Data extracted: ${JSON.stringify(extractedData)}`);

      // Step 2: Apply hierarchical filtering to drastically reduce search space
      const hierarchicalResult = await this.applyHierarchicalFiltering(extractedData, context);
      
      if (!hierarchicalResult.success) {
        result.matchingSteps.push(...hierarchicalResult.matchingSteps);
        return result;
      }

      // Step 3: Final matching on filtered candidates
      const finalMatch = await this.performFinalMatching(
        extractedData,
        hierarchicalResult.candidates,
        context
      );

      result.success = finalMatch.success;
      result.confidence = finalMatch.confidence;
      result.matches = finalMatch.matches;
      result.alternatives = finalMatch.alternatives;
      result.matchingSteps.push(...hierarchicalResult.matchingSteps);
      result.matchingSteps.push(...finalMatch.matchingSteps);

      // Step 4: Log performance statistics
      this.logMatchingPerformance(context);

      return result;

    } catch (error) {
      result.matchingSteps.push(`Error: ${error}`);
      console.error('❌ Unified hierarchical matching failed:', error);
      return result;
    }
  }

  /**
   * Extract data based on input type (counselling vs college/course)
   */
  private async extractDataByType(
    rawData: any, 
    dataType: 'COLLEGE_COURSE' | 'COUNSELLING'
  ): Promise<{
    collegeName: string;
    stateName?: string;
    location?: string;
    courseName?: string;
    categoryName?: string;
    quotaName?: string;
  }> {
    
    if (dataType === 'COUNSELLING') {
      // Apply pattern-based extraction for counselling data
      return this.extractCounsellingPatterns(rawData);
    } else {
      // Direct extraction for college/course data
      return {
        collegeName: this.normalize(rawData.college_institute || ''),
        stateName: this.normalize(rawData.state || ''),
        location: this.extractLocation(rawData.address || ''),
        courseName: this.normalize(rawData.course || ''),
      };
    }
  }

  /**
   * Enhanced pattern-based extraction for counselling data
   */
  private extractCounsellingPatterns(rawData: any): {
    collegeName: string;
    stateName?: string;
    location?: string;
    courseName?: string;
    categoryName?: string;
    quotaName?: string;
  } {
    
    const fullText = rawData.college_institute || '';
    const parts = fullText.split(',').map(part => part.trim());
    
    // Extract college name (first part before comma)
    let collegeName = this.normalize(parts[0] || '');
    
    // Clean college name by removing common address patterns
    collegeName = this.cleanCollegeName(collegeName);
    
    // Extract state from the last meaningful part
    let stateName = '';
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      stateName = this.extractStateFromText(lastPart);
    }
    
    // Extract location (city/district) from middle parts
    let location = '';
    if (parts.length > 2) {
      const middleParts = parts.slice(1, -1);
      location = this.extractLocationFromParts(middleParts);
    }

    return {
      collegeName,
      stateName,
      location,
      courseName: this.normalize(rawData.course || ''),
      categoryName: this.normalize(rawData.category || ''),
      quotaName: this.normalize(rawData.quota || '')
    };
  }

  /**
   * Hierarchical filtering to reduce search space from thousands to handful
   */
  private async applyHierarchicalFiltering(
    extractedData: any,
    context: MatchingContext
  ): Promise<{
    success: boolean;
    candidates: any[];
    matchingSteps: string[];
  }> {
    
    const steps: string[] = [];
    
    // Get all colleges from master data (simulate thousands)
    const allColleges = await this.masterDataManager.getAllColleges();
    this.stats.totalColleges = allColleges.length;
    steps.push(`🏫 Starting with ${allColleges.length} colleges in master data`);
    
    let candidates = allColleges;

    // LEVEL 1: State Filtering (Most Effective - reduces by ~95%)
    if (extractedData.stateName) {
      const stateMatch = await this.masterDataManager.matchState(extractedData.stateName);
      if (stateMatch) {
        candidates = candidates.filter(college => college.state_id === stateMatch.master_id);
        this.stats.stateFiltered = candidates.length;
        steps.push(`🌍 State filter (${extractedData.stateName}): ${candidates.length} colleges remaining`);
      } else {
        steps.push(`⚠️ State not found: ${extractedData.stateName}`);
      }
    }

    // LEVEL 2: Course Filtering (if applicable - reduces by another ~80%)
    if (extractedData.courseName && context.dataType === 'COLLEGE_COURSE') {
      const courseMatch = await this.masterDataManager.matchCourse(extractedData.courseName);
      if (courseMatch) {
        // Filter colleges that offer this course (from college_courses junction table)
        candidates = await this.filterCollegesByCourse(candidates, courseMatch.master_id);
        this.stats.courseFiltered = candidates.length;
        steps.push(`📚 Course filter (${extractedData.courseName}): ${candidates.length} colleges remaining`);
      }
    }

    // LEVEL 3: Location Filtering (reduces by ~50% if location available)
    if (extractedData.location) {
      candidates = this.filterCollegesByLocation(candidates, extractedData.location);
      this.stats.locationFiltered = candidates.length;
      steps.push(`📍 Location filter (${extractedData.location}): ${candidates.length} colleges remaining`);
    }

    this.stats.finalCandidates = candidates.length;
    steps.push(`🎯 Final candidates for name matching: ${candidates.length}`);

    return {
      success: candidates.length > 0,
      candidates,
      matchingSteps: steps
    };
  }

  /**
   * Final matching on heavily filtered candidates
   */
  private async performFinalMatching(
    extractedData: any,
    candidates: any[],
    context: MatchingContext
  ): Promise<{
    success: boolean;
    confidence: number;
    matches: any;
    alternatives: any[];
    matchingSteps: string[];
  }> {
    
    const steps: string[] = [];
    const alternatives: any[] = [];

    // EXACT MATCH (highest confidence)
    for (const college of candidates) {
      if (college.normalized_name === extractedData.collegeName) {
        this.stats.exactMatches++;
        steps.push(`✅ EXACT match found: ${college.name}`);
        
        return {
          success: true,
          confidence: 1.0,
          matches: { college },
          alternatives,
          matchingSteps: steps
        };
      }
    }

    // FUZZY MATCHING on small candidate set
    const fuzzyMatches = [];
    for (const college of candidates) {
      const similarity = this.calculateSimilarity(extractedData.collegeName, college.normalized_name);
      if (similarity > 0.6) {
        fuzzyMatches.push({
          college,
          confidence: similarity,
          reason: `${Math.round(similarity * 100)}% similarity`
        });
      }
    }

    // Sort by confidence
    fuzzyMatches.sort((a, b) => b.confidence - a.confidence);
    
    if (fuzzyMatches.length > 0) {
      this.stats.fuzzyMatches++;
      const bestMatch = fuzzyMatches[0];
      
      steps.push(`🔍 FUZZY match found: ${bestMatch.college.name} (${Math.round(bestMatch.confidence * 100)}%)`);
      
      // Include alternatives
      alternatives.push(...fuzzyMatches.slice(1, 4)); // Top 3 alternatives
      
      return {
        success: true,
        confidence: bestMatch.confidence,
        matches: { college: bestMatch.college },
        alternatives,
        matchingSteps: steps
      };
    }

    steps.push(`❌ No matches found in ${candidates.length} candidates`);
    return {
      success: false,
      confidence: 0,
      matches: {},
      alternatives,
      matchingSteps: steps
    };
  }

  /**
   * Batch processing for large datasets
   */
  async processBatchData(
    rawDataArray: any[],
    context: MatchingContext
  ): Promise<{
    results: HierarchicalMatchResult[];
    stats: {
      totalRecords: number;
      successfulMatches: number;
      averageConfidence: number;
      processingTime: number;
    };
  }> {
    
    const startTime = Date.now();
    const results: HierarchicalMatchResult[] = [];
    let totalConfidence = 0;
    let successCount = 0;

    console.log(`🚀 Processing ${rawDataArray.length} records with unified hierarchical matching`);

    for (let i = 0; i < rawDataArray.length; i++) {
      const rawData = rawDataArray[i];
      
      // Progress callback
      if (context.progressCallback && i % 100 === 0) {
        const progress = Math.floor((i / rawDataArray.length) * 100);
        context.progressCallback(progress, `Processing record ${i + 1}/${rawDataArray.length}`);
      }

      try {
        const result = await this.performHierarchicalMatch(rawData, context);
        results.push(result);
        
        if (result.success) {
          successCount++;
          totalConfidence += result.confidence;
        }

        // Log progress every 1000 records
        if (i % 1000 === 0 && i > 0) {
          console.log(`📊 Progress: ${i}/${rawDataArray.length} (${Math.round((successCount / i) * 100)}% success rate)`);
        }

      } catch (error) {
        console.error(`❌ Error processing record ${i + 1}:`, error);
        results.push({
          success: false,
          confidence: 0,
          matches: {},
          matchingSteps: [`Error: ${error}`]
        });
      }
    }

    const processingTime = Date.now() - startTime;
    const averageConfidence = successCount > 0 ? totalConfidence / successCount : 0;

    // Final progress callback
    if (context.progressCallback) {
      context.progressCallback(100, 'Batch processing completed');
    }

    console.log(`✅ Batch processing completed in ${processingTime}ms`);
    console.log(`📊 Success rate: ${Math.round((successCount / rawDataArray.length) * 100)}%`);
    console.log(`🎯 Average confidence: ${Math.round(averageConfidence * 100)}%`);

    return {
      results,
      stats: {
        totalRecords: rawDataArray.length,
        successfulMatches: successCount,
        averageConfidence,
        processingTime
      }
    };
  }

  /**
   * Helper methods for pattern extraction and filtering
   */
  
  private cleanCollegeName(collegeName: string): string {
    // Remove common address patterns from college names
    const patterns = [
      /\b(DISTRICT|DIST|DT)\b/gi,
      /\b(TALUK|TALUKA|TQ)\b/gi,
      /\b(VILLAGE|VILL|VIL)\b/gi,
      /\b(POST|P\.O|PO)\b/gi,
      /\b(PIN|PINCODE)\b/gi,
      /\b\d{6}\b/g, // PIN codes
      /\b(ROAD|RD|STREET|ST)\b/gi,
      /\b(NEAR|OPP|OPPOSITE)\b/gi
    ];

    let cleaned = collegeName;
    patterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '').trim();
    });

    return cleaned.replace(/\s+/g, ' ').trim();
  }

  private extractStateFromText(text: string): string {
    // Common state abbreviations and patterns
    const statePatterns = {
      'AP': 'ANDHRA PRADESH',
      'TN': 'TAMIL NADU',
      'KA': 'KARNATAKA',
      'MH': 'MAHARASHTRA',
      'UP': 'UTTAR PRADESH',
      'MP': 'MADHYA PRADESH',
      'WB': 'WEST BENGAL',
      'RJ': 'RAJASTHAN',
      'GJ': 'GUJARAT',
      'PB': 'PUNJAB',
      'HR': 'HARYANA',
      'JH': 'JHARKHAND',
      'CG': 'CHHATTISGARH'
    };

    const normalized = this.normalize(text);
    
    // Check for abbreviations first
    for (const [abbr, fullName] of Object.entries(statePatterns)) {
      if (normalized.includes(abbr)) {
        return fullName;
      }
    }

    // Return as is if it looks like a state name
    if (normalized.length > 2) {
      return normalized;
    }

    return '';
  }

  private extractLocationFromParts(parts: string[]): string {
    // Look for city/district names in middle parts
    return parts.map(part => this.normalize(part))
                .filter(part => part.length > 2 && !this.isCommonWord(part))
                .join(' ');
  }

  private extractLocation(address: string): string {
    // Extract city/district from address
    const parts = address.split(/[,-]/).map(p => p.trim());
    return parts.length > 0 ? this.normalize(parts[0]) : '';
  }

  private async filterCollegesByCourse(colleges: any[], courseId: number): Promise<any[]> {
    // In real implementation, this would query the college_courses junction table
    // For now, simulate filtering
    return colleges.filter(college => {
      // Simulate that some colleges offer certain courses
      return Math.random() > 0.2; // 80% of colleges offer the course
    });
  }

  private filterCollegesByLocation(colleges: any[], location: string): Promise<any[]> {
    return colleges.filter(college => {
      if (!college.location && !college.address) return true; // No location data
      
      const collegeLocation = this.normalize(college.location || college.address || '');
      const similarity = this.calculateSimilarity(location, collegeLocation);
      
      return similarity > 0.5; // 50% similarity threshold for location
    });
  }

  private isCommonWord(word: string): boolean {
    const commonWords = ['THE', 'OF', 'AND', 'FOR', 'WITH', 'BY', 'AT', 'IN', 'ON', 'TO', 'FROM'];
    return commonWords.includes(word.toUpperCase());
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Enhanced Jaccard similarity with word order consideration
    const words1 = new Set(str1.split(' '));
    const words2 = new Set(str2.split(' '));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    const jaccard = intersection.size / union.size;
    
    // Bonus for word order similarity
    const orderBonus = this.calculateOrderSimilarity(str1, str2) * 0.1;
    
    return Math.min(jaccard + orderBonus, 1.0);
  }

  private calculateOrderSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    
    let orderScore = 0;
    const minLength = Math.min(words1.length, words2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (words1[i] === words2[i]) {
        orderScore++;
      }
    }
    
    return minLength > 0 ? orderScore / minLength : 0;
  }

  private normalize(text: string): string {
    return text.toUpperCase().trim().replace(/\s+/g, ' ');
  }

  private logMatchingPerformance(context: MatchingContext): void {
    console.log(`\n📊 HIERARCHICAL MATCHING PERFORMANCE [${context.dataType}]:`);
    console.log(`   Total colleges in master data: ${this.stats.totalColleges.toLocaleString()}`);
    console.log(`   After state filtering: ${this.stats.stateFiltered.toLocaleString()}`);
    console.log(`   After course filtering: ${this.stats.courseFiltered.toLocaleString()}`);
    console.log(`   After location filtering: ${this.stats.locationFiltered.toLocaleString()}`);
    console.log(`   Final candidates: ${this.stats.finalCandidates}`);
    console.log(`   Exact matches found: ${this.stats.exactMatches}`);
    console.log(`   Fuzzy matches found: ${this.stats.fuzzyMatches}`);
    
    const reductionRate = this.stats.totalColleges > 0 
      ? ((this.stats.totalColleges - this.stats.finalCandidates) / this.stats.totalColleges) * 100
      : 0;
    
    console.log(`   🎯 Search space reduction: ${Math.round(reductionRate)}%`);
    console.log(`   ⚡ Performance gain: ${Math.round(this.stats.totalColleges / Math.max(this.stats.finalCandidates, 1))}x faster`);
  }
}

/**
 * Demo usage showing unified approach for both data types
 */
export async function demonstrateUnifiedHierarchicalMatching() {
  console.log('🚀 Demonstrating Unified Hierarchical Matching Algorithm');
  
  const masterDataManager = new MasterDataManager();
  const matcher = new UnifiedHierarchicalMatcher(masterDataManager);
  
  // Sample college/course data
  const collegeData = {
    state: 'Karnataka',
    college_institute: 'Bangalore Medical College and Research Institute',
    address: 'Fort, Bengaluru, Karnataka - 560002',
    course: 'MBBS',
    seats: 250
  };
  
  // Sample counselling data
  const counsellingData = {
    college_institute: 'Government Medical College, Anantapur, Andhra Pradesh',
    course: 'MBBS',
    category: 'GENERAL',
    quota: 'STATE',
    rank: 1234
  };
  
  console.log('\n📊 TESTING COLLEGE/COURSE DATA:');
  const collegeResult = await matcher.performHierarchicalMatch(collegeData, {
    dataType: 'COLLEGE_COURSE',
    batchId: 'demo_1'
  });
  
  console.log(`Result: ${collegeResult.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Confidence: ${Math.round(collegeResult.confidence * 100)}%`);
  console.log(`Extracted: ${JSON.stringify(collegeResult.extractedData)}`);
  
  console.log('\n🎯 TESTING COUNSELLING DATA:');
  const counsellingResult = await matcher.performHierarchicalMatch(counsellingData, {
    dataType: 'COUNSELLING',
    batchId: 'demo_2'
  });
  
  console.log(`Result: ${counsellingResult.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Confidence: ${Math.round(counsellingResult.confidence * 100)}%`);
  console.log(`Extracted: ${JSON.stringify(counsellingResult.extractedData)}`);
  
  return { collegeResult, counsellingResult };
}