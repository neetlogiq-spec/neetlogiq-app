/**
 * Enhanced Pattern-Based Hierarchical College Matcher
 * Leverages structured patterns in counselling data for improved accuracy
 * Pattern: "COLLEGE NAME, ADDRESS, STATE" → Extract college name and state
 */

interface PatternExtractionResult {
  collegeName: string;
  address: string;
  state: string;
  confidence: number;
  extractionMethod: 'FIRST_COMMA_SPLIT' | 'STATE_EXTRACTION' | 'FALLBACK';
}

interface EnhancedMatchResult {
  college_id: number;
  confidence: number;
  method: 'EXACT' | 'FUZZY' | 'HIERARCHICAL' | 'PATTERN_MATCHED';
  candidates_reduced: number;
  extraction_result: PatternExtractionResult;
  normalization_applied: string[];
}

export class EnhancedPatternMatcher {
  private colleges: Map<number, any> = new Map();
  private courses: Map<string, any> = new Map();
  private stateNameToId: Map<string, number> = new Map();
  private collegesByState: Map<number, any[]> = new Map();
  private collegesByCourse: Map<number, Set<number>> = new Map();
  
  // Enhanced state extraction patterns
  private statePatterns: Map<string, RegExp> = new Map();
  
  // Common address patterns to filter out
  private addressPatterns: RegExp[] = [];

  constructor(colleges: any[], courses: any[], collegeCourses: any[]) {
    this.initializeData(colleges, courses, collegeCourses);
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // State extraction patterns (from your observation)
    this.statePatterns = new Map([
      ['MAHARASHTRA', /\bMAHARASHTRA\b/gi],
      ['ANDHRA PRADESH', /\bANDHRA\s*PRADESH\b/gi],
      ['TAMIL NADU', /\bTAMIL\s*NADU\b/gi],
      ['KARNATAKA', /\bKARNATAKA\b/gi],
      ['KERALA', /\bKERALA\b/gi],
      ['GUJARAT', /\bGUJARAT\b/gi],
      ['RAJASTHAN', /\bRAJASTAN\b/gi],
      ['UTTAR PRADESH', /\bUTTAR\s*PRADESH\b/gi],
      ['MADHYA PRADESH', /\bMADHYA\s*PRADESH\b/gi],
      ['WEST BENGAL', /\bWEST\s*BENGAL\b/gi],
      ['BIHAR', /\bBIHAR\b/gi],
      ['ODISHA', /\bODISHA\b|\bORISSA\b/gi],
      ['PUNJAB', /\bPUNJAB\b/gi],
      ['HARYANA', /\bHARYANA\b/gi],
      ['DELHI', /\bDELHI\b/gi],
      ['JHARKHAND', /\bJHARKHAND\b/gi],
      ['CHHATTISGARH', /\bCHHATTISGARH\b/gi],
      ['ASSAM', /\bASSAM\b/gi],
      ['HIMACHAL PRADESH', /\bHIMACHAL\s*PRADESH\b/gi],
      ['UTTARAKHAND', /\bUTTARAKHAND\b/gi]
    ]);

    // Address patterns to identify and remove from college names
    this.addressPatterns = [
      /\b\d+[A-Z\-\,\s]*ROAD\b/gi,
      /\b\d+[A-Z\-\,\s]*STREET\b/gi,
      /\bNEAR\s+[A-Z\s,]+/gi,
      /\bOPP\s+[A-Z\s,]+/gi,
      /\bOPPOSITE\s+[A-Z\s,]+/gi,
      /\bBEHIND\s+[A-Z\s,]+/gi,
      /\bNEXT\s+TO\s+[A-Z\s,]+/gi,
      /\bPIN\s*:\s*\d+/gi,
      /\bPIN\s*CODE\s*:\s*\d+/gi,
      /\b\d{6}\b/g, // Pin codes
      /\bDISTRICT\s*:\s*[A-Z\s]+/gi,
      /\bTALUKA?\s*:\s*[A-Z\s]+/gi
    ];
  }

  private initializeData(colleges: any[], courses: any[], collegeCourses: any[]): void {
    console.log('🏗️ Initializing enhanced pattern matcher...');
    
    // Initialize colleges and state mappings
    for (const college of colleges) {
      this.colleges.set(college.id, college);
      this.stateNameToId.set(college.state_name.toUpperCase(), college.state_id);
      
      if (!this.collegesByState.has(college.state_id)) {
        this.collegesByState.set(college.state_id, []);
      }
      this.collegesByState.get(college.state_id)!.push(college);
    }

    // Initialize courses and course-college mappings
    for (const course of courses) {
      this.courses.set(course.name.toUpperCase(), course);
    }

    for (const cc of collegeCourses) {
      if (!this.collegesByCourse.has(cc.course_type_id)) {
        this.collegesByCourse.set(cc.course_type_id, new Set());
      }
      this.collegesByCourse.get(cc.course_type_id)!.add(cc.college_id);
    }

    console.log(`✅ Enhanced matcher initialized: ${colleges.length} colleges, ${courses.length} courses`);
  }

  /**
   * Enhanced pattern-based extraction from counselling data
   * Implements your observation: "phrase before first comma = college name"
   */
  public extractPatternData(rawText: string): PatternExtractionResult {
    console.log(`🔍 Extracting pattern from: "${rawText}"`);
    
    let extractionMethod: 'FIRST_COMMA_SPLIT' | 'STATE_EXTRACTION' | 'FALLBACK' = 'FALLBACK';
    let confidence = 0.5;
    let collegeName = '';
    let address = '';
    let state = '';

    // Step 1: Extract state using pattern matching
    for (const [stateName, pattern] of this.statePatterns.entries()) {
      if (pattern.test(rawText)) {
        state = stateName;
        extractionMethod = 'STATE_EXTRACTION';
        confidence += 0.3;
        console.log(`📍 State extracted: ${state}`);
        break;
      }
    }

    // Step 2: Split by first comma to separate college name from address
    const parts = rawText.split(',');
    if (parts.length >= 2) {
      // First part = college name (your key observation!)
      collegeName = parts[0].trim();
      
      // Rest = address
      address = parts.slice(1).join(',').trim();
      
      extractionMethod = 'FIRST_COMMA_SPLIT';
      confidence += 0.4;
      
      console.log(`🏥 College name extracted: "${collegeName}"`);
      console.log(`📍 Address extracted: "${address}"`);
    } else {
      // Fallback: whole text as college name
      collegeName = rawText.trim();
      extractionMethod = 'FALLBACK';
      console.log(`⚠️  No comma found, using whole text as college name`);
    }

    // Step 3: Clean college name by removing address patterns
    const cleanedCollegeName = this.cleanCollegeName(collegeName);
    if (cleanedCollegeName !== collegeName) {
      confidence += 0.1;
      collegeName = cleanedCollegeName;
      console.log(`🧹 Cleaned college name: "${collegeName}"`);
    }

    // Step 4: Extract state from address if not found in main text
    if (!state && address) {
      for (const [stateName, pattern] of this.statePatterns.entries()) {
        if (pattern.test(address)) {
          state = stateName;
          confidence += 0.2;
          console.log(`📍 State extracted from address: ${state}`);
          break;
        }
      }
    }

    const result: PatternExtractionResult = {
      collegeName: collegeName.toUpperCase(),
      address: address.toUpperCase(),
      state: state.toUpperCase(),
      confidence: Math.min(confidence, 1.0),
      extractionMethod
    };

    console.log(`✅ Pattern extraction complete: ${(result.confidence * 100).toFixed(1)}% confidence`);
    return result;
  }

  /**
   * Clean college name by removing address-like patterns
   */
  private cleanCollegeName(collegeName: string): string {
    let cleaned = collegeName;
    
    for (const pattern of this.addressPatterns) {
      cleaned = cleaned.replace(pattern, '').trim();
    }
    
    // Remove extra commas and spaces
    cleaned = cleaned.replace(/,+/g, ',').replace(/\s+/g, ' ').replace(/^,|,$/, '').trim();
    
    return cleaned;
  }

  /**
   * Enhanced hierarchical matching with pattern-based extraction
   */
  public async matchCollegeWithPattern(rawText: string, courseHint?: string): Promise<EnhancedMatchResult | null> {
    console.log('\n🎯 ENHANCED PATTERN-BASED MATCHING');
    console.log('-'.repeat(50));
    
    const startTime = Date.now();
    
    // Step 1: Pattern extraction
    const extraction = this.extractPatternData(rawText);
    
    if (!extraction.state || !extraction.collegeName) {
      console.log('❌ Insufficient data extracted for matching');
      return null;
    }

    // Step 2: Hierarchical filtering with extracted data
    console.log('\n🔍 HIERARCHICAL FILTERING WITH EXTRACTED DATA:');
    
    let candidates = Array.from(this.colleges.values());
    let candidatesReduced = candidates.length;

    // Step 2a: Filter by extracted state
    const stateId = this.stateNameToId.get(extraction.state);
    if (!stateId) {
      console.log(`❌ State not found in database: ${extraction.state}`);
      return null;
    }

    candidates = this.collegesByState.get(stateId) || [];
    console.log(`📍 State filter (${extraction.state}): ${candidatesReduced} → ${candidates.length} colleges`);

    // Step 2b: Filter by course if provided
    if (courseHint) {
      const course = this.courses.get(courseHint.toUpperCase());
      if (course) {
        const collegeIdsForCourse = this.collegesByCourse.get(course.id);
        if (collegeIdsForCourse) {
          candidates = candidates.filter(college => 
            collegeIdsForCourse.has(college.id)
          );
          console.log(`🎓 Course filter (${courseHint}): ${candidates.length} colleges remain`);
        }
      }
    }

    candidatesReduced = candidates.length;

    // Step 3: Enhanced name matching with normalization
    console.log(`\n🔧 MATCHING EXTRACTED NAME: "${extraction.collegeName}"`);
    const normalizationRules: string[] = [];
    
    const normalizedExtracted = this.normalizeCollegeName(extraction.collegeName, normalizationRules);
    console.log(`🔧 Normalized to: "${normalizedExtracted}"`);

    let bestMatch: any = null;
    let bestScore = 0;
    let matchMethod: 'EXACT' | 'FUZZY' | 'HIERARCHICAL' | 'PATTERN_MATCHED' = 'PATTERN_MATCHED';

    for (const candidate of candidates) {
      const normalizedCandidate = this.normalizeCollegeName(candidate.name, []);
      
      // Exact match check
      if (normalizedExtracted === normalizedCandidate) {
        bestMatch = candidate;
        bestScore = 1.0;
        matchMethod = 'EXACT';
        console.log(`✅ Exact match found: ${candidate.name}`);
        break;
      }

      // Fuzzy matching
      const fuzzyScore = this.calculateFuzzyScore(normalizedExtracted, normalizedCandidate);
      if (fuzzyScore > bestScore && fuzzyScore > 0.7) {
        bestScore = fuzzyScore;
        bestMatch = candidate;
        matchMethod = fuzzyScore > 0.9 ? 'HIERARCHICAL' : 'FUZZY';
      }
    }

    if (bestMatch) {
      const processingTime = Date.now() - startTime;
      console.log(`✅ Match found in ${processingTime}ms: ${bestMatch.name} (${(bestScore * 100).toFixed(1)}% confidence)`);
      
      return {
        college_id: bestMatch.id,
        confidence: bestScore * extraction.confidence, // Combined confidence
        method: matchMethod,
        candidates_reduced: candidatesReduced,
        extraction_result: extraction,
        normalization_applied: normalizationRules
      };
    }

    console.log(`❌ No match found`);
    return null;
  }

  /**
   * Normalize college names for better matching
   */
  private normalizeCollegeName(name: string, appliedRules: string[]): string {
    let result = name.toUpperCase().trim();

    // Apply normalization rules
    const rules = [
      { pattern: /\bGOVT\b\.?\s*/gi, replacement: 'GOVERNMENT ', desc: 'GOVT → GOVERNMENT' },
      { pattern: /\bMED\.?\s*COL\.?\b/gi, replacement: 'MEDICAL COLLEGE', desc: 'MED COL → MEDICAL COLLEGE' },
      { pattern: /\bINST\.?\s*OF\s*/gi, replacement: 'INSTITUTE OF ', desc: 'INST OF → INSTITUTE OF' },
      { pattern: /\bUNIV\.?\b/gi, replacement: 'UNIVERSITY', desc: 'UNIV → UNIVERSITY' },
      { pattern: /\bPVT\.?\s*LTD\.?\b/gi, replacement: 'PRIVATE LIMITED', desc: 'PVT LTD → PRIVATE LIMITED' },
      { pattern: /\s+/g, replacement: ' ', desc: 'Multiple spaces → Single space' },
      { pattern: /[,\s]+$/, replacement: '', desc: 'Remove trailing punctuation' }
    ];

    for (const rule of rules) {
      const before = result;
      result = result.replace(rule.pattern, rule.replacement);
      if (before !== result) {
        appliedRules.push(rule.desc);
      }
    }

    return result.trim();
  }

  /**
   * Calculate fuzzy similarity score
   */
  private calculateFuzzyScore(str1: string, str2: string): number {
    // Jaccard similarity for word-level matching
    const words1 = new Set(str1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(str2.split(' ').filter(w => w.length > 2));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Batch process counselling data with pattern-based approach
   */
  public async processBatchWithPatterns(
    rawTexts: string[],
    courseHints: string[] = [],
    batchSize: number = 1000,
    onProgress?: (processed: number, total: number) => void
  ): Promise<Array<{record: string; match: EnhancedMatchResult | null}>> {
    
    console.log(`🚀 Starting pattern-based batch processing: ${rawTexts.length} records`);
    
    const results: Array<{record: string; match: EnhancedMatchResult | null}> = [];
    
    for (let i = 0; i < rawTexts.length; i += batchSize) {
      const batch = rawTexts.slice(i, i + batchSize);
      const hints = courseHints.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (record, index) => ({
          record,
          match: await this.matchCollegeWithPattern(record, hints[index])
        }))
      );
      
      results.push(...batchResults);
      
      if (onProgress) {
        onProgress(Math.min(i + batchSize, rawTexts.length), rawTexts.length);
      }
      
      // Small delay for system stability
      if (i + batchSize < rawTexts.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    const successful = results.filter(r => r.match !== null).length;
    console.log(`✅ Pattern-based processing complete: ${successful}/${rawTexts.length} matches found`);
    
    return results;
  }
}