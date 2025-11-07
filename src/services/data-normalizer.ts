/**
 * Data Normalization and Standardization System
 * Handles inconsistencies in college names, addresses, and states
 * Processes punctuation, spelling, spacing, and formatting errors
 */

interface NormalizationRule {
  pattern: RegExp;
  replacement: string;
  description: string;
}

interface NormalizationResult {
  original: string;
  normalized: string;
  applied_rules: string[];
  confidence: number;
}

interface CollegeNormalizationData {
  name: string;
  address?: string;
  state: string;
  location?: string;
}

export class DataNormalizer {
  private stateNormalizationRules: NormalizationRule[] = [];
  private collegeNameRules: NormalizationRule[] = [];
  private addressRules: NormalizationRule[] = [];
  private generalRules: NormalizationRule[] = [];
  
  // Standardized state names mapping
  private stateStandardization: Map<string, string> = new Map();
  
  // Common medical/educational institution abbreviations
  private institutionStandardization: Map<string, string> = new Map();

  constructor() {
    this.initializeNormalizationRules();
    this.initializeStandardMappings();
  }

  private initializeNormalizationRules(): void {
    // General text cleaning rules (applied first)
    this.generalRules = [
      {
        pattern: /\s+/g,
        replacement: ' ',
        description: 'Multiple spaces to single space'
      },
      {
        pattern: /,\s*,+/g,
        replacement: ',',
        description: 'Remove duplicate commas'
      },
      {
        pattern: /[,\s]+$/,
        replacement: '',
        description: 'Remove trailing commas and spaces'
      },
      {
        pattern: /^[,\s]+/,
        replacement: '',
        description: 'Remove leading commas and spaces'
      },
      {
        pattern: /\.\s*\./g,
        replacement: '.',
        description: 'Remove duplicate periods'
      },
      {
        pattern: /([A-Z])\s+([A-Z])\s+([A-Z])/g,
        replacement: '$1$2$3',
        description: 'Fix scattered acronyms (A C S R → ACSR)'
      }
    ];

    // State-specific normalization rules
    this.stateNormalizationRules = [
      {
        pattern: /ANDHRA\s*PRADESH/gi,
        replacement: 'ANDHRA PRADESH',
        description: 'Standardize Andhra Pradesh'
      },
      {
        pattern: /TAMIL\s*NADU/gi,
        replacement: 'TAMIL NADU',
        description: 'Standardize Tamil Nadu'
      },
      {
        pattern: /UTTAR\s*PRADESH/gi,
        replacement: 'UTTAR PRADESH',
        description: 'Standardize Uttar Pradesh'
      },
      {
        pattern: /MADHYA\s*PRADESH/gi,
        replacement: 'MADHYA PRADESH',
        description: 'Standardize Madhya Pradesh'
      },
      {
        pattern: /HIMACHAL\s*PRADESH/gi,
        replacement: 'HIMACHAL PRADESH',
        description: 'Standardize Himachal Pradesh'
      },
      {
        pattern: /WEST\s*BENGAL/gi,
        replacement: 'WEST BENGAL',
        description: 'Standardize West Bengal'
      }
    ];

    // College name normalization rules
    this.collegeNameRules = [
      // Government variations
      {
        pattern: /\bGOVT\b\.?\s*/gi,
        replacement: 'GOVERNMENT ',
        description: 'Standardize GOVT to GOVERNMENT'
      },
      {
        pattern: /\bGOVERNMENT\s*MEDICAL\s*COLLEGE\b/gi,
        replacement: 'GOVERNMENT MEDICAL COLLEGE',
        description: 'Standardize Government Medical College'
      },
      
      // Medical college variations
      {
        pattern: /\bMED\.?\s*COL\.?\b/gi,
        replacement: 'MEDICAL COLLEGE',
        description: 'Expand MED COL to MEDICAL COLLEGE'
      },
      {
        pattern: /\bMEDICAL\s*COL\.?\b/gi,
        replacement: 'MEDICAL COLLEGE',
        description: 'Expand MEDICAL COL to MEDICAL COLLEGE'
      },
      
      // Institute variations
      {
        pattern: /\bINST\.?\s*OF\s*/gi,
        replacement: 'INSTITUTE OF ',
        description: 'Expand INST OF to INSTITUTE OF'
      },
      {
        pattern: /\bINSTITUTE\s*OF\s*MED\.?\s*SCI\.?\b/gi,
        replacement: 'INSTITUTE OF MEDICAL SCIENCES',
        description: 'Expand medical sciences abbreviations'
      },
      
      // University variations
      {
        pattern: /\bUNIV\.?\b/gi,
        replacement: 'UNIVERSITY',
        description: 'Expand UNIV to UNIVERSITY'
      },
      
      // All India Institute of Medical Sciences
      {
        pattern: /\bA\.?I\.?I\.?M\.?S\.?\b/gi,
        replacement: 'ALL INDIA INSTITUTE OF MEDICAL SCIENCES',
        description: 'Expand AIIMS acronym'
      },
      {
        pattern: /\bALL\s*INDIA\s*INST\.?\s*OF\s*MED\.?\s*SCI\.?\b/gi,
        replacement: 'ALL INDIA INSTITUTE OF MEDICAL SCIENCES',
        description: 'Standardize AIIMS full name'
      },
      
      // Private/Trust variations
      {
        pattern: /\bPVT\.?\s*LTD\.?\b/gi,
        replacement: 'PRIVATE LIMITED',
        description: 'Expand PVT LTD to PRIVATE LIMITED'
      },
      {
        pattern: /\bPRIVATE\s*LIMITED\b/gi,
        replacement: 'PRIVATE LIMITED',
        description: 'Standardize PRIVATE LIMITED'
      },
      
      // Remove extra punctuation in names
      {
        pattern: /,\s*,+/g,
        replacement: ',',
        description: 'Remove duplicate commas in names'
      },
      {
        pattern: /\s*,\s*/g,
        replacement: ', ',
        description: 'Standardize comma spacing'
      }
    ];

    // Address normalization rules
    this.addressRules = [
      // Road variations
      {
        pattern: /\bRD\.?\b/gi,
        replacement: 'ROAD',
        description: 'Expand RD to ROAD'
      },
      {
        pattern: /\bST\.?\b/gi,
        replacement: 'STREET',
        description: 'Expand ST to STREET'
      },
      
      // Area/Locality variations
      {
        pattern: /\bNAGAR\b/gi,
        replacement: 'NAGAR',
        description: 'Standardize NAGAR'
      },
      {
        pattern: /\bCOLONY\b/gi,
        replacement: 'COLONY',
        description: 'Standardize COLONY'
      },
      
      // Postal/Pin code patterns
      {
        pattern: /\bPIN\s*:\s*(\d+)/gi,
        replacement: 'PIN $1',
        description: 'Standardize PIN code format'
      },
      {
        pattern: /\bPOSTAL\s*CODE\s*:\s*(\d+)/gi,
        replacement: 'PIN $1',
        description: 'Convert postal code to PIN format'
      },
      
      // District variations
      {
        pattern: /\bDIST\.?\b/gi,
        replacement: 'DISTRICT',
        description: 'Expand DIST to DISTRICT'
      },
      {
        pattern: /\bDISTRICT\s*:\s*/gi,
        replacement: 'DISTRICT ',
        description: 'Standardize district format'
      }
    ];
  }

  private initializeStandardMappings(): void {
    // State name standardization (handles variations and abbreviations)
    this.stateStandardization = new Map([
      ['AP', 'ANDHRA PRADESH'],
      ['TN', 'TAMIL NADU'],
      ['UP', 'UTTAR PRADESH'],
      ['MP', 'MADHYA PRADESH'],
      ['HP', 'HIMACHAL PRADESH'],
      ['WB', 'WEST BENGAL'],
      ['KA', 'KARNATAKA'],
      ['KL', 'KERALA'],
      ['RJ', 'RAJASTHAN'],
      ['GJ', 'GUJARAT'],
      ['MH', 'MAHARASHTRA'],
      ['OR', 'ODISHA'],
      ['AS', 'ASSAM'],
      ['BR', 'BIHAR'],
      ['JH', 'JHARKHAND'],
      ['CT', 'CHHATTISGARH'],
      ['HR', 'HARYANA'],
      ['PB', 'PUNJAB'],
      ['UK', 'UTTARAKHAND'],
      ['DL', 'DELHI'],
      ['KARNATAK', 'KARNATAKA'],
      ['ORRISA', 'ODISHA'],
      ['ORISSA', 'ODISHA']
    ]);

    // Institution name standardization
    this.institutionStandardization = new Map([
      ['AIIMS', 'ALL INDIA INSTITUTE OF MEDICAL SCIENCES'],
      ['JIPMER', 'JAWAHARLAL INSTITUTE OF POSTGRADUATE MEDICAL EDUCATION AND RESEARCH'],
      ['PGIMER', 'POSTGRADUATE INSTITUTE OF MEDICAL EDUCATION AND RESEARCH'],
      ['NIMHANS', 'NATIONAL INSTITUTE OF MENTAL HEALTH AND NEURO SCIENCES'],
      ['SGPGIMS', 'SANJAY GANDHI POSTGRADUATE INSTITUTE OF MEDICAL SCIENCES'],
      ['KGMC', 'KING GEORGE MEDICAL COLLEGE'],
      ['LTMMC', 'LOKMANYA TILAK MUNICIPAL MEDICAL COLLEGE'],
      ['GMCH', 'GOVERNMENT MEDICAL COLLEGE AND HOSPITAL'],
      ['GMC', 'GOVERNMENT MEDICAL COLLEGE']
    ]);
  }

  /**
   * Main normalization function for college data
   */
  public normalizeCollegeData(data: CollegeNormalizationData): {
    normalized: CollegeNormalizationData;
    applied_rules: string[];
    confidence: number;
  } {
    console.log('🔧 Normalizing college data...');
    
    const applied_rules: string[] = [];
    let confidence = 1.0;

    // Step 1: Basic text cleaning
    const cleanName = this.applyGeneralNormalization(data.name, applied_rules);
    const cleanAddress = data.address ? this.applyGeneralNormalization(data.address, applied_rules) : undefined;
    const cleanState = this.applyGeneralNormalization(data.state, applied_rules);

    // Step 2: Specific normalization
    const normalizedName = this.normalizeCollegeName(cleanName, applied_rules);
    const normalizedAddress = cleanAddress ? this.normalizeAddress(cleanAddress, applied_rules) : undefined;
    const normalizedState = this.normalizeState(cleanState, applied_rules);

    // Step 3: Extract location from address/name
    const extractedLocation = this.extractLocationFromNormalizedData(normalizedName, normalizedAddress);

    // Calculate confidence based on changes made
    if (applied_rules.length > 0) {
      confidence = Math.max(0.7, 1.0 - (applied_rules.length * 0.05));
    }

    return {
      normalized: {
        name: normalizedName,
        address: normalizedAddress,
        state: normalizedState,
        location: extractedLocation
      },
      applied_rules,
      confidence
    };
  }

  private applyGeneralNormalization(text: string, applied_rules: string[]): string {
    let result = text.toUpperCase().trim();
    
    for (const rule of this.generalRules) {
      const before = result;
      result = result.replace(rule.pattern, rule.replacement);
      if (before !== result) {
        applied_rules.push(`General: ${rule.description}`);
      }
    }
    
    return result;
  }

  private normalizeCollegeName(name: string, applied_rules: string[]): string {
    let result = name;
    
    // Apply college name rules
    for (const rule of this.collegeNameRules) {
      const before = result;
      result = result.replace(rule.pattern, rule.replacement);
      if (before !== result) {
        applied_rules.push(`Name: ${rule.description}`);
      }
    }

    // Apply institution standardization
    for (const [abbrev, full] of this.institutionStandardization.entries()) {
      const pattern = new RegExp(`\\b${abbrev}\\b`, 'gi');
      const before = result;
      result = result.replace(pattern, full);
      if (before !== result) {
        applied_rules.push(`Institution: Expanded ${abbrev} to ${full}`);
      }
    }

    return result.trim();
  }

  private normalizeAddress(address: string, applied_rules: string[]): string {
    let result = address;
    
    for (const rule of this.addressRules) {
      const before = result;
      result = result.replace(rule.pattern, rule.replacement);
      if (before !== result) {
        applied_rules.push(`Address: ${rule.description}`);
      }
    }
    
    return result.trim();
  }

  private normalizeState(state: string, applied_rules: string[]): string {
    let result = state;
    
    // Apply state rules first
    for (const rule of this.stateNormalizationRules) {
      const before = result;
      result = result.replace(rule.pattern, rule.replacement);
      if (before !== result) {
        applied_rules.push(`State: ${rule.description}`);
      }
    }
    
    // Apply state abbreviation standardization
    const standardState = this.stateStandardization.get(result.trim());
    if (standardState) {
      applied_rules.push(`State: Expanded ${result} to ${standardState}`);
      result = standardState;
    }
    
    return result.trim();
  }

  private extractLocationFromNormalizedData(name: string, address?: string): string | undefined {
    // Try to extract location from name first
    let location = this.extractLocationFromText(name);
    
    // If not found, try from address
    if (!location && address) {
      location = this.extractLocationFromText(address);
    }
    
    return location;
  }

  private extractLocationFromText(text: string): string | undefined {
    // Remove common prefixes/suffixes that aren't locations
    const cleaned = text
      .replace(/\b(GOVERNMENT|MEDICAL|COLLEGE|INSTITUTE|UNIVERSITY|PRIVATE|LIMITED|SCIENCES|HOSPITAL)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Split by commas and look for potential locations
    const parts = cleaned.split(',').map(p => p.trim()).filter(p => p.length > 2);
    
    // Look for location indicators in the parts
    for (const part of parts) {
      // Skip if it looks like a full address component
      if (part.includes('ROAD') || part.includes('STREET') || part.includes('NAGAR') || part.includes('DISTRICT')) {
        continue;
      }
      
      // If it's a simple word/phrase, likely a city/location
      if (part.length >= 4 && part.length <= 20 && !part.includes('MEDICAL') && !part.includes('COLLEGE')) {
        return part;
      }
    }
    
    return undefined;
  }

  /**
   * Batch normalize multiple college records
   */
  public batchNormalize(
    records: CollegeNormalizationData[],
    onProgress?: (processed: number, total: number) => void
  ): Array<{
    original: CollegeNormalizationData;
    normalized: CollegeNormalizationData;
    applied_rules: string[];
    confidence: number;
  }> {
    console.log(`🔄 Starting batch normalization of ${records.length} records...`);
    
    const results = [];
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const normalizationResult = this.normalizeCollegeData(record);
      
      results.push({
        original: record,
        ...normalizationResult
      });
      
      if (onProgress && (i + 1) % 100 === 0) {
        onProgress(i + 1, records.length);
      }
    }
    
    if (onProgress) {
      onProgress(records.length, records.length);
    }
    
    console.log(`✅ Batch normalization complete`);
    return results;
  }

  /**
   * Generate normalization report
   */
  public generateNormalizationReport(
    results: Array<{
      original: CollegeNormalizationData;
      normalized: CollegeNormalizationData;
      applied_rules: string[];
      confidence: number;
    }>
  ): string {
    const stats = {
      totalRecords: results.length,
      normalized: results.filter(r => r.applied_rules.length > 0).length,
      unchanged: results.filter(r => r.applied_rules.length === 0).length,
      averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
      ruleFrequency: new Map<string, number>()
    };

    // Count rule applications
    for (const result of results) {
      for (const rule of result.applied_rules) {
        stats.ruleFrequency.set(rule, (stats.ruleFrequency.get(rule) || 0) + 1);
      }
    }

    // Top 10 most applied rules
    const topRules = Array.from(stats.ruleFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([rule, count]) => `${rule}: ${count} times`)
      .join('\n');

    // Examples of changes
    const examples = results
      .filter(r => r.applied_rules.length > 0)
      .slice(0, 5)
      .map(r => `Before: ${r.original.name}\nAfter:  ${r.normalized.name}\nRules:  ${r.applied_rules.join(', ')}\nConfidence: ${(r.confidence * 100).toFixed(1)}%`)
      .join('\n\n');

    return `
🔧 DATA NORMALIZATION REPORT
============================
Total Records: ${stats.totalRecords}
Records Normalized: ${stats.normalized} (${((stats.normalized / stats.totalRecords) * 100).toFixed(1)}%)
Records Unchanged: ${stats.unchanged} (${((stats.unchanged / stats.totalRecords) * 100).toFixed(1)}%)
Average Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%

📊 TOP APPLIED RULES
====================
${topRules}

📋 NORMALIZATION EXAMPLES
=========================
${examples}

✅ Data is now ready for hierarchical matching!
    `.trim();
  }

  /**
   * Validate normalization quality
   */
  public validateNormalization(
    results: Array<{
      original: CollegeNormalizationData;
      normalized: CollegeNormalizationData;
      confidence: number;
    }>
  ): {
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    needsReview: Array<{original: string; normalized: string; confidence: number}>;
  } {
    const highConfidence = results.filter(r => r.confidence >= 0.9).length;
    const mediumConfidence = results.filter(r => r.confidence >= 0.7 && r.confidence < 0.9).length;
    const lowConfidence = results.filter(r => r.confidence < 0.7).length;
    
    const needsReview = results
      .filter(r => r.confidence < 0.7)
      .map(r => ({
        original: r.original.name,
        normalized: r.normalized.name,
        confidence: r.confidence
      }));

    console.log(`📈 Validation Results:`);
    console.log(`   High Confidence (≥90%): ${highConfidence}`);
    console.log(`   Medium Confidence (70-89%): ${mediumConfidence}`);
    console.log(`   Low Confidence (<70%): ${lowConfidence}`);
    
    return { highConfidence, mediumConfidence, lowConfidence, needsReview };
  }
}