import { Database } from 'duckdb';
import path from 'path';

export class DuckDBQueryManager {
  private db: Database;
  private parquetDir: string;

  constructor() {
    this.parquetDir = path.join(process.cwd(), 'data', 'parquet');
    this.db = new Database(':memory:');
  }

  /**
   * Initialize DuckDB with Parquet file views
   */
  async initialize(): Promise<void> {
    try {
      const connection = this.db.connect();
      
      // Create views for each Parquet file
      const collegesPath = path.join(this.parquetDir, 'colleges.parquet');
      const programsPath = path.join(this.parquetDir, 'programs.parquet');
      const cutoffsPath = path.join(this.parquetDir, 'cutoffs.parquet');
      const statesPath = path.join(this.parquetDir, 'states.parquet');
      const citiesPath = path.join(this.parquetDir, 'cities.parquet');

      connection.exec(`
        CREATE OR REPLACE VIEW colleges AS 
        SELECT * FROM read_parquet('${collegesPath}')
        WHERE status != 'empty'
      `);
      
      connection.exec(`
        CREATE OR REPLACE VIEW programs AS 
        SELECT * FROM read_parquet('${programsPath}')
        WHERE status != 'empty'
      `);
      
      connection.exec(`
        CREATE OR REPLACE VIEW cutoffs AS 
        SELECT * FROM read_parquet('${cutoffsPath}')
        WHERE status != 'empty'
      `);
      
      connection.exec(`
        CREATE OR REPLACE VIEW states AS 
        SELECT * FROM read_parquet('${statesPath}')
        WHERE status != 'empty'
      `);
      
      connection.exec(`
        CREATE OR REPLACE VIEW cities AS 
        SELECT * FROM read_parquet('${citiesPath}')
        WHERE status != 'empty'
      `);

      connection.close();
      console.log('✅ DuckDB initialized with Parquet views');
    } catch (error) {
      console.error('❌ Failed to initialize DuckDB:', error);
      throw error;
    }
  }

  /**
   * Execute a SQL query and return results
   */
  async query(sql: string): Promise<any[]> {
    try {
      const connection = this.db.connect();
      const result = connection.all(sql);
      connection.close();
      
      // Convert Statement objects to arrays
      if (Array.isArray(result)) {
        return result.map(row => {
          if (typeof row === 'object' && row !== null) {
            const convertedRow: any = {};
            for (const [key, value] of Object.entries(row)) {
              convertedRow[key] = value;
            }
            return convertedRow;
          }
          return row;
        });
      }
      
      return result;
    } catch (error) {
      console.error('❌ Query failed:', error);
      throw error;
    }
  }

  /**
   * Get all colleges
   */
  async getColleges(limit?: number): Promise<any[]> {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    return await this.query(`
      SELECT 
        id,
        name,
        code,
        city,
        state,
        district,
        address,
        pincode,
        college_type,
        management_type,
        establishment_year,
        university,
        website,
        email,
        phone,
        accreditation,
        status,
        college_type_category,
        created_at,
        updated_at
      FROM colleges
      ORDER BY name
      ${limitClause}
    `);
  }

  /**
   * Get colleges by state
   */
  async getCollegesByState(state: string, limit?: number): Promise<any[]> {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    return await this.query(`
      SELECT 
        id,
        name,
        code,
        city,
        state,
        college_type,
        management_type,
        status
      FROM colleges
      WHERE state = '${state}'
      ORDER BY name
      ${limitClause}
    `);
  }

  /**
   * Get colleges by type
   */
  async getCollegesByType(type: string, limit?: number): Promise<any[]> {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    return await this.query(`
      SELECT 
        id,
        name,
        code,
        city,
        state,
        college_type,
        management_type,
        status
      FROM colleges
      WHERE college_type = '${type}'
      ORDER BY name
      ${limitClause}
    `);
  }

  /**
   * Get all programs
   */
  async getPrograms(limit?: number): Promise<any[]> {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    return await this.query(`
      SELECT 
        p.id,
        p.name,
        p.level,
        p.course_type,
        p.specialization,
        p.duration,
        p.entrance_exam,
        p.total_seats,
        p.fee_structure,
        p.status,
        c.name as college_name,
        c.city,
        c.state
      FROM programs p
      LEFT JOIN colleges c ON p.college_id = c.id
      ORDER BY p.name
      ${limitClause}
    `);
  }

  /**
   * Get programs by college
   */
  async getProgramsByCollege(collegeId: number): Promise<any[]> {
    return await this.query(`
      SELECT 
        p.id,
        p.name,
        p.level,
        p.course_type,
        p.specialization,
        p.duration,
        p.entrance_exam,
        p.total_seats,
        p.fee_structure,
        p.status
      FROM programs p
      WHERE p.college_id = ${collegeId}
      ORDER BY p.name
    `);
  }

  /**
   * Get all cutoffs
   */
  async getCutoffs(limit?: number): Promise<any[]> {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    return await this.query(`
      SELECT 
        co.id,
        co.year,
        co.round,
        co.authority,
        co.quota,
        co.category,
        co.opening_rank,
        co.closing_rank,
        co.opening_score,
        co.closing_score,
        co.seats_available,
        co.seats_filled,
        co.confidence_score,
        co.status,
        c.name as college_name,
        c.city,
        c.state,
        p.name as program_name,
        p.level,
        p.course_type
      FROM cutoffs co
      LEFT JOIN colleges c ON co.college_id = c.id
      LEFT JOIN programs p ON co.program_id = p.id
      ORDER BY co.year DESC, co.opening_rank ASC
      ${limitClause}
    `);
  }

  /**
   * Get cutoffs by college
   */
  async getCutoffsByCollege(collegeId: number, year?: number): Promise<any[]> {
    const yearClause = year ? `AND co.year = ${year}` : '';
    return await this.query(`
      SELECT 
        co.id,
        co.year,
        co.round,
        co.authority,
        co.quota,
        co.category,
        co.opening_rank,
        co.closing_rank,
        co.opening_score,
        co.closing_score,
        co.seats_available,
        co.seats_filled,
        co.confidence_score,
        co.status,
        p.name as program_name,
        p.level,
        p.course_type
      FROM cutoffs co
      LEFT JOIN programs p ON co.program_id = p.id
      WHERE co.college_id = ${collegeId}
      ${yearClause}
      ORDER BY co.year DESC, co.opening_rank ASC
    `);
  }

  /**
   * Get cutoffs by program
   */
  async getCutoffsByProgram(programId: number, year?: number): Promise<any[]> {
    const yearClause = year ? `AND co.year = ${year}` : '';
    return await this.query(`
      SELECT 
        co.id,
        co.year,
        co.round,
        co.authority,
        co.quota,
        co.category,
        co.opening_rank,
        co.closing_rank,
        co.opening_score,
        co.closing_score,
        co.seats_available,
        co.seats_filled,
        co.confidence_score,
        co.status,
        c.name as college_name,
        c.city,
        c.state
      FROM cutoffs co
      LEFT JOIN colleges c ON co.college_id = c.id
      WHERE co.program_id = ${programId}
      ${yearClause}
      ORDER BY co.year DESC, co.opening_rank ASC
    `);
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<any> {
    const stats = await this.query(`
      SELECT 
        (SELECT COUNT(*) FROM colleges) as total_colleges,
        (SELECT COUNT(*) FROM programs) as total_programs,
        (SELECT COUNT(*) FROM cutoffs) as total_cutoffs,
        (SELECT COUNT(*) FROM states) as total_states,
        (SELECT COUNT(DISTINCT state) FROM colleges) as states_with_colleges,
        (SELECT COUNT(DISTINCT college_type) FROM colleges) as college_types,
        (SELECT COUNT(DISTINCT course_type) FROM programs) as program_types,
        (SELECT COUNT(DISTINCT year) FROM cutoffs) as years_available
    `);
    
    return stats[0] || {};
  }

  /**
   * Search colleges by name
   */
  async searchColleges(query: string, limit?: number): Promise<any[]> {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    return await this.query(`
      SELECT 
        id,
        name,
        code,
        city,
        state,
        college_type,
        management_type,
        status
      FROM colleges
      WHERE name ILIKE '%${query}%'
         OR city ILIKE '%${query}%'
         OR state ILIKE '%${query}%'
      ORDER BY name
      ${limitClause}
    `);
  }

  /**
   * Search programs by name
   */
  async searchPrograms(query: string, limit?: number): Promise<any[]> {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    return await this.query(`
      SELECT 
        p.id,
        p.name,
        p.level,
        p.course_type,
        p.specialization,
        p.total_seats,
        p.status,
        c.name as college_name,
        c.city,
        c.state
      FROM programs p
      LEFT JOIN colleges c ON p.college_id = c.id
      WHERE p.name ILIKE '%${query}%'
         OR p.specialization ILIKE '%${query}%'
         OR p.course_type ILIKE '%${query}%'
      ORDER BY p.name
      ${limitClause}
    `);
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

export default DuckDBQueryManager;
