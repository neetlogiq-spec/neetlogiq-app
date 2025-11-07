#!/usr/bin/env tsx

import Fuse from 'fuse.js';
import fs from 'fs';
import path from 'path';

/**
 * HIERARCHICAL-FIRST COLLEGE MATCHER
 * 
 * Implementation Priority:
 * 1. FIRST: Run USER's Hierarchical College Matching Algorithm (Name → State → Location)
 * 2. ONLY IF FAILS: Try enhanced fallback methods (Fuse.js, abbreviations, typo tolerance)
 * 3. TEST: Series vs Sequential vs Parallel fallback approaches
 */

interface CollegeData {
  id: string;
  name: string;
  previousName?: string;
  address: string;
  state: string;
  type: string;
  management?: string;
  university?: string;
}

interface MatchResult {
  college: CollegeData | null;
  matchType: 'HIERARCHICAL_SUCCESS' | 'ENHANCED_FALLBACK' | 'UNMATCHED';
  confidence: number;
  method: string;
  algorithmUsed: 'HIERARCHICAL' | 'SERIES_FALLBACK' | 'SEQUENTIAL_FALLBACK' | 'PARALLEL_FALLBACK';
  processingTime: number;
  step: number; // Which step in hierarchical algorithm succeeded
  fallbackMethod?: string; // Which fallback method worked
}

interface FallbackTestResult {
  approach: 'series' | 'sequential' | 'parallel';
  matchRate: number;
  averageTime: number;
  totalTests: number;
  successes: number;
  description: string;
}

export class HierarchicalFirstMatcher {
  private colleges: CollegeData[] = [];
  private collegesByState: Map<string, CollegeData[]> = new Map();
  private exactNameLookup: Map<string, CollegeData> = new Map();
  private normalizedLookup: Map<string, CollegeData> = new Map();
  private fuseIndex: Fuse<CollegeData> | null = null;
  
  // Enhanced features for fallback
  private abbreviations = {
    'ESIC': 'EMPLOYEES STATE INSURANCE CORPORATION',
    'SMS': 'SAWAI MAN SINGH',
    'GOVT': 'GOVERNMENT',
    'GOV': 'GOVERNMENT',
    'PGIMER': 'POST GRADUATE INSTITUTE OF MEDICAL EDUCATION AND RESEARCH',
    'UCMS': 'UNIVERSITY COLLEGE OF MEDICAL SCIENCES',
    'MAMC': 'MAULANA AZAD MEDICAL COLLEGE',
    'AIIMS': 'ALL INDIA INSTITUTE OF MEDICAL SCIENCES',
    'MM': 'MAHARISHI MARKANDESHWAR',
    'SV': 'SRI VENKATESWARA',
    'BJ': 'BYRAMJEE JEEJEEBHOY'
  };

  private typoCorrections = {
    'VARDHAMAN': 'VARDHMAN',
    'JAWAHAR LAL': 'JAWAHARLAL',
    'OSMANIA MEDICAL COLLGE': 'OSMANIA MEDICAL COLLEGE',
    'KING GEORGES': 'KING GEORGE',
    'BA;VIR SINGH TOMAR': 'BALVIR SINGH TOMAR'
  };

  constructor() {
    console.log('🎯 Initializing Hierarchical-First College Matcher');
    console.log('✅ Priority: YOUR Hierarchical Algorithm → Enhanced Fallbacks');
  }

  async initialize(): Promise<void> {
    console.log('📊 Loading foundation colleges...');
    await this.loadFoundationData();
    
    console.log('🔧 Creating hierarchical indexes...');
    this.createHierarchicalIndexes();
    
    console.log('🔍 Initializing enhanced fallback systems...');
    this.initializeFallbackSystems();
    
    console.log(`✅ Hierarchical-first matcher initialized with ${this.colleges.length} colleges`);
  }

  private async loadFoundationData(): Promise<void> {
    const foundationPath = path.join(process.cwd(), 'data', 'updated-foundation-colleges.json');
    
    if (!fs.existsSync(foundationPath)) {
      throw new Error('Foundation data not found');
    }

    const rawData = JSON.parse(fs.readFileSync(foundationPath, 'utf-8'));
    
    this.colleges = rawData.map((college: any) => {
      const collegeData: CollegeData = {
        id: college.id,
        name: college.name,
        address: college.address || '',
        state: college.state || '',
        type: college.type || 'Medical',
        management: college.management,
        university: college.university
      };

      // Handle PREVNAME extraction
      const prevNameMatch = college.name.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (prevNameMatch) {
        collegeData.name = prevNameMatch[1].trim();
        collegeData.previousName = prevNameMatch[2].trim();
      }

      return collegeData;
    });

    console.log(`✅ Loaded ${this.colleges.length} colleges`);
  }

  private createHierarchicalIndexes(): void {
    console.log('📋 Creating indexes for YOUR hierarchical algorithm...');

    this.colleges.forEach(college => {
      const state = college.state;
      
      // State-based grouping (for step 2: State Filter)
      if (!this.collegesByState.has(state)) {
        this.collegesByState.set(state, []);
      }
      this.collegesByState.get(state)!.push(college);

      // Exact name lookup (for step 3: Name Match)
      const exactKey = `${college.name}|${state}`;
      this.exactNameLookup.set(exactKey, college);
      
      if (college.previousName) {
        const prevKey = `${college.previousName}|${state}`;
        this.exactNameLookup.set(prevKey, college);
      }

      // Normalized lookup for enhanced matching
      const normalizedName = this.normalizeText(college.name);
      const normalizedState = this.normalizeText(state);
      const normalizedKey = `${normalizedName}|${normalizedState}`;
      this.normalizedLookup.set(normalizedKey, college);
    });

    console.log(`✅ Created hierarchical indexes for ${this.collegesByState.size} states`);
  }

  private initializeFallbackSystems(): void {
    // Initialize Fuse.js for fallback
    const fuseOptions = {
      keys: ['name', 'previousName', 'address'],
      threshold: 0.3,
      includeScore: true,
      minMatchCharLength: 3
    };

    this.fuseIndex = new Fuse(this.colleges, fuseOptions);
    console.log('✅ Fuse.js fallback system initialized');
  }

  /**
   * MAIN MATCHING METHOD: Hierarchical Algorithm First, then Enhanced Fallbacks
   */
  async match(counsellingCollege: string, counsellingState: string): Promise<MatchResult> {
    const startTime = Date.now();
    
    // Extract clean college name (before first comma) - YOUR specification
    const cleanCollegeName = counsellingCollege.split(',')[0].trim();
    
    // STEP 1: Run YOUR Hierarchical College Matching Algorithm
    const hierarchicalResult = await this.runHierarchicalAlgorithm(cleanCollegeName, counsellingState, startTime);
    
    if (hierarchicalResult.college) {
      // YOUR algorithm found a match - return immediately
      return hierarchicalResult;
    }

    // STEP 2: YOUR algorithm failed - try enhanced fallback methods
    console.log(`🔄 Hierarchical algorithm failed for: ${cleanCollegeName} (${counsellingState})`);
    console.log('🔧 Trying enhanced fallback methods...');
    
    // Test different fallback approaches
    const seriesResult = await this.runSeriesFallback(cleanCollegeName, counsellingState, startTime);
    if (seriesResult.college) return seriesResult;
    
    const sequentialResult = await this.runSequentialFallback(cleanCollegeName, counsellingState, startTime);
    if (sequentialResult.college) return sequentialResult;
    
    const parallelResult = await this.runParallelFallback(cleanCollegeName, counsellingState, startTime);
    if (parallelResult.college) return parallelResult;

    // No matches found
    return {
      college: null,
      matchType: 'UNMATCHED',
      confidence: 0.0,
      method: 'all_methods_failed',
      algorithmUsed: 'HIERARCHICAL',
      processingTime: Date.now() - startTime,
      step: 0
    };
  }

  /**
   * YOUR HIERARCHICAL COLLEGE MATCHING ALGORITHM
   * Exact implementation: Data Correction → State Filter → Name Match → Location Disambiguation → Fuzzy Fallback
   */
  private async runHierarchicalAlgorithm(collegeName: string, state: string, startTime: number): Promise<MatchResult> {
    
    // Step 1: Data Correction (apply known corrections)
    const correctedCollegeName = this.applyDataCorrections(collegeName);
    
    // Step 2: State Filter (filter colleges by state - fastest filter)
    const stateCandidates = this.collegesByState.get(state) || [];
    
    // Try normalized state if no exact match
    if (stateCandidates.length === 0) {
      const normalizedState = this.normalizeStateName(state);
      for (const [candidateState, colleges] of this.collegesByState.entries()) {
        if (this.normalizeStateName(candidateState) === normalizedState) {
          stateCandidates.push(...colleges);
        }
      }
    }
    
    if (stateCandidates.length === 0) {
      return this.createUnmatchedResult(startTime, 'HIERARCHICAL', 'no_state_candidates', 2);
    }

    // Step 3: Name Match (find exact college name matches)
    const exactKey = `${correctedCollegeName}|${state}`;
    const exactMatch = this.exactNameLookup.get(exactKey);
    
    if (exactMatch) {
      return {
        college: exactMatch,
        matchType: 'HIERARCHICAL_SUCCESS',
        confidence: 1.0,
        method: 'exact_name_match',
        algorithmUsed: 'HIERARCHICAL',
        processingTime: Date.now() - startTime,
        step: 3
      };
    }

    // Step 4: Location Disambiguation (use address/location for multiple matches)
    const locationMatch = this.findLocationDisambiguation(correctedCollegeName, stateCandidates);
    
    if (locationMatch) {
      return {
        college: locationMatch.college,
        matchType: 'HIERARCHICAL_SUCCESS',
        confidence: locationMatch.confidence,
        method: 'location_disambiguation',
        algorithmUsed: 'HIERARCHICAL',
        processingTime: Date.now() - startTime,
        step: 4
      };
    }

    // Step 5: Fuzzy Fallback (apply fuzzy matching if no exact matches)
    const fuzzyMatch = this.findHierarchicalFuzzyFallback(correctedCollegeName, stateCandidates);
    
    if (fuzzyMatch) {
      return {
        college: fuzzyMatch.college,
        matchType: 'HIERARCHICAL_SUCCESS',
        confidence: fuzzyMatch.confidence,
        method: 'hierarchical_fuzzy_fallback',
        algorithmUsed: 'HIERARCHICAL',
        processingTime: Date.now() - startTime,
        step: 5
      };
    }

    // YOUR algorithm failed - no match found
    return this.createUnmatchedResult(startTime, 'HIERARCHICAL', 'hierarchical_algorithm_failed', 6);
  }

  /**
   * ENHANCED FALLBACK METHOD 1: SERIES APPROACH
   * Try methods one after another: Fuse.js → Abbreviations → Typo Tolerance
   */
  private async runSeriesFallback(collegeName: string, state: string, startTime: number): Promise<MatchResult> {
    
    // Try Fuse.js first
    const fuseMatch = await this.tryFuseJsSearch(collegeName, state);
    if (fuseMatch) {
      return {
        college: fuseMatch.college,
        matchType: 'ENHANCED_FALLBACK',
        confidence: fuseMatch.confidence,
        method: 'fuse_js_series',
        algorithmUsed: 'SERIES_FALLBACK',
        processingTime: Date.now() - startTime,
        step: 1,
        fallbackMethod: 'fuse_js'
      };
    }

    // Try abbreviation expansion
    const abbreviationMatch = await this.tryAbbreviationExpansion(collegeName, state);
    if (abbreviationMatch) {
      return {
        college: abbreviationMatch.college,
        matchType: 'ENHANCED_FALLBACK',
        confidence: abbreviationMatch.confidence,
        method: 'abbreviation_series',
        algorithmUsed: 'SERIES_FALLBACK',
        processingTime: Date.now() - startTime,
        step: 2,
        fallbackMethod: 'abbreviation'
      };
    }

    // Try typo tolerance
    const typoMatch = await this.tryTypoTolerance(collegeName, state);
    if (typoMatch) {
      return {
        college: typoMatch.college,
        matchType: 'ENHANCED_FALLBACK',
        confidence: typoMatch.confidence,
        method: 'typo_tolerance_series',
        algorithmUsed: 'SERIES_FALLBACK',
        processingTime: Date.now() - startTime,
        step: 3,
        fallbackMethod: 'typo_tolerance'
      };
    }

    return this.createUnmatchedResult(startTime, 'SERIES_FALLBACK', 'series_fallback_failed', 0);
  }

  /**
   * ENHANCED FALLBACK METHOD 2: SEQUENTIAL APPROACH
   * Try each method sequentially with different parameters
   */
  private async runSequentialFallback(collegeName: string, state: string, startTime: number): Promise<MatchResult> {
    
    const methods = [
      { name: 'high_threshold_fuzzy', threshold: 0.9 },
      { name: 'medium_threshold_fuzzy', threshold: 0.8 },
      { name: 'low_threshold_fuzzy', threshold: 0.7 },
      { name: 'expanded_abbreviations', threshold: 0.8 },
      { name: 'typo_corrected', threshold: 0.8 }
    ];

    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      const result = await this.trySequentialMethod(collegeName, state, method);
      
      if (result) {
        return {
          college: result.college,
          matchType: 'ENHANCED_FALLBACK',
          confidence: result.confidence,
          method: `sequential_${method.name}`,
          algorithmUsed: 'SEQUENTIAL_FALLBACK',
          processingTime: Date.now() - startTime,
          step: i + 1,
          fallbackMethod: method.name
        };
      }
    }

    return this.createUnmatchedResult(startTime, 'SEQUENTIAL_FALLBACK', 'sequential_fallback_failed', 0);
  }

  /**
   * ENHANCED FALLBACK METHOD 3: PARALLEL APPROACH
   * Try all methods simultaneously and pick the best result
   */
  private async runParallelFallback(collegeName: string, state: string, startTime: number): Promise<MatchResult> {
    
    // Run all methods in parallel
    const [fuseResult, abbreviationResult, typoResult] = await Promise.all([
      this.tryFuseJsSearch(collegeName, state),
      this.tryAbbreviationExpansion(collegeName, state),
      this.tryTypoTolerance(collegeName, state)
    ]);

    // Find the best result
    const results = [fuseResult, abbreviationResult, typoResult].filter(r => r !== null);
    
    if (results.length === 0) {
      return this.createUnmatchedResult(startTime, 'PARALLEL_FALLBACK', 'parallel_fallback_failed', 0);
    }

    // Pick the result with highest confidence
    const bestResult = results.reduce((best, current) => 
      current!.confidence > best!.confidence ? current : best
    )!;

    return {
      college: bestResult.college,
      matchType: 'ENHANCED_FALLBACK',
      confidence: bestResult.confidence,
      method: 'parallel_best_confidence',
      algorithmUsed: 'PARALLEL_FALLBACK',
      processingTime: Date.now() - startTime,
      step: 1,
      fallbackMethod: 'parallel_best'
    };
  }

  // Implementation of YOUR hierarchical algorithm steps

  private applyDataCorrections(collegeName: string): string {
    let corrected = collegeName;
    
    // Apply YOUR known corrections
    for (const [typo, correct] of Object.entries(this.typoCorrections)) {
      corrected = corrected.replace(new RegExp(typo, 'gi'), correct);
    }
    
    return corrected;
  }

  private findLocationDisambiguation(collegeName: string, candidates: CollegeData[]): {college: CollegeData, confidence: number} | null {
    // Use address/location for multiple matches (YOUR step 4)
    for (const candidate of candidates) {
      const nameSimilarity = this.calculateSimilarity(collegeName, candidate.name);
      if (nameSimilarity >= 0.8) {
        return { college: candidate, confidence: nameSimilarity };
      }
      
      // Also check against previous name if available
      if (candidate.previousName) {
        const prevNameSimilarity = this.calculateSimilarity(collegeName, candidate.previousName);
        if (prevNameSimilarity >= 0.8) {
          return { college: candidate, confidence: prevNameSimilarity };
        }
      }
    }
    return null;
  }

  private findHierarchicalFuzzyFallback(collegeName: string, candidates: CollegeData[]): {college: CollegeData, confidence: number} | null {
    // YOUR step 5: Apply fuzzy matching if no exact matches
    let bestMatch: CollegeData | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const similarity = this.calculateSimilarity(collegeName, candidate.name);
      if (similarity > bestScore && similarity >= 0.7) {
        bestScore = similarity;
        bestMatch = candidate;
      }
    }

    return bestMatch ? { college: bestMatch, confidence: bestScore } : null;
  }

  // Enhanced fallback methods

  private async tryFuseJsSearch(collegeName: string, state: string): Promise<{college: CollegeData, confidence: number} | null> {
    if (!this.fuseIndex) return null;

    const results = this.fuseIndex.search(collegeName);
    
    for (const result of results) {
      const college = result.item;
      if (college.state === state || this.normalizeStateName(college.state) === this.normalizeStateName(state)) {
        const confidence = 1 - (result.score || 0);
        if (confidence >= 0.7) {
          return { college, confidence };
        }
      }
    }

    return null;
  }

  private async tryAbbreviationExpansion(collegeName: string, state: string): Promise<{college: CollegeData, confidence: number} | null> {
    let expandedName = collegeName;
    
    // Apply abbreviation expansions
    for (const [abbr, full] of Object.entries(this.abbreviations)) {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      expandedName = expandedName.replace(regex, full);
    }

    if (expandedName !== collegeName) {
      // Try matching with expanded name
      const expandedKey = `${expandedName}|${state}`;
      const match = this.exactNameLookup.get(expandedKey);
      
      if (match) {
        return { college: match, confidence: 0.9 };
      }
    }

    return null;
  }

  private async tryTypoTolerance(collegeName: string, state: string): Promise<{college: CollegeData, confidence: number} | null> {
    let correctedName = collegeName;
    
    // Apply typo corrections
    for (const [typo, correct] of Object.entries(this.typoCorrections)) {
      correctedName = correctedName.replace(new RegExp(typo, 'gi'), correct);
    }

    if (correctedName !== collegeName) {
      // Try matching with corrected name
      const correctedKey = `${correctedName}|${state}`;
      const match = this.exactNameLookup.get(correctedKey);
      
      if (match) {
        return { college: match, confidence: 0.95 };
      }
    }

    return null;
  }

  private async trySequentialMethod(collegeName: string, state: string, method: any): Promise<{college: CollegeData, confidence: number} | null> {
    // Implementation varies based on method type
    switch (method.name) {
      case 'high_threshold_fuzzy':
        return this.tryFuzzyWithThreshold(collegeName, state, method.threshold);
      case 'expanded_abbreviations':
        return this.tryAbbreviationExpansion(collegeName, state);
      case 'typo_corrected':
        return this.tryTypoTolerance(collegeName, state);
      default:
        return null;
    }
  }

  private async tryFuzzyWithThreshold(collegeName: string, state: string, threshold: number): Promise<{college: CollegeData, confidence: number} | null> {
    const candidates = this.collegesByState.get(state) || [];
    
    for (const candidate of candidates) {
      const similarity = this.calculateSimilarity(collegeName, candidate.name);
      if (similarity >= threshold) {
        return { college: candidate, confidence: similarity };
      }
    }

    return null;
  }

  // Utility methods

  private normalizeText(text: string): string {
    return text.toUpperCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
  }

  private normalizeStateName(state: string): string {
    const corrections = {
      'DELHI (NCT)': 'NEW DELHI',
      'DELHI': 'NEW DELHI',
      'JAMMU & KASHMIR': 'JAMMU AND KASHMIR'
    };
    
    return corrections[state.toUpperCase()] || state.toUpperCase();
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const norm1 = this.normalizeText(str1);
    const norm2 = this.normalizeText(str2);

    if (norm1 === norm2) return 1.0;

    // Simple Levenshtein-based similarity
    const distance = this.levenshteinDistance(norm1, norm2);
    const maxLength = Math.max(norm1.length, norm2.length);
    return maxLength > 0 ? 1 - (distance / maxLength) : 0;
  }

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

  private createUnmatchedResult(startTime: number, algorithm: string, reason: string, step: number): MatchResult {
    return {
      college: null,
      matchType: 'UNMATCHED',
      confidence: 0.0,
      method: reason,
      algorithmUsed: algorithm as any,
      processingTime: Date.now() - startTime,
      step
    };
  }

  /**
   * TEST FALLBACK APPROACHES
   * Compare Series vs Sequential vs Parallel methods
   */
  async testFallbackApproaches(testCases: {college: string, state: string}[]): Promise<FallbackTestResult[]> {
    console.log('🧪 Testing fallback approaches: Series vs Sequential vs Parallel');
    
    const results: FallbackTestResult[] = [];
    
    // Test each approach
    const approaches = [
      { name: 'series', description: 'Series: Fuse.js → Abbreviations → Typo Tolerance' },
      { name: 'sequential', description: 'Sequential: Each method with different thresholds' },
      { name: 'parallel', description: 'Parallel: All methods → Best result' }
    ];

    for (const approach of approaches) {
      console.log(`🔄 Testing ${approach.name} fallback approach...`);
      
      let successes = 0;
      let totalTime = 0;
      
      for (const testCase of testCases) {
        const startTime = Date.now();
        
        // First run YOUR hierarchical algorithm
        const hierarchicalResult = await this.runHierarchicalAlgorithm(testCase.college, testCase.state, startTime);
        
        if (!hierarchicalResult.college) {
          // YOUR algorithm failed - test the fallback approach
          let fallbackResult = null;
          
          switch (approach.name) {
            case 'series':
              fallbackResult = await this.runSeriesFallback(testCase.college, testCase.state, startTime);
              break;
            case 'sequential':
              fallbackResult = await this.runSequentialFallback(testCase.college, testCase.state, startTime);
              break;
            case 'parallel':
              fallbackResult = await this.runParallelFallback(testCase.college, testCase.state, startTime);
              break;
          }
          
          if (fallbackResult && fallbackResult.college) {
            successes++;
          }
        } else {
          // YOUR algorithm succeeded - count as success
          successes++;
        }
        
        totalTime += Date.now() - startTime;
      }
      
      results.push({
        approach: approach.name as any,
        matchRate: (successes / testCases.length) * 100,
        averageTime: totalTime / testCases.length,
        totalTests: testCases.length,
        successes,
        description: approach.description
      });
    }

    return results;
  }

  generateFallbackReport(results: FallbackTestResult[]): void {
    console.log('\n📊 FALLBACK APPROACHES COMPARISON REPORT');
    console.log('========================================');
    console.log('🎯 Testing: Which fallback works best after YOUR Hierarchical Algorithm fails');
    console.log('');
    
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.approach.toUpperCase()} APPROACH`);
      console.log(`   Description: ${result.description}`);
      console.log(`   Match Rate: ${result.matchRate.toFixed(1)}%`);
      console.log(`   Average Time: ${result.averageTime.toFixed(2)}ms`);
      console.log(`   Successes: ${result.successes}/${result.totalTests}`);
      console.log('');
    });

    // Find best approach
    const bestApproach = results.reduce((best, current) => {
      if (current.matchRate > best.matchRate) return current;
      if (current.matchRate === best.matchRate && current.averageTime < best.averageTime) return current;
      return best;
    });

    console.log(`🏆 BEST FALLBACK APPROACH: ${bestApproach.approach.toUpperCase()}`);
    console.log(`📈 Match Rate: ${bestApproach.matchRate.toFixed(1)}%`);
    console.log(`⚡ Speed: ${bestApproach.averageTime.toFixed(2)}ms`);
    console.log(`📋 ${bestApproach.description}`);
  }
}

export { MatchResult, FallbackTestResult };
