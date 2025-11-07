import { Index } from 'flexsearch';

// Advanced search configuration for medical colleges
export interface SearchableCollege {
  id: string;
  name: string;
  city?: string;
  state?: string;
  course_type?: string;
  management?: string;
  abbreviations?: string[]; // Custom abbreviations
  phonetic?: string; // Phonetic representation
}

export interface SearchableCourse {
  id: string;
  name: string;
  normalized_name?: string;
  course_type?: string;
  abbreviations?: string[];
}

export interface SearchableCutoff {
  id: string;
  college_name: string;
  course_name: string;
  category: string;
  year: number;
  opening_rank: number;
  closing_rank: number;
  college_abbreviations?: string[];
  course_abbreviations?: string[];
}

export class AdvancedNeetLogIQSearch {
  private collegeIndex: Index;
  private courseIndex: Index;
  private cutoffIndex: Index;
  
  private colleges: SearchableCollege[] = [];
  private courses: SearchableCourse[] = [];
  private cutoffs: SearchableCutoff[] = [];
  
  private abbreviationMap: Map<string, string[]> = new Map();
  private reverseAbbreviationMap: Map<string, string> = new Map();

  constructor() {
    // Initialize FlexSearch indexes with advanced options
    this.collegeIndex = new Index({
      tokenize: "forward", // Better for abbreviations
      threshold: 0, // Exact matches first
      resolution: 3, // Higher resolution for better matching
      depth: 2, // Deeper search
      cache: true, // Cache for performance
      async: false, // Synchronous for better control
      worker: false, // No worker for simplicity
      rtl: false,
      doc: {
        id: "id",
        field: ["name", "city", "state", "abbreviations", "phonetic"]
      }
    });

    this.courseIndex = new Index({
      tokenize: "forward",
      threshold: 0,
      resolution: 3,
      depth: 2,
      cache: true,
      async: false,
      worker: false,
      rtl: false,
      doc: {
        id: "id",
        field: ["name", "normalized_name", "abbreviations"]
      }
    });

    this.cutoffIndex = new Index({
      tokenize: "forward",
      threshold: 0,
      resolution: 3,
      depth: 2,
      cache: true,
      async: false,
      worker: false,
      rtl: false,
      doc: {
        id: "id",
        field: ["college_name", "course_name", "category", "college_abbreviations", "course_abbreviations"]
      }
    });

    this.initializeAbbreviationMappings();
  }

  // Initialize common medical college abbreviations
  private initializeAbbreviationMappings() {
    const abbreviations = [
      // A J Institute variations
      {
        full: "A J INSTITUTE OF MEDICAL SCIENCES & RESEARCH CENTRE",
        short: ["AJIMS", "AJIMSRC", "AJ INSTITUTE", "AJ MEDICAL"]
      },
      {
        full: "ALL INDIA INSTITUTE OF MEDICAL SCIENCES",
        short: ["AIIMS", "ALL INDIA", "AIIMS DELHI"]
      },
      {
        full: "CHRISTIAN MEDICAL COLLEGE",
        short: ["CMC", "CMC VELLORE", "CHRISTIAN MEDICAL"]
      },
      {
        full: "JAWAHARLAL INSTITUTE OF POSTGRADUATE MEDICAL EDUCATION AND RESEARCH",
        short: ["JIPMER", "JAWAHARLAL", "JIPMER PUDUCHERRY"]
      },
      {
        full: "KARNATAKA INSTITUTE OF MEDICAL SCIENCES",
        short: ["KIMS", "KARNATAKA MEDICAL", "KIMS HUBLI"]
      },
      {
        full: "KEM HOSPITAL",
        short: ["KEM", "KEM MUMBAI", "KING EDWARD"]
      },
      {
        full: "LADY HARDINGE MEDICAL COLLEGE",
        short: ["LHMC", "LADY HARDINGE", "LHMC DELHI"]
      },
      {
        full: "MAULANA AZAD MEDICAL COLLEGE",
        short: ["MAMC", "MAULANA AZAD", "MAMC DELHI"]
      },
      {
        full: "POST GRADUATE INSTITUTE OF MEDICAL EDUCATION AND RESEARCH",
        short: ["PGIMER", "PGI", "PGI CHANDIGARH"]
      },
      {
        full: "SRI RAMACHANDRA MEDICAL COLLEGE",
        short: ["SRMC", "SRI RAMACHANDRA", "SRMC CHENNAI"]
      },
      {
        full: "STANLEY MEDICAL COLLEGE",
        short: ["STANLEY", "STANLEY CHENNAI", "SMC"]
      },
      {
        full: "UNIVERSITY COLLEGE OF MEDICAL SCIENCES",
        short: ["UCMS", "UNIVERSITY COLLEGE", "UCMS DELHI"]
      },
      {
        full: "VARDHMAN MAHAVIR MEDICAL COLLEGE",
        short: ["VMMC", "VARDHMAN", "VMMC DELHI"]
      },
      {
        full: "GOVERNMENT MEDICAL COLLEGE",
        short: ["GMC", "GOVT MEDICAL", "GOVERNMENT MEDICAL"]
      },
      {
        full: "MEDICAL COLLEGE",
        short: ["MC", "MEDICAL COLLEGE"]
      }
    ];

    // Build abbreviation mappings
    abbreviations.forEach(({ full, short }) => {
      this.abbreviationMap.set(full, short);
      short.forEach(abbr => {
        this.reverseAbbreviationMap.set(abbr, full);
      });
    });
  }

  // Add data to search indexes
  addColleges(colleges: SearchableCollege[]) {
    this.colleges = colleges;
    colleges.forEach(college => {
      // Add abbreviations if not provided
      if (!college.abbreviations) {
        college.abbreviations = this.generateAbbreviations(college.name);
      }
      
      // Add phonetic representation
      college.phonetic = this.generatePhonetic(college.name);
      
      this.collegeIndex.add(college);
    });
  }

  addCourses(courses: SearchableCourse[]) {
    this.courses = courses;
    courses.forEach(course => {
      if (!course.abbreviations) {
        course.abbreviations = this.generateAbbreviations(course.name);
      }
      this.courseIndex.add(course);
    });
  }

  addCutoffs(cutoffs: SearchableCutoff[]) {
    this.cutoffs = cutoffs;
    cutoffs.forEach(cutoff => {
      if (!cutoff.college_abbreviations) {
        cutoff.college_abbreviations = this.generateAbbreviations(cutoff.college_name);
      }
      if (!cutoff.course_abbreviations) {
        cutoff.course_abbreviations = this.generateAbbreviations(cutoff.course_name);
      }
      this.cutoffIndex.add(cutoff);
    });
  }

  // Generate abbreviations from full names
  private generateAbbreviations(fullName: string): string[] {
    const abbreviations: string[] = [];
    
    // Method 1: First letters of each word
    const words = fullName.split(/\s+/);
    if (words.length > 1) {
      const firstLetters = words.map(word => word.charAt(0).toUpperCase()).join('');
      if (firstLetters.length >= 2) {
        abbreviations.push(firstLetters);
      }
    }

    // Method 2: First letters of significant words (skip common words)
    const significantWords = words.filter(word => 
      !['OF', 'AND', 'THE', 'FOR', 'IN', 'AT', 'TO', 'A', 'AN'].includes(word.toUpperCase())
    );
    if (significantWords.length > 1) {
      const significantAbbr = significantWords.map(word => word.charAt(0).toUpperCase()).join('');
      if (significantAbbr.length >= 2 && significantAbbr !== abbreviations[0]) {
        abbreviations.push(significantAbbr);
      }
    }

    // Method 3: Common medical abbreviations
    if (fullName.includes('MEDICAL COLLEGE')) {
      abbreviations.push('MC');
    }
    if (fullName.includes('GOVERNMENT')) {
      abbreviations.push('GMC');
    }
    if (fullName.includes('INSTITUTE')) {
      abbreviations.push('INST');
    }

    return [...new Set(abbreviations)]; // Remove duplicates
  }

  // Generate phonetic representation using simple Soundex-like algorithm
  private generatePhonetic(text: string): string {
    const normalized = text.toUpperCase()
      .replace(/[^A-Z\s]/g, '') // Remove non-letters
      .replace(/\s+/g, ''); // Remove spaces

    // Simple phonetic mapping
    const phoneticMap: { [key: string]: string } = {
      'PH': 'F',
      'CK': 'K',
      'QU': 'KW',
      'X': 'KS',
      'Z': 'S'
    };

    let phonetic = normalized;
    Object.entries(phoneticMap).forEach(([from, to]) => {
      phonetic = phonetic.replace(new RegExp(from, 'g'), to);
    });

    return phonetic;
  }

  // Advanced search with regex and abbreviation support
  search(query: string, options: {
    type?: 'colleges' | 'courses' | 'cutoffs' | 'all';
    limit?: number;
    useRegex?: boolean;
    useAbbreviations?: boolean;
    usePhonetic?: boolean;
  } = {}): {
    colleges: SearchableCollege[];
    courses: SearchableCourse[];
    cutoffs: SearchableCutoff[];
  } {
    const {
      type = 'all',
      limit = 50,
      useRegex = true,
      useAbbreviations = true,
      usePhonetic = true
    } = options;

    const results = {
      colleges: [] as SearchableCollege[],
      courses: [] as SearchableCourse[],
      cutoffs: [] as SearchableCutoff[]
    };

    // Expand query with abbreviations
    const expandedQueries = this.expandQuery(query, { useAbbreviations, usePhonetic });

    // Search each type
    if (type === 'colleges' || type === 'all') {
      results.colleges = this.searchColleges(expandedQueries, limit, useRegex);
    }

    if (type === 'courses' || type === 'all') {
      results.courses = this.searchCourses(expandedQueries, limit, useRegex);
    }

    if (type === 'cutoffs' || type === 'all') {
      results.cutoffs = this.searchCutoffs(expandedQueries, limit, useRegex);
    }

    return results;
  }

  // Expand query with abbreviations and phonetic variations
  private expandQuery(query: string, options: {
    useAbbreviations: boolean;
    usePhonetic: boolean;
  }): string[] {
    const queries = [query];

    if (options.useAbbreviations) {
      // Check if query is an abbreviation
      const fullName = this.reverseAbbreviationMap.get(query.toUpperCase());
      if (fullName) {
        queries.push(fullName);
      }

      // Check if query matches any abbreviation patterns
      this.reverseAbbreviationMap.forEach((fullName, abbr) => {
        if (abbr.includes(query.toUpperCase()) || query.toUpperCase().includes(abbr)) {
          queries.push(fullName);
        }
      });
    }

    if (options.usePhonetic) {
      // Add phonetic variations
      const phonetic = this.generatePhonetic(query);
      queries.push(phonetic);
    }

    return [...new Set(queries)]; // Remove duplicates
  }

  // Search colleges with advanced matching
  private searchColleges(queries: string[], limit: number, useRegex: boolean): SearchableCollege[] {
    const results = new Set<string>();

    queries.forEach(query => {
      if (useRegex) {
        // Use FlexSearch's built-in regex-like capabilities
        const searchResults = this.collegeIndex.search(query, limit);
        searchResults.forEach(id => results.add(id));
      } else {
        // Simple text search
        const searchResults = this.collegeIndex.search(query, limit);
        searchResults.forEach(id => results.add(id));
      }
    });

    return Array.from(results)
      .map(id => this.colleges.find(c => c.id === id))
      .filter(Boolean) as SearchableCollege[];
  }

  // Search courses with advanced matching
  private searchCourses(queries: string[], limit: number, useRegex: boolean): SearchableCourse[] {
    const results = new Set<string>();

    queries.forEach(query => {
      const searchResults = this.courseIndex.search(query, limit);
      searchResults.forEach(id => results.add(id));
    });

    return Array.from(results)
      .map(id => this.courses.find(c => c.id === id))
      .filter(Boolean) as SearchableCourse[];
  }

  // Search cutoffs with advanced matching
  private searchCutoffs(queries: string[], limit: number, useRegex: boolean): SearchableCutoff[] {
    const results = new Set<string>();

    queries.forEach(query => {
      const searchResults = this.cutoffIndex.search(query, limit);
      searchResults.forEach(id => results.add(id));
    });

    return Array.from(results)
      .map(id => this.cutoffs.find(c => c.id === id))
      .filter(Boolean) as SearchableCutoff[];
  }

  // Get search suggestions with abbreviations
  getSuggestions(query: string, limit: number = 10): string[] {
    const suggestions = new Set<string>();

    // Get suggestions from colleges
    const collegeResults = this.searchColleges([query], limit, false);
    collegeResults.forEach(college => {
      suggestions.add(college.name);
      if (college.abbreviations) {
        college.abbreviations.forEach(abbr => suggestions.add(abbr));
      }
    });

    // Get suggestions from courses
    const courseResults = this.searchCourses([query], limit, false);
    courseResults.forEach(course => {
      suggestions.add(course.name);
      if (course.abbreviations) {
        course.abbreviations.forEach(abbr => suggestions.add(abbr));
      }
    });

    return Array.from(suggestions).slice(0, limit);
  }

  // Advanced search with filters
  searchWithFilters(
    query: string,
    filters: {
      state?: string[];
      management?: string[];
      course_type?: string[];
      year?: number[];
      category?: string[];
    },
    options: {
      type?: 'colleges' | 'courses' | 'cutoffs' | 'all';
      limit?: number;
      useRegex?: boolean;
      useAbbreviations?: boolean;
    } = {}
  ) {
    const results = this.search(query, options);
    let filteredResults = { ...results };

    // Apply filters
    if (filters.state?.length) {
      filteredResults.colleges = filteredResults.colleges.filter(college =>
        filters.state!.includes(college.state || '')
      );
    }

    if (filters.management?.length) {
      filteredResults.colleges = filteredResults.colleges.filter(college =>
        filters.management!.includes(college.management || '')
      );
    }

    if (filters.course_type?.length) {
      filteredResults.courses = filteredResults.courses.filter(course =>
        filters.course_type!.includes(course.course_type || '')
      );
    }

    if (filters.year?.length) {
      filteredResults.cutoffs = filteredResults.cutoffs.filter(cutoff =>
        filters.year!.includes(cutoff.year)
      );
    }

    if (filters.category?.length) {
      filteredResults.cutoffs = filteredResults.cutoffs.filter(cutoff =>
        filters.category!.includes(cutoff.category)
      );
    }

    return filteredResults;
  }
}

// Factory function to create search engine
export function createAdvancedSearchEngine() {
  return new AdvancedNeetLogIQSearch();
}
