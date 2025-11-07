#!/usr/bin/env node

/**
 * Data Validator Utility
 * Validates data consistency and quality for NeetLogIQ
 */

const fs = require('fs');
const path = require('path');
const { z } = require('zod');

// Data schemas
const CollegeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  management_type: z.enum(['Government', 'Private', 'Deemed', 'Autonomous']),
  established_year: z.number().min(1800).max(new Date().getFullYear()).optional(),
  website: z.string().url().optional(),
  description: z.string().optional()
});

const CourseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  stream: z.string().min(1),
  branch: z.string().min(1),
  duration_years: z.number().min(1).max(10).optional(),
  description: z.string().optional()
});

const CutoffSchema = z.object({
  id: z.string().min(1),
  college_id: z.string().min(1),
  course_id: z.string().min(1),
  year: z.number().min(2020).max(new Date().getFullYear()),
  round: z.number().min(1).max(10),
  category: z.enum(['General', 'OBC', 'SC', 'ST', 'EWS']),
  opening_rank: z.number().min(1),
  closing_rank: z.number().min(1)
});

class DataValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.stats = {
      colleges: { total: 0, valid: 0, invalid: 0 },
      courses: { total: 0, valid: 0, invalid: 0 },
      cutoffs: { total: 0, valid: 0, invalid: 0 }
    };
  }

  async validateAll() {
    console.log('🔍 Starting data validation...');
    
    await this.validateColleges();
    await this.validateCourses();
    await this.validateCutoffs();
    await this.validateRelationships();
    
    this.printReport();
  }

  async validateColleges() {
    console.log('📊 Validating colleges...');
    
    try {
      const collegesData = fs.readFileSync('./data/colleges.parquet', 'utf8');
      const colleges = JSON.parse(collegesData);
      
      this.stats.colleges.total = colleges.length;
      
      for (const college of colleges) {
        try {
          CollegeSchema.parse(college);
          this.stats.colleges.valid++;
        } catch (error) {
          this.stats.colleges.invalid++;
          this.errors.push(`College ${college.id}: ${error.message}`);
        }
      }
      
    } catch (error) {
      this.errors.push(`Error reading colleges data: ${error.message}`);
    }
  }

  async validateCourses() {
    console.log('📚 Validating courses...');
    
    try {
      const coursesData = fs.readFileSync('./data/courses.parquet', 'utf8');
      const courses = JSON.parse(coursesData);
      
      this.stats.courses.total = courses.length;
      
      for (const course of courses) {
        try {
          CourseSchema.parse(course);
          this.stats.courses.valid++;
        } catch (error) {
          this.stats.courses.invalid++;
          this.errors.push(`Course ${course.id}: ${error.message}`);
        }
      }
      
    } catch (error) {
      this.errors.push(`Error reading courses data: ${error.message}`);
    }
  }

  async validateCutoffs() {
    console.log('📈 Validating cutoffs...');
    
    try {
      const cutoffsData = fs.readFileSync('./data/cutoffs.parquet', 'utf8');
      const cutoffs = JSON.parse(cutoffsData);
      
      this.stats.cutoffs.total = cutoffs.length;
      
      for (const cutoff of cutoffs) {
        try {
          CutoffSchema.parse(cutoff);
          
          // Additional validation
          if (cutoff.opening_rank > cutoff.closing_rank) {
            this.warnings.push(`Cutoff ${cutoff.id}: Opening rank (${cutoff.opening_rank}) > Closing rank (${cutoff.closing_rank})`);
          }
          
          this.stats.cutoffs.valid++;
        } catch (error) {
          this.stats.cutoffs.invalid++;
          this.errors.push(`Cutoff ${cutoff.id}: ${error.message}`);
        }
      }
      
    } catch (error) {
      this.errors.push(`Error reading cutoffs data: ${error.message}`);
    }
  }

  async validateRelationships() {
    console.log('🔗 Validating relationships...');
    
    try {
      // Check if college_courses relationships are valid
      const collegeCoursesData = fs.readFileSync('./data/college_courses.parquet', 'utf8');
      const collegeCourses = JSON.parse(collegeCoursesData);
      
      for (const cc of collegeCourses) {
        // Check if college exists
        const collegeExists = await this.checkCollegeExists(cc.college_id);
        if (!collegeExists) {
          this.errors.push(`College-Course relationship: College ${cc.college_id} not found`);
        }
        
        // Check if course exists
        const courseExists = await this.checkCourseExists(cc.course_id);
        if (!courseExists) {
          this.errors.push(`College-Course relationship: Course ${cc.course_id} not found`);
        }
      }
      
    } catch (error) {
      this.errors.push(`Error validating relationships: ${error.message}`);
    }
  }

  async checkCollegeExists(collegeId) {
    // This would check against the actual college data
    // For now, return true as a placeholder
    return true;
  }

  async checkCourseExists(courseId) {
    // This would check against the actual course data
    // For now, return true as a placeholder
    return true;
  }

  printReport() {
    console.log('\n📋 Data Validation Report');
    console.log('========================');
    
    // Statistics
    console.log('\n📊 Statistics:');
    console.log(`Colleges: ${this.stats.colleges.valid}/${this.stats.colleges.total} valid`);
    console.log(`Courses: ${this.stats.courses.valid}/${this.stats.courses.total} valid`);
    console.log(`Cutoffs: ${this.stats.cutoffs.valid}/${this.stats.cutoffs.total} valid`);
    
    // Errors
    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    // Warnings
    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    // Summary
    const totalErrors = this.errors.length;
    const totalWarnings = this.warnings.length;
    
    console.log('\n🎯 Summary:');
    console.log(`Total Errors: ${totalErrors}`);
    console.log(`Total Warnings: ${totalWarnings}`);
    
    if (totalErrors === 0) {
      console.log('✅ Data validation passed!');
    } else {
      console.log('❌ Data validation failed. Please fix the errors above.');
      process.exit(1);
    }
  }
}

// CLI usage
if (require.main === module) {
  const validator = new DataValidator();
  validator.validateAll();
}

module.exports = DataValidator;
