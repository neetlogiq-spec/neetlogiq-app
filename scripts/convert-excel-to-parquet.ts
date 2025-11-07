import * as duckdb from 'duckdb';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

interface CounsellingRecord {
  id: string;
  allIndiaRank: number;
  quota: string;
  collegeInstitute: string;
  course: string;
  category: string;
  round: number;
  year: number;
  sourceFile: string;
  createdAt: string;
  updatedAt: string;
}

interface College {
  id: string;
  name: string;
  state: string;
  city: string;
  type: string;
  management: string;
  university_affiliation?: string;
  website?: string;
  address?: string;
  established_year?: number;
  recognition?: string;
  affiliation?: string;
  created_at: string;
  updated_at: string;
}

interface Course {
  id: string;
  name: string;
  code: string;
  stream: string;
  branch: string;
  degree_type: string;
  duration_years?: number;
  syllabus?: string;
  career_prospects?: string;
  created_at: string;
  updated_at: string;
}

class ExcelToParquetConverter {
  private db: duckdb.Database;
  private baseDir: string;

  constructor() {
    this.db = new duckdb.Database(':memory:');
    this.baseDir = process.cwd();
  }

  async convertAllData() {
    console.log('🚀 Starting Excel to Parquet conversion...\n');

    // 1. Convert static master data (colleges and courses)
    await this.convertMasterData();

    // 2. Convert counselling data by session and year
    await this.convertCounsellingData();

    console.log('✅ All conversions completed successfully!');
  }

  private async convertMasterData() {
    console.log('📊 Converting master data (colleges and courses)...');

    // Convert colleges from Foundation Excel files
    const foundationDir = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/';
    const collegeFiles = ['med.xlsx', 'dental.xlsx', 'dnb.xlsx'];
    
    let allColleges: College[] = [];
    let allCourses: Course[] = [];

    for (const file of collegeFiles) {
      const filePath = path.join(foundationDir, file);
      if (fs.existsSync(filePath)) {
        console.log(`  📁 Processing ${file}...`);
        const { colleges, courses } = await this.convertFoundationFile(filePath, file);
        allColleges = [...allColleges, ...colleges];
        allCourses = [...allCourses, ...courses];
      }
    }

    // Save colleges to parquet
    await this.saveToParquet(allColleges, 'colleges.parquet', 'colleges');
    console.log(`  ✅ Colleges: ${allColleges.length} records`);

    // Save courses to parquet
    await this.saveToParquet(allCourses, 'courses.parquet', 'courses');
    console.log(`  ✅ Courses: ${allCourses.length} records`);
  }

  private async convertFoundationFile(filePath: string, fileName: string): Promise<{ colleges: College[], courses: Course[] }> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const colleges: College[] = [];
    const courses: Course[] = [];
    const now = new Date().toISOString();

    // Extract colleges and courses from Foundation data
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any;
      
      // Create college record
      const collegeId = `college_${String(i + 1).padStart(4, '0')}`;
      const college: College = {
        id: collegeId,
        name: row['COLLEGE/INSTITUTE'] || row['College Name'] || '',
        state: row['STATE'] || row['State'] || '',
        city: row['CITY'] || row['City'] || 'Unknown',
        type: this.getTypeFromFileName(fileName),
        management: row['MANAGEMENT'] || row['Management'] || 'Unknown',
        university_affiliation: row['UNIVERSITY'] || row['University'] || '',
        website: row['WEBSITE'] || row['Website'] || '',
        address: row['ADDRESS'] || row['Address'] || '',
        established_year: this.parseInteger(row['ESTABLISHED'] || row['Established']) || null,
        recognition: row['RECOGNITION'] || row['Recognition'] || '',
        affiliation: row['AFFILIATION'] || row['Affiliation'] || '',
        created_at: now,
        updated_at: now
      };
      colleges.push(college);

      // Create course record
      const courseId = `course_${String(i + 1).padStart(4, '0')}`;
      const course: Course = {
        id: courseId,
        name: row['COURSE'] || row['Course'] || '',
        code: row['CODE'] || row['Code'] || '',
        stream: this.getStreamFromFileName(fileName),
        branch: row['BRANCH'] || row['Branch'] || 'General',
        degree_type: row['DEGREE_TYPE'] || row['Degree Type'] || '',
        duration_years: this.parseInteger(row['DURATION'] || row['Duration']) || null,
        syllabus: `Curriculum for ${row['COURSE'] || row['Course'] || ''}`,
        career_prospects: this.getCareerProspects(row['COURSE'] || row['Course'] || ''),
        created_at: now,
        updated_at: now
      };
      courses.push(course);
    }

    return { colleges, courses };
  }

  private async convertCounsellingData() {
    console.log('📈 Converting counselling data by session and year...');

    const counsellingFiles = [
      { path: '/Users/kashyapanand/Desktop/EXPORT/AIQ2023.xlsx', session: 'AIQ', year: 2023 },
      { path: '/Users/kashyapanand/Desktop/EXPORT/AIQ2024.xlsx', session: 'AIQ', year: 2024 },
      { path: '/Users/kashyapanand/Desktop/EXPORT/KEA2023.xlsx', session: 'KEA', year: 2023 },
      { path: '/Users/kashyapanand/Desktop/EXPORT/KEA2024.xlsx', session: 'KEA', year: 2024 }
    ];

    for (const file of counsellingFiles) {
      if (fs.existsSync(file.path)) {
        console.log(`  📁 Processing ${file.session} ${file.year}...`);
        await this.convertCounsellingFile(file.path, file.session, file.year);
      } else {
        console.log(`  ⚠️  File not found: ${file.path}`);
      }
    }
  }

  private async convertCounsellingFile(filePath: string, session: string, year: number) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const counsellingRecords: CounsellingRecord[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any;
      
      const record: CounsellingRecord = {
        id: `${session.toLowerCase()}_${year}_${String(i + 1).padStart(4, '0')}`,
        allIndiaRank: this.parseInteger(row['All India Rank'] || row['Rank'] || row['AIR'] || row['ALL_INDIA_RANK']) || 0,
        quota: row['Quota'] || row['Category'] || row['QUOTA'] || 'Unknown',
        collegeInstitute: row['College/Institute'] || row['College Name'] || row['Institute'] || row['COLLEGE/INSTITUTE'] || '',
        course: row['Course'] || row['Program'] || row['COURSE'] || '',
        category: row['Category'] || row['Caste'] || row['CATEGORY'] || 'OPEN',
        round: this.parseInteger(row['Round'] || row['ROUND']) || 1,
        year: year,
        sourceFile: `${session}_${year}_R${row['Round'] || row['ROUND'] || '1'}.xlsx`,
        createdAt: now,
        updatedAt: now
      };

      counsellingRecords.push(record);
    }

    // Save to year-based parquet file
    const fileName = `cutoffs_${session.toLowerCase()}_${year}.parquet`;
    const tableName = `counselling_${session.toLowerCase()}_${year}`;
    await this.saveToParquet(counsellingRecords, fileName, tableName, year);
    console.log(`    ✅ ${session} ${year}: ${counsellingRecords.length} records`);
  }

  private async saveToParquet(data: any[], fileName: string, tableName: string, year?: number) {
    const yearDir = year ? path.join(this.baseDir, 'data', 'parquet', year.toString()) : 
                           path.join(this.baseDir, 'data', 'parquet');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }

    const parquetPath = path.join(yearDir, fileName);

    return new Promise((resolve, reject) => {
      // Create table in DuckDB
      const createTableQuery = this.getCreateTableQuery(tableName);
      this.db.run(createTableQuery, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Insert data
        const insertQuery = this.getInsertQuery(tableName, data);
        this.db.run(insertQuery, (err) => {
          if (err) {
            reject(err);
            return;
          }

          // Export to parquet
          const exportQuery = `COPY ${tableName} TO '${parquetPath}' (FORMAT PARQUET, COMPRESSION SNAPPY)`;
          this.db.run(exportQuery, (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(parquetPath);
          });
        });
      });
    });
  }

  private getCreateTableQuery(tableName: string): string {
    if (tableName === 'colleges') {
      return `CREATE TABLE colleges (
        id VARCHAR,
        name VARCHAR,
        state VARCHAR,
        city VARCHAR,
        type VARCHAR,
        management VARCHAR,
        university_affiliation VARCHAR,
        website VARCHAR,
        address VARCHAR,
        established_year INTEGER,
        recognition VARCHAR,
        affiliation VARCHAR,
        created_at VARCHAR,
        updated_at VARCHAR
      )`;
    }
    
    if (tableName === 'courses') {
      return `CREATE TABLE courses (
        id VARCHAR,
        name VARCHAR,
        code VARCHAR,
        stream VARCHAR,
        branch VARCHAR,
        degree_type VARCHAR,
        duration_years INTEGER,
        syllabus VARCHAR,
        career_prospects VARCHAR,
        created_at VARCHAR,
        updated_at VARCHAR
      )`;
    }
    
    // For counselling tables (any name starting with counselling_)
    if (tableName.startsWith('counselling_')) {
      return `CREATE TABLE ${tableName} (
        id VARCHAR,
        allIndiaRank INTEGER,
        quota VARCHAR,
        collegeInstitute VARCHAR,
        course VARCHAR,
        category VARCHAR,
        round INTEGER,
        year INTEGER,
        sourceFile VARCHAR,
        createdAt VARCHAR,
        updatedAt VARCHAR
      )`;
    }
    
    throw new Error(`Unknown table name: ${tableName}`);
  }

  private getInsertQuery(tableName: string, data: any[]): string {
    const columns = Object.keys(data[0] || {});
    const values = data.map(row => 
      `(${columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined || value === '') {
          return 'NULL';
        }
        return `'${String(value).replace(/'/g, "''")}'`;
      }).join(', ')})`
    ).join(', ');
    
    return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${values}`;
  }

  private getTypeFromFileName(fileName: string): string {
    if (fileName.includes('med')) return 'Medical';
    if (fileName.includes('dental')) return 'Dental';
    if (fileName.includes('dnb')) return 'DNB';
    return 'Medical';
  }

  private getStreamFromFileName(fileName: string): string {
    if (fileName.includes('med')) return 'Medical';
    if (fileName.includes('dental')) return 'Dental';
    if (fileName.includes('dnb')) return 'DNB';
    return 'Medical';
  }

  private getCareerProspects(courseName: string): string {
    const course = courseName.toLowerCase();
    if (course.includes('mbbs')) return 'Doctor, Medical Officer, Specialist';
    if (course.includes('bds')) return 'Dentist, Oral Surgeon, Orthodontist';
    if (course.includes('md')) return 'Medical Specialist, Consultant, Medical Officer';
    if (course.includes('ms')) return 'Surgeon, Medical Specialist, Consultant';
    if (course.includes('dnb')) return 'Medical Specialist, Consultant, Medical Officer';
    return 'Medical Professional, Healthcare Worker';
  }

  private parseInteger(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseInt(String(value));
    return isNaN(parsed) ? null : parsed;
  }

  close() {
    this.db.close();
  }
}

// Run the conversion
async function main() {
  const converter = new ExcelToParquetConverter();
  
  try {
    await converter.convertAllData();
  } catch (error) {
    console.error('❌ Conversion failed:', error);
    process.exit(1);
  } finally {
    converter.close();
  }
}

if (require.main === module) {
  main();
}

export { ExcelToParquetConverter };
