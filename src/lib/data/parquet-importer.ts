import fs from 'fs';
import path from 'path';
import { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import { UnifiedCollege, UnifiedCourse, UnifiedSeatData, UnifiedMetadata } from './unified-database';
import { DnbCategoryAggregation } from './seat-data-importer';

export interface ParquetDatabase {
  colleges: UnifiedCollege[];
  courses: UnifiedCourse[];
  seatData: UnifiedSeatData[];
  dnbAggregations: DnbCategoryAggregation[];
  metadata: UnifiedMetadata;
}

export class ParquetImporter {
  private dataDir: string;
  private parquetDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.parquetDir = path.join(this.dataDir, 'parquet');
  }

  /**
   * Convert unified JSON data to Parquet format using DuckDB
   */
  async convertToParquet(): Promise<void> {
    console.log('🚀 Converting unified database to Parquet format...');
    
    try {
      // Ensure parquet directory exists
      if (!fs.existsSync(this.parquetDir)) {
        fs.mkdirSync(this.parquetDir, { recursive: true });
      }

      // Initialize DuckDB
      const db = new AsyncDuckDB();
      await db.instantiate();
      const conn = await db.connect();

      // Read JSON data
      const colleges = JSON.parse(fs.readFileSync(path.join(this.dataDir, 'unified_colleges.json'), 'utf8'));
      const courses = JSON.parse(fs.readFileSync(path.join(this.dataDir, 'unified_courses.json'), 'utf8'));
      const seatData = JSON.parse(fs.readFileSync(path.join(this.dataDir, 'unified_seat_data.json'), 'utf8'));
      const dnbAggregations = JSON.parse(fs.readFileSync(path.join(this.dataDir, 'dnb_aggregations.json'), 'utf8'));
      const metadata = JSON.parse(fs.readFileSync(path.join(this.dataDir, 'unified_metadata.json'), 'utf8'));

      console.log(`📊 Converting ${colleges.length} colleges to Parquet...`);
      await this.convertTableToParquet(db, 'colleges', colleges, 'colleges.parquet');

      console.log(`📊 Converting ${courses.length} courses to Parquet...`);
      await this.convertTableToParquet(db, 'courses', courses, 'courses.parquet');

      console.log(`📊 Converting ${seatData.length} seat records to Parquet...`);
      await this.convertTableToParquet(db, 'seat_data', seatData, 'seat_data.parquet');

      console.log(`📊 Converting ${dnbAggregations.length} DNB aggregations to Parquet...`);
      await this.convertTableToParquet(db, 'dnb_aggregations', dnbAggregations, 'dnb_aggregations.parquet');

      console.log(`📊 Converting metadata to Parquet...`);
      await this.convertTableToParquet(db, 'metadata', [metadata], 'metadata.parquet');

      // Create summary statistics
      await this.createSummaryStats(db);

      await db.terminate();

      console.log('✅ Successfully converted unified database to Parquet format!');
      console.log(`📁 Parquet files created in: ${this.parquetDir}`);

    } catch (error: any) {
      console.error('❌ Parquet conversion failed:', error);
      throw error;
    }
  }

  /**
   * Convert a table to Parquet format
   */
  private async convertTableToParquet(
    db: any, 
    tableName: string, 
    data: any[], 
    fileName: string
  ): Promise<void> {
    try {
      // Create table from JSON data
      await db.runQuery(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_json_auto('${JSON.stringify(data)}')`);
      
      // Export to Parquet
      const parquetPath = path.join(this.parquetDir, fileName);
      await db.runQuery(`COPY ${tableName} TO '${parquetPath}' (FORMAT PARQUET, COMPRESSION SNAPPY)`);
      
      console.log(`✅ Created ${fileName} with ${data.length} records`);
    } catch (error: any) {
      console.error(`❌ Failed to convert ${tableName} to Parquet:`, error);
      throw error;
    }
  }

  /**
   * Create summary statistics and analytics
   */
  private async createSummaryStats(db: any): Promise<void> {
    try {
      console.log('📊 Creating summary statistics...');

      // College statistics by type
      const collegeStats = await db.runQuery(`
        SELECT 
          type,
          COUNT(*) as count,
          COUNT(DISTINCT state) as states,
          COUNT(DISTINCT management) as management_types
        FROM colleges 
        GROUP BY type
        ORDER BY count DESC
      `);

      // Course statistics by type
      const courseStats = await db.runQuery(`
        SELECT 
          type,
          COUNT(*) as count
        FROM courses 
        GROUP BY type
        ORDER BY count DESC
      `);

      // Seat data statistics
      const seatStats = await db.runQuery(`
        SELECT 
          SUBSTR(college_id, 1, INSTR(college_id, '_') - 1) as type,
          COUNT(*) as records,
          SUM(seats) as total_seats,
          AVG(seats) as avg_seats
        FROM seat_data 
        GROUP BY SUBSTR(college_id, 1, INSTR(college_id, '_') - 1)
        ORDER BY records DESC
      `);

      // DNB aggregation statistics
      const dnbStats = await db.runQuery(`
        SELECT 
          COUNT(*) as total_aggregations,
          COUNT(DISTINCT college_id) as unique_colleges,
          COUNT(DISTINCT course_id) as unique_courses,
          SUM(total_seats) as total_seats
        FROM dnb_aggregations
      `);

      const summaryStats = {
        colleges: collegeStats,
        courses: courseStats,
        seatData: seatStats,
        dnbAggregations: dnbStats && dnbStats.length > 0 ? dnbStats[0] : null
      };

      // Save summary statistics
      const summaryPath = path.join(this.parquetDir, 'summary_stats.json');
      fs.writeFileSync(summaryPath, JSON.stringify(summaryStats, null, 2));

      console.log('✅ Summary statistics created');
      console.log('📊 College Statistics:');
      collegeStats.forEach((stat: any) => {
        console.log(`   ${stat.type}: ${stat.count} colleges, ${stat.states} states, ${stat.management_types} management types`);
      });

      console.log('📊 Course Statistics:');
      courseStats.forEach((stat: any) => {
        console.log(`   ${stat.type}: ${stat.count} courses`);
      });

      console.log('📊 Seat Data Statistics:');
      seatStats.forEach((stat: any) => {
        console.log(`   ${stat.type}: ${stat.records} records, ${stat.total_seats} total seats, ${stat.avg_seats.toFixed(1)} avg seats`);
      });

      console.log('📊 DNB Aggregation Statistics:');
      console.log(`   Total: ${dnbStats[0].total_aggregations} aggregations`);
      console.log(`   Unique Colleges: ${dnbStats[0].unique_colleges}`);
      console.log(`   Unique Courses: ${dnbStats[0].unique_courses}`);
      console.log(`   Total Seats: ${dnbStats[0].total_seats}`);

    } catch (error: any) {
      console.error('❌ Failed to create summary statistics:', error);
      throw error;
    }
  }

  /**
   * Test Parquet performance vs JSON
   */
  async testPerformance(): Promise<void> {
    console.log('🧪 Testing Parquet performance vs JSON...');
    
    try {
      const db = new AsyncDuckDB();
      await db.instantiate();

      // Test queries
      const queries = [
        {
          name: 'Count all colleges',
          sql: 'SELECT COUNT(*) FROM colleges'
        },
        {
          name: 'Count colleges by type',
          sql: 'SELECT type, COUNT(*) FROM colleges GROUP BY type'
        },
        {
          name: 'Count seat data by type',
          sql: 'SELECT SUBSTR(college_id, 1, INSTR(college_id, \'_\') - 1) as type, COUNT(*) FROM seat_data GROUP BY type'
        },
        {
          name: 'Top 10 colleges by seat count',
          sql: 'SELECT college_id, SUM(seats) as total_seats FROM seat_data GROUP BY college_id ORDER BY total_seats DESC LIMIT 10'
        },
        {
          name: 'Colleges in specific state',
          sql: 'SELECT name, state, management FROM colleges WHERE state = \'ANDHRA PRADESH\' LIMIT 10'
        }
      ];

      console.log('📊 Performance Test Results:');
      console.log('================================');

      for (const query of queries) {
        const startTime = Date.now();
        const result = await db.runQuery(query.sql);
        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`✅ ${query.name}: ${duration}ms (${result.length} rows)`);
      }

      await db.terminate();

      console.log('✅ Performance test completed!');

    } catch (error: any) {
      console.error('❌ Performance test failed:', error);
      throw error;
    }
  }

  /**
   * Get Parquet database summary
   */
  async getParquetSummary(): Promise<any> {
    try {
      const summaryPath = path.join(this.parquetDir, 'summary_stats.json');
      if (fs.existsSync(summaryPath)) {
        return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      }
      return null;
    } catch (error: any) {
      console.error('❌ Failed to get Parquet summary:', error);
      return null;
    }
  }
}

export default ParquetImporter;
