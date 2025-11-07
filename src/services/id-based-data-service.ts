/**
 * ID-Based Data Service
 * Retrieves seat and counselling data and enriches with names from master data
 * Ensures standardized names across all pages
 * Supports dynamic partition discovery for automatic updates
 */

import { getMasterDataService, MasterCollege, MasterCourse } from './master-data-service';
import * as duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';

// ... existing code ...

export class IdBasedDataService {
  private db: duckdb.Database;
  private conn: duckdb.Connection;
  private masterDataService = getMasterDataService();
  
  private seatDataPath: string;
  private counsellingDataPath: string;
  private counsellingPartitionedPath: string | null = null;
  private partitionManifest: any = null;
  private lastManifestCheck: number = 0;
  private readonly MANIFEST_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000; // Check manifest every 1 week

  constructor(
    seatDataPath?: string,
    counsellingDataPath?: string,
    masterDataPath?: string,
    usePartitioned: boolean = true,
    enableAutoRefresh: boolean = true
  ) {
    this.db = new duckdb.Database(':memory:');
    this.conn = this.db.connect();
    this.seatDataPath = seatDataPath || path.join(process.cwd(), 'output', 'seat_data_export_20251029_001424.parquet');
    
    const defaultCounsellingPath = path.join(process.cwd(), 'output', 'counselling_data_export_20251029_001424.parquet');
    const defaultPartitionedPath = path.join(process.cwd(), 'output', 'counselling_data_export_20251029_001424_partitioned');
    
    this.counsellingDataPath = counsellingDataPath || defaultCounsellingPath;
    
    // Check if partitioned version exists
    if (usePartitioned) {
      this.checkAndLoadPartitions();
    }
  }
  
  /**
   * Check for partitioned data and load manifest
   * This is called on initialization and can be called periodically for auto-refresh
   */
  private checkAndLoadPartitions(): void {
    const manifestPath = path.join(
      process.cwd(), 
      'output', 
      'counselling_data_export_20251029_001424_partitioned',
      'manifest.json'
    );
    
    if (fs.existsSync(manifestPath)) {
      try {
        const manifestContent = fs.readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestContent);
        
        // Check if manifest changed or it's been a while since last check
        const manifestModified = fs.statSync(manifestPath).mtimeMs;
        const shouldReload = !this.partitionManifest || 
                            manifestModified > this.lastManifestCheck ||
                            JSON.stringify(manifest) !== JSON.stringify(this.partitionManifest);
        
        if (shouldReload) {
          this.counsellingPartitionedPath = path.dirname(manifestPath);
          this.partitionManifest = manifest;
          this.lastManifestCheck = Date.now();
          
          console.log('📦 Using partitioned counselling data:', this.counsellingPartitionedPath);
          console.log(`   Partitions: ${manifest.total_partitions}`);
          console.log(`   Total records: ${manifest.total_records?.toLocaleString()}`);
        }
      } catch (error) {
        console.warn('⚠️ Failed to load partition manifest, using single file:', error);
        this.counsellingPartitionedPath = null;
      }
    } else {
      console.log('📄 Using single file counselling data:', this.counsellingDataPath);
    }
  }
  
  /**
   * Get counselling data path - uses partitioned if available
   * With auto-refresh support for new partitions
   */
  private getCounsellingDataPath(): string {
    // Check for partition updates (throttled)
    const now = Date.now();
    if (now - this.lastManifestCheck > this.MANIFEST_CHECK_INTERVAL) {
      this.checkAndLoadPartitions();
    }
    
    if (this.counsellingPartitionedPath) {
      // Use glob pattern for DuckDB partition pruning
      return path.join(this.counsellingPartitionedPath, 'source=*_level=*_year=*.parquet');
    }
    return this.counsellingDataPath;
  }
  
  /**
   * Build partition-aware query path for DuckDB
   * DuckDB supports glob patterns and reads files on-demand
   * New partitions are automatically discovered via glob patterns
   */
  private buildPartitionQuery(filters: DataFilters): string {
    // Always check for latest partitions when building query
    this.checkAndLoadPartitions();
    
    if (!this.counsellingPartitionedPath) {
      return this.counsellingDataPath;
    }
    
    // Build partition pattern - DuckDB will match any files that fit the pattern
    // This means NEW partitions are automatically included!
    const parts: string[] = [];
    
    if (filters.source_id) {
      const sourceId = filters.source_id.startsWith('SRC') 
        ? filters.source_id 
        : this.masterDataService.getSourceByCode(filters.source_id)?.id || filters.source_id;
      parts.push(`source=${sourceId}*`);
    } else {
      parts.push('source=*');
    }
    
    if (filters.level_id) {
      const levelId = filters.level_id.startsWith('LVL')
        ? filters.level_id
        : this.masterDataService.getLevelByCode(filters.level_id)?.id || filters.level_id;
      parts.push(`level=${levelId}*`);
    } else {
      parts.push('level=*');
    }
    
    if (filters.year) {
      parts.push(`year=${filters.year}*`);
    } else {
      parts.push('year=*');
    }
    
    // DuckDB glob pattern: matches files like source=SRC001_level=LVL002_year=2024.parquet
    // Also matches NEW files like source=SRC001_level=LVL002_year=2025.parquet automatically!
    const globPattern = `${parts[0]}_${parts[1]}_${parts[2]}.parquet`;
    return path.join(this.counsellingPartitionedPath, globPattern);
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Ensure master data service is initialized
    if (!this.masterDataService.isInitialized()) {
      await this.masterDataService.initialize();
    }
    console.log('✅ ID-Based Data Service initialized');
  }

  // ... rest of the existing methods remain the same ...

  /**
   * Get available years from partitions
   * Automatically discovers new years from partition files
   */
  async getAvailableYears(): Promise<number[]> {
    await this.initialize();
    
    if (this.counsellingPartitionedPath && this.partitionManifest) {
      // Extract unique years from manifest
      const years = new Set<number>();
      if (this.partitionManifest.partitions) {
        this.partitionManifest.partitions.forEach((p: any) => {
          if (p.year) years.add(p.year);
        });
      }
      return Array.from(years).sort((a, b) => b - a); // Latest first
    }
    
    // Fallback: query from single file
    return new Promise((resolve, reject) => {
      this.conn.all(
        `SELECT DISTINCT year FROM read_parquet('${this.counsellingDataPath}') ORDER BY year DESC`,
        (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows.map(r => Number(r.year)));
        }
      );
    });
  }

  /**
   * Get available sources from partitions
   */
  async getAvailableSources(): Promise<string[]> {
    await this.initialize();
    
    if (this.counsellingPartitionedPath && this.partitionManifest) {
      const sources = new Set<string>();
      if (this.partitionManifest.partitions) {
        this.partitionManifest.partitions.forEach((p: any) => {
          if (p.source_id) sources.add(p.source_id);
        });
      }
      return Array.from(sources);
    }
    
    return new Promise((resolve, reject) => {
      this.conn.all(
        `SELECT DISTINCT master_source_id FROM read_parquet('${this.counsellingDataPath}') WHERE master_source_id IS NOT NULL`,
        (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows.map(r => String(r.master_source_id)).filter(Boolean));
        }
      );
    });
  }

  /**
   * Get available levels from partitions
   */
  async getAvailableLevels(): Promise<string[]> {
    await this.initialize();
    
    if (this.counsellingPartitionedPath && this.partitionManifest) {
      const levels = new Set<string>();
      if (this.partitionManifest.partitions) {
        this.partitionManifest.partitions.forEach((p: any) => {
          if (p.level_id) levels.add(p.level_id);
        });
      }
      return Array.from(levels);
    }
    
    return new Promise((resolve, reject) => {
      this.conn.all(
        `SELECT DISTINCT master_level_id FROM read_parquet('${this.counsellingDataPath}') WHERE master_level_id IS NOT NULL`,
        (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows.map(r => String(r.master_level_id)).filter(Boolean));
        }
      );
    });
  }

  /**
   * Force refresh partition manifest
   * Useful after adding new partitions to make them available immediately
   */
  refreshPartitions(): void {
    this.lastManifestCheck = 0; // Reset to force reload
    this.checkAndLoadPartitions();
    console.log('🔄 Partitions refreshed manually');
  }

  /**
   * Get partition refresh status
   * Returns when data was last checked and when next check will occur
   */
  getPartitionRefreshStatus(): {
    lastCheck: Date | null;
    nextCheck: Date;
    isUsingPartitions: boolean;
    partitionCount: number | null;
    totalRecords: number | null;
  } {
    const nextCheck = new Date(
      this.lastManifestCheck > 0 
        ? this.lastManifestCheck + this.MANIFEST_CHECK_INTERVAL
        : Date.now() + this.MANIFEST_CHECK_INTERVAL
    );
    
    return {
      lastCheck: this.lastManifestCheck > 0 ? new Date(this.lastManifestCheck) : null,
      nextCheck,
      isUsingPartitions: this.counsellingPartitionedPath !== null,
      partitionCount: this.partitionManifest?.total_partitions || null,
      totalRecords: this.partitionManifest?.total_records || null,
    };
  }
}

// ... rest of existing code ...
