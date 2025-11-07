/**
 * Enhanced VibeSDK Integration Service
 * Full integration with official Cloudflare VibeSDK
 * Based on: https://github.com/cloudflare/vibesdk
 */

import { CloudflareSDKManager } from './sdk-manager';
import { 
  VibeApp, 
  VibeGenerationRequest, 
  VibeGenerationResponse, 
  VibeLivePreview,
  MedicalCollege,
  MedicalCourse,
  NEETCutoff
} from '@/types/cloudflare';

export class EnhancedVibeSDKService {
  private sdkManager: CloudflareSDKManager;
  private baseUrl: string;

  constructor(sdkManager: CloudflareSDKManager, baseUrl: string = 'https://vibesdk.neetlogiq.workers.dev') {
    this.sdkManager = sdkManager;
    this.baseUrl = baseUrl;
  }

  /**
   * Generate a complete medical education application
   */
  async generateMedicalApp(request: VibeGenerationRequest): Promise<VibeGenerationResponse> {
    const enhancedPrompt = this.buildMedicalAppPrompt(request);
    
    try {
      // Use VibeSDK's AI generation pipeline
      const response = await this.callVibeAPI('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: enhancedPrompt,
          framework: request.framework || 'nextjs',
          features: request.features || ['typescript', 'tailwind', 'responsive'],
          style: request.style || 'production',
          includeTests: request.includeTests || true,
          includeDocumentation: request.includeDocumentation || true,
          context: {
            ...request.context,
            domain: 'medical-education',
            platform: 'neetlogiq'
          }
        })
      });

      const app: VibeApp = response.app;
      
      // Create live preview
      const previewUrl = await this.createLivePreview(app);
      
      // Deploy if requested
      let deploymentUrl: string | undefined;
      if (request.style === 'production') {
        deploymentUrl = await this.deployApp(app);
      }

      return {
        app,
        code: app.code,
        previewUrl,
        deploymentUrl,
        metadata: {
          tokensUsed: response.metadata?.tokensUsed || 0,
          model: response.metadata?.model || 'llama-2-7b-chat-int8',
          generationTime: response.metadata?.generationTime || 0,
          confidence: response.metadata?.confidence || 0.8,
          phases: response.metadata?.phases || ['planning', 'foundation', 'core', 'styling', 'integration']
        }
      };
    } catch (error) {
      console.error('VibeSDK generation failed:', error);
      throw new Error(`App generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate medical education specific components
   */
  async generateMedicalComponent(
    componentType: 'college-card' | 'course-card' | 'cutoff-table' | 'search-interface' | 'analytics-dashboard',
    data?: MedicalCollege[] | MedicalCourse[] | NEETCutoff[],
    options?: {
      styling?: 'tailwind' | 'custom';
      interactions?: string[];
      accessibility?: boolean;
      responsive?: boolean;
    }
  ): Promise<VibeGenerationResponse> {
    const prompt = this.buildMedicalComponentPrompt(componentType, data, options);
    
    return await this.generateMedicalApp({
      prompt,
      framework: 'nextjs',
      features: ['typescript', 'tailwind', 'responsive', 'accessibility'],
      style: 'production',
      includeTests: true,
      includeDocumentation: true,
      context: {
        type: 'component',
        data: data ? JSON.stringify(data.slice(0, 5)) : undefined, // Sample data
        options
      }
    });
  }

  /**
   * Generate API endpoints for medical data
   */
  async generateMedicalAPI(
    endpointType: 'colleges' | 'courses' | 'cutoffs' | 'search' | 'analytics',
    requirements?: {
      dataSource?: 'duckdb' | 'r2' | 'd1';
      filters?: string[];
      pagination?: boolean;
      caching?: boolean;
      authentication?: boolean;
    }
  ): Promise<VibeGenerationResponse> {
    const prompt = this.buildMedicalAPIPrompt(endpointType, requirements);
    
    return await this.generateMedicalApp({
      prompt,
      framework: 'nextjs',
      features: ['typescript', 'cloudflare-workers', 'duckdb', 'authentication'],
      style: 'production',
      includeTests: true,
      includeDocumentation: true,
      context: {
        type: 'api',
        requirements,
        platform: 'neetlogiq'
      }
    });
  }

  /**
   * Create live preview using VibeSDK's sandbox
   */
  async createLivePreview(app: VibeApp): Promise<string> {
    try {
      const response = await this.callVibeAPI('/api/preview', {
        method: 'POST',
        body: JSON.stringify({
          appId: app.id,
          code: app.code,
          framework: app.framework
        })
      });

      return response.previewUrl;
    } catch (error) {
      console.error('Live preview creation failed:', error);
      throw new Error(`Preview creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deploy app using VibeSDK's deployment system
   */
  async deployApp(app: VibeApp): Promise<string> {
    try {
      const response = await this.callVibeAPI('/api/deploy', {
        method: 'POST',
        body: JSON.stringify({
          appId: app.id,
          code: app.code,
          framework: app.framework,
          name: app.name
        })
      });

      return response.deploymentUrl;
    } catch (error) {
      console.error('App deployment failed:', error);
      throw new Error(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List user's generated apps
   */
  async listApps(userId?: string): Promise<VibeApp[]> {
    try {
      const response = await this.callVibeAPI('/api/apps', {
        method: 'GET',
        headers: {
          ...(userId && { 'X-User-ID': userId })
        }
      });

      return response.apps || [];
    } catch (error) {
      console.error('Failed to list apps:', error);
      return [];
    }
  }

  /**
   * Get app details
   */
  async getApp(appId: string): Promise<VibeApp | null> {
    try {
      const response = await this.callVibeAPI(`/api/apps/${appId}`, {
        method: 'GET'
      });

      return response.app || null;
    } catch (error) {
      console.error('Failed to get app:', error);
      return null;
    }
  }

  /**
   * Update app
   */
  async updateApp(appId: string, updates: Partial<VibeApp>): Promise<VibeApp> {
    try {
      const response = await this.callVibeAPI(`/api/apps/${appId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });

      return response.app;
    } catch (error) {
      console.error('Failed to update app:', error);
      throw new Error(`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete app
   */
  async deleteApp(appId: string): Promise<boolean> {
    try {
      await this.callVibeAPI(`/api/apps/${appId}`, {
        method: 'DELETE'
      });

      return true;
    } catch (error) {
      console.error('Failed to delete app:', error);
      return false;
    }
  }

  /**
   * Fork an existing app
   */
  async forkApp(appId: string, userId: string): Promise<VibeApp> {
    try {
      const response = await this.callVibeAPI(`/api/apps/${appId}/fork`, {
        method: 'POST',
        body: JSON.stringify({ userId })
      });

      return response.app;
    } catch (error) {
      console.error('Failed to fork app:', error);
      throw new Error(`Fork failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Star/unstar an app
   */
  async toggleStar(appId: string, userId: string): Promise<{ starred: boolean; stars: number }> {
    try {
      const response = await this.callVibeAPI(`/api/apps/${appId}/star`, {
        method: 'POST',
        body: JSON.stringify({ userId })
      });

      return response;
    } catch (error) {
      console.error('Failed to toggle star:', error);
      throw new Error(`Star toggle failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get app analytics
   */
  async getAppAnalytics(appId: string): Promise<any> {
    try {
      const response = await this.callVibeAPI(`/api/apps/${appId}/analytics`, {
        method: 'GET'
      });

      return response.analytics;
    } catch (error) {
      console.error('Failed to get app analytics:', error);
      return null;
    }
  }

  /**
   * Build medical app specific prompt
   */
  private buildMedicalAppPrompt(request: VibeGenerationRequest): string {
    let prompt = request.prompt;
    
    // Add medical education context
    prompt += '\n\nThis is for a medical education platform (NeetLogIQ) that helps students find:';
    prompt += '\n- Medical colleges and courses';
    prompt += '\n- NEET cutoff data and rankings';
    prompt += '\n- Admission guidance and analytics';
    prompt += '\n- AI-powered search and recommendations';
    
    // Add technical context
    prompt += '\n\nTechnical requirements:';
    prompt += '\n- Use TypeScript for type safety';
    prompt += '\n- Use Tailwind CSS for styling';
    prompt += '\n- Make it responsive and accessible';
    prompt += '\n- Include proper error handling';
    prompt += '\n- Follow React best practices';
    
    // Add data context
    if (request.context?.data) {
      prompt += `\n\nSample data structure:\n${request.context.data}`;
    }
    
    return prompt;
  }

  /**
   * Build medical component specific prompt
   */
  private buildMedicalComponentPrompt(
    componentType: string,
    data?: any[],
    options?: any
  ): string {
    const basePrompts = {
      'college-card': 'Create a college card component for displaying medical college information including name, location, type, management, and key statistics. Include features like favoriting, comparison, and detailed view.',
      'course-card': 'Create a course card component for displaying medical course details including specialization, duration, seats, fees, and requirements. Include enrollment and comparison features.',
      'cutoff-table': 'Create a cutoff table component for displaying NEET cutoff data with sorting, filtering, and search capabilities. Include year-over-year comparison and trend analysis.',
      'search-interface': 'Create a search interface component for medical education data with advanced filters, real-time suggestions, and result management. Include saved searches and search history.',
      'analytics-dashboard': 'Create an analytics dashboard component for displaying medical education statistics, trends, and insights. Include charts, graphs, and interactive visualizations.'
    };
    
    let prompt = basePrompts[componentType as keyof typeof basePrompts] || 'Create a medical education component';
    
    if (options?.styling === 'tailwind') {
      prompt += ' using Tailwind CSS for modern, responsive styling';
    }
    
    if (options?.interactions?.length) {
      prompt += ` with interactions: ${options.interactions.join(', ')}`;
    }
    
    if (options?.accessibility) {
      prompt += ' with full accessibility support (ARIA labels, keyboard navigation, screen reader support)';
    }
    
    if (options?.responsive) {
      prompt += ' with responsive design for mobile, tablet, and desktop';
    }
    
    if (data?.length) {
      prompt += `\n\nSample data (${data.length} records):\n${JSON.stringify(data.slice(0, 3), null, 2)}`;
    }
    
    return prompt;
  }

  /**
   * Build medical API specific prompt
   */
  private buildMedicalAPIPrompt(endpointType: string, requirements?: any): string {
    const basePrompts = {
      'colleges': 'Create an API endpoint for medical colleges data with search, filtering by state/type/management, and pagination. Include college details, statistics, and related courses.',
      'courses': 'Create an API endpoint for medical courses data with filtering by specialization, duration, and college. Include course details, requirements, and cutoff information.',
      'cutoffs': 'Create an API endpoint for NEET cutoff data with year-based filtering, ranking, and trend analysis. Include college and course relationships.',
      'search': 'Create a unified search API endpoint for medical education data across colleges, courses, and cutoffs. Include semantic search and AI-powered recommendations.',
      'analytics': 'Create an analytics API endpoint for medical education statistics, trends, and insights. Include user behavior, search patterns, and performance metrics.'
    };
    
    let prompt = basePrompts[endpointType as keyof typeof basePrompts] || 'Create a medical education API endpoint';
    
    if (requirements?.dataSource) {
      prompt += ` using ${requirements.dataSource} as the data source`;
    }
    
    if (requirements?.filters?.length) {
      prompt += ` with filters: ${requirements.filters.join(', ')}`;
    }
    
    if (requirements?.pagination) {
      prompt += ' with pagination support';
    }
    
    if (requirements?.caching) {
      prompt += ' with caching for performance optimization';
    }
    
    if (requirements?.authentication) {
      prompt += ' with JWT authentication and user authorization';
    }
    
    return prompt;
  }

  /**
   * Call VibeSDK API
   */
  private async callVibeAPI(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.sdkManager.getAI()}`,
        ...options.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`VibeSDK API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }
}

/**
 * Factory function to create Enhanced VibeSDK Service
 */
export function createEnhancedVibeSDKService(
  sdkManager: CloudflareSDKManager,
  baseUrl?: string
): EnhancedVibeSDKService {
  return new EnhancedVibeSDKService(sdkManager, baseUrl);
}
