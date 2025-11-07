import { MasterDataManager } from './master-data-architecture';

/**
 * Hierarchical Pivot-based College/Course Data Importer
 * 
 * This leverages the hierarchical structure of your college/course data:
 * STATE -> MANAGEMENT -> COLLEGE -> ADDRESS -> UNIVERSITY -> COURSE -> SEATS -> SPECIALIZATIONS
 * 
 * Benefits:
 * - Eliminates need to search through 16,000+ records
 * - Builds college context progressively 
 * - Creates normalized master data during import
 * - Handles both UG (MBBS/BDS) and PG specializations
 * - Perfect for pivot table structured data
 */

interface HierarchicalContext {
  state?: string;
  management?: string;
  college?: string;
  address?: string;
  university?: string;
  course?: string;
  seats?: number;
  
  // Master data IDs (resolved during processing)
  masterStateId?: number;
  masterCollegeId?: number;
  masterCourseId?: number;
}

interface PivotDataRow {
  level: 'STATE' | 'MANAGEMENT' | 'COLLEGE' | 'ADDRESS' | 'UNIVERSITY' | 'COURSE' | 'SEATS' | 'SPECIALIZATION';
  value: string | number;
  indentLevel: number; // To determine hierarchy depth
}

interface ImportResult {
  success: boolean;
  batchId: string;
  stats: {
    totalRows: number;
    statesProcessed: number;
    collegesCreated: number;
    coursesLinked: number;
    specializationsAdded: number;
    errors: number;
  };
  createdEntities: {
    states: Array<{ name: string; id: number }>;
    colleges: Array<{ name: string; id: number; state: string }>;
    courses: Array<{ name: string; id: number; type: 'UG' | 'PG' }>;
  };
  validationErrors: any[];
  processingTime: number;
}

export class HierarchicalPivotImporter {
  private masterDataManager: MasterDataManager;
  private currentContext: HierarchicalContext = {};
  
  constructor(masterDataManager: MasterDataManager) {
    this.masterDataManager = masterDataManager;
  }

  /**
   * Import hierarchical college/course data from pivot structure
   */
  async importHierarchicalData(
    pivotData: PivotDataRow[],
    options: {
      fileName?: string;
      progressCallback?: (progress: number, status: string, stats: any) => void;
    } = {}
  ): Promise<ImportResult> {
    
    const startTime = Date.now();
    const batchId = this.generateBatchId();
    
    const result: ImportResult = {
      success: false,
      batchId,
      stats: {
        totalRows: pivotData.length,
        statesProcessed: 0,
        collegesCreated: 0,
        coursesLinked: 0,
        specializationsAdded: 0,
        errors: 0
      },
      createdEntities: {
        states: [],
        colleges: [],
        courses: []
      },
      validationErrors: [],
      processingTime: 0
    };

    console.log(`🏗️ Starting hierarchical pivot import [${batchId}]`);
    console.log(`📊 Processing ${pivotData.length} hierarchical rows`);
    
    try {
      // Reset context for new import
      this.currentContext = {};
      
      // Process each row in the hierarchical structure
      for (let i = 0; i < pivotData.length; i++) {
        const row = pivotData[i];
        
        // Progress callback
        if (options.progressCallback && i % 100 === 0) {
          const progress = Math.floor((i / pivotData.length) * 100);
          options.progressCallback(progress, `Processing row ${i + 1}/${pivotData.length}`, result.stats);
        }

        await this.processHierarchicalRow(row, result);
        
        // Log progress every 1000 rows
        if (i % 1000 === 0 && i > 0) {
          console.log(`📈 Progress: ${i}/${pivotData.length} - ${result.stats.collegesCreated} colleges created`);
        }
      }

      result.processingTime = Date.now() - startTime;
      result.success = result.stats.errors < (pivotData.length * 0.1); // Allow 10% errors
      
      console.log(`✅ Hierarchical import completed in ${result.processingTime}ms`);
      this.logImportSummary(result);
      
      return result;
      
    } catch (error) {
      console.error('💥 Critical error during hierarchical import:', error);
      result.processingTime = Date.now() - startTime;
      result.success = false;
      return result;
    }
  }

  /**
   * Process individual hierarchical row based on its level
   */
  private async processHierarchicalRow(row: PivotDataRow, result: ImportResult): Promise<void> {
    try {
      switch (row.level) {
        case 'STATE':
          await this.processStateLevel(row.value as string, result);
          break;
          
        case 'MANAGEMENT':
          await this.processManagementLevel(row.value as string, result);
          break;
          
        case 'COLLEGE':
          await this.processCollegeLevel(row.value as string, result);
          break;
          
        case 'ADDRESS':
          await this.processAddressLevel(row.value as string, result);
          break;
          
        case 'UNIVERSITY':
          await this.processUniversityLevel(row.value as string, result);
          break;
          
        case 'COURSE':
          await this.processCourseLevel(row.value as string, result);
          break;
          
        case 'SEATS':
          await this.processSeatsLevel(row.value as number, result);
          break;
          
        case 'SPECIALIZATION':
          await this.processSpecializationLevel(row.value as string, result);
          break;
          
        default:
          console.warn(`⚠️ Unknown level: ${row.level}`);
      }
      
    } catch (error) {
      result.stats.errors++;
      result.validationErrors.push({
        row_data: row,
        error: error.toString(),
        context: { ...this.currentContext }
      });
      console.error(`❌ Error processing row:`, row, error);
    }
  }

  /**
   * Level processors - each maintains and builds the hierarchical context
   */
  
  private async processStateLevel(stateName: string, result: ImportResult): Promise<void> {
    console.log(`\n🌍 Processing State: ${stateName}`);
    
    // Reset context for new state
    this.currentContext = {
      state: this.normalize(stateName)
    };
    
    // Match or create state in master data
    const stateMatch = await this.masterDataManager.matchState(this.currentContext.state);
    
    if (!stateMatch) {
      // Create new state in master data
      const newStateId = await this.masterDataManager.createMasterRecord(
        'STATE',
        { 
          name: stateName,
          code: this.extractStateCode(stateName)
        },
        'hierarchical_import'
      );
      
      this.currentContext.masterStateId = newStateId;
      result.createdEntities.states.push({ name: stateName, id: newStateId });
      console.log(`  ➕ Created new state: ${stateName} [ID: ${newStateId}]`);
    } else {
      this.currentContext.masterStateId = stateMatch.master_id;
      console.log(`  ✅ Found existing state: ${stateName} [ID: ${stateMatch.master_id}]`);
    }
    
    result.stats.statesProcessed++;
  }

  private async processManagementLevel(management: string, result: ImportResult): Promise<void> {
    this.currentContext.management = this.normalize(management);
    console.log(`  🏛️ Management: ${management}`);
  }

  private async processCollegeLevel(collegeName: string, result: ImportResult): Promise<void> {
    console.log(`    🏫 Processing College: ${collegeName}`);
    
    this.currentContext.college = this.normalize(collegeName);
    
    // Check if college already exists in this state
    const existingCollege = await this.masterDataManager.matchCollege(
      this.currentContext.college,
      this.currentContext.masterStateId!
    );
    
    if (!existingCollege) {
      // Create new college - we'll complete it when we have full context
      console.log(`      🔄 Preparing new college: ${collegeName}`);
    } else {
      this.currentContext.masterCollegeId = existingCollege.master_id;
      console.log(`      ✅ Found existing college: ${collegeName} [ID: ${existingCollege.master_id}]`);
    }
  }

  private async processAddressLevel(address: string, result: ImportResult): Promise<void> {
    this.currentContext.address = address;
    console.log(`      📍 Address: ${address}`);
  }

  private async processUniversityLevel(university: string, result: ImportResult): Promise<void> {
    this.currentContext.university = university === 'N/A' ? '' : university;
    console.log(`      🎓 University: ${university}`);
  }

  private async processCourseLevel(courseName: string, result: ImportResult): Promise<void> {
    console.log(`        📚 Processing Course: ${courseName}`);
    
    this.currentContext.course = this.normalize(courseName);
    
    // Match or create course in master data
    const courseMatch = await this.masterDataManager.matchCourse(this.currentContext.course);
    
    if (!courseMatch) {
      // Determine course type and domain
      const courseInfo = this.analyzeCourse(courseName);
      
      const newCourseId = await this.masterDataManager.createMasterRecord(
        'COURSE',
        {
          name: courseName,
          code: courseInfo.code,
          domain: courseInfo.domain,
          level: courseInfo.level,
          duration_years: courseInfo.duration
        },
        'hierarchical_import'
      );
      
      this.currentContext.masterCourseId = newCourseId;
      result.createdEntities.courses.push({ 
        name: courseName, 
        id: newCourseId,
        type: courseInfo.level
      });
      console.log(`          ➕ Created new course: ${courseName} [ID: ${newCourseId}]`);
    } else {
      this.currentContext.masterCourseId = courseMatch.master_id;
      console.log(`          ✅ Found existing course: ${courseName} [ID: ${courseMatch.master_id}]`);
    }
  }

  private async processSeatsLevel(seats: number, result: ImportResult): Promise<void> {
    console.log(`          💺 Seats: ${seats}`);
    this.currentContext.seats = seats;
    
    // Now we have complete context - create/update the college if needed
    if (!this.currentContext.masterCollegeId) {
      await this.createCompleteCollege(result);
    }
    
    // Link college and course with seat information
    await this.linkCollegeCourse(result);
  }

  private async processSpecializationLevel(specialization: string, result: ImportResult): Promise<void> {
    // For PG specializations - treat as separate courses linked to the college
    if (this.currentContext.course && (
      this.currentContext.course.includes('BDS') || 
      this.currentContext.course.includes('MBBS')
    )) {
      console.log(`            🎯 Specialization: ${specialization}`);
      
      // Create specialization as a PG course
      const specializationInfo = this.analyzeCourse(specialization);
      const specMatch = await this.masterDataManager.matchCourse(this.normalize(specialization));
      
      if (!specMatch) {
        const newSpecId = await this.masterDataManager.createMasterRecord(
          'COURSE',
          {
            name: specialization,
            code: specializationInfo.code,
            domain: specializationInfo.domain,
            level: 'PG',
            duration_years: specializationInfo.duration,
            parent_course_id: this.currentContext.masterCourseId // Link to UG course
          },
          'hierarchical_import'
        );
        
        result.createdEntities.courses.push({ 
          name: specialization, 
          id: newSpecId,
          type: 'PG'
        });
      }
      
      result.stats.specializationsAdded++;
    }
  }

  /**
   * Create complete college record with full context
   */
  private async createCompleteCollege(result: ImportResult): Promise<void> {
    if (!this.currentContext.college || !this.currentContext.masterStateId) {
      throw new Error('Insufficient context to create college');
    }

    const collegeData = {
      name: this.currentContext.college,
      state_id: this.currentContext.masterStateId,
      management: this.currentContext.management || '',
      location: this.extractLocation(this.currentContext.address || ''),
      address: this.currentContext.address || '',
      university_affiliation: this.currentContext.university || ''
    };

    const newCollegeId = await this.masterDataManager.createMasterRecord(
      'COLLEGE',
      collegeData,
      'hierarchical_import'
    );

    this.currentContext.masterCollegeId = newCollegeId;
    result.createdEntities.colleges.push({
      name: this.currentContext.college,
      id: newCollegeId,
      state: this.currentContext.state || ''
    });
    
    result.stats.collegesCreated++;
    console.log(`      ➕ Created complete college: ${this.currentContext.college} [ID: ${newCollegeId}]`);
  }

  /**
   * Link college and course with seat information
   */
  private async linkCollegeCourse(result: ImportResult): Promise<void> {
    if (!this.currentContext.masterCollegeId || !this.currentContext.masterCourseId) {
      return;
    }

    // Create college-course link with seat information
    // In real implementation, this would create a record in college_courses junction table
    const linkData = {
      college_id: this.currentContext.masterCollegeId,
      course_id: this.currentContext.masterCourseId,
      seats: this.currentContext.seats || 0,
      management: this.currentContext.management || '',
      created_by: 'hierarchical_import'
    };

    // Simulate creating the link
    console.log(`            🔗 Linked college-course: ${linkData.seats} seats`);
    result.stats.coursesLinked++;
  }

  /**
   * Analyze course to determine type, domain, and other attributes
   */
  private analyzeCourse(courseName: string): {
    code: string;
    domain: 'MEDICAL' | 'DENTAL' | 'DNB';
    level: 'UG' | 'PG';
    duration: number;
  } {
    const normalized = this.normalize(courseName);
    
    // Medical courses
    if (normalized.includes('MBBS') || normalized.includes('BACHELOR OF MEDICINE')) {
      return { code: 'MBBS', domain: 'MEDICAL', level: 'UG', duration: 5.5 };
    }
    
    // Dental courses
    if (normalized.includes('BDS') || normalized.includes('BACHELOR OF DENTAL')) {
      return { code: 'BDS', domain: 'DENTAL', level: 'UG', duration: 5 };
    }
    
    // PG Medical specializations
    if (normalized.includes('MEDICINE') || 
        normalized.includes('SURGERY') ||
        normalized.includes('RADIOLOGY') ||
        normalized.includes('PATHOLOGY') ||
        normalized.includes('ANESTHESIA') ||
        normalized.includes('PEDIATRIC') ||
        normalized.includes('ORTHOPEDIC') ||
        normalized.includes('CARDIOLOGY')) {
      return { 
        code: this.generateCourseCode(courseName),
        domain: 'MEDICAL', 
        level: 'PG', 
        duration: 3 
      };
    }
    
    // PG Dental specializations
    if (normalized.includes('DENTISTRY') ||
        normalized.includes('ORTHODONTICS') ||
        normalized.includes('PROSTHODONTICS') ||
        normalized.includes('ENDODONTICS') ||
        normalized.includes('PERIODONTOLOGY') ||
        normalized.includes('ORAL') ||
        normalized.includes('MAXILLOFACIAL')) {
      return { 
        code: this.generateCourseCode(courseName),
        domain: 'DENTAL', 
        level: 'PG', 
        duration: 3 
      };
    }
    
    // Default
    return { 
      code: this.generateCourseCode(courseName),
      domain: 'MEDICAL', 
      level: 'PG', 
      duration: 3 
    };
  }

  /**
   * Utility methods
   */
  
  private normalize(text: string): string {
    return text.toUpperCase().trim().replace(/\s+/g, ' ');
  }

  private extractStateCode(stateName: string): string {
    const codes: { [key: string]: string } = {
      'ANDHRA PRADESH': 'AP',
      'KARNATAKA': 'KA', 
      'TAMIL NADU': 'TN',
      'MAHARASHTRA': 'MH',
      'DELHI': 'DL',
      'UTTAR PRADESH': 'UP',
      'MADHYA PRADESH': 'MP'
    };
    return codes[this.normalize(stateName)] || stateName.substring(0, 2);
  }

  private extractLocation(address: string): string {
    if (!address || address === 'N/A') return '';
    
    // Extract city/district from address
    const parts = address.split(',').map(p => p.trim());
    return parts.length > 0 ? this.normalize(parts[0]) : '';
  }

  private generateCourseCode(courseName: string): string {
    // Generate abbreviated code from course name
    const words = this.normalize(courseName).split(' ');
    if (words.length === 1) {
      return words[0].substring(0, 6);
    }
    
    return words.map(w => w.charAt(0)).join('').substring(0, 6);
  }

  private generateBatchId(): string {
    return `hierarchical_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logImportSummary(result: ImportResult): void {
    console.log(`\n📋 HIERARCHICAL IMPORT SUMMARY [${result.batchId}]`);
    console.log(`⏱️  Processing time: ${result.processingTime}ms`);
    console.log(`✅ Success: ${result.success ? 'YES' : 'NO'}`);
    console.log(`\n📊 STATISTICS:`);
    console.log(`   Total rows processed: ${result.stats.totalRows}`);
    console.log(`   States processed: ${result.stats.statesProcessed}`);
    console.log(`   Colleges created: ${result.stats.collegesCreated}`);
    console.log(`   Courses linked: ${result.stats.coursesLinked}`);
    console.log(`   Specializations added: ${result.stats.specializationsAdded}`);
    console.log(`   Errors: ${result.stats.errors}`);
    
    console.log(`\n🏗️ CREATED ENTITIES:`);
    console.log(`   New states: ${result.createdEntities.states.length}`);
    console.log(`   New colleges: ${result.createdEntities.colleges.length}`);
    console.log(`   New courses: ${result.createdEntities.courses.length}`);
    
    if (result.createdEntities.colleges.length > 0) {
      console.log(`\n🏫 SAMPLE COLLEGES CREATED:`);
      result.createdEntities.colleges.slice(0, 5).forEach((college, idx) => {
        console.log(`   ${idx + 1}. ${college.name} (${college.state}) [ID: ${college.id}]`);
      });
    }
  }
}

/**
 * Convert flat pivot data to structured rows for processing
 */
export function parsePivotData(flatData: string[]): PivotDataRow[] {
  const rows: PivotDataRow[] = [];
  const currentIndent = 0;
  
  for (const line of flatData) {
    if (!line.trim()) continue;
    
    // Calculate indent level based on leading spaces
    const indent = line.length - line.trimLeft().length;
    const value = line.trim();
    
    // Determine level based on indent and content
    let level: PivotDataRow['level'];
    if (indent === 0) level = 'STATE';
    else if (indent === 4) level = 'MANAGEMENT';  
    else if (indent === 8) level = 'COLLEGE';
    else if (indent === 12) level = 'ADDRESS';
    else if (indent === 16) level = 'UNIVERSITY';
    else if (indent === 20) level = 'COURSE';
    else if (indent === 24) level = 'SEATS';
    else level = 'SPECIALIZATION';
    
    // Handle numeric values (seats)
    const numericValue = parseInt(value);
    const finalValue = !isNaN(numericValue) && level === 'SEATS' ? numericValue : value;
    
    rows.push({
      level,
      value: finalValue,
      indentLevel: indent
    });
  }
  
  return rows;
}

/**
 * Demo function to show hierarchical import in action
 */
export async function demonstrateHierarchicalPivotImport() {
  console.log('🚀 Demonstrating Hierarchical Pivot Import');
  
  const masterDataManager = new MasterDataManager();
  const importer = new HierarchicalPivotImporter(masterDataManager);
  
  // Your example data
  const samplePivotText = `ANDHRA PRADESH
    GOVERNMENT
        GOVT DENTAL COLLEGE
            RIMS, KADAPA
                N/A
                    BDS
                        100
                            CONSERVATIVE DENTISTRY & ENDODONTICS
                                3
                            ORAL & MAXILLOFACIAL PATHOLOGY AND ORAL MICROBIOLOGY
                                3
                            ORAL AND MAXILLOFACIAL SURGERY
                                3`;
  
  const pivotRows = parsePivotData(samplePivotText.split('\n'));
  
  const result = await importer.importHierarchicalData(pivotRows, {
    fileName: 'sample_hierarchy.txt',
    progressCallback: (progress, status, stats) => {
      console.log(`📈 ${progress}% - ${status} (${stats.collegesCreated} colleges)`);
    }
  });
  
  console.log(`\n🎯 Import ${result.success ? 'SUCCEEDED' : 'FAILED'}`);
  return result;
}