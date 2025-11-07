import { Database } from 'duckdb';
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
  college_type: string; // MEDICAL, DENTAL, DNB, MULTI
  management_type: string; // GOVERNMENT, PRIVATE, TRUST, DEEMED
  establishment_year?: number;
  university?: string;
  website?: string;
  email?: string;
  phone?: string;
  accreditation?: string;
  status: string; // active, inactive, suspended
  college_type_category?: string;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: number;
  college_id: number;
  name: string; // MBBS, BDS, MD, MS, DNB, etc.
  level: string; // UG, PG, DIPLOMA, FELLOWSHIP
  course_type: string; // MEDICAL, DENTAL, DNB, PARAMEDICAL
  specialization?: string; // General Medicine, Surgery, etc.
  duration?: number; // Duration in months
  entrance_exam?: string; // NEET, NEET-PG, AIIMS, JIPMER, etc.
  total_seats: number; // Total capacity
  fee_structure?: string;
  status: string; // active, inactive, discontinued
  created_at: string;
  updated_at: string;
}

export interface Cutoff {
  id: number;
  college_id: number;
  program_id: number;
  year: number; // 2024, 2023, etc.
  round: string; // r1, r2, r3, etc.
  authority: string; // NEET, NEET-PG, AIIMS, etc.
  quota: string; // GENERAL, OBC, SC, ST, EWS, PWD
  category: string; // GENERAL, OBC, SC, ST, EWS, PWD
  opening_rank?: number;
  closing_rank?: number;
  opening_score?: number;
  closing_score?: number;
  score_type?: string; // PERCENTILE, RAW_SCORE, etc.
  score_unit?: string; // PERCENTAGE, MARKS, etc.
  seats_available?: number;
  seats_filled?: number;
  seat_type?: string; // OPEN, RESERVED, etc.
  source_url?: string;
  confidence_score: number; // 1-5
  notes?: string;
  status: string; // active, inactive, provisional
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

export interface City {
  id: number;
  name: string;
  state_id: number;
  status: string;
  created_at: string;
}

export class DuckDBParquetManager {
  private db: Database;
  private dataDir: string;
  private parquetDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.parquetDir = path.join(this.dataDir, 'parquet');
    
    // Ensure parquet directory exists
    if (!fs.existsSync(this.parquetDir)) {
      fs.mkdirSync(this.parquetDir, { recursive: true });
    }

    // Initialize DuckDB
    this.db = new Database(':memory:');
  }

  /**
   * Initialize the Parquet schema and create empty files
   */
  async initializeSchema(): Promise<void> {
    console.log('🏗️ Initializing DuckDB Parquet schema...');

    try {
      // Create states table and Parquet file
      await this.createStatesTable();
      
      // Create cities table and Parquet file
      await this.createCitiesTable();
      
      // Create colleges table and Parquet file
      await this.createCollegesTable();
      
      // Create programs table and Parquet file
      await this.createProgramsTable();
      
      // Create cutoffs table and Parquet file
      await this.createCutoffsTable();

      console.log('✅ DuckDB Parquet schema initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize schema:', error);
      throw error;
    }
  }

  private async createStatesTable(): Promise<void> {
    const statesPath = path.join(this.parquetDir, 'states.parquet');
    
    // Create empty states table
    const emptyStates: State[] = [];
    
    // Create Parquet file
    this.db.exec(`
      CREATE TABLE states AS SELECT * FROM read_json_auto('${JSON.stringify(emptyStates)}')
    `);
    
    this.db.exec(`
      COPY states TO '${statesPath}' (FORMAT PARQUET)
    `);
    
    console.log('✅ Created states.parquet');
  }

  private async createCitiesTable(): Promise<void> {
    const citiesPath = path.join(this.parquetDir, 'cities.parquet');
    
    // Create empty cities table
    const emptyCities: City[] = [];
    
    this.db.exec(`
      CREATE TABLE cities AS SELECT * FROM read_json_auto('${JSON.stringify(emptyCities)}')
    `);
    
    this.db.exec(`
      COPY cities TO '${citiesPath}' (FORMAT PARQUET)
    `);
    
    console.log('✅ Created cities.parquet');
  }

  private async createCollegesTable(): Promise<void> {
    const collegesPath = path.join(this.parquetDir, 'colleges.parquet');
    
    // Create empty colleges table
    const emptyColleges: College[] = [];
    
    this.db.exec(`
      CREATE TABLE colleges AS SELECT * FROM read_json_auto('${JSON.stringify(emptyColleges)}')
    `);
    
    this.db.exec(`
      COPY colleges TO '${collegesPath}' (FORMAT PARQUET)
    `);
    
    console.log('✅ Created colleges.parquet');
  }

  private async createProgramsTable(): Promise<void> {
    const programsPath = path.join(this.parquetDir, 'programs.parquet');
    
    // Create empty programs table
    const emptyPrograms: Program[] = [];
    
    this.db.exec(`
      CREATE TABLE programs AS SELECT * FROM read_json_auto('${JSON.stringify(emptyPrograms)}')
    `);
    
    this.db.exec(`
      COPY programs TO '${programsPath}' (FORMAT PARQUET)
    `);
    
    console.log('✅ Created programs.parquet');
  }

  private async createCutoffsTable(): Promise<void> {
    const cutoffsPath = path.join(this.parquetDir, 'cutoffs.parquet');
    
    // Create empty cutoffs table
    const emptyCutoffs: Cutoff[] = [];
    
    this.db.exec(`
      CREATE TABLE cutoffs AS SELECT * FROM read_json_auto('${JSON.stringify(emptyCutoffs)}')
    `);
    
    this.db.exec(`
      COPY cutoffs TO '${cutoffsPath}' (FORMAT PARQUET)
    `);
    
    console.log('✅ Created cutoffs.parquet');
  }

  /**
   * Load data from Foundation files and populate Parquet files
   */
  async loadFoundationData(): Promise<void> {
    console.log('📊 Loading Foundation data into Parquet files...');

    try {
      // Load states
      await this.loadStates();
      
      // Load cities
      await this.loadCities();
      
      // Load colleges
      await this.loadColleges();
      
      // Load programs
      await this.loadPrograms();

      console.log('✅ Foundation data loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load Foundation data:', error);
      throw error;
    }
  }

  private async loadStates(): Promise<void> {
    const statesPath = path.join(this.dataDir, 'Foundation', 'STATES OF INDIA.xlsx');
    if (!fs.existsSync(statesPath)) {
      console.log('⚠️ States file not found, skipping...');
      return;
    }

    // For now, create a basic states list
    const states: State[] = [
      { id: 1, name: 'Andhra Pradesh', code: 'AP', status: 'active', created_at: new Date().toISOString() },
      { id: 2, name: 'Arunachal Pradesh', code: 'AR', status: 'active', created_at: new Date().toISOString() },
      { id: 3, name: 'Assam', code: 'AS', status: 'active', created_at: new Date().toISOString() },
      { id: 4, name: 'Bihar', code: 'BR', status: 'active', created_at: new Date().toISOString() },
      { id: 5, name: 'Chhattisgarh', code: 'CG', status: 'active', created_at: new Date().toISOString() },
      { id: 6, name: 'Delhi', code: 'DL', status: 'active', created_at: new Date().toISOString() },
      { id: 7, name: 'Goa', code: 'GA', status: 'active', created_at: new Date().toISOString() },
      { id: 8, name: 'Gujarat', code: 'GJ', status: 'active', created_at: new Date().toISOString() },
      { id: 9, name: 'Haryana', code: 'HR', status: 'active', created_at: new Date().toISOString() },
      { id: 10, name: 'Himachal Pradesh', code: 'HP', status: 'active', created_at: new Date().toISOString() },
      { id: 11, name: 'Jharkhand', code: 'JH', status: 'active', created_at: new Date().toISOString() },
      { id: 12, name: 'Karnataka', code: 'KA', status: 'active', created_at: new Date().toISOString() },
      { id: 13, name: 'Kerala', code: 'KL', status: 'active', created_at: new Date().toISOString() },
      { id: 14, name: 'Madhya Pradesh', code: 'MP', status: 'active', created_at: new Date().toISOString() },
      { id: 15, name: 'Maharashtra', code: 'MH', status: 'active', created_at: new Date().toISOString() },
      { id: 16, name: 'Manipur', code: 'MN', status: 'active', created_at: new Date().toISOString() },
      { id: 17, name: 'Meghalaya', code: 'ML', status: 'active', created_at: new Date().toISOString() },
      { id: 18, name: 'Mizoram', code: 'MZ', status: 'active', created_at: new Date().toISOString() },
      { id: 19, name: 'Nagaland', code: 'NL', status: 'active', created_at: new Date().toISOString() },
      { id: 20, name: 'Odisha', code: 'OR', status: 'active', created_at: new Date().toISOString() },
      { id: 21, name: 'Punjab', code: 'PB', status: 'active', created_at: new Date().toISOString() },
      { id: 22, name: 'Rajasthan', code: 'RJ', status: 'active', created_at: new Date().toISOString() },
      { id: 23, name: 'Sikkim', code: 'SK', status: 'active', created_at: new Date().toISOString() },
      { id: 24, name: 'Tamil Nadu', code: 'TN', status: 'active', created_at: new Date().toISOString() },
      { id: 25, name: 'Telangana', code: 'TG', status: 'active', created_at: new Date().toISOString() },
      { id: 26, name: 'Tripura', code: 'TR', status: 'active', created_at: new Date().toISOString() },
      { id: 27, name: 'Uttar Pradesh', code: 'UP', status: 'active', created_at: new Date().toISOString() },
      { id: 28, name: 'Uttarakhand', code: 'UK', status: 'active', created_at: new Date().toISOString() },
      { id: 29, name: 'West Bengal', code: 'WB', status: 'active', created_at: new Date().toISOString() }
    ];

    const statesParquetPath = path.join(this.parquetDir, 'states.parquet');
    this.db.exec(`
      CREATE TABLE temp_states AS SELECT * FROM read_json_auto('${JSON.stringify(states)}')
    `);
    
    this.db.exec(`
      COPY temp_states TO '${statesParquetPath}' (FORMAT PARQUET)
    `);
    
    console.log(`✅ Loaded ${states.length} states`);
  }

  private async loadCities(): Promise<void> {
    // For now, create empty cities table
    // This would need to be populated from a cities data source
    const cities: City[] = [];
    const citiesParquetPath = path.join(this.parquetDir, 'cities.parquet');
    
    this.db.exec(`
      CREATE TABLE temp_cities AS SELECT * FROM read_json_auto('${JSON.stringify(cities)}')
    `);
    
    this.db.exec(`
      COPY temp_cities TO '${citiesParquetPath}' (FORMAT PARQUET)
    `);
    
    console.log('✅ Created empty cities table');
  }

  private async loadColleges(): Promise<void> {
    const collegesPath = path.join(this.dataDir, 'Foundation', 'colleges.json');
    if (!fs.existsSync(collegesPath)) {
      console.log('⚠️ Colleges file not found, skipping...');
      return;
    }

    const collegesData = JSON.parse(fs.readFileSync(collegesPath, 'utf8'));
    const colleges: College[] = collegesData.map((college: any, index: number) => ({
      id: index + 1,
      name: college.name || college.college_name || '',
      code: college.code || college.college_code,
      city: college.city || '',
      state: college.state || '',
      district: college.district,
      address: college.address,
      pincode: college.pincode,
      college_type: college.type || college.college_type || 'MEDICAL',
      management_type: college.management || college.management_type || 'PRIVATE',
      establishment_year: college.established_year || college.establishment_year,
      university: college.university,
      website: college.website,
      email: college.email,
      phone: college.phone,
      accreditation: college.accreditation,
      status: 'active',
      college_type_category: college.category,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const collegesParquetPath = path.join(this.parquetDir, 'colleges.parquet');
    this.db.exec(`
      CREATE TABLE temp_colleges AS SELECT * FROM read_json_auto('${JSON.stringify(colleges)}')
    `);
    
    this.db.exec(`
      COPY temp_colleges TO '${collegesParquetPath}' (FORMAT PARQUET)
    `);
    
    console.log(`✅ Loaded ${colleges.length} colleges`);
  }

  private async loadPrograms(): Promise<void> {
    // For now, create empty programs table
    // This would need to be populated from seat data or other sources
    const programs: Program[] = [];
    const programsParquetPath = path.join(this.parquetDir, 'programs.parquet');
    
    this.db.exec(`
      CREATE TABLE temp_programs AS SELECT * FROM read_json_auto('${JSON.stringify(programs)}')
    `);
    
    this.db.exec(`
      COPY temp_programs TO '${programsParquetPath}' (FORMAT PARQUET)
    `);
    
    console.log('✅ Created empty programs table');
  }

  /**
   * Query Parquet files using DuckDB
   */
  async query(sql: string): Promise<any[]> {
    try {
      // Register Parquet files as tables
      const collegesPath = path.join(this.parquetDir, 'colleges.parquet');
      const programsPath = path.join(this.parquetDir, 'programs.parquet');
      const cutoffsPath = path.join(this.parquetDir, 'cutoffs.parquet');
      const statesPath = path.join(this.parquetDir, 'states.parquet');
      const citiesPath = path.join(this.parquetDir, 'cities.parquet');

      this.db.exec(`
        CREATE OR REPLACE VIEW colleges AS SELECT * FROM read_parquet('${collegesPath}')
      `);
      
      this.db.exec(`
        CREATE OR REPLACE VIEW programs AS SELECT * FROM read_parquet('${programsPath}')
      `);
      
      this.db.exec(`
        CREATE OR REPLACE VIEW cutoffs AS SELECT * FROM read_parquet('${cutoffsPath}')
      `);
      
      this.db.exec(`
        CREATE OR REPLACE VIEW states AS SELECT * FROM read_parquet('${statesPath}')
      `);
      
      this.db.exec(`
        CREATE OR REPLACE VIEW cities AS SELECT * FROM read_parquet('${citiesPath}')
      `);

      // Execute query
      const result = this.db.all(sql);
      return result;
    } catch (error) {
      console.error('❌ Query failed:', error);
      throw error;
    }
  }

  /**
   * Insert data into Parquet files
   */
  async insertData(tableName: string, data: any[]): Promise<void> {
    try {
      const parquetPath = path.join(this.parquetDir, `${tableName}.parquet`);
      
      // Create temporary table with new data
      this.db.exec(`
        CREATE TABLE temp_insert AS SELECT * FROM read_json_auto('${JSON.stringify(data)}')
      `);
      
      // Append to existing Parquet file
      this.db.exec(`
        COPY temp_insert TO '${parquetPath}' (FORMAT PARQUET, APPEND)
      `);
      
      console.log(`✅ Inserted ${data.length} records into ${tableName}`);
    } catch (error) {
      console.error(`❌ Failed to insert data into ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
    }
  }
}

export default DuckDBParquetManager;
