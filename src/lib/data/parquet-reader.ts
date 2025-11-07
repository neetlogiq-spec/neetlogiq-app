import * as parquet from 'parquetjs';
import fs from 'fs';
import path from 'path';

export interface College {
  id: number;
  name: string;
  code?: string;
  city: string;
  state: string;
  district?: string;
  address?: string;
  pincode?: string;
  college_type: string;
  management_type: string;
  establishment_year?: number;
  university?: string;
  university_affiliation?: string;
  website?: string;
  email?: string;
  phone?: string;
  accreditation?: string;
  status: string;
  college_type_category?: string;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: number;
  name: string;
  code: string;
  duration_years: number;
  program_type: string; // UG, PG, SS, DNB
  degree_type: string; // MBBS, BDS, MD, MS, DM, MCH, DNB, MDS, Diploma
  specialization: string;
  category: string; // Medical, Dental, DNB
  description?: string;
  eligibility?: string;
  total_seats: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Cutoff {
  id: number;
  college_id: number;
  program_id: number;
  year: number;
  round: string;
  authority: string;
  quota: string;
  category: string;
  opening_rank?: number;
  closing_rank?: number;
  opening_score?: number;
  closing_score?: number;
  score_type?: string;
  score_unit?: string;
  seats_available?: number;
  seats_filled?: number;
  seat_type?: string;
  source_url?: string;
  confidence_score: number;
  notes?: string;
  status: string;
  // New counselling data fields
  counselling_type?: string; // KEA, AIQ
  course_category?: string; // Medical, Dental, DNB
  state?: string; // State name
  rank_type?: string; // PER_ROUND, PER_YEAR
  total_records?: number; // Number of records used to calculate ranks
  data_source?: string; // Source file name
  created_at: string;
  updated_at: string;
}

export interface State {
  id: number;
  name: string;
  code?: string;
  status: string;
  created_at: string;
}

export class ParquetReader {
  private parquetDir: string;
  private currentFilePath: string | null = null;

  constructor() {
    this.parquetDir = path.join(process.cwd(), 'data', 'parquet');
  }

  /**
   * Load a specific Parquet file
   */
  async loadFile(filePath: string): Promise<void> {
    this.currentFilePath = filePath;
  }

  /**
   * Read all records from the loaded file
   */
  async readAllRecords(): Promise<any[]> {
    if (!this.currentFilePath) {
      throw new Error('No file loaded. Call loadFile() first.');
    }
    
    return await this.readParquetFile<any>(path.basename(this.currentFilePath));
  }

  /**
   * Read all records from a Parquet file
   */
  private async readParquetFile<T>(filename: string): Promise<T[]> {
    const filePath = path.join(this.parquetDir, filename);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Parquet file not found: ${filename}`);
      return [];
    }

    try {
      const reader = await parquet.ParquetReader.openFile(filePath);
      const cursor = reader.getCursor();
      const records: T[] = [];

      let record;
      while (record = await cursor.next()) {
        // Filter out empty placeholder records
        if (record.status !== 'empty') {
          records.push(record as T);
        }
      }

      await reader.close();
      return records;
    } catch (error) {
      console.error(`❌ Failed to read ${filename}:`, error);
      return [];
    }
  }

  /**
   * Get all colleges
   */
  async getColleges(limit?: number): Promise<College[]> {
    const colleges = await this.readParquetFile<College>('colleges.parquet');
    return limit ? colleges.slice(0, limit) : colleges;
  }

  /**
   * Get colleges by state
   */
  async getCollegesByState(state: string, limit?: number): Promise<College[]> {
    const colleges = await this.readParquetFile<College>('colleges.parquet');
    const filtered = colleges.filter(college => 
      college.state.toLowerCase().includes(state.toLowerCase())
    );
    return limit ? filtered.slice(0, limit) : filtered;
  }

  /**
   * Get colleges by type
   */
  async getCollegesByType(type: string, limit?: number): Promise<College[]> {
    const colleges = await this.readParquetFile<College>('colleges.parquet');
    const filtered = colleges.filter(college => 
      college.college_type.toLowerCase().includes(type.toLowerCase())
    );
    return limit ? filtered.slice(0, limit) : filtered;
  }

  /**
   * Get all programs
   */
  async getPrograms(limit?: number): Promise<Program[]> {
    const programs = await this.readParquetFile<Program>('programs.parquet');
    return limit ? programs.slice(0, limit) : programs;
  }

  /**
   * Get programs by college
   */
  async getProgramsByCollege(collegeId: number): Promise<Program[]> {
    // For now, return empty array since our standard programs don't have college associations
    // This will be updated when college-specific program offerings are imported
    return [];
  }

  /**
   * Get all cutoffs
   */
  async getCutoffs(limit?: number): Promise<Cutoff[]> {
    const cutoffs = await this.readParquetFile<Cutoff>('cutoffs.parquet');
    return limit ? cutoffs.slice(0, limit) : cutoffs;
  }

  /**
   * Get cutoffs by college
   */
  async getCutoffsByCollege(collegeId: number, year?: number): Promise<Cutoff[]> {
    const cutoffs = await this.readParquetFile<Cutoff>('cutoffs.parquet');
    return cutoffs.filter(cutoff => 
      cutoff.college_id === collegeId && 
      (year === undefined || cutoff.year === year)
    );
  }

  /**
   * Get cutoffs by program
   */
  async getCutoffsByProgram(programId: number, year?: number): Promise<Cutoff[]> {
    const cutoffs = await this.readParquetFile<Cutoff>('cutoffs.parquet');
    return cutoffs.filter(cutoff => 
      cutoff.program_id === programId && 
      (year === undefined || cutoff.year === year)
    );
  }

  /**
   * Get all states
   */
  async getStates(): Promise<State[]> {
    return await this.readParquetFile<State>('states.parquet');
  }

  /**
   * Search colleges by name
   */
  async searchColleges(query: string, limit?: number): Promise<College[]> {
    const colleges = await this.readParquetFile<College>('colleges.parquet');
    const filtered = colleges.filter(college => 
      college.name.toLowerCase().includes(query.toLowerCase()) ||
      college.city.toLowerCase().includes(query.toLowerCase()) ||
      college.state.toLowerCase().includes(query.toLowerCase())
    );
    return limit ? filtered.slice(0, limit) : filtered;
  }

  /**
   * Search programs by name
   */
  async searchPrograms(query: string, limit?: number): Promise<Program[]> {
    const programs = await this.readParquetFile<Program>('programs.parquet');
    const filtered = programs.filter(program => 
      program.name.toLowerCase().includes(query.toLowerCase()) ||
      program.specialization.toLowerCase().includes(query.toLowerCase()) ||
      program.degree_type.toLowerCase().includes(query.toLowerCase()) ||
      program.category.toLowerCase().includes(query.toLowerCase())
    );
    return limit ? filtered.slice(0, limit) : filtered;
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<any> {
    const colleges = await this.readParquetFile<College>('colleges.parquet');
    const programs = await this.readParquetFile<Program>('programs.parquet');
    const cutoffs = await this.readParquetFile<Cutoff>('cutoffs.parquet');
    const states = await this.readParquetFile<State>('states.parquet');

    return {
      total_colleges: colleges.length,
      total_programs: programs.length,
      total_cutoffs: cutoffs.length,
      total_states: states.length,
      states_with_colleges: new Set(colleges.map(c => c.state)).size,
      college_types: new Set(colleges.map(c => c.college_type)).size,
      program_types: new Set(programs.map(p => p.program_type)).size,
      years_available: new Set(cutoffs.map(c => c.year)).size
    };
  }

  /**
   * Get colleges with their programs (relational query)
   */
  async getCollegesWithPrograms(limit?: number): Promise<any[]> {
    const colleges = await this.getColleges();
    // For now, return colleges without programs since standard programs don't have college associations
    // This will be updated when college-specific program offerings are imported
    const result = colleges.map(college => ({
      ...college,
      programs: []
    }));

    return limit ? result.slice(0, limit) : result;
  }

  /**
   * Get cutoffs with college and program details (relational query)
   */
  async getCutoffsWithDetails(limit?: number): Promise<any[]> {
    const cutoffs = await this.getCutoffs();
    const colleges = await this.getColleges();
    const programs = await this.getPrograms();
    
    const result = cutoffs.map(cutoff => {
      const college = colleges.find(c => c.id === cutoff.college_id);
      const program = programs.find(p => p.id === cutoff.program_id);
      
      return {
        ...cutoff,
        college_name: college?.name,
        college_city: college?.city,
        college_state: college?.state,
        program_name: program?.name,
        program_level: program?.level,
        program_course_type: program?.course_type
      };
    });

    return limit ? result.slice(0, limit) : result;
  }
}

export default ParquetReader;

