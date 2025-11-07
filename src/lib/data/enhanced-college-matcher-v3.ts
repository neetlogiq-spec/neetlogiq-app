#!/usr/bin/env tsx

import Fuse from 'fuse.js';
import fs from 'fs';
import path from 'path';

interface CollegeData {
  id: string;
  name: string;
  previousName?: string;
  address: string;
  state: string;
  type: string;
  management?: string;
  university?: string;
  searchableNames: string[]; // Contains both current and previous names
  normalizedNames: string[]; // Normalized versions for exact matching
}

interface MatchResult {
  college: CollegeData;
  matchType: 'EXACT' | 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE' | 'UNMATCHED';
  confidence: number;
  method: 'exact' | 'exact_previous' | 'normalized' | 'normalized_previous' | 'fuzzy_current' | 'fuzzy_previous' | 'fuse_js';
  matchedName: string; // Which name was matched (current or previous)
  pass: number; // Which pass found the match (1-4)
}

interface MatchingStats {
  totalAttempts: number;
  pass1Exact: number;
  pass2HighConfidence: number;
  pass3MediumConfidence: number;
  pass4LowConfidence: number;
  unmatched: number;
  averageProcessingTime: number;
}

export class EnhancedCollegeMatcherV3 {
  private colleges: CollegeData[] = [];
  private collegesByState: Map<string, CollegeData[]> = new Map();
  private exactLookup: Map<string, CollegeData> = new Map();
  private normalizedLookup: Map<string, CollegeData> = new Map();
  private fuseIndex: Fuse<CollegeData> | null = null;
  private stats: MatchingStats = {
    totalAttempts: 0,
    pass1Exact: 0,
    pass2HighConfidence: 0,
    pass3MediumConfidence: 0,
    pass4LowConfidence: 0,
    unmatched: 0,
    averageProcessingTime: 0
  };

  constructor() {
    console.log('🚀 Initializing Enhanced College Matcher V3');
    console.log('✅ Fuse.js integration for powerful fuzzy search');
    console.log('✅ 4-pass progressive matching strategy');
    console.log('✅ PREVNAME bracket handling');
    console.log('✅ Enhanced typo tolerance');
  }

  async initialize(): Promise<void> {
    console.log('📊 Loading foundation colleges...');
    await this.loadFoundationData();
    
    console.log('🔧 Creating search indexes...');
    this.createLookupTables();
    this.initializeFuseJS();
    
    console.log(`✅ Enhanced matcher initialized with ${this.colleges.length} colleges`);
  }

  private async loadFoundationData(): Promise<void> {
    const foundationPath = path.join(process.cwd(), 'data', 'updated-foundation-colleges.json');
    
    if (!fs.existsSync(foundationPath)) {
      throw new Error('Foundation data not found. Please run foundation import first.');
    }

    const rawData = JSON.parse(fs.readFileSync(foundationPath, 'utf-8'));
    
    this.colleges = rawData.map((college: any) => {
      const collegeData: CollegeData = {
        id: college.id || `college_${Date.now()}_${Math.random()}`,
        name: college.name,
        address: college.address || '',
        state: college.state || '',
        type: college.type || 'Medical',
        management: college.management,
        university: college.university,
        searchableNames: [college.name],
        normalizedNames: [this.normalizeCollegeName(college.name)]
      };

      // Extract PREVNAME from brackets
      const prevNameMatch = college.name.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (prevNameMatch) {
        const currentName = prevNameMatch[1].trim();
        const previousName = prevNameMatch[2].trim();
        
        // Update college data with extracted names
        collegeData.name = currentName;
        collegeData.previousName = previousName;
        collegeData.searchableNames = [currentName, previousName];
        collegeData.normalizedNames = [
          this.normalizeCollegeName(currentName),
          this.normalizeCollegeName(previousName)
        ];
      }

      return collegeData;
    });

    console.log(`✅ Loaded ${this.colleges.length} colleges`);
    
    // Log PREVNAME extraction stats
    const withPrevNames = this.colleges.filter(c => c.previousName).length;
    console.log(`📋 Extracted previous names from ${withPrevNames} colleges`);
  }

  private createLookupTables(): void {
    console.log('📋 Creating lookup tables...');

    // Group by state
    this.colleges.forEach(college => {
      const state = college.state;
      if (!this.collegesByState.has(state)) {
        this.collegesByState.set(state, []);
      }
      this.collegesByState.get(state)!.push(college);

      // Create exact lookup for all searchable names
      college.searchableNames.forEach(name => {
        const exactKey = `${name}|${state}`;
        this.exactLookup.set(exactKey, college);
      });

      // Create normalized lookup for all normalized names
      college.normalizedNames.forEach(normalizedName => {
        const normalizedKey = `${normalizedName}|${this.normalizeStateName(state)}`;
        this.normalizedLookup.set(normalizedKey, college);
      });
    });

    console.log(`✅ Created lookups for ${this.collegesByState.size} states`);
  }

  private initializeFuseJS(): void {
    console.log('🔍 Initializing Fuse.js for advanced fuzzy search...');

    // Create searchable documents for Fuse.js
    const fuseOptions = {
      keys: [
        { name: 'searchableNames', weight: 0.7 },
        { name: 'name', weight: 0.6 },
        { name: 'previousName', weight: 0.5 },
        { name: 'address', weight: 0.2 },
        { name: 'normalizedNames', weight: 0.4 }
      ],
      threshold: 0.4, // Lower = more strict matching
      distance: 100,
      minMatchCharLength: 3,
      includeScore: true,
      includeMatches: true,
      ignoreLocation: true,
      useExtendedSearch: true
    };

    this.fuseIndex = new Fuse(this.colleges, fuseOptions);
    console.log('✅ Fuse.js index created');
  }

  private normalizeCollegeName(name: string): string {
    if (!name) return '';

    let normalized = name.toUpperCase().trim();

    // ENHANCED ABBREVIATION EXPANSION
    const abbreviations = {
      'ESIC': 'EMPLOYEES STATE INSURANCE CORPORATION',
      'SMS': 'SAWAI MAN SINGH',
      'GOVT': 'GOVERNMENT',
      'GOV': 'GOVERNMENT',
      'UNIV': 'UNIVERSITY',
      'INST': 'INSTITUTE',
      'COLL': 'COLLEGE',
      'HOSP': 'HOSPITAL',
      'MED': 'MEDICAL',
      'DENT': 'DENTAL',
      'DR': 'DOCTOR',
      'PT': 'PANDIT',
      'UCMS': 'UNIVERSITY COLLEGE OF MEDICAL SCIENCES',
      'PGIMER': 'POST GRADUATE INSTITUTE OF MEDICAL EDUCATION AND RESEARCH',
      'MAMC': 'MAULANA AZAD MEDICAL COLLEGE',
      'KGMU': 'KING GEORGE MEDICAL UNIVERSITY',
      'SGSMC': 'SETH GORDHANDAS SUNDERDAS MEDICAL COLLEGE',
      'AIIMS': 'ALL INDIA INSTITUTE OF MEDICAL SCIENCES'
    };

    // Apply abbreviation expansions
    for (const [abbr, full] of Object.entries(abbreviations)) {
      const regex = new RegExp(`\\b${abbr}\\b`, 'g');
      normalized = normalized.replace(regex, full);
    }

    // ENHANCED TYPO CORRECTIONS
    const typoCorrections = {
      'VARDHAMAN': 'VARDHMAN',
      'JAWAHAR LAL': 'JAWAHARLAL',
      'JAWAHAR-LAL': 'JAWAHARLAL',
      'OSMANIA MEDICAL COLLGE': 'OSMANIA MEDICAL COLLEGE',
      'KING GEORGES': 'KING GEORGE',
      'COLLGE': 'COLLEGE',
      'UNIVERSTIY': 'UNIVERSITY',
      'INSTITTUE': 'INSTITUTE',
      'RESEARC': 'RESEARCH',
      'CENTRE': 'CENTER',
      'BALVIR SINGH TOMAR': 'BALVIR SINGH TOMAR',
      'BA;VIR SINGH TOMAR': 'BALVIR SINGH TOMAR'
    };

    for (const [typo, correct] of Object.entries(typoCorrections)) {
      normalized = normalized.replace(typo, correct);
    }

    // Normalize punctuation and spaces
    normalized = normalized.replace(/[^\w\s]/g, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  private normalizeStateName(state: string): string {
    if (!state) return '';

    const normalized = state.toUpperCase().trim();

    const stateCorrections = {
      'DELHI (NCT)': 'NEW DELHI',
      'DELHI': 'NEW DELHI',
      'JAMMU & KASHMIR': 'JAMMU AND KASHMIR',
      'JAMMU AND KASHMIR': 'JAMMU AND KASHMIR',
      'ODISHA': 'ORISSA',
      'ORISSA': 'ODISHA',
      'CHATTISGARH': 'CHHATTISGARH',
      'CHHATTISGARH': 'CHATTISGARH'
    };

    return stateCorrections[normalized] || normalized;
  }

  async enhancedMatch(counsellingCollege: string, counsellingState: string): Promise<MatchResult> {
    const startTime = Date.now();
    this.stats.totalAttempts++;

    // Extract clean college name (before first comma)
    const cleanCollegeName = counsellingCollege.split(',')[0].trim();
    
    // PASS 1: EXACT MATCH (Current and Previous Names)
    const pass1Result = this.pass1ExactMatch(cleanCollegeName, counsellingState);
    if (pass1Result) {
      this.stats.pass1Exact++;
      this.updateProcessingTime(startTime);
      return pass1Result;
    }

    // PASS 2: HIGH-CONFIDENCE FUZZY MATCH (90%+)
    const pass2Result = await this.pass2HighConfidenceMatch(cleanCollegeName, counsellingState);
    if (pass2Result) {
      this.stats.pass2HighConfidence++;
      this.updateProcessingTime(startTime);
      return pass2Result;
    }

    // PASS 3: MEDIUM-CONFIDENCE FUZZY MATCH (80-90%)
    const pass3Result = await this.pass3MediumConfidenceMatch(cleanCollegeName, counsellingState);
    if (pass3Result) {
      this.stats.pass3MediumConfidence++;
      this.updateProcessingTime(startTime);
      return pass3Result;
    }

    // PASS 4: LOW-CONFIDENCE FUZZY MATCH (70-80%) - Manual Review Queue
    const pass4Result = await this.pass4LowConfidenceMatch(cleanCollegeName, counsellingState);
    if (pass4Result) {
      this.stats.pass4LowConfidence++;
      this.updateProcessingTime(startTime);
      return pass4Result;
    }

    // UNMATCHED
    this.stats.unmatched++;
    this.updateProcessingTime(startTime);
    
    return {
      college: {} as CollegeData,
      matchType: 'UNMATCHED',
      confidence: 0.0,
      method: 'exact',
      matchedName: cleanCollegeName,
      pass: 5
    };
  }

  private pass1ExactMatch(collegeName: string, state: string): MatchResult | null {
    // Try exact match with current name
    const exactKey = `${collegeName}|${state}`;
    let exactMatch = this.exactLookup.get(exactKey);
    
    if (exactMatch) {
      return {
        college: exactMatch,
        matchType: 'EXACT',
        confidence: 1.0,
        method: 'exact',
        matchedName: collegeName,
        pass: 1
      };
    }

    // Try exact match with normalized state
    const normalizedState = this.normalizeStateName(state);
    const exactKeyNormState = `${collegeName}|${normalizedState}`;
    exactMatch = this.exactLookup.get(exactKeyNormState);
    
    if (exactMatch) {
      return {
        college: exactMatch,
        matchType: 'EXACT',
        confidence: 1.0,
        method: 'exact',
        matchedName: collegeName,
        pass: 1
      };
    }

    return null;
  }

  private async pass2HighConfidenceMatch(collegeName: string, state: string): Promise<MatchResult | null> {
    // Try normalized exact match
    const normalizedCollege = this.normalizeCollegeName(collegeName);
    const normalizedState = this.normalizeStateName(state);
    const normalizedKey = `${normalizedCollege}|${normalizedState}`;
    
    const normalizedMatch = this.normalizedLookup.get(normalizedKey);
    if (normalizedMatch) {
      return {
        college: normalizedMatch,
        matchType: 'HIGH_CONFIDENCE',
        confidence: 0.95,
        method: 'normalized',
        matchedName: collegeName,
        pass: 2
      };
    }

    // Try Fuse.js with high threshold
    if (this.fuseIndex) {
      const fuseResults = this.fuseIndex.search(collegeName);
      
      for (const result of fuseResults) {
        const college = result.item;
        
        // Filter by state first
        if (college.state !== state && this.normalizeStateName(college.state) !== normalizedState) {
          continue;
        }

        const confidence = 1 - (result.score || 0);
        if (confidence >= 0.9) {
          // Determine which name was matched
          const matchedName = this.determineMatchedName(result, collegeName);
          
          return {
            college,
            matchType: 'HIGH_CONFIDENCE',
            confidence,
            method: 'fuse_js',
            matchedName,
            pass: 2
          };
        }
      }
    }

    return null;
  }

  private async pass3MediumConfidenceMatch(collegeName: string, state: string): Promise<MatchResult | null> {
    const normalizedState = this.normalizeStateName(state);
    
    // Get state candidates
    const candidates = this.collegesByState.get(state) || [];
    const normalizedStateCandidates = this.collegesByState.get(normalizedState) || [];
    const allCandidates = [...new Set([...candidates, ...normalizedStateCandidates])];

    // Manual fuzzy matching with medium confidence
    let bestMatch: CollegeData | null = null;
    let bestScore = 0;
    let bestMatchedName = '';

    for (const candidate of allCandidates) {
      // Check against all searchable names
      for (const searchableName of candidate.searchableNames) {
        const score = this.calculateSimilarity(collegeName, searchableName);
        if (score >= 0.8 && score > bestScore) {
          bestScore = score;
          bestMatch = candidate;
          bestMatchedName = searchableName;
        }
      }
    }

    if (bestMatch && bestScore >= 0.8) {
      return {
        college: bestMatch,
        matchType: 'MEDIUM_CONFIDENCE',
        confidence: bestScore,
        method: bestMatchedName === bestMatch.name ? 'fuzzy_current' : 'fuzzy_previous',
        matchedName: bestMatchedName,
        pass: 3
      };
    }

    return null;
  }

  private async pass4LowConfidenceMatch(collegeName: string, state: string): Promise<MatchResult | null> {
    const normalizedState = this.normalizeStateName(state);
    
    // Get state candidates
    const candidates = this.collegesByState.get(state) || [];
    const normalizedStateCandidates = this.collegesByState.get(normalizedState) || [];
    const allCandidates = [...new Set([...candidates, ...normalizedStateCandidates])];

    // Manual fuzzy matching with low confidence
    let bestMatch: CollegeData | null = null;
    let bestScore = 0;
    let bestMatchedName = '';

    for (const candidate of allCandidates) {
      // Check against all searchable names
      for (const searchableName of candidate.searchableNames) {
        const score = this.calculateSimilarity(collegeName, searchableName);
        if (score >= 0.7 && score > bestScore) {
          bestScore = score;
          bestMatch = candidate;
          bestMatchedName = searchableName;
        }
      }
    }

    if (bestMatch && bestScore >= 0.7) {
      return {
        college: bestMatch,
        matchType: 'LOW_CONFIDENCE',
        confidence: bestScore,
        method: bestMatchedName === bestMatch.name ? 'fuzzy_current' : 'fuzzy_previous',
        matchedName: bestMatchedName,
        pass: 4
      };
    }

    return null;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const norm1 = this.normalizeCollegeName(text1);
    const norm2 = this.normalizeCollegeName(text2);

    if (norm1 === norm2) return 1.0;

    // Word-based similarity
    const words1 = new Set(norm1.split(' '));
    const words2 = new Set(norm2.split(' '));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    const wordSimilarity = union.size > 0 ? intersection.size / union.size : 0;

    // Character-based similarity (Levenshtein-based)
    const charSimilarity = this.levenshteinSimilarity(norm1, norm2);

    // Length penalty
    const lengthRatio = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
    const lengthPenalty = lengthRatio > 0.7 ? 1.0 : lengthRatio;

    // Combined score
    return ((wordSimilarity * 0.6) + (charSimilarity * 0.4)) * lengthPenalty;
  }

  private levenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength > 0 ? 1 - (distance / maxLength) : 1;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private determineMatchedName(fuseResult: any, originalQuery: string): string {
    // Analyze Fuse.js matches to determine which name was matched
    if (fuseResult.matches) {
      for (const match of fuseResult.matches) {
        if (match.key === 'name') {
          return fuseResult.item.name;
        } else if (match.key === 'previousName') {
          return fuseResult.item.previousName || fuseResult.item.name;
        } else if (match.key === 'searchableNames') {
          // Find which searchable name was closest to the query
          let bestMatch = fuseResult.item.name;
          let bestScore = this.calculateSimilarity(originalQuery, fuseResult.item.name);
          
          for (const searchableName of fuseResult.item.searchableNames) {
            const score = this.calculateSimilarity(originalQuery, searchableName);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = searchableName;
            }
          }
          return bestMatch;
        }
      }
    }
    
    return fuseResult.item.name;
  }

  private updateProcessingTime(startTime: number): void {
    const processingTime = Date.now() - startTime;
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (this.stats.totalAttempts - 1) + processingTime) / this.stats.totalAttempts;
  }

  getMatchingStats(): MatchingStats {
    return { ...this.stats };
  }

  generateStatsReport(): void {
    const total = this.stats.totalAttempts;
    
    console.log('\n📊 ENHANCED COLLEGE MATCHER V3 STATS');
    console.log('====================================');
    console.log(`📋 Total matching attempts: ${total.toLocaleString()}`);
    console.log(`⚡ Average processing time: ${this.stats.averageProcessingTime.toFixed(2)}ms`);
    console.log('');
    console.log('🎯 PASS BREAKDOWN:');
    console.log(`Pass 1 (Exact): ${this.stats.pass1Exact} (${(this.stats.pass1Exact/total*100).toFixed(1)}%)`);
    console.log(`Pass 2 (High confidence): ${this.stats.pass2HighConfidence} (${(this.stats.pass2HighConfidence/total*100).toFixed(1)}%)`);
    console.log(`Pass 3 (Medium confidence): ${this.stats.pass3MediumConfidence} (${(this.stats.pass3MediumConfidence/total*100).toFixed(1)}%)`);
    console.log(`Pass 4 (Low confidence): ${this.stats.pass4LowConfidence} (${(this.stats.pass4LowConfidence/total*100).toFixed(1)}%)`);
    console.log(`Unmatched: ${this.stats.unmatched} (${(this.stats.unmatched/total*100).toFixed(1)}%)`);
    
    const totalMatched = total - this.stats.unmatched;
    const matchRate = total > 0 ? (totalMatched / total) * 100 : 0;
    
    console.log('');
    console.log(`📈 OVERALL MATCH RATE: ${matchRate.toFixed(1)}%`);
    
    if (matchRate >= 95) {
      console.log('🎉 OUTSTANDING! 95%+ match rate achieved!');
    } else if (matchRate >= 90) {
      console.log('🎉 EXCELLENT! 90%+ match rate achieved!');
    } else if (matchRate >= 85) {
      console.log('✅ VERY GOOD! 85%+ match rate achieved!');
    }
    
    console.log('\n✅ ENHANCED FEATURES ACTIVE:');
    console.log('🔧 PREVNAME extraction and indexing');
    console.log('🔧 ESIC → EMPLOYEES STATE INSURANCE CORPORATION');
    console.log('🔧 Enhanced abbreviation expansion');
    console.log('🔧 Advanced typo correction');
    console.log('🔧 Fuse.js fuzzy search integration');
    console.log('🔧 4-pass progressive matching');
  }
}

export { MatchResult, MatchingStats };
