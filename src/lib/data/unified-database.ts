import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

// Interfaces
export interface SeatDataRecord {
  state: string;
  collegeName: string;
  address: string;
  course: string;
  universityAffiliation: string;
  management: string;
  seats: number;
  category?: string; // Only for DNB data
  sourceFile: string;
  uniqueId: string; // Generated unique identifier
}

export interface UnifiedCollege {
  id: string;
  name: string;
  fullName?: string;
  type: 'MEDICAL' | 'DENTAL' | 'DNB';
  state: string;
  address: string;
  city?: string;
  pincode?: string;
  university: string;
  management: string;
  establishedYear?: number;
  website?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  sourceFile: string;
  createdAt: string;
  updatedAt: string;
  // DNB specific
  dnbCode?: string; // 6-digit code for DNB colleges
}

export interface UnifiedCourse {
  id: string;
  name: string;
  type: 'MEDICAL' | 'DENTAL' | 'DNB';
  description?: string;
  duration?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UnifiedSeatData {
  id: string;
  collegeId: string;
  courseId: string;
  seats: number;
  year: number;
  sourceFile: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportSummary {
  totalRecords: number;
  collegesCreated: number;
  coursesCreated: number;
  seatDataCreated: number;
  errors: string[];
  warnings: string[];
}

export class UnifiedDatabase {
  private dataDir: string;
  private seatDataPath: string;
  private foundationDataPath: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.seatDataPath = path.join(process.cwd(), 'data', 'seat data');
    this.foundationDataPath = path.join(process.cwd(), 'data', 'Foundation');
  }

  /**
   * Main method to import all seat data and create unified database
   */
  async importAllSeatData(): Promise<ImportSummary> {
    console.log('🚀 Starting unified seat data import...');
    
    const summary: ImportSummary = {
      totalRecords: 0,
      collegesCreated: 0,
      coursesCreated: 0,
      seatDataCreated: 0,
      errors: [],
      warnings: []
    };

    try {
      // Import medical data
      console.log('📊 Importing medical seat data...');
      const medicalResult = await this.importSeatData('medical_total_seats_CLEANED.xlsx', 'MEDICAL');
      this.mergeSummary(summary, medicalResult);

      // Import dental data
      console.log('📊 Importing dental seat data...');
      const dentalResult = await this.importSeatData('dental_total_seats_CLEANED.xlsx', 'DENTAL');
      this.mergeSummary(summary, dentalResult);

      // Import DNB data
      console.log('📊 Importing DNB seat data...');
      const dnbResult = await this.importSeatData('dnb_total_seats_CLEANED.xlsx', 'DNB');
      this.mergeSummary(summary, dnbResult);

      // Create unified JSON files
      await this.createUnifiedJsonFiles();

      console.log('✅ Unified seat data import completed successfully!');
      return summary;

    } catch (error: any) {
      console.error('❌ Unified seat data import failed:', error);
      summary.errors.push(`Import failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Import seat data from a specific file
   */
  private async importSeatData(fileName: string, type: 'MEDICAL' | 'DENTAL' | 'DNB'): Promise<ImportSummary> {
    const summary: ImportSummary = {
      totalRecords: 0,
      collegesCreated: 0,
      coursesCreated: 0,
      seatDataCreated: 0,
      errors: [],
      warnings: []
    };

    try {
      const filePath = path.join(this.seatDataPath, fileName);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      console.log(`📁 Reading ${type} data from: ${filePath}`);
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      console.log(`📊 Found ${data.length} records in ${fileName}`);

      // Process each record
      for (const record of data) {
        try {
          const seatRecord = this.processSeatRecord(record, type, fileName);
          if (seatRecord) {
            summary.totalRecords++;
            // Here we would add to our unified database
            // For now, we'll just validate the data structure
          }
        } catch (error: any) {
          summary.errors.push(`Error processing record: ${error.message}`);
        }
      }

      console.log(`✅ Successfully processed ${summary.totalRecords} ${type} records`);
      return summary;

    } catch (error: any) {
      console.error(`❌ Error importing ${type} data:`, error);
      summary.errors.push(`Import failed: ${error.message}`);
      return summary;
    }
  }

  /**
   * Process individual seat data record
   */
  private processSeatRecord(record: any, type: 'MEDICAL' | 'DENTAL' | 'DNB', sourceFile: string): SeatDataRecord | null {
    try {
      // Extract basic data
      const state = this.sanitizeString(record.STATE) || 'Not Available';
      const collegeName = this.sanitizeString(record['COLLEGE/INSTITUTE']) || 'Not Available';
      const address = this.sanitizeString(record.ADDRESS) || 'Not Available';
      const course = this.sanitizeString(record.COURSE) || 'Not Available';
      const universityAffiliation = this.sanitizeString(record.UNIVERSITY_AFFILIATION) || 'Not Available';
      const management = this.sanitizeString(record.MANAGEMENT) || 'Not Available';
      const seats = this.sanitizeNumber(record.SEATS) || 0;

      // Generate unique ID based on type
      let uniqueId: string;
      if (type === 'DNB') {
        // Extract 6-digit code from address
        const dnbCode = this.extractDnbCode(address);
        if (!dnbCode) {
          throw new Error(`DNB college missing 6-digit code: ${collegeName}`);
        }
        uniqueId = `dnb_${dnbCode}`;
      } else {
        // Use college name + address for medical/dental
        uniqueId = `${type.toLowerCase()}_${this.createSlug(collegeName)}_${this.createSlug(address)}`;
      }

      // Handle DNB category aggregation
      let finalSeats = seats;
      if (type === 'DNB' && record.CATEGORY) {
        // For DNB, we'll aggregate seats across categories
        // This will be handled in the aggregation step
        finalSeats = seats;
      }

      return {
        state,
        collegeName,
        address,
        course,
        universityAffiliation,
        management,
        seats: finalSeats,
        category: type === 'DNB' ? record.CATEGORY : undefined,
        sourceFile,
        uniqueId
      };

    } catch (error: any) {
      console.error(`❌ Error processing record:`, error);
      return null;
    }
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
  private createSlug(str: string): string {
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
   * Sanitize number values
   */
  private sanitizeNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  /**
   * Merge import summaries
   */
  private mergeSummary(target: ImportSummary, source: ImportSummary): void {
    target.totalRecords += source.totalRecords;
    target.collegesCreated += source.collegesCreated;
    target.coursesCreated += source.coursesCreated;
    target.seatDataCreated += source.seatDataCreated;
    target.errors.push(...source.errors);
    target.warnings.push(...source.warnings);
  }

  /**
   * Create unified JSON files
   */
  private async createUnifiedJsonFiles(): Promise<void> {
    console.log('📊 Creating unified JSON files...');
    
    // This would create the final unified database files
    // For now, we'll create placeholder files
    const unifiedData = {
      colleges: [],
      courses: [],
      seatData: [],
      metadata: {
        createdAt: new Date().toISOString(),
        totalColleges: 0,
        totalCourses: 0,
        totalSeats: 0
      }
    };

    await this.createJsonFile('unified_colleges.json', unifiedData.colleges);
    await this.createJsonFile('unified_courses.json', unifiedData.courses);
    await this.createJsonFile('unified_seat_data.json', unifiedData.seatData);
    await this.createJsonFile('unified_metadata.json', unifiedData.metadata);

    console.log('✅ Unified JSON files created successfully');
  }

  /**
   * Create JSON file helper
   */
  private async createJsonFile(fileName: string, data: any[]): Promise<void> {
    const jsonPath = path.join(this.dataDir, fileName);
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    console.log(`✅ Created ${jsonPath} with ${data.length} records`);
  }

  /**
   * Test seat data access
   */
  async testSeatDataAccess(): Promise<boolean> {
    try {
      console.log('🧪 Testing seat data access...');
      
      const files = [
        'medical_total_seats_CLEANED.xlsx',
        'dental_total_seats_CLEANED.xlsx',
        'dnb_total_seats_CLEANED.xlsx'
      ];

      for (const file of files) {
        const filePath = path.join(this.seatDataPath, file);
        if (!fs.existsSync(filePath)) {
          console.error(`❌ File not found: ${filePath}`);
          return false;
        }
        console.log(`✅ Found: ${file}`);
      }

      console.log('✅ All seat data files accessible');
      return true;

    } catch (error: any) {
      console.error('❌ Seat data access test failed:', error);
      return false;
    }
  }

  /**
   * Get seat data summary
   */
  async getSeatDataSummary(): Promise<any> {
    try {
      console.log('📊 Getting seat data summary...');
      
      const summary = {
        medical: { records: 0, colleges: 0, courses: 0, seats: 0 },
        dental: { records: 0, colleges: 0, courses: 0, seats: 0 },
        dnb: { records: 0, colleges: 0, courses: 0, seats: 0 }
      };

      // This would analyze the actual data files
      // For now, return placeholder summary
      return summary;

    } catch (error: any) {
      console.error('❌ Failed to get seat data summary:', error);
      return null;
    }
  }
}

export default UnifiedDatabase;
