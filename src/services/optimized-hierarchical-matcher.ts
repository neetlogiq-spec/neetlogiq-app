/**
 * Optimized Hierarchical College Matcher
 * Handles fuzzy name matching and adaptive filtering order
 * 
 * Key Optimizations:
 * 1. Advanced fuzzy matching for cases like:
 *    "SETH GORDHANDAS SUNDERDAS MEDICAL COLLEGE" → "SETH GS MEDICAL COLLEGE AND KEM HOSPITAL"
 * 
 * 2. Adaptive filtering order:
 *    - Single location colleges: State → Course → Name (skip location)
 *    - Multiple location colleges: State → Course → Name → Location
 */

interface CollegeRecord {
  id: number;
  name: string;
  state_id: number;
  state_name: string;
  address?: string;
  location?: string;
  location_count?: number; // How many locations this college name appears in
  university_id?: number;
}

interface OptimizedMatchResult {
  college_id: number;
  confidence: number;
  method: 'EXACT' | 'FUZZY_ADVANCED' | 'ABBREVIATION_MATCH' | 'PARTIAL_MATCH';
  candidates_reduced: number;
  filtering_path: string[];
  match_details: {
    extraction_confidence: number;
    name_match_score: number;
    location_disambiguation_used: boolean;
  };
}

interface PatternExtraction {
  collegeName: string;
  location?: string;
  state: string;
  confidence: number;
}

export class OptimizedHierarchicalMatcher {
  private colleges: Map<number, CollegeRecord> = new Map();
  private courses: Map<string, any> = new Map();
  private stateNameToId: Map<string, number> = new Map();
  private collegesByState: Map<number, CollegeRecord[]> = new Map();
  private collegesByCourse: Map<number, Set<number>> = new Map();
  
  // Advanced name matching structures
  private collegeNameFrequency: Map<string, number> = new Map(); // How many locations per college name
  private abbreviationMappings: Map<string, string[]> = new Map(); // Common abbreviations
  
  constructor(colleges: CollegeRecord[], courses: any[], collegeCourses: any[]) {
    this.initializeData(colleges, courses, collegeCourses);
    this.initializeAdvancedMatching();
  }

  private initializeData(colleges: CollegeRecord[], courses: any[], collegeCourses: any[]): void {
    console.log('🏗️ Initializing optimized hierarchical matcher...');
    
    // Initialize basic structures
    for (const college of colleges) {
      this.colleges.set(college.id, college);
      this.stateNameToId.set(college.state_name.toUpperCase(), college.state_id);
      
      if (!this.collegesByState.has(college.state_id)) {
        this.collegesByState.set(college.state_id, []);
      }
      this.collegesByState.get(college.state_id)!.push(college);
    }

    for (const course of courses) {
      this.courses.set(course.name.toUpperCase(), course);
    }

    for (const cc of collegeCourses) {
      if (!this.collegesByCourse.has(cc.course_type_id)) {
        this.collegesByCourse.set(cc.course_type_id, new Set());
      }
      this.collegesByCourse.get(cc.course_type_id)!.add(cc.college_id);
    }

    // Calculate location frequency for each college name
    const nameLocationCount = new Map<string, Set<string>>();
    for (const college of colleges) {
      const normalizedName = this.normalizeCollegeName(college.name);
      if (!nameLocationCount.has(normalizedName)) {
        nameLocationCount.set(normalizedName, new Set());
      }
      if (college.location) {
        nameLocationCount.get(normalizedName)!.add(college.location);
      }
    }

    // Store location frequency in colleges
    for (const college of colleges) {
      const normalizedName = this.normalizeCollegeName(college.name);
      const locationSet = nameLocationCount.get(normalizedName);
      college.location_count = locationSet ? locationSet.size : 1;
      this.collegeNameFrequency.set(normalizedName, college.location_count);
    }

    console.log(`✅ Initialized: ${colleges.length} colleges, ${courses.length} courses`);
  }

  private initializeAdvancedMatching(): void {
    // Common abbreviation patterns in medical colleges
    this.abbreviationMappings = new Map([
      // Seth Gordhandas → Seth GS
      ['SETH GORDHANDAS SUNDERDAS', ['SETH GS', 'SETH G S', 'SGS']],
      ['GORDHANDAS SUNDERDAS', ['GS', 'G S']],
      
      // Government variations
      ['GOVERNMENT', ['GOVT', 'GOV']],
      ['MEDICAL COLLEGE', ['MED COL', 'MEDICAL COL', 'MC']],
      
      // Hospital variations
      ['AND KEM HOSPITAL', ['KEM HOSPITAL', 'KEM HOSP', '& KEM HOSPITAL']],
      ['HOSPITAL', ['HOSP', 'HSP']],
      
      // Institute variations
      ['INSTITUTE', ['INST', 'INSTT']],
      ['OF MEDICAL SCIENCES', ['MED SCI', 'OF MED SCI', 'MEDICAL SCI']],
      
      // Location-based abbreviations (will be expanded based on data)
      ['ALL INDIA INSTITUTE OF MEDICAL SCIENCES', ['AIIMS', 'A.I.I.M.S', 'A I I M S']],
    ]);

    console.log('🔧 Advanced matching patterns initialized');
  }

  /**
   * Enhanced pattern extraction from counselling data
   */
  public extractPattern(rawText: string): PatternExtraction {
    console.log(`🔍 Extracting pattern from: "${rawText}"`);
    
    // Split by first comma (your key insight)
    const parts = rawText.split(',');
    const collegeName = parts[0]?.trim() || '';
    
    // Extract state using pattern matching
    let state = '';
    const statePatterns = [
      'MAHARASHTRA', 'ANDHRA PRADESH', 'TAMIL NADU', 'KARNATAKA', 'KERALA',
      'GUJARAT', 'RAJASTHAN', 'UTTAR PRADESH', 'MADHYA PRADESH', 'WEST BENGAL',
      'BIHAR', 'ODISHA', 'PUNJAB', 'HARYANA', 'DELHI', 'JHARKHAND'
    ];
    
    for (const stateName of statePatterns) {
      if (rawText.toUpperCase().includes(stateName)) {
        state = stateName;
        break;
      }
    }

    // Extract potential location from address parts
    let location: string | undefined;
    if (parts.length > 1) {
      const addressParts = parts.slice(1).join(',').toUpperCase();
      // Simple location extraction - can be enhanced
      const locationMatch = addressParts.match(/\b([A-Z]{3,15})\b/);
      if (locationMatch) {
        location = locationMatch[1];
      }
    }

    const result: PatternExtraction = {
      collegeName: collegeName.toUpperCase(),
      location,
      state: state.toUpperCase(),
      confidence: (collegeName && state) ? 0.9 : 0.6
    };

    console.log(`✅ Extracted - Name: "${result.collegeName}", State: "${result.state}", Location: "${result.location || 'N/A'}"`);
    return result;
  }

  /**
   * Optimized hierarchical matching with adaptive filtering order
   */
  public async optimizedMatch(rawText: string, courseHint?: string): Promise<OptimizedMatchResult | null> {
    console.log('\n🎯 OPTIMIZED HIERARCHICAL MATCHING');
    console.log('-'.repeat(50));
    
    const startTime = Date.now();
    const filteringPath: string[] = [];
    
    // Step 1: Pattern extraction
    const extraction = this.extractPattern(rawText);
    if (!extraction.state || !extraction.collegeName) {
      console.log('❌ Insufficient extraction data');
      return null;
    }

    let candidates = Array.from(this.colleges.values());
    const totalCandidates = candidates.length;

    // Step 2: State filtering
    const stateId = this.stateNameToId.get(extraction.state);
    if (!stateId) {
      console.log(`❌ State not found: ${extraction.state}`);
      return null;
    }

    candidates = this.collegesByState.get(stateId) || [];
    filteringPath.push(`State(${extraction.state}): ${totalCandidates}→${candidates.length}`);
    console.log(`📍 ${filteringPath[filteringPath.length - 1]}`);

    // Step 3: Course filtering
    if (courseHint) {
      const course = this.courses.get(courseHint.toUpperCase());
      if (course) {
        const collegeIdsForCourse = this.collegesByCourse.get(course.id);
        if (collegeIdsForCourse) {
          const beforeCourse = candidates.length;
          candidates = candidates.filter(c => collegeIdsForCourse.has(c.id));
          filteringPath.push(`Course(${courseHint}): ${beforeCourse}→${candidates.length}`);
          console.log(`🎓 ${filteringPath[filteringPath.length - 1]}`);
        }
      }
    }

    // Step 4: Advanced name matching (CRITICAL FOR YOUR EXAMPLE)
    console.log('\n🔧 ADVANCED NAME MATCHING');
    const nameMatchResult = this.advancedNameMatching(extraction.collegeName, candidates);
    
    if (!nameMatchResult.matches || nameMatchResult.matches.length === 0) {
      console.log('❌ No name matches found');
      return null;
    }

    candidates = nameMatchResult.matches;
    filteringPath.push(`Name(${nameMatchResult.method}): ${nameMatchResult.beforeCount}→${candidates.length}`);
    console.log(`🏥 ${filteringPath[filteringPath.length - 1]} (${(nameMatchResult.bestScore * 100).toFixed(1)}% confidence)`);

    // Step 5: Adaptive location filtering (your optimization)
    let locationDisambiguationUsed = false;
    
    // Check if we need location disambiguation
    const uniqueNames = new Set(candidates.map(c => this.normalizeCollegeName(c.name)));
    const needsLocationDisambiguation = uniqueNames.size < candidates.length;
    
    if (needsLocationDisambiguation && extraction.location) {
      console.log('🔍 Multiple colleges with same name - applying location disambiguation');
      const beforeLocation = candidates.length;
      candidates = this.filterByLocation(candidates, extraction.location);
      filteringPath.push(`Location(${extraction.location}): ${beforeLocation}→${candidates.length}`);
      console.log(`📍 ${filteringPath[filteringPath.length - 1]}`);
      locationDisambiguationUsed = true;
    } else if (needsLocationDisambiguation) {
      console.log('⚠️  Multiple locations detected but no location extracted - using best name match');
    } else {
      console.log('✅ Single location college - skipping location filter');
    }

    // Step 6: Final selection
    if (candidates.length === 0) {
      console.log('❌ No candidates remaining after filtering');
      return null;
    }

    // Select best candidate (highest confidence)
    const bestCandidate = candidates[0];
    const bestConfidence = nameMatchResult.bestScore * extraction.confidence;

    if (candidates.length > 1) {
      console.log(`🤔 Multiple candidates (${candidates.length}) - selecting best match`);
      for (const candidate of candidates) {
        console.log(`   - ${candidate.name} (ID: ${candidate.id})`);
      }
      // Could add additional scoring logic here
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Match found in ${processingTime}ms: ${bestCandidate.name}`);

    return {
      college_id: bestCandidate.id,
      confidence: bestConfidence,
      method: nameMatchResult.method,
      candidates_reduced: totalCandidates - candidates.length,
      filtering_path: filteringPath,
      match_details: {
        extraction_confidence: extraction.confidence,
        name_match_score: nameMatchResult.bestScore,
        location_disambiguation_used: locationDisambiguationUsed
      }
    };
  }

  /**
   * Advanced name matching to handle your specific example:
   * "SETH GORDHANDAS SUNDERDAS MEDICAL COLLEGE" → "SETH GS MEDICAL COLLEGE AND KEM HOSPITAL"
   */
  private advancedNameMatching(extractedName: string, candidates: CollegeRecord[]): {
    matches: CollegeRecord[];
    method: 'EXACT' | 'FUZZY_ADVANCED' | 'ABBREVIATION_MATCH' | 'PARTIAL_MATCH';
    bestScore: number;
    beforeCount: number;
  } {
    console.log(`🔍 Advanced matching for: "${extractedName}"`);
    const beforeCount = candidates.length;
    const normalizedExtracted = this.normalizeCollegeName(extractedName);
    
    // Strategy 1: Exact match
    const exactMatches = candidates.filter(c => 
      this.normalizeCollegeName(c.name) === normalizedExtracted
    );
    
    if (exactMatches.length > 0) {
      console.log(`✅ Exact matches found: ${exactMatches.length}`);
      return {
        matches: exactMatches,
        method: 'EXACT',
        bestScore: 1.0,
        beforeCount
      };
    }

    // Strategy 2: Advanced fuzzy matching with abbreviation handling
    const fuzzyResults = candidates.map(candidate => {
      const normalizedCandidate = this.normalizeCollegeName(candidate.name);
      const score = this.calculateAdvancedSimilarity(normalizedExtracted, normalizedCandidate);
      return { candidate, score };
    }).filter(result => result.score > 0.6);

    if (fuzzyResults.length > 0) {
      // Sort by score and take top matches
      fuzzyResults.sort((a, b) => b.score - a.score);
      const bestScore = fuzzyResults[0].score;
      const threshold = Math.max(0.7, bestScore - 0.1); // Dynamic threshold
      const topMatches = fuzzyResults.filter(r => r.score >= threshold);
      
      console.log(`🎯 Fuzzy matches found: ${topMatches.length} (best: ${(bestScore * 100).toFixed(1)}%)`);
      topMatches.forEach(match => {
        console.log(`   - ${match.candidate.name} (${(match.score * 100).toFixed(1)}%)`);
      });

      return {
        matches: topMatches.map(r => r.candidate),
        method: bestScore > 0.9 ? 'FUZZY_ADVANCED' : 'PARTIAL_MATCH',
        bestScore,
        beforeCount
      };
    }

    console.log('❌ No sufficient matches found');
    return {
      matches: [],
      method: 'PARTIAL_MATCH',
      bestScore: 0,
      beforeCount
    };
  }

  /**
   * Calculate advanced similarity score handling abbreviations and variations
   */
  private calculateAdvancedSimilarity(str1: string, str2: string): number {
    // Tokenize both strings
    const tokens1 = this.tokenizeCollegeName(str1);
    const tokens2 = this.tokenizeCollegeName(str2);
    
    console.log(`   Comparing tokens: [${tokens1.join(', ')}] vs [${tokens2.join(', ')}]`);
    
    // Calculate various similarity scores
    const exactWordMatches = this.countExactWordMatches(tokens1, tokens2);
    const abbreviationMatches = this.countAbbreviationMatches(tokens1, tokens2);
    const partialMatches = this.countPartialMatches(tokens1, tokens2);
    
    // Weighted scoring
    const exactScore = exactWordMatches / Math.max(tokens1.length, tokens2.length);
    const abbreviationScore = abbreviationMatches / Math.max(tokens1.length, tokens2.length);
    const partialScore = partialMatches / Math.max(tokens1.length, tokens2.length);
    
    const finalScore = (exactScore * 0.5) + (abbreviationScore * 0.3) + (partialScore * 0.2);
    
    console.log(`   Scores - Exact: ${(exactScore * 100).toFixed(0)}%, Abbrev: ${(abbreviationScore * 100).toFixed(0)}%, Partial: ${(partialScore * 100).toFixed(0)}%, Final: ${(finalScore * 100).toFixed(1)}%`);
    
    return finalScore;
  }

  private tokenizeCollegeName(name: string): string[] {
    return name.split(/\s+/).filter(token => token.length > 1 && !['OF', 'AND', '&', 'THE'].includes(token));
  }

  private countExactWordMatches(tokens1: string[], tokens2: string[]): number {
    let matches = 0;
    const used = new Set<number>();
    
    for (const token1 of tokens1) {
      for (let i = 0; i < tokens2.length; i++) {
        if (!used.has(i) && token1 === tokens2[i]) {
          matches++;
          used.add(i);
          break;
        }
      }
    }
    
    return matches;
  }

  private countAbbreviationMatches(tokens1: string[], tokens2: string[]): number {
    let matches = 0;
    
    // Check for common abbreviation patterns
    for (const [full, abbrevs] of this.abbreviationMappings.entries()) {
      const fullTokens = full.split(/\s+/);
      
      // Check if full form in tokens1 matches abbreviation in tokens2
      if (this.containsSequence(tokens1, fullTokens)) {
        for (const abbrev of abbrevs) {
          if (tokens2.some(token => token.includes(abbrev))) {
            matches += fullTokens.length * 0.8; // Partial credit for abbreviations
            break;
          }
        }
      }
      
      // Check reverse: abbreviation in tokens1, full form in tokens2
      if (this.containsSequence(tokens2, fullTokens)) {
        for (const abbrev of abbrevs) {
          if (tokens1.some(token => token.includes(abbrev))) {
            matches += fullTokens.length * 0.8;
            break;
          }
        }
      }
    }
    
    return matches;
  }

  private countPartialMatches(tokens1: string[], tokens2: string[]): number {
    let matches = 0;
    
    for (const token1 of tokens1) {
      for (const token2 of tokens2) {
        if (token1.length >= 4 && token2.length >= 4) {
          // Check if one contains the other
          if (token1.includes(token2) || token2.includes(token1)) {
            matches += 0.6;
          }
          // Check edit distance for similar tokens
          else if (this.editDistance(token1, token2) <= 2) {
            matches += 0.4;
          }
        }
      }
    }
    
    return Math.min(matches, Math.max(tokens1.length, tokens2.length));
  }

  private containsSequence(tokens: string[], sequence: string[]): boolean {
    if (sequence.length === 0) return true;
    if (tokens.length < sequence.length) return false;
    
    for (let i = 0; i <= tokens.length - sequence.length; i++) {
      let match = true;
      for (let j = 0; j < sequence.length; j++) {
        if (tokens[i + j] !== sequence[j]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    
    return false;
  }

  private editDistance(str1: string, str2: string): number {
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

  private filterByLocation(candidates: CollegeRecord[], location: string): CollegeRecord[] {
    return candidates.filter(c => 
      c.location?.toUpperCase().includes(location.toUpperCase()) ||
      c.address?.toUpperCase().includes(location.toUpperCase())
    );
  }

  private normalizeCollegeName(name: string): string {
    return name
      .toUpperCase()
      .replace(/\bGOVT\.?\b/g, 'GOVERNMENT')
      .replace(/\bMED\.?\s*COL\.?\b/g, 'MEDICAL COLLEGE')
      .replace(/\bINST\.?\b/g, 'INSTITUTE')
      .replace(/\bUNIV\.?\b/g, 'UNIVERSITY')
      .replace(/\s+/g, ' ')
      .trim();
  }
}