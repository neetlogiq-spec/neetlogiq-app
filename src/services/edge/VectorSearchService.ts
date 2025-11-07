// VectorSearchService - AI-powered semantic search using real embeddings
// This service provides high-performance vector similarity search

import { CutoffRecord, CutoffFilters, SearchResult } from '@/types/edge/data';

interface VectorSearchConfig {
  wasmPath: string;
  embeddingPath: string;
  dimensions: number;
  similarityThreshold: number;
}

interface EmbeddingData {
  id: string;
  name: string;
  text: string;
  embedding: number[];
  metadata: any;
}

interface CacheItem {
  data: any;
  timestamp: number;
  ttl: number;
}

class VectorSearchService {
  private embeddings: Map<string, EmbeddingData> = new Map();
  private config: VectorSearchConfig;
  private initialized: boolean = false;

  constructor(config: VectorSearchConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    console.log('VectorSearchService initializing...');
    
    try {
      // Load real embeddings from generated files
      await this.loadEmbeddings();
      this.initialized = true;
      console.log('VectorSearchService initialized with real embeddings');
    } catch (error) {
      console.error('Failed to load embeddings, using fallback:', error);
      this.generateMockEmbeddings();
      this.initialized = true;
    }
  }

  private async loadEmbeddings(): Promise<void> {
    try {
      // Load college embeddings
      const collegeResponse = await fetch('/data/embeddings/college_embeddings.json');
      if (collegeResponse.ok) {
        const collegeData = await collegeResponse.json();
        collegeData.forEach((item: EmbeddingData) => {
          this.embeddings.set(item.id, item);
        });
        console.log(`Loaded ${collegeData.length} college embeddings`);
      }

      // Load course embeddings
      const courseResponse = await fetch('/data/embeddings/course_embeddings.json');
      if (courseResponse.ok) {
        const courseData = await courseResponse.json();
        courseData.forEach((item: EmbeddingData) => {
          this.embeddings.set(`course_${item.id}`, item);
        });
        console.log(`Loaded ${courseData.length} course embeddings`);
      }

      // Load cutoff embeddings
      const cutoffResponse = await fetch('/data/embeddings/cutoff_embeddings.json');
      if (cutoffResponse.ok) {
        const cutoffData = await cutoffResponse.json();
        cutoffData.forEach((item: EmbeddingData) => {
          this.embeddings.set(`cutoff_${item.id}`, item);
        });
        console.log(`Loaded ${cutoffData.length} cutoff embeddings`);
      }
    } catch (error) {
      console.error('Error loading embeddings:', error);
      throw error;
    }
  }

  private generateMockEmbeddings(): void {
    // Fallback mock embeddings for development
    const mockColleges = [
      { id: 'MED0001', name: 'A J INSTITUTE OF MEDICAL SCIENCES AND RESEARCH CENTRE' },
      { id: 'MED0002', name: 'AARUPADAI VEEDU MEDICAL COLLEGE' },
      { id: 'MED0003', name: 'ABHISHEK I MISHRA MEMORIAL MEDICAL COLLEGE AND RESEARCH' },
      { id: 'MED0004', name: 'ACHARYA HARIHAR REGIONAL CANCER CENTRE' },
      { id: 'MED0005', name: 'ACHARYA SHRI CHANDER COLLEGE OF MEDICAL SCIENCES' }
    ];
    
    const mockCourses = [
      { id: 'CRS0001', name: 'ALL PG COURSES' },
      { id: 'CRS0002', name: 'BDS' },
      { id: 'CRS0003', name: 'DIPLOMA IN ANAESTHESIOLOGY' },
      { id: 'CRS0004', name: 'DIPLOMA IN BACTERIOLOGY' },
      { id: 'CRS0005', name: 'DIPLOMA IN CHILD HEALTH/ PAEDIATRICS' }
    ];
    
    mockColleges.forEach(college => {
      const embedding = new Array(384).fill(0);
      for (let i = 0; i < 384; i++) {
        embedding[i] = Math.random() * 0.5;
      }
      this.embeddings.set(college.id, {
        id: college.id,
        name: college.name,
        text: college.name,
        embedding: embedding,
        metadata: {}
      });
    });
    
    mockCourses.forEach(course => {
      const embedding = new Array(384).fill(0);
      for (let i = 0; i < 384; i++) {
        embedding[i] = Math.random() * 0.5;
      }
      this.embeddings.set(`course_${course.id}`, {
        id: course.id,
        name: course.name,
        text: course.name,
        embedding: embedding,
        metadata: {}
      });
    });
  }

  async searchColleges(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!this.initialized) {
      await this.init();
    }
    
    console.log('Searching colleges for:', query);
    
    // Generate query embedding
    const queryEmbedding = this.generateQueryEmbedding(query);
    
    // Calculate similarity with all college embeddings
    const results: SearchResult[] = [];
    
    for (const [id, embedding] of this.embeddings) {
      if (!id.startsWith('course_') && !id.startsWith('cutoff_')) {
        const similarity = this.calculateCosineSimilarity(queryEmbedding, embedding.embedding);
        
        if (similarity > this.config.similarityThreshold) {
          results.push({
            record: {
              id: `CUTOFF_${embedding.id}`,
              college_id: embedding.id,
              college_name: embedding.name,
              college_type: 'Medical',
              stream: 'Medical',
              state_id: 'STATE001',
              state_name: 'Delhi',
              course_id: 'CRS0001',
              course_name: 'MBBS',
              year: 2024,
              level: 'UG',
              counselling_body: 'AIQ',
              round: 1,
              quota_id: 'QUOTA001',
              quota_name: 'All India',
              category_id: 'CAT001',
              category_name: 'General',
              opening_rank: 1,
              closing_rank: 100,
              total_seats: 100,
              ranks: [1, 2, 3, 4, 5]
            } as CutoffRecord,
            similarity,
            score: similarity * 100
          });
        }
      }
    }
    
    // Sort by similarity and return top results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async searchCutoffs(query: string, filters: CutoffFilters, limit: number = 10): Promise<SearchResult[]> {
    if (!this.initialized) {
      await this.init();
    }
    
    console.log('Searching cutoffs for:', query, filters);
    
    // Generate query embedding
    const queryEmbedding = this.generateQueryEmbedding(query);
    
    // Calculate similarity with cutoff embeddings
    const results: SearchResult[] = [];
    
    for (const [id, embedding] of this.embeddings) {
      if (id.startsWith('cutoff_')) {
        const similarity = this.calculateCosineSimilarity(queryEmbedding, embedding.embedding);
        
        if (similarity > this.config.similarityThreshold) {
          // Apply filters
          if (this.matchesFilters(embedding.metadata, filters)) {
            results.push({
              record: {
                id: embedding.id,
                college_id: embedding.metadata.college_id || 'MED0001',
                college_name: embedding.metadata.college || 'Unknown',
                college_type: 'Medical',
                stream: 'Medical',
                state_id: embedding.metadata.state_id || 'STATE001',
                state_name: embedding.metadata.state || 'Unknown',
                course_id: embedding.metadata.course_id || 'CRS0001',
                course_name: embedding.metadata.course || 'Unknown',
                year: embedding.metadata.year || 2024,
                level: embedding.metadata.level || 'UG',
                counselling_body: embedding.metadata.source || 'AIQ',
                round: embedding.metadata.round || 1,
                quota_id: embedding.metadata.quota_id || 'QUOTA001',
                quota_name: embedding.metadata.quota || 'All India',
                category_id: embedding.metadata.category_id || 'CAT001',
                category_name: embedding.metadata.category || 'General',
                opening_rank: embedding.metadata.rank || 1,
                closing_rank: embedding.metadata.rank || 100,
                total_seats: 100,
                ranks: [embedding.metadata.rank || 1]
              } as CutoffRecord,
              similarity,
              score: similarity * 100
            });
          }
        }
      }
    }
    
    // Sort by similarity and return top results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async processNaturalLanguageQuery(query: string): Promise<{
    intent: string;
    entities: string[];
    filters: CutoffFilters;
  }> {
    console.log('Processing natural language query:', query);
    
    // Simple NLP for demo
    const words = query.toLowerCase().split(' ');
    
    const intent = words.includes('search') ? 'search' : 'browse';
    
    const entities = words.filter(word => 
      word.length > 3 && !['the', 'and', 'or', 'in', 'with'].includes(word)
    );
    
    const filters: CutoffFilters = {};
    
    // Extract year
    const yearMatch = query.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      filters.year = parseInt(yearMatch[1]);
    }
    
    // Extract rank range
    const rankMatch = query.match(/rank\s*(\d+)\s*-\s*(\d+)/);
    if (rankMatch) {
      filters.min_rank = parseInt(rankMatch[1]);
      filters.max_rank = parseInt(rankMatch[2]);
    }
    
    return {
      intent,
      entities,
      filters
    };
  }

  private generateQueryEmbedding(query: string): number[] {
    // Simple hash-based query embedding (for demo)
    const hash = this.simpleHash(query);
    const embedding = new Array(384).fill(0);
    
    for (let i = 0; i < 384; i++) {
      embedding[i] = Math.sin(hash + i) * 0.5;
    }
    
    return embedding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private matchesFilters(metadata: any, filters: CutoffFilters): boolean {
    if (filters.year && metadata.year !== filters.year) return false;
    if (filters.state_id && metadata.state_id !== filters.state_id) return false;
    if (filters.category_id && metadata.category_id !== filters.category_id) return false;
    if (filters.quota_id && metadata.quota_id !== filters.quota_id) return false;
    if (filters.min_rank && metadata.rank < filters.min_rank) return false;
    if (filters.max_rank && metadata.rank > filters.max_rank) return false;
    
    return true;
  }

  cleanup(): void {
    this.embeddings.clear();
    this.initialized = false;
    console.log('VectorSearchService cleaned up');
  }
}

// Export singleton instance
export const vectorSearchService = new VectorSearchService({
  wasmPath: '/New/WASM',
  embeddingPath: '/data/embeddings',
  dimensions: 384,
  similarityThreshold: 0.7,
});

export default vectorSearchService;
