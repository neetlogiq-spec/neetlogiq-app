// Advanced regex matching for medical college and course names
export class RegexMatcher {
  // Common regex patterns for medical institutions
  private static patterns = {
    // College name patterns
    collegeName: /^([A-Z\s]+?)\s+(MEDICAL|DENTAL|PHARMACY|NURSING)\s+(COLLEGE|INSTITUTE|UNIVERSITY|HOSPITAL)/i,
    
    // Abbreviation patterns
    abbreviation: /^[A-Z]{2,10}$/,
    
    // Location patterns
    location: /(DELHI|MUMBAI|CHENNAI|KOLKATA|BANGALORE|HYDERABAD|PUNE|AHMEDABAD|JAIPUR|LUCKNOW)/i,
    
    // Government/Private patterns
    management: /(GOVERNMENT|PRIVATE|PUBLIC|AUTONOMOUS)/i,
    
    // Course patterns
    course: /(MBBS|BDS|MD|MS|DNB|MDS|BPT|MPT|BSC|MSC|B.PHARM|M.PHARM)/i,
    
    // Year patterns
    year: /\b(19|20)\d{2}\b/,
    
    // Rank patterns
    rank: /\b\d{1,6}\b/,
    
    // Category patterns
    category: /(GENERAL|OBC|SC|ST|EWS|PWD|NRI)/i
  };

  // Test if text matches a specific pattern
  static matchesPattern(text: string, patternName: keyof typeof RegexMatcher.patterns): boolean {
    const pattern = this.patterns[patternName];
    return pattern.test(text);
  }

  // Extract matches from text
  static extractMatches(text: string, patternName: keyof typeof RegexMatcher.patterns): string[] {
    const pattern = this.patterns[patternName];
    const matches = text.match(new RegExp(pattern.source, 'gi'));
    return matches || [];
  }

  // Generate regex patterns for search
  static generateSearchPatterns(query: string): RegExp[] {
    const patterns: RegExp[] = [];
    const normalizedQuery = query.trim();

    // Exact match pattern
    patterns.push(new RegExp(`^${this.escapeRegex(normalizedQuery)}$`, 'i'));

    // Contains pattern
    patterns.push(new RegExp(this.escapeRegex(normalizedQuery), 'i'));

    // Word boundary pattern
    patterns.push(new RegExp(`\\b${this.escapeRegex(normalizedQuery)}\\b`, 'i'));

    // Fuzzy pattern (allows some character variations)
    if (normalizedQuery.length > 3) {
      const fuzzyPattern = normalizedQuery.split('').join('.*?');
      patterns.push(new RegExp(fuzzyPattern, 'i'));
    }

    // Abbreviation pattern
    if (this.matchesPattern(normalizedQuery, 'abbreviation')) {
      patterns.push(new RegExp(`^${normalizedQuery}`, 'i'));
    }

    return patterns;
  }

  // Escape special regex characters
  private static escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Advanced search with multiple patterns
  static advancedSearch(text: string, query: string): {
    matches: boolean;
    score: number;
    matchedPatterns: string[];
  } {
    const patterns = this.generateSearchPatterns(query);
    let score = 0;
    const matchedPatterns: string[] = [];

    patterns.forEach((pattern, index) => {
      if (pattern.test(text)) {
        // Higher score for more specific patterns
        const patternScore = 1 / (index + 1);
        score += patternScore;
        
        matchedPatterns.push(pattern.source);
      }
    });

    return {
      matches: score > 0,
      score,
      matchedPatterns
    };
  }

  // Generate smart search suggestions based on patterns
  static generateSmartSuggestions(query: string, data: string[]): string[] {
    const suggestions = new Set<string>();
    const normalizedQuery = query.toLowerCase();

    data.forEach(item => {
      const itemLower = item.toLowerCase();
      
      // Exact match
      if (itemLower.includes(normalizedQuery)) {
        suggestions.add(item);
      }

      // Word boundary match
      const words = itemLower.split(/\s+/);
      words.forEach(word => {
        if (word.startsWith(normalizedQuery)) {
          suggestions.add(item);
        }
      });

      // Abbreviation match
      if (this.matchesPattern(query, 'abbreviation')) {
        const abbreviation = this.extractAbbreviation(item);
        if (abbreviation && abbreviation.toLowerCase().includes(normalizedQuery)) {
          suggestions.add(item);
        }
      }
    });

    return Array.from(suggestions).slice(0, 10);
  }

  // Extract potential abbreviation from full name
  private static extractAbbreviation(fullName: string): string {
    const words = fullName.split(/\s+/);
    const abbreviation = words
      .filter(word => word.length > 0 && /^[A-Z]/.test(word))
      .map(word => word[0])
      .join('');
    
    return abbreviation.length >= 2 ? abbreviation : '';
  }

  // Validate search query format
  static validateQuery(query: string): {
    isValid: boolean;
    type: 'exact' | 'fuzzy' | 'abbreviation' | 'pattern' | 'invalid';
    suggestions?: string[];
  } {
    if (!query || query.trim().length < 2) {
      return { isValid: false, type: 'invalid' };
    }

    const normalizedQuery = query.trim();

    // Check if it's an abbreviation
    if (this.matchesPattern(normalizedQuery, 'abbreviation')) {
      return { isValid: true, type: 'abbreviation' };
    }

    // Check if it's a college name pattern
    if (this.matchesPattern(normalizedQuery, 'collegeName')) {
      return { isValid: true, type: 'exact' };
    }

    // Check if it's a course pattern
    if (this.matchesPattern(normalizedQuery, 'course')) {
      return { isValid: true, type: 'exact' };
    }

    // Check if it's a location pattern
    if (this.matchesPattern(normalizedQuery, 'location')) {
      return { isValid: true, type: 'pattern' };
    }

    // Default to fuzzy search
    return { isValid: true, type: 'fuzzy' };
  }
}
