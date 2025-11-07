import * as duckdb from 'duckdb';
import path from 'path';

export interface College {
  id: string;
  name: string;
  state: string;
  city: string;
  type: string;
  management: string;
  university_affiliation?: string;
  website?: string;
  address?: string;
  established_year?: any;
  recognition?: string;
  affiliation?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  stream: string;
  branch: string;
  degree_type: string;
  duration_years?: number;
  syllabus?: string;
  career_prospects?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CounsellingRecord {
  id: string;
  allIndiaRank: string | number; // Can be string from BigInt conversion
  quota: string;
  collegeInstitute: string;
  course: string;
  category: string;
  round: string | number; // Can be string from BigInt conversion
  year: string | number; // Can be string from BigInt conversion
  sourceFile?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class SimpleParquetService {
  private db: duckdb.Database;

  constructor() {
    this.db = new duckdb.Database(':memory:');
  }

  async getColleges(filters: {
    query?: string;
    state?: string;
    city?: string;
    type?: string;
    management?: string;
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}): Promise<{ data: College[]; total: number }> {
    const {
      query,
      state,
      city,
      type,
      management,
      limit = 20,
      offset = 0,
      sort_by = 'name',
      sort_order = 'asc'
    } = filters;

    const parquetPath = path.join(process.cwd(), 'data', 'parquet', '2024', 'colleges_2024.parquet');
    
    return new Promise((resolve, reject) => {
      // First get total count
      this.db.all(`SELECT COUNT(*) as total FROM read_parquet('${parquetPath}')`, (err, countRows) => {
        if (err) {
          reject(err);
          return;
        }

        // Then get data with simple query
        const dataQuery = `SELECT * FROM read_parquet('${parquetPath}') ORDER BY ${sort_by} ${sort_order.toUpperCase()} LIMIT ${limit} OFFSET ${offset}`;
        
        this.db.all(dataQuery, (err, dataRows) => {
          if (err) {
            reject(err);
            return;
          }

          // Apply filters in JavaScript (simpler approach)
          let filteredData = dataRows as College[];
          
          if (query) {
            const searchTerm = query.toLowerCase();
            filteredData = filteredData.filter(college => 
              college.name.toLowerCase().includes(searchTerm) ||
              college.state.toLowerCase().includes(searchTerm) ||
              college.city.toLowerCase().includes(searchTerm) ||
              (college.university_affiliation && college.university_affiliation.toLowerCase().includes(searchTerm))
            );
          }

          if (state) {
            filteredData = filteredData.filter(college => college.state === state);
          }

          if (city) {
            filteredData = filteredData.filter(college => college.city === city);
          }

          if (type) {
            filteredData = filteredData.filter(college => college.type === type);
          }

          if (management) {
            filteredData = filteredData.filter(college => college.management === management);
          }

          resolve({
            data: filteredData,
            total: typeof countRows[0].total === 'bigint' 
              ? Number(countRows[0].total) 
              : countRows[0].total
          });
        });
      });
    });
  }

  async getCollegeById(id: string): Promise<College | null> {
    const parquetPath = path.join(process.cwd(), 'data', 'parquet', '2024', 'colleges_2024.parquet');
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM read_parquet('${parquetPath}') WHERE id = '${id}' OR name = '${id}'`,
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(rows.length > 0 ? rows[0] as College : null);
        }
      );
    });
  }

  async getCourses(filters: {
    query?: string;
    stream?: string;
    branch?: string;
    degree_type?: string;
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}): Promise<{ data: Course[]; total: number }> {
    const {
      query,
      stream,
      branch,
      degree_type,
      limit = 20,
      offset = 0,
      sort_by = 'name',
      sort_order = 'asc'
    } = filters;

    const parquetPath = path.join(process.cwd(), 'data', 'parquet', '2024', 'courses_2024.parquet');
    
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT COUNT(*) as total FROM read_parquet('${parquetPath}')`, (err, countRows) => {
        if (err) {
          reject(err);
          return;
        }

        const dataQuery = `SELECT * FROM read_parquet('${parquetPath}') ORDER BY ${sort_by} ${sort_order.toUpperCase()} LIMIT ${limit} OFFSET ${offset}`;
        
        this.db.all(dataQuery, (err, dataRows) => {
          if (err) {
            reject(err);
            return;
          }

          // Apply filters in JavaScript
          let filteredData = dataRows as Course[];
          
          if (query) {
            const searchTerm = query.toLowerCase();
            filteredData = filteredData.filter(course => 
              course.name.toLowerCase().includes(searchTerm) ||
              course.code.toLowerCase().includes(searchTerm) ||
              course.stream.toLowerCase().includes(searchTerm) ||
              course.branch.toLowerCase().includes(searchTerm)
            );
          }

          if (stream) {
            filteredData = filteredData.filter(course => course.stream === stream);
          }

          if (branch) {
            filteredData = filteredData.filter(course => course.branch === branch);
          }

          if (degree_type) {
            filteredData = filteredData.filter(course => course.degree_type === degree_type);
          }

          resolve({
            data: filteredData,
            total: typeof countRows[0].total === 'bigint' 
              ? Number(countRows[0].total) 
              : countRows[0].total
          });
        });
      });
    });
  }

  async getCourseById(id: string): Promise<Course | null> {
    const parquetPath = path.join(process.cwd(), 'data', 'parquet', '2024', 'courses_2024.parquet');
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM read_parquet('${parquetPath}') WHERE id = '${id}' OR name = '${id}'`,
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(rows.length > 0 ? rows[0] as Course : null);
        }
      );
    });
  }

  async getCounsellingData(filters: {
    query?: string;
    year?: number;
    category?: string;
    quota?: string;
    college_id?: string;
    course_id?: string;
    session?: string; // AIQ, KEA, etc.
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}): Promise<{ data: CounsellingRecord[]; total: number }> {
    const {
      query,
      year,
      category,
      quota,
      college_id,
      course_id,
      session,
      limit = 20,
      offset = 0,
      sort_by = 'allIndiaRank',
      sort_order = 'asc'
    } = filters;

    // Get parquet files for counselling data based on year and session
    const parquetFiles = [];
    const years = year ? [year.toString()] : ['2023', '2024'];
    const sessions = session ? [session.toUpperCase()] : ['AIQ', 'KEA'];
    
    for (const y of years) {
      for (const s of sessions) {
        const parquetPath = path.join(process.cwd(), 'data', 'parquet', y, `cutoffs_${s.toLowerCase()}_${y}.parquet`);
        if (require('fs').existsSync(parquetPath)) {
          parquetFiles.push(`read_parquet('${parquetPath}')`);
        }
      }
    }

    if (parquetFiles.length === 0) {
      return { data: [], total: 0 };
    }

    const unionQuery = parquetFiles.join(' UNION ALL ');
    
    return new Promise((resolve, reject) => {
      const countQuery = `SELECT COUNT(*) as total FROM (${unionQuery})`;
      
      this.db.all(countQuery, (err, countRows) => {
        if (err) {
          reject(err);
          return;
        }

        const dataQuery = `SELECT * FROM (${unionQuery}) ORDER BY ${sort_by} ${sort_order.toUpperCase()} LIMIT ${limit} OFFSET ${offset}`;
        
        this.db.all(dataQuery, (err, dataRows) => {
          if (err) {
            reject(err);
            return;
          }

          // Convert BigInt to string and apply filters in JavaScript
          let filteredData = dataRows.map(row => {
            const converted: any = {};
            for (const [key, value] of Object.entries(row)) {
              converted[key] = typeof value === 'bigint' ? value.toString() : value;
            }
            return converted;
          }) as CounsellingRecord[];
          
          if (query) {
            const searchTerm = query.toLowerCase();
            filteredData = filteredData.filter(record => 
              record.collegeInstitute.toLowerCase().includes(searchTerm) ||
              record.course.toLowerCase().includes(searchTerm)
            );
          }

          if (year) {
            filteredData = filteredData.filter(record => record.year === year);
          }

          if (category) {
            filteredData = filteredData.filter(record => record.category === category);
          }

          if (quota) {
            filteredData = filteredData.filter(record => record.quota === quota);
          }

          if (college_id) {
            const searchTerm = college_id.toLowerCase();
            filteredData = filteredData.filter(record => 
              record.collegeInstitute.toLowerCase().includes(searchTerm)
            );
          }

          if (course_id) {
            const searchTerm = course_id.toLowerCase();
            filteredData = filteredData.filter(record => 
              record.course.toLowerCase().includes(searchTerm)
            );
          }

          resolve({
            data: filteredData,
            total: typeof countRows[0].total === 'bigint' 
              ? Number(countRows[0].total) 
              : countRows[0].total
          });
        });
      });
    });
  }

  async getStats(): Promise<{
    colleges: number;
    courses: number;
    cutoffs: number;
    years: number[];
  }> {
    const collegesPath = path.join(process.cwd(), 'data', 'parquet', '2024', 'colleges_2024.parquet');
    const coursesPath = path.join(process.cwd(), 'data', 'parquet', '2024', 'courses_2024.parquet');
    const cutoffsPath = path.join(process.cwd(), 'data', 'parquet', '2024', 'cutoffs_2024.parquet');
    
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT COUNT(*) as count FROM read_parquet('${collegesPath}')`, (err, collegeRows) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.all(`SELECT COUNT(*) as count FROM read_parquet('${coursesPath}')`, (err, courseRows) => {
          if (err) {
            reject(err);
            return;
          }

          this.db.all(`SELECT COUNT(*) as count FROM read_parquet('${cutoffsPath}')`, (err, cutoffRows) => {
            if (err) {
              reject(err);
              return;
            }

            resolve({
              colleges: typeof collegeRows[0].count === 'bigint' 
                ? Number(collegeRows[0].count) 
                : collegeRows[0].count,
              courses: typeof courseRows[0].count === 'bigint' 
                ? Number(courseRows[0].count) 
                : courseRows[0].count,
              cutoffs: typeof cutoffRows[0].count === 'bigint' 
                ? Number(cutoffRows[0].count) 
                : cutoffRows[0].count,
              years: [2024]
            });
          });
        });
      });
    });
  }

  close() {
    this.db.close();
  }
}

// Singleton instance
let simpleParquetService: SimpleParquetService | null = null;

export function getSimpleParquetService(): SimpleParquetService {
  if (!simpleParquetService) {
    simpleParquetService = new SimpleParquetService();
  }
  return simpleParquetService;
}
