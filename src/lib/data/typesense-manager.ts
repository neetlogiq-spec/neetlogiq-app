import Typesense from 'typesense';
import fs from 'fs';
import path from 'path';

export interface TypesenseConfig {
  nodes: Array<{
    host: string;
    port: number;
    protocol: string;
  }>;
  apiKey: string;
  connectionTimeoutSeconds: number;
}

export interface CollegeDocument {
  id: string;
  name: string;
  fullName?: string;
  state: string;
  city?: string;
  type: string;
  management: string;
  establishedYear?: number;
  source: 'unified' | 'staging';
}

export interface CourseDocument {
  id: string;
  name: string;
  type: string;
  stream?: string;
  branch?: string;
  level?: string;
  source: 'unified' | 'staging';
}

export interface SearchResult {
  document: CollegeDocument | CourseDocument;
  score: number;
  highlights: any[];
}

export class TypesenseManager {
  private client: Typesense.Client | null = null;
  private config: TypesenseConfig;
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.config = {
      nodes: [
        {
          host: 'localhost',
          port: 8108,
          protocol: 'http'
        }
      ],
      apiKey: 'xyz', // Default Typesense API key
      connectionTimeoutSeconds: 2
    };
  }

  /**
   * Initialize Typesense client
   */
  async initialize(): Promise<void> {
    try {
      this.client = new Typesense.Client(this.config);
      
      // Test connection
      await this.client.health.retrieve();
      console.log('✅ Typesense connection established');
      
      // Create collections if they don't exist
      await this.createCollections();
      
    } catch (error: any) {
      console.warn('⚠️ Typesense not available, falling back to local matching:', error.message);
      this.client = null;
    }
  }

  /**
   * Create Typesense collections
   */
  private async createCollections(): Promise<void> {
    if (!this.client) return;

    try {
      // Create colleges collection
      const collegesSchema = {
        name: 'colleges',
        fields: [
          { name: 'id', type: 'string' },
          { name: 'name', type: 'string', sort: true },
          { name: 'fullName', type: 'string', optional: true },
          { name: 'state', type: 'string' },
          { name: 'city', type: 'string', optional: true },
          { name: 'type', type: 'string' },
          { name: 'management', type: 'string' },
          { name: 'establishedYear', type: 'int32', optional: true },
          { name: 'source', type: 'string' }
        ],
        default_sorting_field: 'name'
      };

      try {
        await this.client.collections('colleges').retrieve();
        console.log('✅ Colleges collection already exists');
      } catch {
        await this.client.collections().create(collegesSchema);
        console.log('✅ Created colleges collection');
      }

      // Create courses collection
      const coursesSchema = {
        name: 'courses',
        fields: [
          { name: 'id', type: 'string' },
          { name: 'name', type: 'string', sort: true },
          { name: 'type', type: 'string' },
          { name: 'stream', type: 'string', optional: true },
          { name: 'branch', type: 'string', optional: true },
          { name: 'level', type: 'string', optional: true },
          { name: 'source', type: 'string' }
        ],
        default_sorting_field: 'name'
      };

      try {
        await this.client.collections('courses').retrieve();
        console.log('✅ Courses collection already exists');
      } catch {
        await this.client.collections().create(coursesSchema);
        console.log('✅ Created courses collection');
      }

    } catch (error: any) {
      console.error('❌ Failed to create Typesense collections:', error);
      throw error;
    }
  }

  /**
   * Index colleges from unified database
   */
  async indexUnifiedColleges(): Promise<void> {
    if (!this.client) return;

    try {
      const collegesPath = path.join(this.dataDir, 'unified_colleges.json');
      if (!fs.existsSync(collegesPath)) {
        console.warn('⚠️ Unified colleges file not found');
        return;
      }

      const collegesData = JSON.parse(fs.readFileSync(collegesPath, 'utf8'));
      const colleges = collegesData.data || collegesData;

      const documents: CollegeDocument[] = colleges.map((college: any) => ({
        id: college.id,
        name: college.name,
        fullName: college.fullName,
        state: college.state,
        city: college.city,
        type: college.type || 'MEDICAL',
        management: college.management || 'GOVERNMENT',
        establishedYear: college.establishedYear,
        source: 'unified' as const
      }));

      // Import documents in batches
      const batchSize = 100;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        await this.client.collections('colleges').documents().import(batch);
      }

      console.log(`✅ Indexed ${documents.length} unified colleges in Typesense`);

    } catch (error: any) {
      console.error('❌ Failed to index unified colleges:', error);
      throw error;
    }
  }

  /**
   * Index courses from unified database
   */
  async indexUnifiedCourses(): Promise<void> {
    if (!this.client) return;

    try {
      const coursesPath = path.join(this.dataDir, 'unified_courses.json');
      if (!fs.existsSync(coursesPath)) {
        console.warn('⚠️ Unified courses file not found');
        return;
      }

      const coursesData = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));
      const courses = coursesData.data || coursesData;

      const documents: CourseDocument[] = courses.map((course: any) => ({
        id: course.id,
        name: course.name,
        type: course.type || 'MD',
        stream: course.stream,
        branch: course.branch,
        level: course.level,
        source: 'unified' as const
      }));

      // Import documents in batches
      const batchSize = 100;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        await this.client.collections('courses').documents().import(batch);
      }

      console.log(`✅ Indexed ${documents.length} unified courses in Typesense`);

    } catch (error: any) {
      console.error('❌ Failed to index unified courses:', error);
      throw error;
    }
  }

  /**
   * Search for colleges using Typesense
   */
  async searchColleges(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!this.client) {
      return [];
    }

    try {
      const searchResults = await this.client.collections('colleges').documents().search({
        q: query,
        query_by: 'name,fullName',
        highlight_full_fields: 'name,fullName',
        limit: limit,
        sort_by: '_text_match:desc'
      });

      return searchResults.hits?.map((hit: any) => ({
        document: hit.document as CollegeDocument,
        score: hit.text_match || 0,
        highlights: hit.highlights || []
      })) || [];

    } catch (error: any) {
      console.error('❌ College search failed:', error);
      return [];
    }
  }

  /**
   * Search for courses using Typesense
   */
  async searchCourses(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!this.client) {
      return [];
    }

    try {
      const searchResults = await this.client.collections('courses').documents().search({
        q: query,
        query_by: 'name',
        highlight_full_fields: 'name',
        limit: limit,
        sort_by: '_text_match:desc'
      });

      return searchResults.hits?.map((hit: any) => ({
        document: hit.document as CourseDocument,
        score: hit.text_match || 0,
        highlights: hit.highlights || []
      })) || [];

    } catch (error: any) {
      console.error('❌ Course search failed:', error);
      return [];
    }
  }

  /**
   * Get Typesense status
   */
  async getStatus(): Promise<any> {
    if (!this.client) {
      return { available: false, message: 'Typesense not available' };
    }

    try {
      const health = await this.client.health.retrieve();
      const collections = await this.client.collections().retrieve();
      
      return {
        available: true,
        health,
        collections: collections.collections?.map((c: any) => ({
          name: c.name,
          documentCount: c.num_documents
        })) || []
      };
    } catch (error: any) {
      return { available: false, message: error.message };
    }
  }
}

export default TypesenseManager;
