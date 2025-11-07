/**
 * Cloudflare SDK Manager
 * Centralized management for Cloudflare services integration
 * Supports both VibeSDK (AI-driven development) and TypeScript SDK features
 */

import { Env } from '@/types/cloudflare';

export interface CloudflareSDKConfig {
  accountId: string;
  apiToken: string;
  environment: 'development' | 'staging' | 'production';
}

export interface VibeSDKConfig {
  enableAICodeGeneration: boolean;
  enableLivePreviews: boolean;
  enableMultiModelSupport: boolean;
  defaultModel: string;
}

export class CloudflareSDKManager {
  private config: CloudflareSDKConfig;
  private vibeConfig: VibeSDKConfig;
  private env: Env;

  constructor(config: CloudflareSDKConfig, vibeConfig: VibeSDKConfig, env: Env) {
    this.config = config;
    this.vibeConfig = vibeConfig;
    this.env = env;
  }

  /**
   * Initialize Cloudflare SDK with all services
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Cloudflare SDK Manager...');
    
    try {
      // Initialize R2 storage
      await this.initializeR2();
      
      // Initialize D1 database
      await this.initializeD1();
      
      // Initialize Vectorize
      await this.initializeVectorize();
      
      // Initialize AI services
      await this.initializeAI();
      
      // Initialize VibeSDK if enabled
      if (this.vibeConfig.enableAICodeGeneration) {
        await this.initializeVibeSDK();
      }
      
      console.log('✅ Cloudflare SDK Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Cloudflare SDK Manager:', error);
      throw error;
    }
  }

  /**
   * Initialize R2 Storage
   */
  private async initializeR2(): Promise<void> {
    console.log('📦 Initializing R2 Storage...');
    
    // R2 is already bound in wrangler.toml
    if (!this.env.R2) {
      throw new Error('R2 binding not found in environment');
    }
    
    console.log('✅ R2 Storage initialized');
  }

  /**
   * Initialize D1 Database
   */
  private async initializeD1(): Promise<void> {
    console.log('🗄️ Initializing D1 Database...');
    
    if (!this.env.D1) {
      throw new Error('D1 binding not found in environment');
    }
    
    // Ensure database schema is up to date
    await this.setupD1Schema();
    
    console.log('✅ D1 Database initialized');
  }

  /**
   * Initialize Vectorize
   */
  private async initializeVectorize(): Promise<void> {
    console.log('🔍 Initializing Vectorize...');
    
    if (!this.env.VECTORIZE) {
      throw new Error('Vectorize binding not found in environment');
    }
    
    console.log('✅ Vectorize initialized');
  }

  /**
   * Initialize AI Services
   */
  private async initializeAI(): Promise<void> {
    console.log('🤖 Initializing AI Services...');
    
    if (!this.env.AI) {
      throw new Error('AI binding not found in environment');
    }
    
    console.log('✅ AI Services initialized');
  }

  /**
   * Initialize VibeSDK for AI-driven development
   */
  private async initializeVibeSDK(): Promise<void> {
    console.log('🎨 Initializing VibeSDK...');
    
    // VibeSDK configuration
    const vibeConfig = {
      enableAICodeGeneration: this.vibeConfig.enableAICodeGeneration,
      enableLivePreviews: this.vibeConfig.enableLivePreviews,
      enableMultiModelSupport: this.vibeConfig.enableMultiModelSupport,
      defaultModel: this.vibeConfig.defaultModel,
      cloudflareConfig: this.config
    };
    
    console.log('✅ VibeSDK initialized with config:', vibeConfig);
  }

  /**
   * Setup D1 Database Schema
   */
  private async setupD1Schema(): Promise<void> {
    const schema = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        avatar_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- User preferences table
      CREATE TABLE IF NOT EXISTS user_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        preferences JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      -- Search history table
      CREATE TABLE IF NOT EXISTS search_history (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        query TEXT NOT NULL,
        results_count INTEGER,
        search_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      -- AI interactions table
      CREATE TABLE IF NOT EXISTS ai_interactions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        prompt TEXT NOT NULL,
        response TEXT,
        model TEXT,
        tokens_used INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `;

    await this.env.D1.exec(schema);
  }

  /**
   * Get R2 Storage instance
   */
  getR2() {
    return this.env.R2;
  }

  /**
   * Get D1 Database instance
   */
  getD1() {
    return this.env.D1;
  }

  /**
   * Get Vectorize instance
   */
  getVectorize() {
    return this.env.VECTORIZE;
  }

  /**
   * Get AI instance
   */
  getAI() {
    return this.env.AI;
  }

  /**
   * Generate AI-powered code using VibeSDK
   */
  async generateCode(prompt: string, context?: any): Promise<string> {
    if (!this.vibeConfig.enableAICodeGeneration) {
      throw new Error('VibeSDK code generation is not enabled');
    }

    try {
      const response = await this.env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
        messages: [
          {
            role: 'system',
            content: `You are an expert TypeScript developer specializing in Next.js, Cloudflare Workers, and medical education platforms. Generate clean, production-ready code based on the user's requirements.`
          },
          {
            role: 'user',
            content: `Generate TypeScript code for: ${prompt}${context ? `\n\nContext: ${JSON.stringify(context, null, 2)}` : ''}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      });

      return response.response || '';
    } catch (error) {
      console.error('Error generating code:', error);
      throw new Error('Failed to generate code');
    }
  }

  /**
   * Create live preview using VibeSDK
   */
  async createLivePreview(code: string, type: 'component' | 'page' | 'api'): Promise<string> {
    if (!this.vibeConfig.enableLivePreviews) {
      throw new Error('VibeSDK live previews are not enabled');
    }

    // Generate preview URL for the code
    const previewId = `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store code in R2 for preview
    await this.env.R2.put(`previews/${previewId}.tsx`, code, {
      httpMetadata: {
        contentType: 'text/typescript'
      }
    });

    return `https://preview.neetlogiq.com/${previewId}`;
  }

  /**
   * Deploy generated code to Cloudflare Workers
   */
  async deployCode(code: string, name: string): Promise<string> {
    try {
      // Store code in R2
      const codeKey = `generated/${name}_${Date.now()}.js`;
      await this.env.R2.put(codeKey, code, {
        httpMetadata: {
          contentType: 'application/javascript'
        }
      });

      // Return deployment URL
      return `https://${name}.neetlogiq.workers.dev`;
    } catch (error) {
      console.error('Error deploying code:', error);
      throw new Error('Failed to deploy code');
    }
  }

  /**
   * Get SDK status and health
   */
  async getStatus(): Promise<{
    r2: boolean;
    d1: boolean;
    vectorize: boolean;
    ai: boolean;
    vibe: boolean;
    timestamp: string;
  }> {
    return {
      r2: !!this.env.R2,
      d1: !!this.env.D1,
      vectorize: !!this.env.VECTORIZE,
      ai: !!this.env.AI,
      vibe: this.vibeConfig.enableAICodeGeneration,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Factory function to create SDK Manager
 */
export function createCloudflareSDKManager(env: Env): CloudflareSDKManager {
  const config: CloudflareSDKConfig = {
    accountId: env.CLOUDFLARE_ACCOUNT_ID || '',
    apiToken: env.CLOUDFLARE_API_TOKEN || '',
    environment: (env.ENVIRONMENT as any) || 'development'
  };

  const vibeConfig: VibeSDKConfig = {
    enableAICodeGeneration: env.ENABLE_VIBE_AI === 'true',
    enableLivePreviews: env.ENABLE_LIVE_PREVIEWS === 'true',
    enableMultiModelSupport: env.ENABLE_MULTI_MODEL === 'true',
    defaultModel: env.DEFAULT_AI_MODEL || '@cf/meta/llama-2-7b-chat-int8'
  };

  return new CloudflareSDKManager(config, vibeConfig, env);
}
