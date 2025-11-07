// Utility functions for hybrid search
import { SearchableItem } from './hybrid-search-engine';

// Search result scoring and ranking
export interface SearchResult {
  item: SearchableItem;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'abbreviation' | 'regex' | 'phonetic';
  matchedFields: string[];
}

export class SearchResultRanker {
  // Rank search results by relevance
  static rankResults(
    results: SearchableItem[],
    query: string,
    matchTypes: string[] = []
  ): SearchResult[] {
    const queryLower = query.toLowerCase();
    
    return results.map(item => {
      let score = 0;
      const matchedFields: string[] = [];
      let matchType: SearchResult['matchType'] = 'exact';

      // Exact name match (highest score)
      if (item.name.toLowerCase().includes(queryLower)) {
        score += 100;
        matchedFields.push('name');
        if (item.name.toLowerCase() === queryLower) {
          score += 50; // Bonus for exact match
        }
      }

      // City match
      if (item.city?.toLowerCase().includes(queryLower)) {
        score += 30;
        matchedFields.push('city');
      }

      // State match
      if (item.state?.toLowerCase().includes(queryLower)) {
        score += 25;
        matchedFields.push('state');
      }

      // Abbreviation match
      if (item.abbreviations?.some(abbr => 
        abbr.toLowerCase().includes(queryLower) || 
        queryLower.includes(abbr.toLowerCase())
      )) {
        score += 40;
        matchedFields.push('abbreviations');
        matchType = 'abbreviation';
      }

      // Course type match
      if (item.course_type?.toLowerCase().includes(queryLower)) {
        score += 20;
        matchedFields.push('course_type');
      }

      // Management match
      if (item.management?.toLowerCase().includes(queryLower)) {
        score += 15;
        matchedFields.push('management');
      }

      // Determine match type based on score
      if (score >= 100) {
        matchType = 'exact';
      } else if (score >= 40) {
        matchType = 'fuzzy';
      }

      return {
        item,
        score,
        matchType,
        matchedFields
      };
    }).sort((a, b) => b.score - a.score);
  }

  // Group results by match type
  static groupByMatchType(results: SearchResult[]): Record<string, SearchResult[]> {
    return results.reduce((groups, result) => {
      const type = result.matchType;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(result);
      return groups;
    }, {} as Record<string, SearchResult[]>);
  }
}

// Search query preprocessing
export class QueryPreprocessor {
  // Clean and normalize search query
  static preprocessQuery(query: string): string {
    return query
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  // Extract search terms from query
  static extractSearchTerms(query: string): string[] {
    const cleaned = this.preprocessQuery(query);
    return cleaned.split(' ').filter(term => term.length > 0);
  }

  // Check if query is likely an abbreviation
  static isAbbreviation(query: string): boolean {
    const cleaned = query.trim().toUpperCase();
    return /^[A-Z]{2,10}$/.test(cleaned);
  }

  // Check if query contains numbers (ranks, years, etc.)
  static containsNumbers(query: string): boolean {
    return /\d/.test(query);
  }

  // Suggest query improvements
  static suggestImprovements(query: string): string[] {
    const suggestions: string[] = [];
    const cleaned = this.preprocessQuery(query);

    if (cleaned.length < 2) {
      suggestions.push('Try a longer search term');
    }

    if (this.isAbbreviation(query)) {
      suggestions.push('Try searching for the full name as well');
    }

    if (cleaned.includes(' ')) {
      suggestions.push('Try searching without spaces for abbreviations');
    }

    return suggestions;
  }
}

// Search analytics and metrics
export class SearchAnalytics {
  private static searchHistory: Array<{
    query: string;
    timestamp: number;
    resultCount: number;
    searchTime: number;
  }> = [];

  // Track search performance
  static trackSearch(
    query: string,
    resultCount: number,
    searchTime: number
  ) {
    this.searchHistory.push({
      query,
      timestamp: Date.now(),
      resultCount,
      searchTime
    });

    // Keep only last 100 searches
    if (this.searchHistory.length > 100) {
      this.searchHistory = this.searchHistory.slice(-100);
    }
  }

  // Get search statistics
  static getStats() {
    const totalSearches = this.searchHistory.length;
    const avgResultCount = totalSearches > 0 
      ? this.searchHistory.reduce((sum, search) => sum + search.resultCount, 0) / totalSearches
      : 0;
    const avgSearchTime = totalSearches > 0
      ? this.searchHistory.reduce((sum, search) => sum + search.searchTime, 0) / totalSearches
      : 0;

    return {
      totalSearches,
      avgResultCount: Math.round(avgResultCount),
      avgSearchTime: Math.round(avgSearchTime),
      recentQueries: this.searchHistory.slice(-10).map(s => s.query)
    };
  }

  // Get popular search terms
  static getPopularQueries(limit: number = 10): Array<{ query: string; count: number }> {
    const queryCounts = this.searchHistory.reduce((counts, search) => {
      counts[search.query] = (counts[search.query] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return Object.entries(queryCounts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

// Search result highlighting
export class SearchHighlighter {
  // Highlight matching text in search results
  static highlightMatches(
    text: string,
    query: string,
    className: string = 'bg-yellow-200'
  ): string {
    if (!query.trim()) return text;

    const queryTerms = QueryPreprocessor.extractSearchTerms(query);
    let highlightedText = text;

    queryTerms.forEach(term => {
      if (term.length > 1) {
        const regex = new RegExp(`(${term})`, 'gi');
        highlightedText = highlightedText.replace(
          regex,
          `<span class="${className}">$1</span>`
        );
      }
    });

    return highlightedText;
  }

  // Get matching text snippets
  static getSnippets(
    text: string,
    query: string,
    maxLength: number = 100
  ): string[] {
    const queryTerms = QueryPreprocessor.extractSearchTerms(query);
    const snippets: string[] = [];
    
    queryTerms.forEach(term => {
      const index = text.toLowerCase().indexOf(term.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - maxLength / 2);
        const end = Math.min(text.length, index + term.length + maxLength / 2);
        const snippet = text.substring(start, end);
        
        if (start > 0) {
          snippets.push('...' + snippet);
        } else {
          snippets.push(snippet);
        }
        
        if (end < text.length) {
          snippets[snippets.length - 1] += '...';
        }
      }
    });

    return [...new Set(snippets)]; // Remove duplicates
  }
}

