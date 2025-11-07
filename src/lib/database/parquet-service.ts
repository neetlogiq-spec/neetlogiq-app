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
  allIndiaRank: number;
  quota: string;
  collegeInstitute: string;
  course: string;
  category: string;
  round: number;
  year: number;
  sourceFile?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class ParquetService {
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
    
    let whereConditions: string[] = [];
    let params: any[] = [];

    if (query) {
      whereConditions.push(`(LOWER(name) LIKE LOWER(?) OR LOWER(state) LIKE LOWER(?) OR LOWER(city) LIKE LOWER(?) OR LOWER(university_affiliation) LIKE LOWER(?))`);
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (state) {
      whereConditions.push('state = ?');
      params.push(state);
    }

    if (city) {
      whereConditions.push('city = ?');
      params.push(city);
    }

    if (type) {
      whereConditions.push('type = ?');
      params.push(type);
    }

    if (management) {
      whereConditions.push('management = ?');
      params.push(management);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const orderClause = `ORDER BY ${sort_by} ${sort_order.toUpperCase()}`;
    const limitClause = `LIMIT ${limit} OFFSET ${offset}`;

    const countQuery = `SELECT COUNT(*) as total FROM read_parquet('${parquetPath}') ${whereClause}`;
    const dataQuery = `SELECT * FROM read_parquet('${parquetPath}') ${whereClause} ${orderClause} ${limitClause}`;

    return new Promise((resolve, reject) => {
      this.db.all(countQuery, params, (err, countRows) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.all(dataQuery, params, (err, dataRows) => {
          if (err) {
            reject(err);
            return;
          }

          resolve({
            data: dataRows as College[],
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
        `SELECT * FROM read_parquet('${parquetPath}') WHERE id = ? OR name = ?`,
        [id, id],
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
    
    let whereConditions: string[] = [];
    let params: any[] = [];

    if (query) {
      whereConditions.push(`(LOWER(name) LIKE LOWER(?) OR LOWER(code) LIKE LOWER(?) OR LOWER(stream) LIKE LOWER(?) OR LOWER(branch) LIKE LOWER(?))`);
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (stream) {
      whereConditions.push('stream = ?');
      params.push(stream);
    }

    if (branch) {
      whereConditions.push('branch = ?');
      params.push(branch);
    }

    if (degree_type) {
      whereConditions.push('degree_type = ?');
      params.push(degree_type);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const orderClause = `ORDER BY ${sort_by} ${sort_order.toUpperCase()}`;
    const limitClause = `LIMIT ${limit} OFFSET ${offset}`;

    const countQuery = `SELECT COUNT(*) as total FROM read_parquet('${parquetPath}') ${whereClause}`;
    const dataQuery = `SELECT * FROM read_parquet('${parquetPath}') ${whereClause} ${orderClause} ${limitClause}`;

    return new Promise((resolve, reject) => {
      this.db.all(countQuery, params, (err, countRows) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.all(dataQuery, params, (err, dataRows) => {
          if (err) {
            reject(err);
            return;
          }

          resolve({
            data: dataRows as Course[],
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
        `SELECT * FROM read_parquet('${parquetPath}') WHERE id = ? OR name = ?`,
        [id, id],
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
      limit = 20,
      offset = 0,
      sort_by = 'allIndiaRank',
      sort_order = 'asc'
    } = filters;

    // Get all parquet files for counselling data
    const parquetFiles = [];
    const years = year ? [year.toString()] : ['2023', '2024'];
    
    for (const y of years) {
      const parquetPath = path.join(process.cwd(), 'data', 'parquet', y, `cutoffs_${y}.parquet`);
      if (require('fs').existsSync(parquetPath)) {
        parquetFiles.push(`read_parquet('${parquetPath}')`);
      }
    }

    if (parquetFiles.length === 0) {
      return { data: [], total: 0 };
    }

    const unionQuery = parquetFiles.join(' UNION ALL ');
    
    let whereConditions: string[] = [];
    let params: any[] = [];

    if (query) {
      whereConditions.push(`(LOWER(collegeInstitute) LIKE LOWER(?) OR LOWER(course) LIKE LOWER(?))`);
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm);
    }

    if (year) {
      whereConditions.push('year = ?');
      params.push(year);
    }

    if (category) {
      whereConditions.push('category = ?');
      params.push(category);
    }

    if (quota) {
      whereConditions.push('quota = ?');
      params.push(quota);
    }

    if (college_id) {
      whereConditions.push('LOWER(collegeInstitute) LIKE LOWER(?)');
      params.push(`%${college_id}%`);
    }

    if (course_id) {
      whereConditions.push('LOWER(course) LIKE LOWER(?)');
      params.push(`%${course_id}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const orderClause = `ORDER BY ${sort_by} ${sort_order.toUpperCase()}`;
    const limitClause = `LIMIT ${limit} OFFSET ${offset}`;

    const countQuery = `SELECT COUNT(*) as total FROM (${unionQuery}) ${whereClause}`;
    const dataQuery = `SELECT * FROM (${unionQuery}) ${whereClause} ${orderClause} ${limitClause}`;

    return new Promise((resolve, reject) => {
      this.db.all(countQuery, params, (err, countRows) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.all(dataQuery, params, (err, dataRows) => {
          if (err) {
            reject(err);
            return;
          }

          resolve({
            data: dataRows as CounsellingRecord[],
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
    
    return new Promise((resolve, reject) => {
      // Get colleges count
      this.db.all(`SELECT COUNT(*) as count FROM read_parquet('${collegesPath}')`, (err, collegeRows) => {
        if (err) {
          reject(err);
          return;
        }

        // Get courses count
        this.db.all(`SELECT COUNT(*) as count FROM read_parquet('${coursesPath}')`, (err, courseRows) => {
          if (err) {
            reject(err);
            return;
          }

          // Get cutoffs count and years
          const cutoffsPath2023 = path.join(process.cwd(), 'data', 'parquet', '2023', 'cutoffs_2023.parquet');
          const cutoffsPath2024 = path.join(process.cwd(), 'data', 'parquet', '2024', 'cutoffs_2024.parquet');
          
          let cutoffsCount = 0;
          const years: number[] = [];

          const checkYear = (yearPath: string, year: number) => {
            if (require('fs').existsSync(yearPath)) {
              this.db.all(`SELECT COUNT(*) as count FROM read_parquet('${yearPath}')`, (err, yearRows) => {
                if (!err && yearRows.length > 0) {
                  // Convert BigInt to number safely
                  const count = typeof yearRows[0].count === 'bigint' 
                    ? Number(yearRows[0].count) 
                    : yearRows[0].count;
                  cutoffsCount += count;
                  years.push(year);
                }
                
                // If this was the last year check, resolve
                if (year === 2024) {
                  resolve({
                    colleges: typeof collegeRows[0].count === 'bigint' 
                      ? Number(collegeRows[0].count) 
                      : collegeRows[0].count,
                    courses: typeof courseRows[0].count === 'bigint' 
                      ? Number(courseRows[0].count) 
                      : courseRows[0].count,
                    cutoffs: cutoffsCount,
                    years: years.sort()
                  });
                }
              });
            } else if (year === 2024) {
              resolve({
                colleges: typeof collegeRows[0].count === 'bigint' 
                  ? Number(collegeRows[0].count) 
                  : collegeRows[0].count,
                courses: typeof courseRows[0].count === 'bigint' 
                  ? Number(courseRows[0].count) 
                  : courseRows[0].count,
                cutoffs: cutoffsCount,
                years: years.sort()
              });
            }
          };

          checkYear(cutoffsPath2023, 2023);
          checkYear(cutoffsPath2024, 2024);
        });
      });
    });
  }

  close() {
    this.db.close();
  }
}

// Singleton instance
let parquetService: ParquetService | null = null;

export function getParquetService(): ParquetService {
  if (!parquetService) {
    parquetService = new ParquetService();
  }
  return parquetService;
}
