import fs from 'fs';
import path from 'path';
import * as simdjson from 'simdjson';

export interface SimdJsonReaderOptions {
  chunkSize?: number;
  maxMemoryUsage?: number;
  enableStreaming?: boolean;
}

export class SimdJsonReader {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data');
  }

  /**
   * Read and parse JSON file using simdjson for maximum performance
   */
  async readJsonFile<T>(filename: string, options: SimdJsonReaderOptions = {}): Promise<T[]> {
    const filePath = path.join(this.dataDir, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    try {
      console.log(`📊 Reading ${filename} with simdjson...`);
      const startTime = Date.now();
      
      // Read file as string for simdjson
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Parse with simdjson
      const parsed = simdjson.parse(fileContent);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ Parsed ${filename} in ${duration}ms`);
      
      return parsed as T[];
      
    } catch (error: any) {
      console.error(`❌ Failed to read ${filename} with simdjson:`, error);
      throw error;
    }
  }

  /**
   * Read multiple JSON files in parallel using simdjson
   */
  async readMultipleJsonFiles<T>(filenames: string[]): Promise<{ [key: string]: T[] }> {
    console.log(`📊 Reading ${filenames.length} files with simdjson in parallel...`);
    const startTime = Date.now();

    try {
      const promises = filenames.map(async (filename) => {
        const data = await this.readJsonFile<T>(filename);
        return { filename, data };
      });

      const results = await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ Parsed ${filenames.length} files in ${duration}ms`);
      
      // Convert to object
      const result: { [key: string]: T[] } = {};
      results.forEach(({ filename, data }) => {
        result[filename] = data;
      });
      
      return result;
      
    } catch (error: any) {
      console.error('❌ Failed to read multiple files with simdjson:', error);
      throw error;
    }
  }

  /**
   * Read unified database files with simdjson
   */
  async readUnifiedDatabase(): Promise<{
    colleges: any[];
    courses: any[];
    seatData: any[];
    dnbAggregations: any[];
    metadata: any;
  }> {
    console.log('🚀 Reading unified database with simdjson...');
    const startTime = Date.now();

    try {
      const files = [
        'unified_colleges.json',
        'unified_courses.json', 
        'unified_seat_data.json',
        'dnb_aggregations.json',
        'unified_metadata.json'
      ];

      const results = await this.readMultipleJsonFiles(files);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ Unified database loaded in ${duration}ms`);
      
      return {
        colleges: results['unified_colleges.json'] || [],
        courses: results['unified_courses.json'] || [],
        seatData: results['unified_seat_data.json'] || [],
        dnbAggregations: results['dnb_aggregations.json'] || [],
        metadata: results['unified_metadata.json']?.[0] || {}
      };
      
    } catch (error: any) {
      console.error('❌ Failed to read unified database with simdjson:', error);
      throw error;
    }
  }

  /**
   * Stream large JSON files with simdjson
   */
  async streamJsonFile<T>(
    filename: string, 
    onChunk: (chunk: T[]) => void,
    chunkSize: number = 1000
  ): Promise<void> {
    const filePath = path.join(this.dataDir, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    try {
      console.log(`📊 Streaming ${filename} with simdjson...`);
      const startTime = Date.now();
      
      // Read file as string
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Parse with simdjson
      const parsed = simdjson.parse(fileContent) as T[];
      
      // Process in chunks
      for (let i = 0; i < parsed.length; i += chunkSize) {
        const chunk = parsed.slice(i, i + chunkSize);
        onChunk(chunk);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ Streamed ${filename} in ${duration}ms`);
      
    } catch (error: any) {
      console.error(`❌ Failed to stream ${filename} with simdjson:`, error);
      throw error;
    }
  }

  /**
   * Get file statistics
   */
  getFileStats(filename: string): { size: number; sizeKB: number; sizeMB: number } {
    const filePath = path.join(this.dataDir, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      sizeKB: Math.round(stats.size / 1024),
      sizeMB: Math.round(stats.size / (1024 * 1024) * 100) / 100
    };
  }
}

export default SimdJsonReader;
