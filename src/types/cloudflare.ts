/**
 * Cloudflare Workers Environment Types
 * Defines the environment bindings for Cloudflare Workers
 */

export interface Env {
  // R2 Storage
  R2: R2Bucket;
  
  // D1 Database
  D1: D1Database;
  
  // Vectorize
  VECTORIZE: VectorizeIndex;
  
  // AI
  AI: Ai;
  
  // Analytics
  ANALYTICS: AnalyticsEngineDataset;
  
  // Environment Variables
  ENVIRONMENT: string;
  CACHE_TTL: string;
  SEARCH_LIMIT: string;
  COMPARISON_LIMIT: string;
  
  // Cloudflare Account
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  
  // VibeSDK Configuration
  ENABLE_VIBE_AI?: string;
  ENABLE_LIVE_PREVIEWS?: string;
  ENABLE_MULTI_MODEL?: string;
  DEFAULT_AI_MODEL?: string;
  
  // AI Gateway
  CLOUDFLARE_AI_GATEWAY_TOKEN?: string;
  CLOUDFLARE_AI_GATEWAY_URL?: string;
  
  // Model API Keys
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GOOGLE_AI_STUDIO_API_KEY?: string;
  
  // JWT
  JWT_SECRET?: string;
  
  // GitHub
  GITHUB_TOKEN?: string;
  GITHUB_APP_ID?: string;
  GITHUB_PRIVATE_KEY?: string;
  
  // Sentry
  SENTRY_DSN?: string;
  
  // Other
  MAX_SANDBOX_INSTANCES?: string;
  SANDBOX_INSTANCE_TYPE?: string;
}

/**
 * VibeSDK Types
 */
export interface VibeApp {
  id: string;
  name: string;
  description: string;
  prompt: string;
  code: string;
  status: 'generating' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  userId: string;
  visibility: 'public' | 'private';
  stars: number;
  forks: number;
  tags: string[];
  framework: 'nextjs' | 'react' | 'vue' | 'svelte';
  deploymentUrl?: string;
  previewUrl?: string;
}

export interface VibeGenerationRequest {
  prompt: string;
  framework?: 'nextjs' | 'react' | 'vue' | 'svelte';
  features?: string[];
  style?: 'minimal' | 'comprehensive' | 'production';
  includeTests?: boolean;
  includeDocumentation?: boolean;
  context?: any;
}

export interface VibeGenerationResponse {
  app: VibeApp;
  code: string;
  previewUrl?: string;
  deploymentUrl?: string;
  metadata: {
    tokensUsed: number;
    model: string;
    generationTime: number;
    confidence: number;
    phases: string[];
  };
}

export interface VibeLivePreview {
  id: string;
  appId: string;
  code: string;
  url: string;
  status: 'building' | 'ready' | 'error';
  createdAt: string;
  expiresAt: string;
}

/**
 * Cloudflare SDK Response Types
 */
export interface CloudflareResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: {
    timestamp: string;
    requestId: string;
    duration: number;
  };
}

/**
 * Medical Education Data Types
 */
export interface MedicalCollege {
  id: string;
  name: string;
  state: string;
  city: string;
  type: 'MEDICAL' | 'DENTAL' | 'DNB';
  management: 'GOVERNMENT' | 'PRIVATE';
  establishedYear: number;
  website?: string;
  email?: string;
  phone?: string;
  address: string;
  pincode?: string;
  accreditation?: string;
  status: 'ACTIVE' | 'INACTIVE';
  universityAffiliation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicalCourse {
  id: string;
  name: string;
  specialization: string;
  level: 'UNDERGRADUATE' | 'POSTGRADUATE' | 'DIPLOMA' | 'CERTIFICATE';
  duration: number;
  totalSeats: number;
  feeStructure: string;
  entranceExam: string;
  collegeId: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface NEETCutoff {
  id: string;
  collegeId: string;
  courseId: string;
  year: number;
  round: string;
  authority: string;
  quota: string;
  category: string;
  openingRank: number;
  closingRank: number;
  openingScore: number;
  closingScore: number;
  scoreType: string;
  scoreUnit: string;
  seatsAvailable: number;
  seatsFilled: number;
  seatType: string;
  sourceUrl?: string;
  confidenceScore: number;
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

/**
 * Search and Filter Types
 */
export interface SearchFilters {
  query?: string;
  state?: string;
  city?: string;
  type?: string;
  management?: string;
  year?: number;
  category?: string;
  round?: string;
  degree_type?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface SearchResult<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * AI Integration Types
 */
export interface AIRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  options?: {
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
  };
}

export interface AIResponse {
  response: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
}

/**
 * Analytics Types
 */
export interface AnalyticsEvent {
  id: string;
  userId?: string;
  event: string;
  properties: Record<string, any>;
  timestamp: string;
  sessionId?: string;
}

export interface UserAnalytics {
  userId: string;
  totalSearches: number;
  totalGenerations: number;
  totalApps: number;
  favoriteApps: number;
  lastActive: string;
  createdAt: string;
}

/**
 * API Response Types
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Error Types
 */
export interface CloudflareError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

/**
 * Configuration Types
 */
export interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  environment: 'development' | 'staging' | 'production';
  region?: string;
}

export interface VibeConfig {
  enableAICodeGeneration: boolean;
  enableLivePreviews: boolean;
  enableMultiModelSupport: boolean;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
  sandboxInstanceType: 'dev' | 'basic' | 'standard' | 'enhanced';
  maxSandboxInstances: number;
}
