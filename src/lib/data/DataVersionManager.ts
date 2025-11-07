/**
 * Data Version Manager for Immutable Parquet Files
 * Handles time-based versioning with atomic switching
 */

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

export interface VersionMetadata {
  version: string;
  timestamp: string;
  data_sources: {
    colleges: string;
    courses: string;
    cutoffs: string;
  };
  json_artifacts: string;
  search_docs: string;
  stats: {
    colleges_count: number;
    courses_count: number;
    cutoffs_count: number;
  };
  checksums: {
    colleges: string;
    courses: string;
    cutoffs: string;
  };
}

export interface VersionHistory {
  versions: {
    version: string;
    created: string;
    status: 'current' | 'archived' | 'deprecated';
    size_mb: number;
  }[];
}

export interface ImportFiles {
  colleges: string;
  courses: string;
  cutoffs: string;
}

export class DataVersionManager {
  private baseDir: string;
  private dataDir: string;
  private metadataDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
    this.dataDir = path.join(baseDir, 'data');
    this.metadataDir = path.join(this.dataDir, 'parquet', 'metadata');
  }

  /**
   * Generate version string based on current date
   */
  generateVersion(): string {
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return `${year}_q${quarter}`;
  }

  /**
   * Create directory structure for a version
   */
  async createVersionDir(version: string): Promise<void> {
    const versionDir = path.join(this.dataDir, 'parquet', version.split('_')[0]);
    const jsonDir = path.join(this.dataDir, 'processed', 'json', version);
    const searchDir = path.join(this.dataDir, 'processed', 'search', version);

    await fs.mkdir(versionDir, { recursive: true });
    await fs.mkdir(jsonDir, { recursive: true });
    await fs.mkdir(searchDir, { recursive: true });
    await fs.mkdir(this.metadataDir, { recursive: true });
  }

  /**
   * Calculate file checksum
   */
  async calculateChecksum(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Get file size in MB
   */
  async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return Math.round(stats.size / (1024 * 1024) * 100) / 100;
  }

  /**
   * Load current version metadata
   */
  async getCurrentMetadata(): Promise<VersionMetadata | null> {
    try {
      const metadataPath = path.join(this.metadataDir, 'current_version.json');
      const content = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Load version history
   */
  async getVersionHistory(): Promise<VersionHistory> {
    try {
      const historyPath = path.join(this.metadataDir, 'version_history.json');
      const content = await fs.readFile(historyPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return { versions: [] };
    }
  }

  /**
   * Update version metadata
   */
  async updateMetadata(metadata: VersionMetadata): Promise<void> {
    const metadataPath = path.join(this.metadataDir, 'current_version.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Update version history
   */
  async updateHistory(version: string, sizeMb: number): Promise<void> {
    const history = await this.getVersionHistory();
    const historyPath = path.join(this.metadataDir, 'version_history.json');

    // Mark previous current version as archived
    history.versions.forEach(v => {
      if (v.status === 'current') {
        v.status = 'archived';
      }
    });

    // Add new version
    history.versions.push({
      version,
      created: new Date().toISOString(),
      status: 'current',
      size_mb: sizeMb
    });

    // Keep only last 10 versions in history
    if (history.versions.length > 10) {
      history.versions = history.versions.slice(-10);
    }

    await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
  }

  /**
   * Create symlinks to current version
   */
  async updateSymlinks(version: string): Promise<void> {
    const currentJsonDir = path.join(this.dataDir, 'processed', 'json', 'current');
    const currentSearchDir = path.join(this.dataDir, 'processed', 'search', 'current');
    
    const versionJsonDir = path.join(this.dataDir, 'processed', 'json', version);
    const versionSearchDir = path.join(this.dataDir, 'processed', 'search', version);

    try {
      // Remove existing symlinks
      await fs.unlink(currentJsonDir).catch(() => {});
      await fs.unlink(currentSearchDir).catch(() => {});

      // Create new symlinks
      await fs.symlink(path.relative(path.dirname(currentJsonDir), versionJsonDir), currentJsonDir);
      await fs.symlink(path.relative(path.dirname(currentSearchDir), versionSearchDir), currentSearchDir);
    } catch (error) {
      console.warn('Symlink creation failed, continuing without symlinks:', error);
    }
  }

  /**
   * Process Excel files to Parquet (mock implementation)
   */
  async processToParquet(sourceFiles: ImportFiles, version: string): Promise<{ [key: string]: string }> {
    const year = version.split('_')[0];
    const parquetFiles = {
      colleges: path.join(this.dataDir, 'parquet', year, `colleges_${version}.parquet`),
      courses: path.join(this.dataDir, 'parquet', year, `courses_${version}.parquet`),
      cutoffs: path.join(this.dataDir, 'parquet', year, `cutoffs_${version}.parquet`)
    };

    // TODO: Implement actual Excel to Parquet conversion
    // For now, create placeholder files
    for (const [key, outputPath] of Object.entries(parquetFiles)) {
      const sourceFile = sourceFiles[key as keyof ImportFiles];
      if (sourceFile) {
        // Mock conversion - in reality, use a proper Excel to Parquet converter
        await fs.copyFile(sourceFile, outputPath);
      }
    }

    return parquetFiles;
  }

  /**
   * Generate JSON artifacts for SSR
   */
  async generateJsonArtifacts(version: string, parquetFiles: { [key: string]: string }): Promise<void> {
    const jsonDir = path.join(this.dataDir, 'processed', 'json', version);

    // TODO: Implement Parquet to JSON conversion
    // For now, create placeholder structure
    const directories = ['colleges', 'courses', 'cutoffs', 'search'];
    for (const dir of directories) {
      await fs.mkdir(path.join(jsonDir, dir), { recursive: true });
    }

    // Create index file
    const indexData = {
      version,
      timestamp: new Date().toISOString(),
      available_data: Object.keys(parquetFiles)
    };
    
    await fs.writeFile(
      path.join(jsonDir, 'search_index.json'),
      JSON.stringify(indexData, null, 2)
    );
  }

  /**
   * Generate search documents for AutoRAG
   */
  async generateSearchDocs(version: string, parquetFiles: { [key: string]: string }): Promise<void> {
    const searchDir = path.join(this.dataDir, 'processed', 'search', version);

    // Create directories
    const directories = ['colleges', 'courses'];
    for (const dir of directories) {
      await fs.mkdir(path.join(searchDir, dir), { recursive: true });
    }

    // TODO: Implement search document generation
    // Create placeholder documents
    const docContent = `# Medical Education Data v${version}

This document contains structured data for medical education in India.

## Version Information
- Version: ${version}
- Generated: ${new Date().toISOString()}
- Data Sources: ${Object.keys(parquetFiles).join(', ')}

## Content Summary
This data includes comprehensive information about medical colleges, courses, and admission cutoffs.
`;

    await fs.writeFile(
      path.join(searchDir, 'overview.md'),
      docContent
    );
  }

  /**
   * Import new data with versioning
   */
  async importNewData(sourceFiles: ImportFiles): Promise<string> {
    const version = this.generateVersion();
    
    try {
      console.log(`Starting data import for version: ${version}`);
      
      // 1. Create version directory structure
      await this.createVersionDir(version);
      
      // 2. Process Excel files to Parquet
      const parquetFiles = await this.processToParquet(sourceFiles, version);
      
      // 3. Calculate checksums
      const checksums = {
        colleges: await this.calculateChecksum(parquetFiles.colleges),
        courses: await this.calculateChecksum(parquetFiles.courses),
        cutoffs: await this.calculateChecksum(parquetFiles.cutoffs)
      };
      
      // 4. Generate JSON artifacts
      await this.generateJsonArtifacts(version, parquetFiles);
      
      // 5. Generate search documents
      await this.generateSearchDocs(version, parquetFiles);
      
      // 6. Calculate total size
      let totalSize = 0;
      for (const filePath of Object.values(parquetFiles)) {
        totalSize += await this.getFileSize(filePath);
      }
      
      // 7. Create metadata
      const metadata: VersionMetadata = {
        version,
        timestamp: new Date().toISOString(),
        data_sources: parquetFiles,
        json_artifacts: path.join(this.dataDir, 'processed', 'json', version),
        search_docs: path.join(this.dataDir, 'processed', 'search', version),
        stats: {
          colleges_count: 2400, // TODO: Count from actual data
          courses_count: 16830,
          cutoffs_count: 400000
        },
        checksums
      };
      
      // 8. Update metadata files
      await this.updateMetadata(metadata);
      await this.updateHistory(version, totalSize);
      
      console.log(`Data import completed for version: ${version}`);
      return version;
      
    } catch (error) {
      console.error(`Data import failed for version: ${version}`, error);
      throw error;
    }
  }

  /**
   * Switch to a specific version (atomic operation)
   */
  async switchToVersion(version: string): Promise<void> {
    const versionHistory = await this.getVersionHistory();
    const targetVersion = versionHistory.versions.find(v => v.version === version);
    
    if (!targetVersion) {
      throw new Error(`Version ${version} not found in history`);
    }

    try {
      // Update symlinks
      await this.updateSymlinks(version);
      
      // Update current metadata
      const year = version.split('_')[0];
      const metadata: VersionMetadata = {
        version,
        timestamp: new Date().toISOString(),
        data_sources: {
          colleges: path.join(this.dataDir, 'parquet', year, `colleges_${version}.parquet`),
          courses: path.join(this.dataDir, 'parquet', year, `courses_${version}.parquet`),
          cutoffs: path.join(this.dataDir, 'parquet', year, `cutoffs_${version}.parquet`)
        },
        json_artifacts: path.join(this.dataDir, 'processed', 'json', version),
        search_docs: path.join(this.dataDir, 'processed', 'search', version),
        stats: {
          colleges_count: 2400, // TODO: Load from actual metadata
          courses_count: 16830,
          cutoffs_count: 400000
        },
        checksums: {
          colleges: '', // TODO: Load from stored checksums
          courses: '',
          cutoffs: ''
        }
      };
      
      await this.updateMetadata(metadata);
      
      // Update history status
      const history = await this.getVersionHistory();
      history.versions.forEach(v => {
        v.status = v.version === version ? 'current' : 'archived';
      });
      
      const historyPath = path.join(this.metadataDir, 'version_history.json');
      await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
      
      console.log(`Successfully switched to version: ${version}`);
      
    } catch (error) {
      console.error(`Failed to switch to version: ${version}`, error);
      throw error;
    }
  }

  /**
   * List all available versions
   */
  async listVersions(): Promise<VersionHistory> {
    return await this.getVersionHistory();
  }

  /**
   * Rollback to previous version
   */
  async rollbackToPrevious(): Promise<string> {
    const history = await this.getVersionHistory();
    const currentVersion = history.versions.find(v => v.status === 'current');
    const archivedVersions = history.versions
      .filter(v => v.status === 'archived')
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    if (archivedVersions.length === 0) {
      throw new Error('No previous version available for rollback');
    }

    const previousVersion = archivedVersions[0];
    await this.switchToVersion(previousVersion.version);
    
    return previousVersion.version;
  }

  /**
   * Clean up old versions (keep only specified number)
   */
  async cleanupOldVersions(keepCount: number = 3): Promise<string[]> {
    const history = await this.getVersionHistory();
    const sortedVersions = history.versions
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    const versionsToDelete = sortedVersions.slice(keepCount);
    const deletedVersions: string[] = [];

    for (const version of versionsToDelete) {
      try {
        const year = version.version.split('_')[0];
        const versionFiles = [
          path.join(this.dataDir, 'parquet', year, `colleges_${version.version}.parquet`),
          path.join(this.dataDir, 'parquet', year, `courses_${version.version}.parquet`),
          path.join(this.dataDir, 'parquet', year, `cutoffs_${version.version}.parquet`)
        ];

        // Delete files
        for (const filePath of versionFiles) {
          await fs.unlink(filePath).catch(() => {});
        }

        // Delete directories
        const jsonDir = path.join(this.dataDir, 'processed', 'json', version.version);
        const searchDir = path.join(this.dataDir, 'processed', 'search', version.version);
        
        await fs.rm(jsonDir, { recursive: true, force: true });
        await fs.rm(searchDir, { recursive: true, force: true });

        deletedVersions.push(version.version);
        
      } catch (error) {
        console.warn(`Failed to cleanup version ${version.version}:`, error);
      }
    }

    // Update history
    history.versions = sortedVersions.slice(0, keepCount);
    const historyPath = path.join(this.metadataDir, 'version_history.json');
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2));

    return deletedVersions;
  }
}