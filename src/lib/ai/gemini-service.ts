/**
 * GeminiAIService (Optional Enhancement)
 *
 * Integration with Google Gemini API for advanced natural language queries
 * NOTE: This is OPTIONAL. ClientAIEngine provides free client-side AI.
 *       Use this only for complex queries that need better NLP understanding.
 *
 * Free Tier: 15 requests/minute (more than enough for most use cases)
 *
 * Setup:
 * 1. Get API key from https://makersuite.google.com/app/apikey
 * 2. Add to .env.local: NEXT_PUBLIC_GEMINI_API_KEY=your_key
 * 3. Enable in chatbot settings (optional)
 */

import { College, Course, Cutoff } from '@/services/UnifiedDataService';

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GeminiResponse {
  text: string;
  tokensUsed?: number;
  model?: string;
}

export class GeminiAIService {
  private config: GeminiConfig;
  private requestCount: number = 0;
  private resetTime: number = Date.now() + 60000; // Reset every minute

  constructor(config: GeminiConfig) {
    this.config = {
      model: 'gemini-1.5-flash', // Free tier model
      temperature: 0.7,
      maxTokens: 1000,
      ...config
    };
  }

  /**
   * Check if API is available and within rate limits
   */
  isAvailable(): boolean {
    // Reset counter every minute
    if (Date.now() > this.resetTime) {
      this.requestCount = 0;
      this.resetTime = Date.now() + 60000;
    }

    // Free tier: 15 requests/minute
    return this.requestCount < 15 && !!this.config.apiKey;
  }

  /**
   * Answer user query with context
   */
  async answerQuery(
    query: string,
    context: {
      colleges: College[];
      cutoffs: Cutoff[];
      courses: Course[];
    }
  ): Promise<GeminiResponse> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API not available or rate limit exceeded. Using client-side AI instead.');
    }

    try {
      this.requestCount++;

      const prompt = this.buildPrompt(query, context);
      const response = await this.callGeminiAPI(prompt);

      return {
        text: response,
        model: this.config.model
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  /**
   * Generate college summary
   */
  async generateCollegeSummary(college: College, cutoffs: Cutoff[]): Promise<string> {
    if (!this.isAvailable()) {
      return this.generateClientSideSummary(college, cutoffs);
    }

    try {
      this.requestCount++;

      const prompt = `
Summarize this medical college in 2-3 concise sentences for a prospective student:

**College:** ${college.name}
**Location:** ${college.city}, ${college.state}
**Type:** ${college.management_type}
**Established:** ${college.established_year || 'N/A'}
**Stream:** ${college.stream}

${cutoffs.length > 0 ? `**Recent Cutoffs:**
${cutoffs.slice(0, 5).map(c => `- ${c.course_name}: Closing rank ${c.closing_rank} (${c.category})`).join('\n')}` : ''}

Highlight key strengths and admission prospects. Be specific and student-friendly.
`;

      return await this.callGeminiAPI(prompt);
    } catch (error) {
      console.error('Error generating summary:', error);
      return this.generateClientSideSummary(college, cutoffs);
    }
  }

  /**
   * Compare multiple colleges
   */
  async compareColleges(colleges: College[]): Promise<string> {
    if (!this.isAvailable() || colleges.length < 2) {
      return this.generateClientSideComparison(colleges);
    }

    try {
      this.requestCount++;

      const prompt = `
Compare these ${colleges.length} medical colleges for a student making an admission decision:

${colleges.map((c, idx) => `
**${idx + 1}. ${c.name}**
- Location: ${c.city}, ${c.state}
- Type: ${c.management_type}
- Established: ${c.established_year || 'N/A'}
${c.nirf_ranking ? `- NIRF Rank: ${c.nirf_ranking}` : ''}
`).join('\n')}

Provide a structured comparison focusing on:
1. Academic reputation
2. Fee structure
3. Location advantages
4. Admission difficulty

Keep it concise and actionable.
`;

      return await this.callGeminiAPI(prompt);
    } catch (error) {
      console.error('Error comparing colleges:', error);
      return this.generateClientSideComparison(colleges);
    }
  }

  /**
   * Explain cutoff trends
   */
  async explainCutoffTrends(cutoffs: Cutoff[], collegeName: string): Promise<string> {
    if (!this.isAvailable() || cutoffs.length === 0) {
      return this.generateClientSideTrendAnalysis(cutoffs, collegeName);
    }

    try {
      this.requestCount++;

      const prompt = `
Analyze the cutoff trends for ${collegeName}:

${cutoffs.map(c => `${c.year} - ${c.course_name}: Opening ${c.opening_rank}, Closing ${c.closing_rank} (${c.category})`).join('\n')}

Provide insights on:
1. Trend direction (increasing/decreasing/stable)
2. Expected 2025 cutoffs
3. Advice for students

Be specific and data-driven. Max 4 sentences.
`;

      return await this.callGeminiAPI(prompt);
    } catch (error) {
      console.error('Error analyzing trends:', error);
      return this.generateClientSideTrendAnalysis(cutoffs, collegeName);
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Build prompt for Gemini API
   */
  private buildPrompt(
    query: string,
    context: { colleges: College[]; cutoffs: Cutoff[]; courses: Course[] }
  ): string {
    return `
You are an expert medical education counselor helping students with college admissions in India.

**Student Question:** ${query}

**Available Context:**

**Top Colleges (${context.colleges.length} total):**
${context.colleges.slice(0, 10).map(c => `- ${c.name}, ${c.state} (${c.management_type})`).join('\n')}

**Recent Cutoffs (${context.cutoffs.length} data points):**
${context.cutoffs.slice(0, 20).map(c => `- ${c.college_name || c.college}: ${c.course_name || c.course} - Rank ${c.closing_rank} (${c.category}, ${c.year})`).join('\n')}

**Available Courses (${context.courses.length} total):**
${context.courses.slice(0, 10).map(c => `- ${c.name || c.course_name} (${c.stream || 'N/A'})`).join('\n')}

**Instructions:**
1. Provide accurate, helpful answers based on the data above
2. If data is insufficient, acknowledge it and provide general guidance
3. Use bullet points for clarity
4. Be encouraging but realistic
5. Mention specific colleges/courses when relevant
6. Keep response under 200 words

Respond in a friendly, professional tone:
`;
  }

  /**
   * Call Gemini API
   */
  private async callGeminiAPI(prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || 'No response generated';
  }

  // ============================================================================
  // CLIENT-SIDE FALLBACKS (When API unavailable)
  // ============================================================================

  /**
   * Generate summary without API (fallback)
   */
  private generateClientSideSummary(college: College, cutoffs: Cutoff[]): string {
    let summary = `${college.name} is a ${college.management_type.toLowerCase()} ${college.stream.toLowerCase()} institution located in ${college.city}, ${college.state}.`;

    if (college.established_year) {
      const age = new Date().getFullYear() - college.established_year;
      summary += ` Established in ${college.established_year} (${age}+ years of experience).`;
    }

    if (cutoffs.length > 0) {
      const avgClosing = cutoffs.reduce((sum, c) => sum + c.closing_rank, 0) / cutoffs.length;
      summary += ` Recent average closing rank: ${Math.round(avgClosing)}.`;
    }

    if (college.management_type === 'GOVERNMENT') {
      summary += ' Offers affordable education with excellent facilities.';
    }

    return summary;
  }

  /**
   * Generate comparison without API (fallback)
   */
  private generateClientSideComparison(colleges: College[]): string {
    if (colleges.length < 2) {
      return 'Please select at least 2 colleges to compare.';
    }

    let comparison = `Comparing ${colleges.length} colleges:\n\n`;

    colleges.forEach((college, idx) => {
      comparison += `**${idx + 1}. ${college.name}**\n`;
      comparison += `- Location: ${college.city}, ${college.state}\n`;
      comparison += `- Type: ${college.management_type}\n`;
      if (college.nirf_ranking) {
        comparison += `- NIRF Rank: ${college.nirf_ranking}\n`;
      }
      comparison += '\n';
    });

    const govtColleges = colleges.filter(c => c.management_type === 'GOVERNMENT').length;
    if (govtColleges > 0) {
      comparison += `${govtColleges} government college(s) with lower fees.\n`;
    }

    return comparison;
  }

  /**
   * Generate trend analysis without API (fallback)
   */
  private generateClientSideTrendAnalysis(cutoffs: Cutoff[], collegeName: string): string {
    if (cutoffs.length === 0) {
      return `No cutoff data available for ${collegeName}.`;
    }

    const years = [...new Set(cutoffs.map(c => c.year))].sort((a, b) => b - a);
    const latestYear = years[0];
    const latestCutoffs = cutoffs.filter(c => c.year === latestYear);

    let analysis = `**${collegeName} - ${latestYear} Cutoffs:**\n\n`;

    const uniqueCategories = [...new Set(latestCutoffs.map(c => c.category))];
    uniqueCategories.slice(0, 3).forEach(category => {
      const catCutoffs = latestCutoffs.filter(c => c.category === category);
      const avgClosing = catCutoffs.reduce((sum, c) => sum + c.closing_rank, 0) / catCutoffs.length;
      analysis += `- ${category}: Average closing rank ${Math.round(avgClosing)}\n`;
    });

    if (years.length > 1) {
      analysis += `\nData available for ${years.length} years. Cutoffs vary by course and category.`;
    }

    return analysis;
  }

  /**
   * Get request count status
   */
  getStatus(): { requestCount: number; limit: number; resetIn: number } {
    return {
      requestCount: this.requestCount,
      limit: 15,
      resetIn: Math.max(0, this.resetTime - Date.now())
    };
  }
}

/**
 * Create Gemini service instance (only if API key available)
 */
export const createGeminiService = (): GeminiAIService | null => {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    console.log('Gemini API key not found. Using client-side AI only.');
    return null;
  }

  return new GeminiAIService({ apiKey });
};

export default GeminiAIService;
