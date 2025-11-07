#!/usr/bin/env tsx

import Joi from 'joi';
import { CollegeData } from './excel-processor';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedData?: CollegeData;
  confidence: number;
}

export interface ValidationStats {
  totalProcessed: number;
  valid: number;
  invalid: number;
  warnings: number;
  duplicatesFound: number;
  confidenceDistribution: {
    high: number; // > 0.8
    medium: number; // 0.5 - 0.8
    low: number; // < 0.5
  };
}

export class CollegeValidator {
  private indianStates: Set<string>;
  private commonCollegeTypes: Set<string>;
  private medicalTerms: Set<string>;
  private dentalTerms: Set<string>;
  private dnbTerms: Set<string>;

  constructor() {
    this.initializeReferenceSets();
  }

  private initializeReferenceSets() {
    this.indianStates = new Set([
      'ANDAMAN AND NICOBAR ISLANDS', 'ANDHRA PRADESH', 'ARUNACHAL PRADESH',
      'ASSAM', 'BIHAR', 'CHANDIGARH', 'CHHATTISGARH', 'DADRA AND NAGAR HAVELI',
      'DAMAN AND DIU', 'DELHI', 'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH',
      'JAMMU AND KASHMIR', 'JHARKHAND', 'KARNATAKA', 'KERALA', 'LADAKH',
      'LAKSHADWEEP', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR', 'MEGHALAYA',
      'MIZORAM', 'NAGALAND', 'ODISHA', 'PUDUCHERRY', 'PUNJAB', 'RAJASTHAN',
      'SIKKIM', 'TAMIL NADU', 'TELANGANA', 'TRIPURA', 'UTTAR PRADESH',
      'UTTARAKHAND', 'WEST BENGAL'
    ]);

    this.commonCollegeTypes = new Set([
      'COLLEGE', 'INSTITUTE', 'UNIVERSITY', 'ACADEMY', 'SCHOOL', 'CENTRE', 'CENTER'
    ]);

    this.medicalTerms = new Set([
      'MEDICAL', 'MEDICINE', 'MBBS', 'MD', 'MS', 'AIIMS', 'JIPMER', 'PGIMER',
      'HOSPITAL', 'HEALTH', 'SCIENCES'
    ]);

    this.dentalTerms = new Set([
      'DENTAL', 'DENTISTRY', 'BDS', 'MDS', 'ORAL', 'MAXILLOFACIAL'
    ]);

    this.dnbTerms = new Set([
      'DNB', 'DIPLOMATE', 'NATIONAL', 'BOARD', 'FELLOWSHIP', 'TRAINING',
      'HOSPITAL', 'NURSING HOME'
    ]);
  }

  // Main validation schema
  private get collegeSchema() {
    return Joi.object({
      id: Joi.string().required().pattern(/^(medical|dental|dnb)_[a-z0-9]+$/, 'ID format'),
      name: Joi.string().required().min(10).max(500),
      cleanName: Joi.string().required().min(5).max(300),
      type: Joi.string().valid('MEDICAL', 'DENTAL', 'DNB').required(),
      state: Joi.string().optional().allow('', null),
      city: Joi.string().optional().allow('', null),
      address: Joi.string().optional().allow('', null),
      pincode: Joi.string().optional().pattern(/^\d{6}$/, 'Indian pincode format'),
      isActive: Joi.boolean().required(),
      sourceFile: Joi.string().required(),
      metadata: Joi.object({
        originalName: Joi.string().required(),
        extractedInfo: Joi.object().optional(),
        confidence: Joi.number().min(0).max(1).required()
      }).required()
    });
  }

  async validateCollege(college: CollegeData): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = college.metadata?.confidence || 0;

    // Schema validation
    const schemaResult = this.collegeSchema.validate(college, { abortEarly: false });
    if (schemaResult.error) {
      errors.push(...schemaResult.error.details.map(d => d.message));
    }

    // Business logic validation
    const businessValidation = await this.validateBusinessLogic(college);
    errors.push(...businessValidation.errors);
    warnings.push(...businessValidation.warnings);
    confidence = Math.max(confidence, businessValidation.confidence);

    // Normalize data if valid
    let normalizedData: CollegeData | undefined;
    if (errors.length === 0) {
      normalizedData = await this.normalizeCollegeData(college);
      confidence = Math.max(confidence, this.calculateConfidence(normalizedData));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      normalizedData,
      confidence
    };
  }

  private async validateBusinessLogic(college: CollegeData): Promise<{
    errors: string[];
    warnings: string[];
    confidence: number;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 0;

    // Validate college name consistency
    const nameValidation = this.validateCollegeName(college);
    errors.push(...nameValidation.errors);
    warnings.push(...nameValidation.warnings);
    confidence += nameValidation.confidence * 0.4;

    // Validate location data
    const locationValidation = this.validateLocationData(college);
    errors.push(...locationValidation.errors);
    warnings.push(...locationValidation.warnings);
    confidence += locationValidation.confidence * 0.3;

    // Validate type consistency
    const typeValidation = this.validateTypeConsistency(college);
    errors.push(...typeValidation.errors);
    warnings.push(...typeValidation.warnings);
    confidence += typeValidation.confidence * 0.3;

    return { errors, warnings, confidence };
  }

  private validateCollegeName(college: CollegeData): {
    errors: string[];
    warnings: string[];
    confidence: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 0;

    const name = college.name.toUpperCase();
    const cleanName = college.cleanName.toUpperCase();

    // Check if name contains college-type keywords
    const hasCollegeType = Array.from(this.commonCollegeTypes).some(type => 
      name.includes(type)
    );
    if (hasCollegeType) confidence += 0.3;
    else warnings.push('College name does not contain standard institution keywords');

    // Check name length and structure
    if (name.length < 10) {
      errors.push('College name is too short (minimum 10 characters)');
    } else if (name.length > 500) {
      errors.push('College name is too long (maximum 500 characters)');
    } else {
      confidence += 0.2;
    }

    // Check for suspicious patterns
    if (name.includes('...') || name.includes('???')) {
      warnings.push('College name contains suspicious patterns');
    } else {
      confidence += 0.1;
    }

    // Validate clean name is actually cleaner
    if (cleanName.length >= name.length) {
      warnings.push('Clean name is not actually cleaned');
    } else {
      confidence += 0.2;
    }

    // Check for duplicate words (common data quality issue)
    const words = name.split(/\s+/);
    const uniqueWords = new Set(words);
    if (words.length - uniqueWords.size > 2) {
      warnings.push('College name contains many repeated words');
    } else {
      confidence += 0.2;
    }

    return { errors, warnings, confidence };
  }

  private validateLocationData(college: CollegeData): {
    errors: string[];
    warnings: string[];
    confidence: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 0;

    // Validate state
    if (college.state) {
      if (this.indianStates.has(college.state.toUpperCase())) {
        confidence += 0.4;
      } else {
        warnings.push(`Unknown state: ${college.state}`);
      }
    } else {
      warnings.push('Missing state information');
    }

    // Validate pincode
    if (college.pincode) {
      if (/^\d{6}$/.test(college.pincode)) {
        confidence += 0.3;
      } else {
        errors.push('Invalid pincode format');
      }
    } else {
      warnings.push('Missing pincode information');
    }

    // Validate city
    if (college.city) {
      if (college.city.length >= 2 && college.city.length <= 50) {
        confidence += 0.2;
      } else {
        warnings.push('City name seems invalid');
      }
    } else {
      warnings.push('Missing city information');
    }

    // Check address consistency
    if (college.address) {
      const addressUpper = college.address.toUpperCase();
      
      // Address should contain some location info
      if (college.state && addressUpper.includes(college.state.toUpperCase())) {
        confidence += 0.1;
      }
      
      if (college.city && addressUpper.includes(college.city.toUpperCase())) {
        confidence += 0.1;
      }
      
      if (college.address.length > 200) {
        warnings.push('Address is very long, might contain duplicate information');
      }
    }

    return { errors, warnings, confidence };
  }

  private validateTypeConsistency(college: CollegeData): {
    errors: string[];
    warnings: string[];
    confidence: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 0;

    const name = college.name.toUpperCase();
    const type = college.type;

    // Check if name contains terms consistent with type
    let hasRelevantTerms = false;
    
    switch (type) {
      case 'MEDICAL':
        hasRelevantTerms = Array.from(this.medicalTerms).some(term => name.includes(term));
        break;
      case 'DENTAL':
        hasRelevantTerms = Array.from(this.dentalTerms).some(term => name.includes(term));
        break;
      case 'DNB':
        hasRelevantTerms = Array.from(this.dnbTerms).some(term => name.includes(term));
        break;
    }

    if (hasRelevantTerms) {
      confidence += 0.6;
    } else {
      warnings.push(`College name doesn't contain terms consistent with type: ${type}`);
    }

    // Check for conflicting type terms
    const conflictingTerms = [];
    if (type !== 'MEDICAL' && Array.from(this.medicalTerms).some(term => name.includes(term))) {
      conflictingTerms.push('medical');
    }
    if (type !== 'DENTAL' && Array.from(this.dentalTerms).some(term => name.includes(term))) {
      conflictingTerms.push('dental');
    }

    if (conflictingTerms.length > 0) {
      warnings.push(`College name contains terms conflicting with type: ${conflictingTerms.join(', ')}`);
    } else {
      confidence += 0.4;
    }

    return { errors, warnings, confidence };
  }

  private async normalizeCollegeData(college: CollegeData): Promise<CollegeData> {
    const normalized = { ...college };

    // Normalize name fields
    normalized.name = this.normalizeText(college.name);
    normalized.cleanName = this.normalizeText(college.cleanName);

    // Normalize location data
    if (normalized.state) {
      normalized.state = this.normalizeLocationName(normalized.state);
    }
    
    if (normalized.city) {
      normalized.city = this.normalizeLocationName(normalized.city);
    }

    // Ensure pincode is properly formatted
    if (normalized.pincode) {
      normalized.pincode = normalized.pincode.replace(/\D/g, '').slice(0, 6);
      if (normalized.pincode.length !== 6) {
        normalized.pincode = undefined;
      }
    }

    // Update confidence based on normalization
    normalized.metadata.confidence = Math.max(
      normalized.metadata.confidence,
      this.calculateConfidence(normalized)
    );

    return normalized;
  }

  private normalizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[""]/g, '"') // Normalize quotes
      .replace(/['']/g, "'") // Normalize apostrophes
      .toUpperCase();
  }

  private normalizeLocationName(location: string): string {
    // Common location name normalizations
    const normalized = location
      .toUpperCase()
      .replace(/\bST\b/g, 'SAINT')
      .replace(/\bMT\b/g, 'MOUNT')
      .replace(/\bU\.?T\.?\b/g, 'UNION TERRITORY')
      .trim();

    return normalized;
  }

  private calculateConfidence(college: CollegeData): number {
    let confidence = 0;

    // Name quality (30%)
    if (college.name.length > 15 && college.name.length < 200) confidence += 0.1;
    if (college.cleanName.length > 5 && college.cleanName.length < college.name.length) confidence += 0.1;
    if (Array.from(this.commonCollegeTypes).some(type => college.name.toUpperCase().includes(type))) confidence += 0.1;

    // Location data quality (40%)
    if (college.state && this.indianStates.has(college.state.toUpperCase())) confidence += 0.15;
    if (college.city && college.city.length > 2) confidence += 0.1;
    if (college.pincode && /^\d{6}$/.test(college.pincode)) confidence += 0.15;

    // Type consistency (30%)
    const name = college.name.toUpperCase();
    switch (college.type) {
      case 'MEDICAL':
        if (Array.from(this.medicalTerms).some(term => name.includes(term))) confidence += 0.3;
        break;
      case 'DENTAL':
        if (Array.from(this.dentalTerms).some(term => name.includes(term))) confidence += 0.3;
        break;
      case 'DNB':
        if (Array.from(this.dnbTerms).some(term => name.includes(term))) confidence += 0.3;
        break;
    }

    return Math.min(confidence, 1.0);
  }

  async validateBatch(colleges: CollegeData[]): Promise<{
    results: ValidationResult[];
    stats: ValidationStats;
    duplicates: Array<{ college1: CollegeData; college2: CollegeData; similarity: number }>;
  }> {
    const results: ValidationResult[] = [];
    const duplicates: Array<{ college1: CollegeData; college2: CollegeData; similarity: number }> = [];

    // Validate each college
    for (const college of colleges) {
      const result = await this.validateCollege(college);
      results.push(result);
    }

    // Find duplicates
    const validColleges = results
      .filter(r => r.isValid && r.normalizedData)
      .map(r => r.normalizedData!);

    for (let i = 0; i < validColleges.length; i++) {
      for (let j = i + 1; j < validColleges.length; j++) {
        const similarity = this.calculateSimilarity(validColleges[i], validColleges[j]);
        if (similarity > 0.85) {
          duplicates.push({
            college1: validColleges[i],
            college2: validColleges[j],
            similarity
          });
        }
      }
    }

    // Generate stats
    const stats = this.generateValidationStats(results, duplicates);

    return { results, stats, duplicates };
  }

  private calculateSimilarity(college1: CollegeData, college2: CollegeData): number {
    let similarity = 0;

    // Name similarity (most important)
    const nameSimilarity = this.stringSimilarity(college1.cleanName, college2.cleanName);
    similarity += nameSimilarity * 0.6;

    // Location similarity
    if (college1.state === college2.state) similarity += 0.2;
    if (college1.city === college2.city) similarity += 0.1;
    if (college1.pincode === college2.pincode) similarity += 0.1;

    return similarity;
  }

  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
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

  private generateValidationStats(results: ValidationResult[], duplicates: any[]): ValidationStats {
    const valid = results.filter(r => r.isValid).length;
    const invalid = results.filter(r => !r.isValid).length;
    const warnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

    const confidences = results
      .filter(r => r.isValid && r.normalizedData)
      .map(r => r.confidence);

    const confidenceDistribution = {
      high: confidences.filter(c => c > 0.8).length,
      medium: confidences.filter(c => c >= 0.5 && c <= 0.8).length,
      low: confidences.filter(c => c < 0.5).length
    };

    return {
      totalProcessed: results.length,
      valid,
      invalid,
      warnings,
      duplicatesFound: duplicates.length,
      confidenceDistribution
    };
  }

  // Utility method to generate validation report
  generateValidationReport(
    results: ValidationResult[], 
    stats: ValidationStats, 
    duplicates: any[]
  ): string {
    const report = [];
    
    report.push('=== COLLEGE DATA VALIDATION REPORT ===\n');
    
    report.push('📊 SUMMARY:');
    report.push(`Total Processed: ${stats.totalProcessed}`);
    report.push(`Valid: ${stats.valid} (${(stats.valid/stats.totalProcessed*100).toFixed(1)}%)`);
    report.push(`Invalid: ${stats.invalid} (${(stats.invalid/stats.totalProcessed*100).toFixed(1)}%)`);
    report.push(`Warnings: ${stats.warnings}`);
    report.push(`Duplicates Found: ${stats.duplicatesFound}`);
    report.push('');

    report.push('🎯 CONFIDENCE DISTRIBUTION:');
    report.push(`High Confidence (>80%): ${stats.confidenceDistribution.high}`);
    report.push(`Medium Confidence (50-80%): ${stats.confidenceDistribution.medium}`);
    report.push(`Low Confidence (<50%): ${stats.confidenceDistribution.low}`);
    report.push('');

    if (duplicates.length > 0) {
      report.push('🔍 POTENTIAL DUPLICATES:');
      duplicates.slice(0, 10).forEach((dup, i) => {
        report.push(`${i + 1}. Similarity: ${(dup.similarity * 100).toFixed(1)}%`);
        report.push(`   A: ${dup.college1.cleanName}`);
        report.push(`   B: ${dup.college2.cleanName}`);
        report.push('');
      });
    }

    const errorSummary = results
      .filter(r => !r.isValid)
      .slice(0, 10)
      .map(r => r.errors.join(', '));

    if (errorSummary.length > 0) {
      report.push('❌ COMMON ERRORS:');
      errorSummary.forEach((error, i) => {
        report.push(`${i + 1}. ${error}`);
      });
    }

    return report.join('\n');
  }
}

export default CollegeValidator;