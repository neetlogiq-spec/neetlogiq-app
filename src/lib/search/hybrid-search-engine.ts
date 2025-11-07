import { Index } from 'flexsearch';
import uFuzzy from '@leeoniya/ufuzzy';
import { AbbreviationGenerator } from './abbreviation-generator';
import { PhoneticMatcher } from './phonetic-matcher';
import { RegexMatcher } from './regex-matcher';

// Hybrid search configuration
export interface SearchableItem {
  id: string;
  name: string;
  city?: string;
  state?: string;
  course_type?: string;
  management?: string;
  abbreviations?: string[];
  phonetic?: string;
  // Add other searchable fields
}

export interface SearchOptions {
  type?: 'colleges' | 'courses' | 'cutoffs' | 'all';
  limit?: number;
  useFuzzy?: boolean;
  useRegex?: boolean;
  useAbbreviations?: boolean;
  usePhonetic?: boolean;
  fuzzyThreshold?: number;
}

export class HybridSearchEngine {
  private flexSearchIndex: Index;
  private uFuzzyInstance: uFuzzy;
  
  private items: SearchableItem[] = [];
  private searchableTexts: string[] = [];
  private preparedIndex: any = null;

  constructor(items: SearchableItem[] = []) {
    this.items = items || [];
    
    // Initialize FlexSearch with advanced options
    this.flexSearchIndex = new Index({
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
        field: ["name", "city", "state", "abbreviations", "phonetic"]
      }
    });

    // Initialize uFuzzy with optimized settings
    this.uFuzzyInstance = new uFuzzy({
      intraMode: 1,        // Allow gaps between characters
      intraIns: 1,         // Insertion cost
      intraSub: 1,         // Substitution cost
      intraDel: 1,         // Deletion cost
      intraTrn: 1,         // Transposition cost
      intraChars: '[a-z\\d]',
      intraBound: '\\b',
    });
  }

  // Add items to both search engines
  addItems(items: SearchableItem[] = []) {
    this.items = items || [];
    
    // Prepare items for FlexSearch
    this.items.forEach(item => {
      // Add abbreviations if not provided
      if (!item.abbreviations) {
        item.abbreviations = AbbreviationGenerator.generateAbbreviations(item.name);
      }
      
      // Add phonetic representation
      item.phonetic = PhoneticMatcher.generatePhoneticVariations(item.name).join(' ');
      
      this.flexSearchIndex.add(item);
    });

    // Prepare items for uFuzzy
    this.prepareUFuzzyIndex();
  }

  // Prepare uFuzzy index
  private prepareUFuzzyIndex() {
    this.searchableTexts = this.items.map(item => {
      const searchableText = [
        item.name,
        item.city || '',
        item.state || '',
        item.course_type || '',
        item.management || '',
        ...(item.abbreviations || []),
        item.phonetic || ''
      ].join(' ').toLowerCase();
      
      return searchableText;
    });
  }

  // Hybrid search combining FlexSearch + uFuzzy
  search(query: string, options: SearchOptions = {}): SearchableItem[] {
    const {
      type = 'all',
      limit = 50,
      useFuzzy = true,
      useRegex = true,
      useAbbreviations = true,
      usePhonetic = true,
      fuzzyThreshold = 0.6
    } = options;

    if (!query.trim()) {
      return this.items.slice(0, limit);
    }

    const results = new Set<string>();
    const queryLower = query.toLowerCase();

    // Step 1: FlexSearch for exact and pattern matching
    const flexSearchResults = this.flexSearchIndex.search(query, limit * 2);
    flexSearchResults.forEach(id => results.add(id));

    // Step 2: uFuzzy for fuzzy matching (if enabled)
    if (useFuzzy) {
      const fuzzyResults = this.performFuzzySearch(queryLower, limit * 2, fuzzyThreshold);
      fuzzyResults.forEach(id => results.add(id));
    }

    // Step 3: Abbreviation expansion (if enabled)
    if (useAbbreviations) {
      const abbreviationResults = this.searchAbbreviations(query, limit);
      abbreviationResults.forEach(id => results.add(id));
    }

    // Step 4: Regex pattern matching (if enabled)
    if (useRegex) {
      const regexResults = this.searchWithRegex(query, limit);
      regexResults.forEach(id => results.add(id));
    }

    // Step 5: Phonetic matching (if enabled)
    if (usePhonetic) {
      const phoneticResults = this.searchPhonetically(query, limit);
      phoneticResults.forEach(id => results.add(id));
    }

    // Convert IDs back to items and apply limit
    return Array.from(results)
      .map(id => this.items.find(item => item.id === id))
      .filter(Boolean)
      .slice(0, limit) as SearchableItem[];
  }

  // Perform fuzzy search using uFuzzy
  private performFuzzySearch(query: string, limit: number, threshold: number): string[] {
    try {
      const [indices, info, order] = this.uFuzzyInstance.search(
        this.searchableTexts,
        query,
        limit
      );

      if (!indices) return [];

      // Filter by threshold and return IDs
      return order
        .filter(idx => {
          const score = info.idx[idx] / query.length;
          return score >= threshold;
        })
        .map(idx => this.items[indices[idx]].id);
    } catch (error) {
      console.error('Fuzzy search error:', error);
      return [];
    }
  }

  // Search using abbreviations
  private searchAbbreviations(query: string, limit: number): string[] {
    const results: string[] = [];
    const queryUpper = query.toUpperCase();

    this.items.forEach(item => {
      if (item.abbreviations) {
        const hasMatch = item.abbreviations.some(abbr => 
          abbr.includes(queryUpper) || queryUpper.includes(abbr)
        );
        
        if (hasMatch) {
          results.push(item.id);
        }
      }
    });

    return results.slice(0, limit);
  }

  // Search using regex patterns
  private searchWithRegex(query: string, limit: number): string[] {
    const results: string[] = [];
    const patterns = RegexMatcher.generateSearchPatterns(query);

    this.items.forEach(item => {
      const searchText = [
        item.name,
        item.city || '',
        item.state || '',
        item.course_type || '',
        item.management || ''
      ].join(' ').toLowerCase();

      const hasMatch = patterns.some(pattern => pattern.test(searchText));
      
      if (hasMatch) {
        results.push(item.id);
      }
    });

    return results.slice(0, limit);
  }

  // Search using phonetic matching
  private searchPhonetically(query: string, limit: number): string[] {
    const results: string[] = [];
    const queryPhonetic = PhoneticMatcher.generateSoundex(query);

    this.items.forEach(item => {
      if (item.phonetic) {
        const phoneticVariations = item.phonetic.split(' ');
        const hasMatch = phoneticVariations.some(phonetic => 
          PhoneticMatcher.arePhoneticallySimilar(query, phonetic, 0.7)
        );
        
        if (hasMatch) {
          results.push(item.id);
        }
      }
    });

    return results.slice(0, limit);
  }

  // Get search suggestions
  getSuggestions(query: string, limit: number = 10): string[] {
    if (!query.trim()) return [];

    const suggestions = new Set<string>();
    
    // Get suggestions from fuzzy search
    const fuzzyResults = this.performFuzzySearch(query.toLowerCase(), limit * 2, 0.4);
    fuzzyResults.forEach(id => {
      const item = this.items.find(i => i.id === id);
      if (item) {
        suggestions.add(item.name);
        if (item.abbreviations) {
          item.abbreviations.forEach(abbr => suggestions.add(abbr));
        }
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
    },
    options: SearchOptions = {}
  ): SearchableItem[] {
    // First perform the search
    let results = this.search(query, options);

    // Then apply filters
    if (filters.state?.length) {
      results = results.filter(item => 
        filters.state!.includes(item.state || '')
      );
    }

    if (filters.management?.length) {
      results = results.filter(item => 
        filters.management!.includes(item.management || '')
      );
    }

    if (filters.course_type?.length) {
      results = results.filter(item => 
        filters.course_type!.includes(item.course_type || '')
      );
    }

    return results;
  }

  // Get search statistics
  getStats() {
    return {
      totalItems: this.items.length,
      flexSearchEnabled: true,
      uFuzzyEnabled: true,
      abbreviationMatching: true,
      regexMatching: true,
      phoneticMatching: true
    };
  }
}

// Factory function
export function createHybridSearchEngine(): HybridSearchEngine {
  return new HybridSearchEngine();
}
