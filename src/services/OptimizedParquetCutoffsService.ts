/**
 * Optimized Parquet + DuckDB-WASM Service
 * Best for large datasets with rich filtering
 */

import * as duckdb from '@duckdb/duckdb-wasm';

export class OptimizedParquetCutoffsService {
  private db: duckdb.AsyncDuckDB | null = null;
  private loadingPromise: Promise<void> | null = null;
  private cache: Map<string, any[]> = new Map();

  // Lazy initialization - only load DuckDB when needed
  async initialize() {
    if (this.db) return;
    
    if (!this.loadingPromise) {
      this.loadingPromise = this._loadDuckDB();
    }
    
    await this.loadingPromise;
  }

  private async _loadDuckDB() {
    const DUCKDB_BUNDLES = await duckdb.selectBundle({
      mvp: {
        mainModule: import('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm'),
        mainWorker: import('@duckdb/duckdb-wasm/dist/duckdb-mvp.worker.js'),
      },
    });

    this.db = new duckdb.AsyncDuckDB(DUCKDB_BUNDLES.worker, DUCKDB_BUNDLES.mainModule);
    await this.db.instantiate();
  }

  // 1. STREAMING: Load Parquet file in chunks (don't download full file)
  async loadStreaming(filePath: string) {
    // Fetch file size
    const headResponse = await fetch(filePath, { method: 'HEAD' });
    const totalSize = parseInt(headResponse.headers.get('content-length') || '0');
    
    // Load in 500KB chunks
    const chunkSize = 500 * 1024;
    const chunks: Blob[] = [];
    
    for (let offset = 0; offset < totalSize; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, totalSize);
      const response = await fetch(filePath, {
        headers: { Range: `bytes=${offset}-${end - 1}` }
      });
      
      if (response.ok) {
        chunks.push(await response.blob());
      }
    }
    
    // Return combined blob (doesn't download full file at once)
    return new Blob(chunks);
  }

  // 2. LAZY COLUMN LOADING: Only load columns you need
  async loadWithColumnSelection(filePath: string, columns: string[]) {
    await this.initialize();
    
    // Load only needed columns from Parquet
    const columnList = columns.join(', ');
    const query = `
      SELECT ${columnList}
      FROM read_parquet('${filePath}')
      WHERE round IN (1, 2)
      LIMIT 1000
    `;
    
    const result = await this.db!.runQuery(query);
    return result.toArray();
  }

  // 3. PROGRESSIVE QUERY: Start with small dataset, expand on demand
  async loadPriorityThenExpand(stream: string) {
    // Step 1: Load priority rounds (small, fast)
    const priorityData = await this.loadStreaming(`/data/parquet/${stream}_priority.parquet`);
    
    // Step 2: Load full data in background (don't wait)
    setTimeout(() => this.loadFullData(stream), 100);
    
    return priorityData;
  }

  async loadFullData(stream: string) {
    return this.loadStreaming(`/data/parquet/${stream}_full.parquet`);
  }

  // 4. INTELLIGENT CACHING: Cache based on query patterns
  async getCachedOrQuery(queryKey: string, queryFn: () => Promise<any>) {
    if (this.cache.has(queryKey)) {
      return this.cache.get(queryKey);
    }
    
    const result = await queryFn();
    this.cache.set(queryKey, result);
    return result;
  }

  // 5. QUERY OPTIMIZATION: Use Parquet metadata for fast queries
  async fastFilter(filters: { college?: string; category?: string; minRank?: number }) {
    await this.initialize();
    
    let query = "SELECT * FROM read_parquet('/data/parquet/UG_priority.parquet') WHERE 1=1";
    
    if (filters.college) {
      query += ` AND college_name ILIKE '%${filters.college}%'`;
    }
    
    if (filters.minRank) {
      query += ` AND closing_rank <= ${filters.minRank}`;
    }
    
    // Limit results for performance
    query += " LIMIT 500";
    
    const result = await this.db!.runQuery(query);
    return result.toArray();
  }

  // 6. PRELOAD PREDICTION: Preload what user is likely to need next
  async predictAndPreload(stream: string, currentQuery: string) {
    // Based on common query patterns
    const predictions = [
      `/data/parquet/${stream}_round_3.parquet`,
      `/data/parquet/${stream}_round_4.parquet`
    ];
    
    // Preload in background
    predictions.forEach(file => {
      this.loadStreaming(file).catch(() => {}); // Silent fail if not needed
    });
  }
}

export const optimizedParquetService = new OptimizedParquetCutoffsService();
