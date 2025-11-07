/**
 * Local Cloudflare Services Emulation
 * Provides local development environment that mimics Cloudflare R2, D1, and Vectorize
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

// Local storage paths
const LOCAL_DATA_DIR = path.join(process.cwd(), '.local-cloudflare');
const R2_DIR = path.join(LOCAL_DATA_DIR, 'r2');
const D1_DB_PATH = path.join(LOCAL_DATA_DIR, 'd1.sqlite');
const VECTORIZE_DIR = path.join(LOCAL_DATA_DIR, 'vectorize');

// Ensure directories exist
[LOCAL_DATA_DIR, R2_DIR, VECTORIZE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Local R2 Emulation
 * Mimics Cloudflare R2 object storage using local file system
 */
export class LocalR2 {
  private bucketPath: string;

  constructor(bucketName: string = 'neetlogiq-data') {
    this.bucketPath = path.join(R2_DIR, bucketName);
    if (!fs.existsSync(this.bucketPath)) {
      fs.mkdirSync(this.bucketPath, { recursive: true });
    }
  }

  async get(key: string): Promise<LocalR2Object | null> {
    const filePath = path.join(this.bucketPath, key);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);

    return new LocalR2Object(content, {
      key,
      size: stats.size,
      etag: createHash('md5').update(content).digest('hex'),
      uploaded: stats.mtime,
    });
  }

  async put(key: string, data: string | Buffer, options?: { expirationTtl?: number }): Promise<void> {
    const filePath = path.join(this.bucketPath, key);
    const dir = path.dirname(filePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = typeof data === 'string' ? Buffer.from(data) : data;
    fs.writeFileSync(filePath, content);

    // Store metadata
    const metadataPath = `${filePath}.metadata.json`;
    const metadata = {
      key,
      size: content.length,
      etag: createHash('md5').update(content).digest('hex'),
      uploaded: new Date().toISOString(),
      expirationTtl: options?.expirationTtl,
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`📦 LocalR2: Stored ${key} (${content.length} bytes)`);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.bucketPath, key);
    const metadataPath = `${filePath}.metadata.json`;
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }
  }

  async list(prefix?: string): Promise<string[]> {
    const getAllFiles = (dir: string, prefix: string = ''): string[] => {
      const files: string[] = [];
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        if (item.endsWith('.metadata.json')) continue;
        
        const itemPath = path.join(dir, item);
        const relativePath = path.join(prefix, item);
        
        if (fs.statSync(itemPath).isDirectory()) {
          files.push(...getAllFiles(itemPath, relativePath));
        } else {
          files.push(relativePath);
        }
      }
      return files;
    };

    const allFiles = getAllFiles(this.bucketPath);
    
    if (prefix) {
      return allFiles.filter(file => file.startsWith(prefix));
    }
    
    return allFiles;
  }
}

class LocalR2Object {
  constructor(private content: Buffer, public metadata: any) {}

  text(): Promise<string> {
    return Promise.resolve(this.content.toString('utf-8'));
  }

  json(): Promise<any> {
    return Promise.resolve(JSON.parse(this.content.toString('utf-8')));
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(this.content.buffer);
  }

  get body(): ReadableStream {
    // Simplified for local development
    return new ReadableStream({
      start(controller) {
        controller.enqueue(this.content);
        controller.close();
      }
    });
  }
}

/**
 * Local D1 Emulation
 * Mimics Cloudflare D1 database using SQLite
 */
export class LocalD1 {
  private db: any;

  constructor() {
    // We'll use better-sqlite3 for local development
    try {
      const Database = eval('require')('better-sqlite3');
      this.db = new Database(D1_DB_PATH);
      this.initializeSchema();
      console.log('📊 LocalD1: Initialized SQLite database');
    } catch (error) {
      console.warn('⚠️ LocalD1: SQLite not available, using in-memory storage');
      this.db = new MemoryDB();
    }
  }

  private initializeSchema() {
    // Create tables that match the PRD schema
    const schema = `
      CREATE TABLE IF NOT EXISTS colleges (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT,
        state TEXT,
        type TEXT,
        stream TEXT,
        management_type TEXT,
        established_year INTEGER,
        website TEXT,
        phone TEXT,
        email TEXT,
        description TEXT,
        rating REAL,
        total_seats INTEGER,
        cutoff_rank INTEGER,
        fees INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        stream TEXT,
        branch TEXT,
        duration_years INTEGER,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS college_courses (
        id TEXT PRIMARY KEY,
        college_id TEXT,
        course_id TEXT,
        total_seats INTEGER DEFAULT 0,
        FOREIGN KEY (college_id) REFERENCES colleges(id),
        FOREIGN KEY (course_id) REFERENCES courses(id)
      );

      CREATE TABLE IF NOT EXISTS cutoffs (
        id TEXT PRIMARY KEY,
        college_id TEXT,
        course_id TEXT,
        year INTEGER,
        category TEXT,
        opening_rank INTEGER,
        closing_rank INTEGER,
        round INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (college_id) REFERENCES colleges(id),
        FOREIGN KEY (course_id) REFERENCES courses(id)
      );

      CREATE TABLE IF NOT EXISTS analytics (
        id TEXT PRIMARY KEY,
        event_type TEXT,
        data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    schema.split(';').forEach(statement => {
      if (statement.trim()) {
        this.db.exec(statement);
      }
    });
  }

  prepare(sql: string) {
    return new LocalD1Statement(this.db, sql);
  }

  batch(statements: any[]): Promise<any[]> {
    return Promise.resolve(statements.map(stmt => stmt.run()));
  }
}

class LocalD1Statement {
  private stmt: any;

  constructor(private db: any, private sql: string) {
    this.stmt = db.prepare(sql);
  }

  bind(...params: any[]) {
    return {
      run: () => {
        try {
          const result = this.stmt.run(...params);
          return {
            success: true,
            changes: result.changes,
            meta: {
              changes: result.changes,
              last_row_id: result.lastInsertRowid,
            }
          };
        } catch (error) {
          console.error('LocalD1 Error:', error);
          return { success: false, error: error.message };
        }
      },
      all: () => {
        try {
          return this.stmt.all(...params);
        } catch (error) {
          console.error('LocalD1 Error:', error);
          return [];
        }
      },
      first: () => {
        try {
          return this.stmt.get(...params);
        } catch (error) {
          console.error('LocalD1 Error:', error);
          return null;
        }
      }
    };
  }

  run() {
    return this.bind().run();
  }

  all() {
    return this.bind().all();
  }

  first() {
    return this.bind().first();
  }
}

/**
 * Simple in-memory database fallback
 */
class MemoryDB {
  private data = new Map();

  prepare(sql: string) {
    return {
      bind: (...params: any[]) => ({
        run: () => ({ success: true, changes: 0 }),
        all: () => [],
        first: () => null
      }),
      run: () => ({ success: true, changes: 0 }),
      all: () => [],
      first: () => null
    };
  }

  exec(sql: string) {
    // No-op for schema creation
  }
}

/**
 * Local Vectorize Emulation
 * Simple in-memory vector search for development
 */
export class LocalVectorize {
  private vectors = new Map<string, { vector: number[], metadata: any }>();

  constructor(private indexName: string = 'neetlogiq-vectors') {
    console.log(`🔍 LocalVectorize: Initialized index ${indexName}`);
  }

  async insert(vectors: Array<{ id: string, values: number[], metadata: any }>) {
    for (const vector of vectors) {
      this.vectors.set(vector.id, {
        vector: vector.values,
        metadata: vector.metadata
      });
    }
    console.log(`🔍 LocalVectorize: Inserted ${vectors.length} vectors`);
  }

  async query(vector: number[] | string, options: { topK?: number, filter?: any } = {}) {
    const { topK = 10, filter = {} } = options;
    
    // For string queries, we'll use simple text matching as a placeholder
    if (typeof vector === 'string') {
      const query = vector.toLowerCase();
      const matches = Array.from(this.vectors.entries())
        .filter(([_, data]) => {
          // Apply filters
          if (Object.keys(filter).length > 0) {
            for (const [key, value] of Object.entries(filter)) {
              if (data.metadata[key] !== value) return false;
            }
          }
          
          // Simple text search in metadata
          const searchableText = [
            data.metadata.name,
            data.metadata.description,
            data.metadata.city,
            data.metadata.state
          ].join(' ').toLowerCase();
          
          return searchableText.includes(query);
        })
        .slice(0, topK)
        .map(([id, data]) => ({
          id,
          score: Math.random() * 0.5 + 0.5, // Mock similarity score
          metadata: data.metadata
        }));

      return { matches };
    }

    // For actual vector queries (not implemented in local dev)
    return { matches: [] };
  }

  async delete(ids: string[]) {
    for (const id of ids) {
      this.vectors.delete(id);
    }
  }
}

/**
 * Local Analytics Emulation
 */
export class LocalAnalytics {
  async writeDataPoint(data: { blobs?: string[], doubles?: number[], indexes?: string[] }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      blobs: data.blobs || [],
      doubles: data.doubles || [],
      indexes: data.indexes || []
    };
    
    console.log('📊 LocalAnalytics:', JSON.stringify(logEntry, null, 2));
    
    // Could write to file for persistence if needed
    return Promise.resolve();
  }
}

/**
 * Create local Cloudflare environment
 */
export function createLocalEnv(): any {
  return {
    R2: new LocalR2('neetlogiq-data'),
    D1: new LocalD1(),
    VECTORIZE: new LocalVectorize('neetlogiq-vectors'),
    ANALYTICS: new LocalAnalytics(),
    AI: {
      // Placeholder for Cloudflare AI
      run: async (model: string, input: any) => {
        console.log('🤖 LocalAI: Mock AI response for', model);
        return { response: 'Mock AI response' };
      }
    },
    // Environment variables
    ENVIRONMENT: 'development',
    CACHE_TTL: '3600',
    SEARCH_LIMIT: '20',
    COMPARISON_LIMIT: '4'
  };
}

export { LOCAL_DATA_DIR, R2_DIR, D1_DB_PATH, VECTORIZE_DIR };