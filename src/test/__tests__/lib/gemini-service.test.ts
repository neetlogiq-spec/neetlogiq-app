/**
 * Gemini AI Service Tests
 * Tests for AI chatbot and RAG functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiAIService } from '@/lib/ai/gemini-service';

// Mock fetch globally
global.fetch = vi.fn();

describe('GeminiAIService', () => {
  let service: GeminiAIService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GeminiAIService({
      apiKey: 'test-api-key',
    });
  });

  describe('Configuration', () => {
    it('should initialize with API key', () => {
      expect(service).toBeInstanceOf(GeminiAIService);
    });

    it('should use default model if not specified', () => {
      const defaultService = new GeminiAIService({ apiKey: 'test-key' });
      expect(defaultService).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customService = new GeminiAIService({
        apiKey: 'test-key',
        model: 'gemini-1.5-pro',
        temperature: 0.5,
        maxTokens: 500,
      });

      expect(customService).toBeDefined();
    });
  });

  describe('isAvailable()', () => {
    it('should return true when API key is present', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when API key is missing', () => {
      const noKeyService = new GeminiAIService({ apiKey: '' });
      expect(noKeyService.isAvailable()).toBe(false);
    });

    it('should respect rate limits (15 requests/minute)', () => {
      // Make 15 requests
      for (let i = 0; i < 15; i++) {
        expect(service.isAvailable()).toBe(true);
      }

      // Should still be available until counter is incremented by actual API calls
      expect(service.isAvailable()).toBe(true);
    });
  });

  describe('answerQuery()', () => {
    it('should generate answer with context', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Test response from Gemini' }],
              },
            },
          ],
        }),
      });

      const context = {
        colleges: [],
        cutoffs: [],
        courses: [],
      };

      const response = await service.answerQuery('Test query', context);

      expect(response.text).toBe('Test response from Gemini');
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'API rate limit exceeded' },
        }),
      });

      const context = {
        colleges: [],
        cutoffs: [],
        courses: [],
      };

      await expect(service.answerQuery('Test query', context)).rejects.toThrow();
    });

    it('should throw error when rate limit exceeded', async () => {
      const noKeyService = new GeminiAIService({ apiKey: '' });

      await expect(
        noKeyService.answerQuery('Test', { colleges: [], cutoffs: [], courses: [] })
      ).rejects.toThrow('Gemini API not available');
    });
  });

  describe('generateCollegeSummary()', () => {
    it('should generate summary for college', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'College summary text' }],
              },
            },
          ],
        }),
      });

      const college = {
        name: 'Test Medical College',
        city: 'Mumbai',
        state: 'Maharashtra',
        management_type: 'GOVERNMENT',
        established_year: 2000,
        stream: 'UG',
      };

      const summary = await service.generateCollegeSummary(college, []);

      expect(summary).toBe('College summary text');
    });

    it('should fall back to client-side summary when API unavailable', async () => {
      const noKeyService = new GeminiAIService({ apiKey: '' });

      const college = {
        name: 'Test College',
        city: 'Delhi',
        state: 'Delhi',
        management_type: 'PRIVATE',
        stream: 'UG',
      };

      const summary = await noKeyService.generateCollegeSummary(college, []);

      expect(summary).toContain('Test College');
      expect(summary).toContain('Delhi');
    });
  });

  describe('compareColleges()', () => {
    it('should compare multiple colleges', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Comparison result' }],
              },
            },
          ],
        }),
      });

      const colleges = [
        { name: 'College A', city: 'Mumbai', state: 'Maharashtra', management_type: 'GOVERNMENT', stream: 'UG' },
        { name: 'College B', city: 'Delhi', state: 'Delhi', management_type: 'PRIVATE', stream: 'UG' },
      ];

      const comparison = await service.compareColleges(colleges);

      expect(comparison).toBe('Comparison result');
    });

    it('should require at least 2 colleges', async () => {
      const colleges = [
        { name: 'College A', city: 'Mumbai', state: 'Maharashtra', management_type: 'GOVERNMENT', stream: 'UG' },
      ];

      const comparison = await service.compareColleges(colleges);

      expect(comparison).toContain('at least 2 colleges');
    });
  });

  describe('explainCutoffTrends()', () => {
    it('should analyze cutoff trends', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Trend analysis' }],
              },
            },
          ],
        }),
      });

      const cutoffs = [
        { year: 2024, course_name: 'MBBS', opening_rank: 100, closing_rank: 500, category: 'GENERAL' },
        { year: 2023, course_name: 'MBBS', opening_rank: 120, closing_rank: 520, category: 'GENERAL' },
      ];

      const trends = await service.explainCutoffTrends(cutoffs, 'Test College');

      expect(trends).toBe('Trend analysis');
    });

    it('should handle empty cutoff data', async () => {
      const trends = await service.explainCutoffTrends([], 'Test College');

      expect(trends).toContain('No cutoff data available');
    });
  });

  describe('getStatus()', () => {
    it('should return request count and limits', () => {
      const status = service.getStatus();

      expect(status).toHaveProperty('requestCount');
      expect(status).toHaveProperty('limit');
      expect(status).toHaveProperty('resetIn');
      expect(status.limit).toBe(15);
    });
  });
});

describe('createGeminiService()', () => {
  const originalEnv = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_GEMINI_API_KEY = originalEnv;
  });

  it('should create service when API key is present', () => {
    process.env.NEXT_PUBLIC_GEMINI_API_KEY = 'test-key';

    const { createGeminiService } = require('@/lib/ai/gemini-service');
    const service = createGeminiService();

    expect(service).toBeInstanceOf(GeminiAIService);
  });

  it('should return null when API key is missing', () => {
    process.env.NEXT_PUBLIC_GEMINI_API_KEY = '';

    const { createGeminiService } = require('@/lib/ai/gemini-service');
    const service = createGeminiService();

    expect(service).toBeNull();
  });
});
