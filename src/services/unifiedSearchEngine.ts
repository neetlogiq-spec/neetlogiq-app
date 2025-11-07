// Unified Search Engine Service
// Provides advanced search capabilities across all content types

import { College, Course, Cutoff } from '@/types/index';

export interface SearchParams {
  query: string;
  type?: 'all' | 'colleges' | 'courses' | 'cutoffs';
  filters?: {
    state?: string;
    category?: string;
    year?: number;
    stream?: string;
    management_type?: string;
  };
  sort?: 'relevance' | 'name' | 'rank' | 'year';
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  type: 'college' | 'course' | 'cutoff';
  id: string;
  name: string;
  score: number;
  metadata: Record<string, any>;
  highlights?: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  filters: SearchParams['filters'];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

class UnifiedSearchEngine {
  private colleges: College[] = [];
  private courses: Course[] = [];
  private cutoffs: Cutoff[] = [];
  private searchHistory: string[] = [];

  constructor() {
    this.loadData();
  }

  // Load data from API or local storage
  private async loadData() {
    try {
      // Load colleges
      const collegesResponse = await fetch('/api/colleges');
      if (collegesResponse.ok) {
        const collegesData = await collegesResponse.json();
        this.colleges = collegesData.data || [];
      }

      // Load courses
      const coursesResponse = await fetch('/api/courses');
      if (coursesResponse.ok) {
        const coursesData = await coursesResponse.json();
        this.courses = coursesData.data || [];
      }

      // Load cutoffs
      const cutoffsResponse = await fetch('/api/cutoffs');
      if (cutoffsResponse.ok) {
        const cutoffsData = await cutoffsResponse.json();
        this.cutoffs = cutoffsData.data || [];
      }
    } catch (error) {
      console.error('Error loading search data:', error);
    }
  }

  // Main search function
  async search(params: SearchParams): Promise<SearchResponse> {
    const { query, type = 'all', filters = {}, sort = 'relevance', limit = 20, offset = 0 } = params;
    
    // Track search history
    this.addToSearchHistory(query);

    let results: SearchResult[] = [];

    // Search colleges
    if (type === 'all' || type === 'colleges') {
      const collegeResults = this.searchColleges(query, filters);
      results.push(...collegeResults);
    }

    // Search courses
    if (type === 'all' || type === 'courses') {
      const courseResults = this.searchCourses(query, filters);
      results.push(...courseResults);
    }

    // Search cutoffs
    if (type === 'all' || type === 'cutoffs') {
      const cutoffResults = this.searchCutoffs(query, filters);
      results.push(...cutoffResults);
    }

    // Sort results
    results = this.sortResults(results, sort);

    // Apply pagination
    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total,
      query,
      filters,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      }
    };
  }

  // Search colleges
  private searchColleges(query: string, filters: any): SearchResult[] {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    return this.colleges
      .filter(college => {
        // Apply filters
        if (filters.state && college.state !== filters.state) return false;
        if (filters.management_type && college.management_type !== filters.management_type) return false;

        // Search in name, city, state
        const searchText = `${college.name} ${college.city} ${college.state}`.toLowerCase();
        return searchTerms.every(term => searchText.includes(term));
      })
      .map(college => ({
        type: 'college' as const,
        id: college.id.toString(),
        name: college.name,
        score: this.calculateRelevanceScore(query, college.name),
        metadata: {
          city: college.city,
          state: college.state,
          management_type: college.management_type,
          established_year: college.established_year,
          website: college.website
        },
        highlights: this.generateHighlights(query, college.name)
      }));
  }

  // Search courses
  private searchCourses(query: string, filters: any): SearchResult[] {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    return this.courses
      .filter(course => {
        // Apply filters
        if (filters.stream && course.stream !== filters.stream) return false;

        // Search in name, stream, branch
        const searchText = `${course.name} ${course.stream} ${course.branch}`.toLowerCase();
        return searchTerms.every(term => searchText.includes(term));
      })
      .map(course => ({
        type: 'course' as const,
        id: course.id.toString(),
        name: course.name,
        score: this.calculateRelevanceScore(query, course.name),
        metadata: {
          stream: course.stream,
          branch: course.branch,
          duration_years: course.duration_years,
          description: course.description
        },
        highlights: this.generateHighlights(query, course.name)
      }));
  }

  // Search cutoffs
  private searchCutoffs(query: string, filters: any): SearchResult[] {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    return this.cutoffs
      .filter(cutoff => {
        // Apply filters
        if (filters.year && cutoff.year !== filters.year) return false;
        if (filters.category && cutoff.category !== filters.category) return false;

        // Find associated college and course names
        const college = this.colleges.find(c => c.id.toString() === cutoff.college_id.toString());
        const course = this.courses.find(c => c.id.toString() === cutoff.course_id.toString());
        
        if (!college || !course) return false;

        // Search in college name, course name, category
        const searchText = `${college.name} ${course.name} ${cutoff.category}`.toLowerCase();
        return searchTerms.every(term => searchText.includes(term));
      })
      .map(cutoff => {
        const college = this.colleges.find(c => c.id.toString() === cutoff.college_id.toString());
        const course = this.courses.find(c => c.id.toString() === cutoff.course_id.toString());
        
        return {
          type: 'cutoff' as const,
          id: cutoff.id.toString(),
          name: `${college?.name} - ${course?.name}`,
          score: this.calculateRelevanceScore(query, `${college?.name} ${course?.name}`),
          metadata: {
            college_name: college?.name,
            course_name: course?.name,
            year: cutoff.year,
            category: cutoff.category,
            opening_rank: cutoff.opening_rank,
            closing_rank: cutoff.closing_rank,
            round: cutoff.round
          },
          highlights: this.generateHighlights(query, `${college?.name} ${course?.name}`)
        };
      });
  }

  // Calculate relevance score
  private calculateRelevanceScore(query: string, text: string): number {
    const queryTerms = query.toLowerCase().split(' ');
    const textLower = text.toLowerCase();
    
    let score = 0;
    
    // Exact match gets highest score
    if (textLower.includes(query.toLowerCase())) {
      score += 100;
    }
    
    // Partial matches
    queryTerms.forEach(term => {
      if (textLower.includes(term)) {
        score += 10;
      }
    });
    
    // Length penalty (shorter matches are better)
    score -= text.length * 0.01;
    
    return Math.max(0, score);
  }

  // Generate highlights for search results
  private generateHighlights(query: string, text: string): string[] {
    const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    const highlights: string[] = [];
    
    queryTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      if (regex.test(text)) {
        highlights.push(term);
      }
    });
    
    return highlights;
  }

  // Sort results
  private sortResults(results: SearchResult[], sort: string): SearchResult[] {
    switch (sort) {
      case 'name':
        return results.sort((a, b) => a.name.localeCompare(b.name));
      case 'rank':
        return results.sort((a, b) => {
          const aRank = a.metadata.opening_rank || a.metadata.closing_rank || 999999;
          const bRank = b.metadata.opening_rank || b.metadata.closing_rank || 999999;
          return aRank - bRank;
        });
      case 'year':
        return results.sort((a, b) => {
          const aYear = a.metadata.year || 0;
          const bYear = b.metadata.year || 0;
          return bYear - aYear;
        });
      case 'relevance':
      default:
        return results.sort((a, b) => b.score - a.score);
    }
  }

  // Add to search history
  private addToSearchHistory(query: string) {
    if (query.trim().length === 0) return;
    
    // Remove if already exists
    this.searchHistory = this.searchHistory.filter(item => item !== query);
    
    // Add to beginning
    this.searchHistory.unshift(query);
    
    // Keep only last 10 searches
    this.searchHistory = this.searchHistory.slice(0, 10);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('neetlogiq_search_history', JSON.stringify(this.searchHistory));
    }
  }

  // Get search suggestions
  getSearchSuggestions(query: string): string[] {
    if (query.length < 2) return [];
    
    const suggestions: string[] = [];
    const queryLower = query.toLowerCase();
    
    // Add from search history
    suggestions.push(...this.searchHistory.filter(item => 
      item.toLowerCase().includes(queryLower)
    ));
    
    // Add college names
    this.colleges.forEach(college => {
      if (college.name.toLowerCase().includes(queryLower)) {
        suggestions.push(college.name);
      }
    });
    
    // Add course names
    this.courses.forEach(course => {
      if (course.name.toLowerCase().includes(queryLower)) {
        suggestions.push(course.name);
      }
    });
    
    // Remove duplicates and limit
    return [...new Set(suggestions)].slice(0, 8);
  }

  // Get search history
  getSearchHistory(): string[] {
    return [...this.searchHistory];
  }

  // Clear search history
  clearSearchHistory(): void {
    this.searchHistory = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('neetlogiq_search_history');
    }
  }

  // Refresh data
  async refreshData(): Promise<void> {
    await this.loadData();
  }
}

// Export singleton instance
const unifiedSearchEngine = new UnifiedSearchEngine();
export default unifiedSearchEngine;
