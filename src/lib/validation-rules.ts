// Validation Rules Engine for Staging Data Review

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  type: 'college' | 'course' | 'cutoff';
  severity: 'error' | 'warning' | 'info';
  validate: (data: any) => ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  suggestions?: string[];
}

export interface ValidationReport {
  ruleId: string;
  ruleName: string;
  severity: 'error' | 'warning' | 'info';
  itemId: string;
  itemName: string;
  message: string;
  suggestions: string[];
}

// College Validation Rules
export const collegeValidationRules: ValidationRule[] = [
  {
    id: 'college-low-confidence',
    name: 'Low Confidence Match',
    description: 'Flags matches with confidence below 70%',
    type: 'college',
    severity: 'warning',
    validate: (college: any): ValidationResult => {
      if (college.match_confidence && college.match_confidence < 0.7) {
        return {
          isValid: false,
          message: `Low confidence match: ${(college.match_confidence * 100).toFixed(1)}%`,
          suggestions: [
            'Review the mapping manually',
            'Check for spelling variations',
            'Consider using alias mapping'
          ]
        };
      }
      return { isValid: true };
    }
  },
  {
    id: 'college-unmatched',
    name: 'Unmatched College',
    description: 'Flags colleges without any match',
    type: 'college',
    severity: 'error',
    validate: (college: any): ValidationResult => {
      if (!college.unified_college_id) {
        return {
          isValid: false,
          message: 'No matching college found in master data',
          suggestions: [
            'Verify college name spelling',
            'Check if college exists in master data',
            'Create manual mapping if needed',
            'Add to alias table for future imports'
          ]
        };
      }
      return { isValid: true };
    }
  },
  {
    id: 'college-name-mismatch',
    name: 'Name Similarity Check',
    description: 'Flags potential name mismatches',
    type: 'college',
    severity: 'warning',
    validate: (college: any): ValidationResult => {
      if (college.unified_college_name && college.staging_college_name) {
        const stagingLower = college.staging_college_name.toLowerCase();
        const unifiedLower = college.unified_college_name.toLowerCase();

        // Check if staging name contains unified name or vice versa
        const hasSubstring = stagingLower.includes(unifiedLower) ||
                            unifiedLower.includes(stagingLower);

        if (!hasSubstring && college.match_confidence < 0.9) {
          return {
            isValid: false,
            message: 'Staging and unified names appear significantly different',
            suggestions: [
              'Verify this is the correct match',
              'Check for abbreviations or alternate names',
              'Consider rejecting and creating manual match'
            ]
          };
        }
      }
      return { isValid: true };
    }
  }
];

// Course Validation Rules
export const courseValidationRules: ValidationRule[] = [
  {
    id: 'course-low-confidence',
    name: 'Low Confidence Match',
    description: 'Flags course matches with confidence below 80%',
    type: 'course',
    severity: 'warning',
    validate: (course: any): ValidationResult => {
      if (course.match_confidence && course.match_confidence < 0.8) {
        return {
          isValid: false,
          message: `Low confidence match: ${(course.match_confidence * 100).toFixed(1)}%`,
          suggestions: [
            'Review the course mapping',
            'Check for abbreviations',
            'Verify course code alignment'
          ]
        };
      }
      return { isValid: true };
    }
  },
  {
    id: 'course-unmatched',
    name: 'Unmatched Course',
    description: 'Flags courses without any match',
    type: 'course',
    severity: 'error',
    validate: (course: any): ValidationResult => {
      if (!course.unified_course_id) {
        return {
          isValid: false,
          message: 'No matching course found in master data',
          suggestions: [
            'Verify course name and code',
            'Check if course exists in master data',
            'Create manual mapping',
            'Add to course alias table'
          ]
        };
      }
      return { isValid: true };
    }
  }
];

// Cutoff Validation Rules
export const cutoffValidationRules: ValidationRule[] = [
  {
    id: 'cutoff-rank-validation',
    name: 'Rank Order Validation',
    description: 'Ensures opening rank <= closing rank',
    type: 'cutoff',
    severity: 'error',
    validate: (cutoff: any): ValidationResult => {
      if (cutoff.opening_rank > cutoff.closing_rank) {
        return {
          isValid: false,
          message: `Opening rank (${cutoff.opening_rank}) is greater than closing rank (${cutoff.closing_rank})`,
          suggestions: [
            'Verify the rank values',
            'Check source data for errors',
            'Swap ranks if they were entered incorrectly'
          ]
        };
      }
      return { isValid: true };
    }
  },
  {
    id: 'cutoff-year-validation',
    name: 'Year Range Validation',
    description: 'Ensures year is within valid range',
    type: 'cutoff',
    severity: 'warning',
    validate: (cutoff: any): ValidationResult => {
      const currentYear = new Date().getFullYear();
      if (cutoff.year < 2020 || cutoff.year > currentYear + 1) {
        return {
          isValid: false,
          message: `Year ${cutoff.year} is outside expected range (2020-${currentYear + 1})`,
          suggestions: [
            'Verify the year value',
            'Check if this is historical data',
            'Confirm source file year'
          ]
        };
      }
      return { isValid: true };
    }
  },
  {
    id: 'cutoff-missing-college',
    name: 'Missing College Reference',
    description: 'Flags cutoffs without college mapping',
    type: 'cutoff',
    severity: 'error',
    validate: (cutoff: any): ValidationResult => {
      if (!cutoff.college_id) {
        return {
          isValid: false,
          message: 'Cutoff has no college reference',
          suggestions: [
            'Ensure college is matched first',
            'Check data import integrity',
            'Verify foreign key relationships'
          ]
        };
      }
      return { isValid: true };
    }
  },
  {
    id: 'cutoff-missing-course',
    name: 'Missing Course Reference',
    description: 'Flags cutoffs without course mapping',
    type: 'cutoff',
    severity: 'error',
    validate: (cutoff: any): ValidationResult => {
      if (!cutoff.course_id) {
        return {
          isValid: false,
          message: 'Cutoff has no course reference',
          suggestions: [
            'Ensure course is matched first',
            'Check data import integrity',
            'Verify foreign key relationships'
          ]
        };
      }
      return { isValid: true };
    }
  }
];

// Validation Engine
export class ValidationEngine {
  private rules: ValidationRule[] = [];

  constructor() {
    this.rules = [
      ...collegeValidationRules,
      ...courseValidationRules,
      ...cutoffValidationRules
    ];
  }

  validateItem(item: any, type: 'college' | 'course' | 'cutoff'): ValidationReport[] {
    const applicableRules = this.rules.filter(rule => rule.type === type);
    const reports: ValidationReport[] = [];

    for (const rule of applicableRules) {
      const result = rule.validate(item);
      if (!result.isValid) {
        reports.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          itemId: item.id,
          itemName: item.staging_college_name || item.staging_course_name || item.id,
          message: result.message || 'Validation failed',
          suggestions: result.suggestions || []
        });
      }
    }

    return reports;
  }

  validateBatch(items: any[], type: 'college' | 'course' | 'cutoff'): ValidationReport[] {
    const allReports: ValidationReport[] = [];

    for (const item of items) {
      const itemReports = this.validateItem(item, type);
      allReports.push(...itemReports);
    }

    return allReports;
  }

  getValidationSummary(reports: ValidationReport[]) {
    const summary = {
      total: reports.length,
      errors: reports.filter(r => r.severity === 'error').length,
      warnings: reports.filter(r => r.severity === 'warning').length,
      info: reports.filter(r => r.severity === 'info').length,
      byRule: {} as Record<string, number>
    };

    reports.forEach(report => {
      summary.byRule[report.ruleId] = (summary.byRule[report.ruleId] || 0) + 1;
    });

    return summary;
  }

  getRuleById(id: string): ValidationRule | undefined {
    return this.rules.find(rule => rule.id === id);
  }

  getAllRules(): ValidationRule[] {
    return this.rules;
  }
}

// Export singleton instance
export const validationEngine = new ValidationEngine();
