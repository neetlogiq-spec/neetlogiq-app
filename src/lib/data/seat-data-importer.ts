import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { UnifiedDatabase, SeatDataRecord, UnifiedCollege, UnifiedCourse, UnifiedSeatData } from './unified-database';

export interface SeatDataAnalysis {
  totalRecords: number;
  uniqueColleges: number;
  uniqueCourses: number;
  totalSeats: number;
  emptyCells: { [key: string]: number };
  sampleRecords: any[];
}

export interface DnbCategoryAggregation {
  collegeId: string;
  courseId: string;
  totalSeats: number;
  categories: { [category: string]: number };
}

export class SeatDataImporter {
  private dataDir: string;
  private seatDataPath: string;
  private foundationDataPath: string;
  private unifiedDb: UnifiedDatabase;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.seatDataPath = path.join(process.cwd(), 'data', 'seat data');
    this.foundationDataPath = path.join(process.cwd(), 'data', 'Foundation');
    this.unifiedDb = new UnifiedDatabase();
  }

  /**
   * Analyze seat data files to understand structure and content
   */
  async analyzeSeatData(): Promise<{ [key: string]: SeatDataAnalysis }> {
    console.log('🔍 Analyzing seat data files...');
    
    const analysis: { [key: string]: SeatDataAnalysis } = {};

    const files = [
      { name: 'medical_total_seats_CLEANED.xlsx', type: 'MEDICAL' },
      { name: 'dental_total_seats_CLEANED.xlsx', type: 'DENTAL' },
      { name: 'dnb_total_seats_CLEANED.xlsx', type: 'DNB' }
    ];

    for (const file of files) {
      try {
        const filePath = path.join(this.seatDataPath, file.name);
        if (!fs.existsSync(filePath)) {
          console.warn(`⚠️ File not found: ${filePath}`);
          continue;
        }

        console.log(`📊 Analyzing ${file.name}...`);
        const fileAnalysis = await this.analyzeFile(filePath, file.type);
        analysis[file.type.toLowerCase()] = fileAnalysis;

      } catch (error: any) {
        console.error(`❌ Error analyzing ${file.name}:`, error);
        analysis[file.type.toLowerCase()] = {
          totalRecords: 0,
          uniqueColleges: 0,
          uniqueCourses: 0,
          totalSeats: 0,
          emptyCells: {},
          sampleRecords: []
        };
      }
    }

    return analysis;
  }

  /**
   * Analyze individual file
   */
  private async analyzeFile(filePath: string, type: 'MEDICAL' | 'DENTAL' | 'DNB'): Promise<SeatDataAnalysis> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const analysis: SeatDataAnalysis = {
      totalRecords: data.length,
      uniqueColleges: 0,
      uniqueCourses: 0,
      totalSeats: 0,
      emptyCells: {},
      sampleRecords: data.slice(0, 3) // First 3 records as samples
    };

    // Count empty cells
    const columns = ['STATE', 'COLLEGE/INSTITUTE', 'ADDRESS', 'COURSE', 'UNIVERSITY_AFFILIATION', 'MANAGEMENT', 'SEATS'];
    if (type === 'DNB') {
      columns.push('CATEGORY');
    }

    for (const column of columns) {
      analysis.emptyCells[column] = data.filter((record: any) => 
        record[column] === null || record[column] === undefined || record[column] === ''
      ).length;
    }

    // Count unique colleges
    const collegeSet = new Set();
    const courseSet = new Set();
    let totalSeats = 0;

    for (const record of data) {
      // Type assertion for unknown record
      const typedRecord = record as {
        ADDRESS: string;
        'COLLEGE/INSTITUTE': string;
        COURSE: string;
        SEATS: string | number;
      };

      // Generate unique college identifier
      let collegeId: string;
      if (type === 'DNB') {
        const dnbCode = this.extractDnbCode(typedRecord.ADDRESS);
        collegeId = dnbCode ? `dnb_${dnbCode}` : `${typedRecord['COLLEGE/INSTITUTE']}_${typedRecord.ADDRESS}`;
      } else {
        collegeId = `${typedRecord['COLLEGE/INSTITUTE']}_${typedRecord.ADDRESS}`;
      }
      collegeSet.add(collegeId);

      // Count unique courses
      courseSet.add(typedRecord.COURSE);

      // Sum total seats
      const seats = Number(typedRecord.SEATS) || 0;
      totalSeats += seats;
    }

    analysis.uniqueColleges = collegeSet.size;
    analysis.uniqueCourses = courseSet.size;
    analysis.totalSeats = totalSeats;

    console.log(`📊 ${type} Analysis:`);
    console.log(`   Records: ${analysis.totalRecords}`);
    console.log(`   Unique Colleges: ${analysis.uniqueColleges}`);
    console.log(`   Unique Courses: ${analysis.uniqueCourses}`);
    console.log(`   Total Seats: ${analysis.totalSeats}`);
    console.log(`   Empty Cells:`, analysis.emptyCells);

    return analysis;
  }

  /**
   * Import and process seat data with DNB category aggregation
   */
  async importSeatDataWithAggregation(): Promise<{
    colleges: UnifiedCollege[];
    courses: UnifiedCourse[];
    seatData: UnifiedSeatData[];
    dnbAggregations: DnbCategoryAggregation[];
  }> {
    console.log('🚀 Starting seat data import with DNB aggregation...');

    const colleges: UnifiedCollege[] = [];
    const courses: UnifiedCourse[] = [];
    const seatData: UnifiedSeatData[] = [];
    const dnbAggregations: DnbCategoryAggregation[] = [];

    try {
      // Process medical data
      console.log('📊 Processing medical data...');
      const medicalResult = await this.processSeatDataFile('medical_total_seats_CLEANED.xlsx', 'MEDICAL');
      colleges.push(...medicalResult.colleges);
      courses.push(...medicalResult.courses);
      seatData.push(...medicalResult.seatData);

      // Process dental data
      console.log('📊 Processing dental data...');
      const dentalResult = await this.processSeatDataFile('dental_total_seats_CLEANED.xlsx', 'DENTAL');
      colleges.push(...dentalResult.colleges);
      courses.push(...dentalResult.courses);
      seatData.push(...dentalResult.seatData);

      // Process DNB data with category aggregation
      console.log('📊 Processing DNB data with category aggregation...');
      const dnbResult = await this.processDnbDataWithAggregation('dnb_total_seats_CLEANED.xlsx');
      colleges.push(...dnbResult.colleges);
      courses.push(...dnbResult.courses);
      seatData.push(...dnbResult.seatData);
      dnbAggregations.push(...dnbResult.aggregations);

      console.log('✅ Seat data import completed successfully!');
      console.log(`📊 Summary:`);
      console.log(`   Total Colleges: ${colleges.length}`);
      console.log(`   Total Courses: ${courses.length}`);
      console.log(`   Total Seat Records: ${seatData.length}`);
      console.log(`   DNB Aggregations: ${dnbAggregations.length}`);

      return { colleges, courses, seatData, dnbAggregations };

    } catch (error: any) {
      console.error('❌ Seat data import failed:', error);
      throw error;
    }
  }

  /**
   * Process regular seat data file (medical/dental)
   */
  private async processSeatDataFile(fileName: string, type: 'MEDICAL' | 'DENTAL'): Promise<{
    colleges: UnifiedCollege[];
    courses: UnifiedCourse[];
    seatData: UnifiedSeatData[];
  }> {
    const filePath = path.join(this.seatDataPath, fileName);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const colleges: UnifiedCollege[] = [];
    const courses: UnifiedCourse[] = [];
    const seatData: UnifiedSeatData[] = [];

    const collegeMap = new Map<string, UnifiedCollege>();
    const courseMap = new Map<string, UnifiedCourse>();

    for (const record of data) {
      try {
        // Type assertion for unknown record
        const typedRecord = record as {
          ADDRESS: string;
          'COLLEGE/INSTITUTE': string;
          COURSE: string;
          SEATS: string | number;
          [key: string]: any;
        };

        // Create college
        const collegeId = this.createCollegeId(typedRecord['COLLEGE/INSTITUTE'], typedRecord.ADDRESS, type);
        if (!collegeMap.has(collegeId)) {
          const college = this.createUnifiedCollege(typedRecord, type, collegeId);
          collegeMap.set(collegeId, college);
          colleges.push(college);
        }

        // Create course
        const courseId = this.createCourseId(typedRecord.COURSE, type);
        if (!courseMap.has(courseId)) {
          const course = this.createUnifiedCourse(typedRecord.COURSE, type, courseId);
          courseMap.set(courseId, course);
          courses.push(course);
        }

        // Create seat data
        const seatRecord = this.createUnifiedSeatData(
          collegeId,
          courseId,
          typedRecord.SEATS,
          fileName
        );
        seatData.push(seatRecord);

      } catch (error: any) {
        console.error(`❌ Error processing record:`, error);
      }
    }

    return { colleges, courses, seatData };
  }

  /**
   * Process DNB data with category aggregation
   */
  private async processDnbDataWithAggregation(fileName: string): Promise<{
    colleges: UnifiedCollege[];
    courses: UnifiedCourse[];
    seatData: UnifiedSeatData[];
    aggregations: DnbCategoryAggregation[];
  }> {
    const filePath = path.join(this.seatDataPath, fileName);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const colleges: UnifiedCollege[] = [];
    const courses: UnifiedCourse[] = [];
    const seatData: UnifiedSeatData[] = [];
    const aggregations: DnbCategoryAggregation[] = [];

    const collegeMap = new Map<string, UnifiedCollege>();
    const courseMap = new Map<string, UnifiedCourse>();
    const aggregationMap = new Map<string, DnbCategoryAggregation>();

    for (const record of data) {
      try {
        const typedRecord = record as {
          ADDRESS: string;
          'COLLEGE/INSTITUTE': string;
          COURSE: string;
          SEATS: string | number;
          [key: string]: any;
        };
        
        // Extract DNB code
        const dnbCode = this.extractDnbCode(typedRecord.ADDRESS);
        let collegeId: string;
        
        if (dnbCode) {
          collegeId = `dnb_${dnbCode}`;
        } else {
          // Fall back to college name + address for colleges without DNB codes
          collegeId = this.createCollegeId(typedRecord['COLLEGE/INSTITUTE'], typedRecord.ADDRESS, 'DNB');
          console.warn(`⚠️ DNB college missing 6-digit code, using fallback ID: ${typedRecord['COLLEGE/INSTITUTE']} -> ${collegeId}`);
        }

        const courseId = this.createCourseId(typedRecord.COURSE, 'DNB');

        // Create college
        if (!collegeMap.has(collegeId)) {
          const college = this.createUnifiedCollege(typedRecord, 'DNB', collegeId, dnbCode);
          collegeMap.set(collegeId, college);
          colleges.push(college);
        }

        // Create course
        if (!courseMap.has(courseId)) {
          const course = this.createUnifiedCourse(typedRecord.COURSE, 'DNB', courseId);
          courseMap.set(courseId, course);
          courses.push(course);
        }

        // Aggregate seats by category
        const aggregationKey = `${collegeId}_${courseId}`;
        if (!aggregationMap.has(aggregationKey)) {
          aggregationMap.set(aggregationKey, {
            collegeId,
            courseId,
            totalSeats: 0,
            categories: {}
          });
        }

        const aggregation = aggregationMap.get(aggregationKey)!;
        const category = typedRecord.CATEGORY || 'UNKNOWN';
        const seats = Number(typedRecord.SEATS) || 0;

        aggregation.categories[category] = (aggregation.categories[category] || 0) + seats;
        aggregation.totalSeats += seats;

      } catch (error: any) {
        console.error(`❌ Error processing DNB record:`, error);
      }
    }

    // Create final seat data records (aggregated)
    for (const aggregation of aggregationMap.values()) {
      const seatRecord = this.createUnifiedSeatData(
        aggregation.collegeId,
        aggregation.courseId,
        aggregation.totalSeats,
        fileName
      );
      seatData.push(seatRecord);
      aggregations.push(aggregation);
    }

    return { colleges, courses, seatData, aggregations };
  }

  /**
   * Create unified college record
   */
  private createUnifiedCollege(record: any, type: 'MEDICAL' | 'DENTAL' | 'DNB', collegeId: string, dnbCode?: string): UnifiedCollege {
    return {
      id: collegeId,
      name: this.sanitizeString(record['COLLEGE/INSTITUTE']) || 'Not Available',
      fullName: this.sanitizeString(record['COLLEGE/INSTITUTE']) || 'Not Available',
      type,
      state: this.sanitizeString(record.STATE) || 'Not Available',
      address: this.sanitizeString(record.ADDRESS) || 'Not Available',
      university: this.sanitizeString(record.UNIVERSITY_AFFILIATION) || 'Not Available',
      management: this.sanitizeString(record.MANAGEMENT) || 'Not Available',
      isActive: true,
      sourceFile: 'seat_data',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dnbCode: dnbCode || undefined
    };
  }

  /**
   * Create unified course record
   */
  private createUnifiedCourse(courseName: string, type: 'MEDICAL' | 'DENTAL' | 'DNB', courseId: string): UnifiedCourse {
    return {
      id: courseId,
      name: this.sanitizeString(courseName) || 'Not Available',
      type,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Create unified seat data record
   */
  private createUnifiedSeatData(collegeId: string, courseId: string, seats: number, sourceFile: string): UnifiedSeatData {
    return {
      id: `${collegeId}_${courseId}_${Date.now()}`,
      collegeId,
      courseId,
      seats: Number(seats) || 0,
      year: 2024, // Current year
      sourceFile,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Create college ID based on type
   */
  private createCollegeId(collegeName: string | null | undefined, address: string | null | undefined, type: 'MEDICAL' | 'DENTAL' | 'DNB'): string {
    if (type === 'DNB') {
      const dnbCode = address ? this.extractDnbCode(address) : null;
      return dnbCode ? `dnb_${dnbCode}` : `${type.toLowerCase()}_${this.createSlug(collegeName)}_${this.createSlug(address)}`;
    } else {
      return `${type.toLowerCase()}_${this.createSlug(collegeName)}_${this.createSlug(address)}`;
    }
  }

  /**
   * Create course ID
   */
  private createCourseId(courseName: string | null | undefined, type: 'MEDICAL' | 'DENTAL' | 'DNB'): string {
    return `${type.toLowerCase()}_${this.createSlug(courseName)}`;
  }

  /**
   * Extract 6-digit DNB code from address
   */
  private extractDnbCode(address: string): string | null {
    const match = address.match(/\((\d{6})\)/);
    return match ? match[1] : null;
  }

  /**
   * Create URL-friendly slug from string
   */
  private createSlug(str: string | null | undefined): string {
    if (!str) return 'not-available';
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Sanitize string values
   */
  private sanitizeString(value: any): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return String(value).trim();
  }

  /**
   * Test seat data access
   */
  async testSeatDataAccess(): Promise<boolean> {
    return await this.unifiedDb.testSeatDataAccess();
  }
}

export default SeatDataImporter;
