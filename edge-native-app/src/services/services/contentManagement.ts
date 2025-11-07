/**
 * Content Management System Service
 * Handles announcements, help documentation, FAQs, and static content
 */

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetAudience: 'all' | 'students' | 'admins' | 'new_users';
  status: 'draft' | 'published' | 'archived';
  scheduled?: string; // ISO date for scheduled publishing
  expiresAt?: string; // ISO date for automatic expiration
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  viewCount: number;
  dismissible: boolean;
  sticky: boolean; // Pin to top
}

export interface HelpDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  tags: string[];
  searchKeywords: string[];
  order: number; // For sorting within category
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedReadTime: number; // in minutes
  lastReviewed?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  helpful: number; // Thumbs up count
  notHelpful: number; // Thumbs down count
  relatedDocs: string[]; // Array of related document IDs
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  status: 'draft' | 'published' | 'archived';
  order: number; // For sorting within category
  tags: string[];
  searchKeywords: string[];
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  helpful: number;
  notHelpful: number;
  relatedFAQs: string[];
}

export interface StaticPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  metaDescription?: string;
  metaKeywords?: string[];
  status: 'draft' | 'published';
  template: 'default' | 'privacy' | 'terms' | 'about';
  lastReviewed?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  seoOptimized: boolean;
}

export interface ContentCategory {
  id: string;
  name: string;
  description: string;
  type: 'help' | 'faq';
  slug: string;
  color?: string;
  icon?: string;
  order: number;
  parentId?: string; // For subcategories
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentStats {
  totalAnnouncements: number;
  activeAnnouncements: number;
  totalHelpDocs: number;
  publishedHelpDocs: number;
  totalFAQs: number;
  publishedFAQs: number;
  totalStaticPages: number;
  publishedStaticPages: number;
  totalViews: number;
  popularContent: Array<{
    id: string;
    title: string;
    type: 'announcement' | 'help' | 'faq' | 'page';
    viewCount: number;
  }>;
}

export interface ContentSearchResult {
  id: string;
  title: string;
  type: 'announcement' | 'help' | 'faq' | 'page';
  snippet: string;
  url: string;
  relevance: number;
}

/**
 * Content Management Service
 */
export class ContentManagementService {
  private storagePrefix = 'neetlogiq_cms_';

  // Announcements
  async getAnnouncements(status?: string, targetAudience?: string): Promise<Announcement[]> {
    try {
      const stored = localStorage.getItem(`${this.storagePrefix}announcements`);
      let announcements = stored ? JSON.parse(stored) : this.getDefaultAnnouncements();
      
      if (status) {
        announcements = announcements.filter((a: Announcement) => a.status === status);
      }
      
      if (targetAudience) {
        announcements = announcements.filter((a: Announcement) => 
          a.targetAudience === 'all' || a.targetAudience === targetAudience
        );
      }
      
      return announcements.sort((a: Announcement, b: Announcement) => {
        if (a.sticky && !b.sticky) return -1;
        if (!a.sticky && b.sticky) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    } catch (error) {
      console.error('Error getting announcements:', error);
      return this.getDefaultAnnouncements();
    }
  }

  async createAnnouncement(announcement: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt' | 'viewCount'>): Promise<Announcement> {
    const newAnnouncement: Announcement = {
      ...announcement,
      id: `announcement_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      viewCount: 0
    };

    const announcements = await this.getAnnouncements();
    announcements.push(newAnnouncement);
    localStorage.setItem(`${this.storagePrefix}announcements`, JSON.stringify(announcements));
    
    return newAnnouncement;
  }

  async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement | null> {
    const announcements = await this.getAnnouncements();
    const index = announcements.findIndex(a => a.id === id);
    
    if (index === -1) return null;
    
    announcements[index] = {
      ...announcements[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem(`${this.storagePrefix}announcements`, JSON.stringify(announcements));
    return announcements[index];
  }

  async deleteAnnouncement(id: string): Promise<boolean> {
    const announcements = await this.getAnnouncements();
    const filtered = announcements.filter(a => a.id !== id);
    localStorage.setItem(`${this.storagePrefix}announcements`, JSON.stringify(filtered));
    return true;
  }

  // Help Documents
  async getHelpDocuments(category?: string, status?: string): Promise<HelpDocument[]> {
    try {
      const stored = localStorage.getItem(`${this.storagePrefix}help_docs`);
      let docs = stored ? JSON.parse(stored) : this.getDefaultHelpDocs();
      
      if (category) {
        docs = docs.filter((d: HelpDocument) => d.category === category);
      }
      
      if (status) {
        docs = docs.filter((d: HelpDocument) => d.status === status);
      }
      
      return docs.sort((a: HelpDocument, b: HelpDocument) => a.order - b.order);
    } catch (error) {
      console.error('Error getting help documents:', error);
      return this.getDefaultHelpDocs();
    }
  }

  async createHelpDocument(doc: Omit<HelpDocument, 'id' | 'createdAt' | 'updatedAt' | 'viewCount' | 'helpful' | 'notHelpful'>): Promise<HelpDocument> {
    const newDoc: HelpDocument = {
      ...doc,
      id: `help_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      viewCount: 0,
      helpful: 0,
      notHelpful: 0
    };

    const docs = await this.getHelpDocuments();
    docs.push(newDoc);
    localStorage.setItem(`${this.storagePrefix}help_docs`, JSON.stringify(docs));
    
    return newDoc;
  }

  async updateHelpDocument(id: string, updates: Partial<HelpDocument>): Promise<HelpDocument | null> {
    const docs = await this.getHelpDocuments();
    const index = docs.findIndex(d => d.id === id);
    
    if (index === -1) return null;
    
    docs[index] = {
      ...docs[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem(`${this.storagePrefix}help_docs`, JSON.stringify(docs));
    return docs[index];
  }

  async deleteHelpDocument(id: string): Promise<boolean> {
    const docs = await this.getHelpDocuments();
    const filtered = docs.filter(d => d.id !== id);
    localStorage.setItem(`${this.storagePrefix}help_docs`, JSON.stringify(filtered));
    return true;
  }

  // FAQs
  async getFAQs(category?: string, status?: string): Promise<FAQ[]> {
    try {
      const stored = localStorage.getItem(`${this.storagePrefix}faqs`);
      let faqs = stored ? JSON.parse(stored) : this.getDefaultFAQs();
      
      if (category) {
        faqs = faqs.filter((f: FAQ) => f.category === category);
      }
      
      if (status) {
        faqs = faqs.filter((f: FAQ) => f.status === status);
      }
      
      return faqs.sort((a: FAQ, b: FAQ) => a.order - b.order);
    } catch (error) {
      console.error('Error getting FAQs:', error);
      return this.getDefaultFAQs();
    }
  }

  async createFAQ(faq: Omit<FAQ, 'id' | 'createdAt' | 'updatedAt' | 'viewCount' | 'helpful' | 'notHelpful'>): Promise<FAQ> {
    const newFAQ: FAQ = {
      ...faq,
      id: `faq_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      viewCount: 0,
      helpful: 0,
      notHelpful: 0
    };

    const faqs = await this.getFAQs();
    faqs.push(newFAQ);
    localStorage.setItem(`${this.storagePrefix}faqs`, JSON.stringify(faqs));
    
    return newFAQ;
  }

  async updateFAQ(id: string, updates: Partial<FAQ>): Promise<FAQ | null> {
    const faqs = await this.getFAQs();
    const index = faqs.findIndex(f => f.id === id);
    
    if (index === -1) return null;
    
    faqs[index] = {
      ...faqs[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem(`${this.storagePrefix}faqs`, JSON.stringify(faqs));
    return faqs[index];
  }

  async deleteFAQ(id: string): Promise<boolean> {
    const faqs = await this.getFAQs();
    const filtered = faqs.filter(f => f.id !== id);
    localStorage.setItem(`${this.storagePrefix}faqs`, JSON.stringify(filtered));
    return true;
  }

  // Static Pages
  async getStaticPages(status?: string): Promise<StaticPage[]> {
    try {
      const stored = localStorage.getItem(`${this.storagePrefix}static_pages`);
      let pages = stored ? JSON.parse(stored) : this.getDefaultStaticPages();
      
      if (status) {
        pages = pages.filter((p: StaticPage) => p.status === status);
      }
      
      return pages.sort((a: StaticPage, b: StaticPage) => a.title.localeCompare(b.title));
    } catch (error) {
      console.error('Error getting static pages:', error);
      return this.getDefaultStaticPages();
    }
  }

  async createStaticPage(page: Omit<StaticPage, 'id' | 'createdAt' | 'updatedAt'>): Promise<StaticPage> {
    const newPage: StaticPage = {
      ...page,
      id: `page_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const pages = await this.getStaticPages();
    pages.push(newPage);
    localStorage.setItem(`${this.storagePrefix}static_pages`, JSON.stringify(pages));
    
    return newPage;
  }

  async updateStaticPage(id: string, updates: Partial<StaticPage>): Promise<StaticPage | null> {
    const pages = await this.getStaticPages();
    const index = pages.findIndex(p => p.id === id);
    
    if (index === -1) return null;
    
    pages[index] = {
      ...pages[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem(`${this.storagePrefix}static_pages`, JSON.stringify(pages));
    return pages[index];
  }

  async deleteStaticPage(id: string): Promise<boolean> {
    const pages = await this.getStaticPages();
    const filtered = pages.filter(p => p.id !== id);
    localStorage.setItem(`${this.storagePrefix}static_pages`, JSON.stringify(filtered));
    return true;
  }

  // Categories
  async getCategories(type?: 'help' | 'faq'): Promise<ContentCategory[]> {
    try {
      const stored = localStorage.getItem(`${this.storagePrefix}categories`);
      let categories = stored ? JSON.parse(stored) : this.getDefaultCategories();
      
      if (type) {
        categories = categories.filter((c: ContentCategory) => c.type === type);
      }
      
      return categories.filter((c: ContentCategory) => c.isActive)
        .sort((a: ContentCategory, b: ContentCategory) => a.order - b.order);
    } catch (error) {
      console.error('Error getting categories:', error);
      return this.getDefaultCategories();
    }
  }

  async createCategory(category: Omit<ContentCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContentCategory> {
    const newCategory: ContentCategory = {
      ...category,
      id: `category_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const categories = await this.getCategories();
    categories.push(newCategory);
    localStorage.setItem(`${this.storagePrefix}categories`, JSON.stringify(categories));
    
    return newCategory;
  }

  // Content Statistics
  async getContentStats(): Promise<ContentStats> {
    const announcements = await this.getAnnouncements();
    const helpDocs = await this.getHelpDocuments();
    const faqs = await this.getFAQs();
    const staticPages = await this.getStaticPages();

    const allContent = [
      ...announcements.map(a => ({ id: a.id, title: a.title, type: 'announcement' as const, viewCount: a.viewCount })),
      ...helpDocs.map(h => ({ id: h.id, title: h.title, type: 'help' as const, viewCount: h.viewCount })),
      ...faqs.map(f => ({ id: f.id, title: f.question, type: 'faq' as const, viewCount: f.viewCount })),
      ...staticPages.map(p => ({ id: p.id, title: p.title, type: 'page' as const, viewCount: 0 }))
    ];

    return {
      totalAnnouncements: announcements.length,
      activeAnnouncements: announcements.filter(a => a.status === 'published').length,
      totalHelpDocs: helpDocs.length,
      publishedHelpDocs: helpDocs.filter(h => h.status === 'published').length,
      totalFAQs: faqs.length,
      publishedFAQs: faqs.filter(f => f.status === 'published').length,
      totalStaticPages: staticPages.length,
      publishedStaticPages: staticPages.filter(p => p.status === 'published').length,
      totalViews: allContent.reduce((sum, content) => sum + content.viewCount, 0),
      popularContent: allContent
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 10)
    };
  }

  // Search across all content types
  async searchContent(query: string): Promise<ContentSearchResult[]> {
    const announcements = await this.getAnnouncements();
    const helpDocs = await this.getHelpDocuments();
    const faqs = await this.getFAQs();
    const staticPages = await this.getStaticPages();

    const results: ContentSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // Search announcements
    announcements.forEach(item => {
      if (item.title.toLowerCase().includes(lowerQuery) || item.content.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: item.id,
          title: item.title,
          type: 'announcement',
          snippet: this.extractSnippet(item.content, query),
          url: `/admin/content/announcements/${item.id}`,
          relevance: this.calculateRelevance(item.title, item.content, query)
        });
      }
    });

    // Search help docs
    helpDocs.forEach(item => {
      if (item.title.toLowerCase().includes(lowerQuery) || item.content.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: item.id,
          title: item.title,
          type: 'help',
          snippet: this.extractSnippet(item.content, query),
          url: `/help/${item.slug}`,
          relevance: this.calculateRelevance(item.title, item.content, query)
        });
      }
    });

    // Search FAQs
    faqs.forEach(item => {
      if (item.question.toLowerCase().includes(lowerQuery) || item.answer.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: item.id,
          title: item.question,
          type: 'faq',
          snippet: this.extractSnippet(item.answer, query),
          url: `/faq#${item.id}`,
          relevance: this.calculateRelevance(item.question, item.answer, query)
        });
      }
    });

    // Search static pages
    staticPages.forEach(item => {
      if (item.title.toLowerCase().includes(lowerQuery) || item.content.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: item.id,
          title: item.title,
          type: 'page',
          snippet: this.extractSnippet(item.content, query),
          url: `/${item.slug}`,
          relevance: this.calculateRelevance(item.title, item.content, query)
        });
      }
    });

    return results.sort((a, b) => b.relevance - a.relevance);
  }

  // Helper methods
  private extractSnippet(content: string, query: string, maxLength: number = 150): string {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);
    
    if (index === -1) {
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }
    
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 100);
    
    return (start > 0 ? '...' : '') + 
           content.substring(start, end) + 
           (end < content.length ? '...' : '');
  }

  private calculateRelevance(title: string, content: string, query: string): number {
    const lowerTitle = title.toLowerCase();
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    let score = 0;
    
    // Title matches are worth more
    if (lowerTitle.includes(lowerQuery)) {
      score += 10;
      if (lowerTitle.startsWith(lowerQuery)) score += 5;
    }
    
    // Content matches
    const contentMatches = (lowerContent.match(new RegExp(lowerQuery, 'g')) || []).length;
    score += contentMatches;
    
    return score;
  }

  // Default data generators
  private getDefaultAnnouncements(): Announcement[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'announcement_1',
        title: 'New NEET 2024 Cutoff Data Available',
        content: 'We have updated our database with the latest NEET 2024 cutoff data. Explore the new rankings and find your perfect medical college match!',
        type: 'success',
        priority: 'high',
        targetAudience: 'all',
        status: 'published',
        createdBy: 'admin',
        createdAt: now,
        updatedAt: now,
        tags: ['neet', 'cutoff', '2024'],
        viewCount: 1250,
        dismissible: true,
        sticky: true
      },
      {
        id: 'announcement_2',
        title: 'System Maintenance Scheduled',
        content: 'We will be performing system maintenance on Sunday, 2 AM - 4 AM IST. The platform may be temporarily unavailable during this time.',
        type: 'warning',
        priority: 'medium',
        targetAudience: 'all',
        status: 'published',
        scheduled: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'admin',
        createdAt: now,
        updatedAt: now,
        tags: ['maintenance', 'system'],
        viewCount: 890,
        dismissible: true,
        sticky: false
      }
    ];
  }

  private getDefaultHelpDocs(): HelpDocument[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'help_1',
        title: 'How to Search for Medical Colleges',
        content: '# Searching for Medical Colleges\n\nUse our advanced search feature to find medical colleges that match your preferences...',
        category: 'Getting Started',
        slug: 'how-to-search-colleges',
        status: 'published',
        tags: ['search', 'colleges', 'beginner'],
        searchKeywords: ['search', 'find', 'colleges', 'medical', 'filter'],
        order: 1,
        difficulty: 'beginner',
        estimatedReadTime: 5,
        createdBy: 'admin',
        createdAt: now,
        updatedAt: now,
        viewCount: 2340,
        helpful: 89,
        notHelpful: 12,
        relatedDocs: []
      },
      {
        id: 'help_2',
        title: 'Understanding NEET Cutoff Ranks',
        content: '# NEET Cutoff Ranks Explained\n\nNEET cutoff ranks determine admission eligibility for medical colleges...',
        category: 'NEET Information',
        slug: 'understanding-neet-cutoffs',
        status: 'published',
        tags: ['neet', 'cutoff', 'ranks'],
        searchKeywords: ['neet', 'cutoff', 'rank', 'admission', 'eligibility'],
        order: 1,
        difficulty: 'intermediate',
        estimatedReadTime: 8,
        createdBy: 'admin',
        createdAt: now,
        updatedAt: now,
        viewCount: 1890,
        helpful: 156,
        notHelpful: 23,
        relatedDocs: []
      }
    ];
  }

  private getDefaultFAQs(): FAQ[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'faq_1',
        question: 'How accurate is the cutoff data on NeetLogIQ?',
        answer: 'Our cutoff data is sourced directly from official counseling authorities and is updated regularly. We maintain over 95% accuracy in our database.',
        category: 'General',
        status: 'published',
        order: 1,
        tags: ['accuracy', 'data', 'cutoff'],
        searchKeywords: ['accurate', 'reliable', 'cutoff', 'data'],
        createdBy: 'admin',
        createdAt: now,
        updatedAt: now,
        viewCount: 3450,
        helpful: 234,
        notHelpful: 18,
        relatedFAQs: []
      },
      {
        id: 'faq_2',
        question: 'Can I compare different medical colleges?',
        answer: 'Yes! Use our comparison tool to compare up to 4 colleges side by side. You can compare fees, cutoffs, facilities, and rankings.',
        category: 'Features',
        status: 'published',
        order: 1,
        tags: ['comparison', 'colleges', 'features'],
        searchKeywords: ['compare', 'colleges', 'side by side'],
        createdBy: 'admin',
        createdAt: now,
        updatedAt: now,
        viewCount: 2180,
        helpful: 167,
        notHelpful: 12,
        relatedFAQs: []
      }
    ];
  }

  private getDefaultStaticPages(): StaticPage[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'page_1',
        title: 'About NeetLogIQ',
        slug: 'about',
        content: '# About NeetLogIQ\n\nNeetLogIQ is India\'s premier medical education platform...',
        metaDescription: 'Learn about NeetLogIQ - India\'s leading platform for medical college information and NEET guidance.',
        metaKeywords: ['about', 'neetlogiq', 'medical', 'education'],
        status: 'published',
        template: 'about',
        createdBy: 'admin',
        createdAt: now,
        updatedAt: now,
        seoOptimized: true
      },
      {
        id: 'page_2',
        title: 'Privacy Policy',
        slug: 'privacy',
        content: '# Privacy Policy\n\nYour privacy is important to us...',
        metaDescription: 'NeetLogIQ Privacy Policy - Learn how we protect your personal information.',
        metaKeywords: ['privacy', 'policy', 'data', 'protection'],
        status: 'published',
        template: 'privacy',
        createdBy: 'admin',
        createdAt: now,
        updatedAt: now,
        seoOptimized: true
      }
    ];
  }

  private getDefaultCategories(): ContentCategory[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'category_1',
        name: 'Getting Started',
        description: 'Basic guides to help you get started with NeetLogIQ',
        type: 'help',
        slug: 'getting-started',
        color: '#3B82F6',
        icon: 'play-circle',
        order: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'category_2',
        name: 'NEET Information',
        description: 'Everything about NEET exam and counseling',
        type: 'help',
        slug: 'neet-information',
        color: '#10B981',
        icon: 'academic-cap',
        order: 2,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'category_3',
        name: 'General',
        description: 'General questions about the platform',
        type: 'faq',
        slug: 'general',
        color: '#6B7280',
        icon: 'question-mark-circle',
        order: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'category_4',
        name: 'Features',
        description: 'Questions about platform features',
        type: 'faq',
        slug: 'features',
        color: '#8B5CF6',
        icon: 'sparkles',
        order: 2,
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ];
  }
}

// Export singleton instance
export const contentManagementService = new ContentManagementService();