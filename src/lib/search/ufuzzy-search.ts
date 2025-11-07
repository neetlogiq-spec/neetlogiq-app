import uFuzzy from '@leeoniya/ufuzzy';

// Search configuration for NeetLogIQ
const uf = new uFuzzy({
  // Search options
  intraMode: 1,        // Allow gaps between characters
  intraIns: 1,         // Insertion cost
  intraSub: 1,         // Substitution cost
  intraDel: 1,         // Deletion cost
  intraTrn: 1,         // Transposition cost
  
  // Performance tuning
  intraChars: '[a-z\\d]',  // Characters to consider for fuzzy matching
  intraBound: '\\b',       // Word boundary
});

export interface SearchableItem {
  id: string;
  name: string;
  city?: string;
  state?: string;
  course_type?: string;
  management?: string;
  // Add other searchable fields
}

export class NeetLogIQSearch {
  private searchIndex: string[] = [];
  private items: SearchableItem[] = [];
  private prepared: any = null;

  constructor(items: SearchableItem[] = []) {
    this.items = items || [];
    this.buildIndex();
  }

  private buildIndex() {
    // Create searchable text for each item
    this.searchIndex = (this.items || []).map(item => {
      const searchableText = [
        item.name,
        item.city || '',
        item.state || '',
        item.course_type || '',
        item.management || ''
      ].join(' ').toLowerCase();
      
      return searchableText;
    });
  }

  search(query: string, limit: number = 50): SearchableItem[] {
    if (!query.trim()) return this.items.slice(0, limit);

    const queryLower = query.toLowerCase();
    
    // Perform fuzzy search
    const [indices, info, order] = uf.search(
      this.searchIndex,
      queryLower,
      limit
    );

    if (!indices) return [];

    // Return results in order of relevance
    return order.map(idx => this.items[indices[idx]]);
  }

  // Advanced search with filters
  searchWithFilters(
    query: string, 
    filters: {
      state?: string[];
      management?: string[];
      course_type?: string[];
    },
    limit: number = 50
  ): SearchableItem[] {
    let results = this.search(query, limit * 2); // Get more results for filtering

    // Apply filters
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

    return results.slice(0, limit);
  }

  // Get search suggestions
  getSuggestions(query: string, limit: number = 10): string[] {
    if (!query.trim()) return [];

    const results = this.search(query, limit);
    return results.map(item => item.name);
  }
}

// Usage example
export function createSearchEngine(data: SearchableItem[]) {
  return new NeetLogIQSearch(data);
}
