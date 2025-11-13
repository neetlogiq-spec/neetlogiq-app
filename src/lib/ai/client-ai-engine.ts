/**
 * ClientAIEngine
 *
 * Client-side AI engine for generating recommendations without API calls
 * 100% free, runs in browser, instant results
 *
 * Features:
 * - College recommendations based on user profile
 * - Intelligent scoring algorithm
 * - Reason generation for each recommendation
 * - Confidence levels
 * - No external API required
 */

import { UnifiedDataService, College, Course, Cutoff } from '@/services/UnifiedDataService';
import { FilterParams } from '@/lib/smart-router';

export interface UserProfile {
  // Basic info
  stream: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL';
  estimatedRank?: number;
  neetScore?: number;
  category: 'General' | 'OBC' | 'SC' | 'ST' | 'EWS';

  // Preferences
  preferredStates: string[];
  preferredCities: string[];
  preferredManagementTypes: ('GOVERNMENT' | 'PRIVATE' | 'TRUST')[];
  budgetRange: [number, number]; // [min, max] in rupees

  // Academic interests
  interests: string[];
  careerGoals: string[];

  // Constraints
  maxDistance?: number; // km from home
  requiresHostel?: boolean;
}

export interface Recommendation {
  id: string;
  type: 'college' | 'course' | 'cutoff';
  data: College | Course | Cutoff;
  score: number; // 0-100
  reasons: string[];
  confidence: 'high' | 'medium' | 'low';
  tags: string[];
  feasibility: 'safe' | 'moderate' | 'reach' | 'dream';
}

export interface ScoringWeights {
  statePref: number;
  managementType: number;
  cutoffFeasibility: number;
  budget: number;
  reputation: number;
  location: number;
}

export class ClientAIEngine {
  private dataService: UnifiedDataService;
  private weights: ScoringWeights;

  constructor(dataService: UnifiedDataService, weights?: Partial<ScoringWeights>) {
    this.dataService = dataService;
    this.weights = {
      statePref: 20,
      managementType: 15,
      cutoffFeasibility: 30,
      budget: 20,
      reputation: 15,
      location: 10,
      ...weights
    };
  }

  // ============================================================================
  // COLLEGE RECOMMENDATIONS
  // ============================================================================

  /**
   * Generate college recommendations based on user profile
   */
  async generateCollegeRecommendations(
    userProfile: UserProfile,
    limit: number = 10
  ): Promise<Recommendation[]> {
    try {
      // Load necessary data
      const [colleges, cutoffs] = await Promise.all([
        this.dataService.getColleges(),
        this.dataService.getCutoffs({ year: 2024 })
      ]);

      // Score each college
      const scored = await Promise.all(
        colleges.map(async (college) => {
          const collegeCutoffs = cutoffs.data.filter(
            c => c.college_id === college.id || c.college_name === college.name
          );

          const score = this.calculateCollegeScore(college, collegeCutoffs, userProfile);
          const reasons = this.generateReasons(college, collegeCutoffs, userProfile, score);
          const feasibility = this.determineFeasibility(college, collegeCutoffs, userProfile);
          const confidence = this.determineConfidence(score, collegeCutoffs.length);
          const tags = this.generateTags(college, userProfile);

          return {
            id: `rec_college_${college.id}`,
            type: 'college' as const,
            data: college,
            score,
            reasons,
            confidence,
            tags,
            feasibility
          };
        })
      );

      // Filter and sort
      return scored
        .filter(r => r.score > 30) // Minimum score threshold
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('Error generating college recommendations:', error);
      return [];
    }
  }

  /**
   * Calculate college score based on user profile
   */
  private calculateCollegeScore(
    college: College,
    cutoffs: Cutoff[],
    profile: UserProfile
  ): number {
    let score = 0;

    // 1. State Preference (0-20 points)
    if (profile.preferredStates.includes(college.state)) {
      score += this.weights.statePref;
    } else if (profile.preferredStates.length === 0) {
      score += this.weights.statePref * 0.5; // Half points if no preference
    }

    // 2. Management Type (0-15 points)
    if (profile.preferredManagementTypes.includes(college.management_type as any)) {
      score += this.weights.managementType;
    } else if (profile.preferredManagementTypes.length === 0) {
      score += this.weights.managementType * 0.5;
    }

    // 3. Cutoff Feasibility (0-30 points) - MOST IMPORTANT
    if (profile.estimatedRank && cutoffs.length > 0) {
      const relevantCutoffs = cutoffs.filter(c => c.category === profile.category);
      if (relevantCutoffs.length > 0) {
        const avgClosingRank = relevantCutoffs.reduce((sum, c) => sum + c.closing_rank, 0) / relevantCutoffs.length;
        const buffer = avgClosingRank - profile.estimatedRank;

        if (buffer > 5000) {
          score += this.weights.cutoffFeasibility; // Very safe
        } else if (buffer > 2000) {
          score += this.weights.cutoffFeasibility * 0.8; // Safe
        } else if (buffer > 0) {
          score += this.weights.cutoffFeasibility * 0.5; // Moderate
        } else if (buffer > -2000) {
          score += this.weights.cutoffFeasibility * 0.3; // Reach
        }
        // else: Dream college (no points)
      }
    }

    // 4. Budget Compatibility (0-20 points)
    const estimatedFees = this.estimateFees(college);
    if (estimatedFees >= profile.budgetRange[0] && estimatedFees <= profile.budgetRange[1]) {
      score += this.weights.budget;
    } else if (estimatedFees < profile.budgetRange[1] * 1.2) {
      score += this.weights.budget * 0.5; // Slightly over budget
    }

    // 5. Reputation (0-15 points)
    if (college.nirf_ranking) {
      if (college.nirf_ranking <= 10) {
        score += this.weights.reputation;
      } else if (college.nirf_ranking <= 50) {
        score += this.weights.reputation * 0.7;
      } else if (college.nirf_ranking <= 100) {
        score += this.weights.reputation * 0.4;
      }
    } else if (college.established_year && college.established_year < 1950) {
      score += this.weights.reputation * 0.6; // Old = reputed
    }

    // 6. Location/City Preference (0-10 points)
    if (profile.preferredCities.includes(college.city)) {
      score += this.weights.location;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Generate human-readable reasons for recommendation
   */
  private generateReasons(
    college: College,
    cutoffs: Cutoff[],
    profile: UserProfile,
    score: number
  ): string[] {
    const reasons: string[] = [];

    // State match
    if (profile.preferredStates.includes(college.state)) {
      reasons.push(`Located in your preferred state: ${college.state}`);
    }

    // Management type
    if (college.management_type === 'GOVERNMENT') {
      reasons.push('Government college with significantly lower fees');
    } else if (profile.preferredManagementTypes.includes('PRIVATE')) {
      reasons.push('Private college with modern infrastructure');
    }

    // Cutoff feasibility
    if (profile.estimatedRank && cutoffs.length > 0) {
      const relevantCutoffs = cutoffs.filter(c => c.category === profile.category);
      if (relevantCutoffs.length > 0) {
        const avgClosingRank = relevantCutoffs.reduce((sum, c) => sum + c.closing_rank, 0) / relevantCutoffs.length;
        const buffer = avgClosingRank - profile.estimatedRank;

        if (buffer > 5000) {
          reasons.push(`Very good chances - your rank is ${buffer} above last year's closing rank`);
        } else if (buffer > 2000) {
          reasons.push(`Good chances - comfortable margin above cutoff`);
        } else if (buffer > 0) {
          reasons.push(`Moderate chances - slight margin above cutoff`);
        } else {
          reasons.push(`Ambitious choice - aim to improve your rank`);
        }
      }
    }

    // Reputation
    if (college.nirf_ranking && college.nirf_ranking <= 50) {
      reasons.push(`Highly ranked institution (NIRF Rank: ${college.nirf_ranking})`);
    }

    // Established
    if (college.established_year && college.established_year < 1970) {
      const age = new Date().getFullYear() - college.established_year;
      reasons.push(`Established institution with ${age}+ years of experience`);
    }

    // City
    if (profile.preferredCities.includes(college.city)) {
      reasons.push(`Located in your preferred city: ${college.city}`);
    }

    // Add at least one reason
    if (reasons.length === 0) {
      reasons.push('Matches your stream requirements');
    }

    return reasons.slice(0, 5); // Max 5 reasons
  }

  /**
   * Determine admission feasibility
   */
  private determineFeasibility(
    college: College,
    cutoffs: Cutoff[],
    profile: UserProfile
  ): 'safe' | 'moderate' | 'reach' | 'dream' {
    if (!profile.estimatedRank || cutoffs.length === 0) {
      return 'moderate';
    }

    const relevantCutoffs = cutoffs.filter(c => c.category === profile.category);
    if (relevantCutoffs.length === 0) {
      return 'moderate';
    }

    const avgClosingRank = relevantCutoffs.reduce((sum, c) => sum + c.closing_rank, 0) / relevantCutoffs.length;
    const buffer = avgClosingRank - profile.estimatedRank;

    if (buffer > 5000) return 'safe';
    if (buffer > 1000) return 'moderate';
    if (buffer > -1000) return 'reach';
    return 'dream';
  }

  /**
   * Determine confidence level
   */
  private determineConfidence(score: number, cutoffDataPoints: number): 'high' | 'medium' | 'low' {
    if (score > 70 && cutoffDataPoints > 3) return 'high';
    if (score > 50 && cutoffDataPoints > 1) return 'medium';
    return 'low';
  }

  /**
   * Generate tags for filtering/searching
   */
  private generateTags(college: College, profile: UserProfile): string[] {
    const tags: string[] = [];

    tags.push(college.management_type.toLowerCase());
    tags.push(college.state.toLowerCase().replace(/\s+/g, '-'));
    tags.push(college.stream.toLowerCase());

    if (college.nirf_ranking && college.nirf_ranking <= 50) {
      tags.push('top-ranked');
    }

    if (profile.preferredStates.includes(college.state)) {
      tags.push('preferred-state');
    }

    if (college.management_type === 'GOVERNMENT') {
      tags.push('affordable');
    }

    return tags;
  }

  /**
   * Estimate college fees
   */
  private estimateFees(college: College): number {
    // If fees data available
    if (college.fees) {
      if (typeof college.fees === 'number') return college.fees;
      if (typeof college.fees === 'string') {
        const match = college.fees.match(/(\d+)/);
        if (match) return parseInt(match[1]);
      }
    }

    // Estimate based on management type
    if (college.management_type === 'GOVERNMENT') {
      return 50000; // Typical govt college fees
    } else if (college.management_type === 'PRIVATE') {
      return 2000000; // Typical private college fees
    } else {
      return 500000; // Trust/others
    }
  }

  // ============================================================================
  // COURSE RECOMMENDATIONS
  // ============================================================================

  /**
   * Generate course recommendations
   */
  async generateCourseRecommendations(
    userProfile: UserProfile,
    limit: number = 10
  ): Promise<Recommendation[]> {
    try {
      const courses = await this.dataService.getCourses();

      const scored = courses.map(course => {
        const score = this.calculateCourseScore(course, userProfile);
        const reasons = this.generateCourseReasons(course, userProfile);
        const confidence = score > 70 ? 'high' : score > 50 ? 'medium' : 'low';
        const tags = [course.stream?.toLowerCase() || '', course.level?.toLowerCase() || ''];

        return {
          id: `rec_course_${course.id}`,
          type: 'course' as const,
          data: course,
          score,
          reasons,
          confidence,
          tags,
          feasibility: 'moderate' as const
        };
      });

      return scored
        .filter(r => r.score > 30)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('Error generating course recommendations:', error);
      return [];
    }
  }

  /**
   * Calculate course score
   */
  private calculateCourseScore(course: Course, profile: UserProfile): number {
    let score = 50; // Base score

    // Stream match
    if (course.stream === profile.stream) {
      score += 30;
    }

    // Interest match
    const courseName = (course.name || course.course_name || '').toLowerCase();
    for (const interest of profile.interests) {
      if (courseName.includes(interest.toLowerCase())) {
        score += 10;
        break;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Generate course reasons
   */
  private generateCourseReasons(course: Course, profile: UserProfile): string[] {
    const reasons: string[] = [];

    reasons.push(`Matches your ${profile.stream} stream preference`);

    if (course.duration) {
      const years = Math.floor(course.duration / 12);
      const months = course.duration % 12;
      reasons.push(`Duration: ${years} years${months > 0 ? ` ${months} months` : ''}`);
    }

    return reasons;
  }

  // ============================================================================
  // NATURAL LANGUAGE QUERY
  // ============================================================================

  /**
   * Answer natural language queries using available data
   */
  async answerQuery(query: string, profile: UserProfile): Promise<string> {
    const lowerQuery = query.toLowerCase();

    // College recommendations
    if (lowerQuery.includes('recommend') || lowerQuery.includes('suggest')) {
      const recommendations = await this.generateCollegeRecommendations(profile, 5);

      if (recommendations.length === 0) {
        return "I couldn't find suitable recommendations based on your profile. Please update your preferences.";
      }

      let response = `Based on your profile, here are my top ${recommendations.length} recommendations:\n\n`;

      recommendations.forEach((rec, idx) => {
        const college = rec.data as College;
        response += `**${idx + 1}. ${college.name}** (Score: ${rec.score}/100)\n`;
        response += `- ${rec.reasons[0]}\n`;
        response += `- ${rec.reasons[1] || 'Suitable for your stream'}\n\n`;
      });

      return response;
    }

    // Cutoff information
    if (lowerQuery.includes('cutoff') || lowerQuery.includes('rank')) {
      const colleges = await this.dataService.getColleges();
      const cutoffs = await this.dataService.getCutoffs({ year: 2024, category: profile.category });

      if (cutoffs.data.length === 0) {
        return "I don't have cutoff data available for your category at the moment.";
      }

      const avgClosing = cutoffs.data.reduce((sum, c) => sum + c.closing_rank, 0) / cutoffs.data.length;

      let response = `**2024 Cutoff Insights:**\n\n`;
      response += `- Average closing rank for ${profile.category}: ${Math.round(avgClosing)}\n`;
      response += `- Total colleges with data: ${colleges.length}\n`;
      response += `- Your estimated rank: ${profile.estimatedRank || 'Not provided'}\n\n`;

      if (profile.estimatedRank) {
        const feasibleCount = cutoffs.data.filter(c => c.closing_rank > profile.estimatedRank!).length;
        response += `You have good chances in approximately ${feasibleCount} seats across various colleges.\n`;
      }

      return response;
    }

    // Default response
    return `I can help you with:\n- College recommendations\n- Cutoff information\n- Course suggestions\n\nTry asking: "Recommend colleges for my rank" or "Show me 2024 cutoffs"`;
  }
}

export default ClientAIEngine;
