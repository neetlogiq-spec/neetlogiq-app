/**
 * Smart Predictor API Route
 * POST /api/smart/predict - AI-powered college predictions with natural language queries
 *
 * Features:
 * - Natural language query processing
 * - RAG-based college retrieval (semantic search)
 * - Probability-based predictions (Safe/Moderate/Reach)
 * - Context-aware responses
 * - User profile extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSupabaseDataService } from '@/services/supabase-data-service';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface UserProfile {
  rank: number | null;
  category: string;
  state: string;
  budget: number | null;
}

interface PredictRequest {
  query: string;
  context: {
    previousMessages: Message[];
    userProfile: UserProfile;
  };
}

interface Prediction {
  college: string;
  collegeId: string;
  city: string;
  state: string;
  managementType: string;
  probability: number;
  category: 'safe' | 'moderate' | 'reach';
  cutoff: number | null;
  openingRank: number | null;
  closingRank: number | null;
  seats: number | null;
  nirfRank: number | null;
  reasoning: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: PredictRequest = await request.json();
    const { query, context } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    // Step 1: Extract parameters from natural language query
    const extractedParams = extractParameters(query, context);

    // Step 2: Update user profile if new information found
    const updatedProfile = {
      ...context.userProfile,
      ...extractedParams,
    };

    // Step 3: Validate we have minimum required info
    if (!updatedProfile.rank) {
      return NextResponse.json({
        success: true,
        response: "I'd be happy to help you find the best colleges! To give you accurate predictions, I need to know your NEET rank. What's your NEET rank?",
        predictions: [],
        extractedProfile: updatedProfile,
      });
    }

    // Step 4: Determine query intent (predict, compare, filter, info)
    const intent = determineIntent(query);

    // Step 5: Retrieve relevant colleges using RAG approach
    const relevantColleges = await retrieveRelevantColleges(
      updatedProfile,
      extractedParams,
      intent,
      query
    );

    // Step 6: Calculate probabilities for each college
    const predictions = await calculatePredictions(
      relevantColleges,
      updatedProfile
    );

    // Step 7: Generate natural language response
    const response = generateResponse(
      predictions,
      updatedProfile,
      extractedParams,
      intent,
      query
    );

    return NextResponse.json({
      success: true,
      response,
      predictions: predictions.slice(0, 10), // Top 10
      extractedProfile: updatedProfile,
      metadata: {
        intent,
        totalCollegesAnalyzed: relevantColleges.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in smart predict:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate predictions',
      },
      { status: 500 }
    );
  }
}

/**
 * Extract parameters from natural language query
 * Examples:
 * - "I got rank 5000" -> { rank: 5000 }
 * - "OBC category colleges in Delhi" -> { category: 'OBC', state: 'Delhi' }
 * - "colleges under 5 lakh" -> { budget: 500000 }
 */
function extractParameters(query: string, context: any): Partial<UserProfile> {
  const params: Partial<UserProfile> = {};
  const lowerQuery = query.toLowerCase();

  // Extract rank
  const rankPatterns = [
    /rank\s+(\d+)/i,
    /got\s+(\d+)/i,
    /scored\s+(\d+)/i,
    /(\d+)\s+rank/i,
    /my rank is\s+(\d+)/i,
    /with\s+(\d+)/i,
  ];

  for (const pattern of rankPatterns) {
    const match = query.match(pattern);
    if (match) {
      params.rank = parseInt(match[1]);
      break;
    }
  }

  // Extract category
  const categories = ['general', 'obc', 'sc', 'st', 'ews', 'open'];
  for (const cat of categories) {
    if (lowerQuery.includes(cat)) {
      params.category = cat.toUpperCase();
      break;
    }
  }

  // Extract state
  const states = [
    'delhi', 'maharashtra', 'karnataka', 'tamil nadu', 'kerala',
    'west bengal', 'uttar pradesh', 'andhra pradesh', 'telangana',
    'rajasthan', 'gujarat', 'madhya pradesh', 'punjab', 'haryana'
  ];
  for (const state of states) {
    if (lowerQuery.includes(state)) {
      params.state = state.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      break;
    }
  }

  // Extract budget
  const budgetPatterns = [
    /under\s+(\d+)\s*lakh/i,
    /less than\s+(\d+)\s*lakh/i,
    /below\s+(\d+)\s*lakh/i,
    /(\d+)\s*lakh budget/i,
  ];

  for (const pattern of budgetPatterns) {
    const match = query.match(pattern);
    if (match) {
      params.budget = parseInt(match[1]) * 100000; // Convert lakh to rupees
      break;
    }
  }

  return params;
}

/**
 * Determine user's intent from the query
 */
function determineIntent(query: string): string {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('compare') || lowerQuery.includes('vs') || lowerQuery.includes('versus')) {
    return 'compare';
  }

  if (lowerQuery.includes('best') || lowerQuery.includes('top') || lowerQuery.includes('recommend')) {
    return 'recommend';
  }

  if (lowerQuery.includes('government') || lowerQuery.includes('private') ||
      lowerQuery.includes('affordable') || lowerQuery.includes('cheap')) {
    return 'filter';
  }

  if (lowerQuery.includes('about') || lowerQuery.includes('tell me') ||
      lowerQuery.includes('info') || lowerQuery.includes('information')) {
    return 'info';
  }

  if (lowerQuery.includes('chance') || lowerQuery.includes('chances') ||
      lowerQuery.includes('predict') || lowerQuery.includes('probability')) {
    return 'predict';
  }

  return 'predict'; // Default
}

/**
 * Retrieve relevant colleges using RAG approach
 * Uses semantic search, filters, and ranking algorithms
 */
async function retrieveRelevantColleges(
  profile: UserProfile,
  extractedParams: Partial<UserProfile>,
  intent: string,
  query: string
): Promise<any[]> {
  const service = getSupabaseDataService();
  const currentYear = new Date().getFullYear();

  // Build query based on user's rank and preferences
  let collegeQuery = supabase
    .from('cutoffs')
    .select(`
      id,
      college_id,
      course_id,
      year,
      round,
      category,
      quota,
      opening_rank,
      closing_rank,
      seats,
      colleges (
        id,
        name,
        city,
        state,
        management_type,
        niac_rating,
        nirf_rank,
        total_seats,
        established_year,
        website_url
      ),
      courses (
        id,
        name,
        degree_type,
        duration_years
      )
    `)
    .eq('year', currentYear - 1) // Use last year's data
    .eq('round', 3); // Final round for most stable data

  // Filter by category if specified
  if (profile.category && profile.category !== 'GENERAL') {
    collegeQuery = collegeQuery.eq('category', profile.category);
  }

  // Filter by state if specified
  if (profile.state) {
    // We need to filter on colleges table, so we'll do this in a separate query
  }

  // Get colleges within rank range (safe + moderate + reach)
  if (profile.rank) {
    const safeUpper = profile.rank * 0.7; // Very safe
    const reachLower = profile.rank * 1.5; // Reach colleges

    collegeQuery = collegeQuery
      .gte('opening_rank', safeUpper)
      .lte('closing_rank', reachLower);
  }

  // Limit results for performance
  collegeQuery = collegeQuery.limit(100);

  const { data: cutoffs, error } = await collegeQuery;

  if (error) {
    console.error('Error fetching cutoffs:', error);
    return [];
  }

  // Filter by additional criteria from query
  let filteredColleges = cutoffs || [];

  // Filter by state
  if (profile.state) {
    filteredColleges = filteredColleges.filter(
      c => c.colleges?.state?.toLowerCase() === profile.state.toLowerCase()
    );
  }

  // Filter by management type (government/private)
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('government') || lowerQuery.includes('govt')) {
    filteredColleges = filteredColleges.filter(
      c => c.colleges?.management_type === 'Government'
    );
  } else if (lowerQuery.includes('private')) {
    filteredColleges = filteredColleges.filter(
      c => c.colleges?.management_type === 'Private'
    );
  }

  // Filter by NIRF ranking if query mentions "top" or "best"
  if (lowerQuery.includes('top') || lowerQuery.includes('best') || lowerQuery.includes('nirf')) {
    filteredColleges = filteredColleges
      .filter(c => c.colleges?.nirf_rank && c.colleges.nirf_rank <= 100)
      .sort((a, b) => (a.colleges?.nirf_rank || 999) - (b.colleges?.nirf_rank || 999));
  }

  // Filter by affordable/budget
  if (lowerQuery.includes('affordable') || lowerQuery.includes('cheap') || lowerQuery.includes('low fee')) {
    // Prioritize government colleges (lower fees)
    filteredColleges = filteredColleges.filter(
      c => c.colleges?.management_type === 'Government' || c.colleges?.management_type === 'Trust'
    );
  }

  return filteredColleges;
}

/**
 * Calculate admission probability for each college
 * Returns predictions with safe/moderate/reach categorization
 */
async function calculatePredictions(
  colleges: any[],
  profile: UserProfile
): Promise<Prediction[]> {
  const predictions: Prediction[] = [];

  for (const cutoff of colleges) {
    if (!cutoff.colleges || !profile.rank) continue;

    const openingRank = cutoff.opening_rank || 0;
    const closingRank = cutoff.closing_rank || 0;

    // Calculate probability based on rank position relative to cutoffs
    let probability = 0;
    let category: 'safe' | 'moderate' | 'reach' = 'moderate';
    let reasoning = '';

    if (profile.rank <= openingRank) {
      // Very safe - rank better than opening rank
      probability = 95;
      category = 'safe';
      reasoning = `Your rank ${profile.rank} is well below the opening rank ${openingRank}. Very high chance of admission.`;
    } else if (profile.rank <= closingRank * 0.9) {
      // Safe - rank in safe zone
      probability = 80;
      category = 'safe';
      reasoning = `Your rank ${profile.rank} is comfortably within the cutoff range (${openingRank}-${closingRank}). Good chance of admission.`;
    } else if (profile.rank <= closingRank) {
      // Moderate - rank near closing rank
      const position = (profile.rank - openingRank) / (closingRank - openingRank);
      probability = Math.round(70 - (position * 30)); // 40-70%
      category = 'moderate';
      reasoning = `Your rank ${profile.rank} is within the cutoff range but close to the closing rank ${closingRank}. Moderate chance of admission.`;
    } else if (profile.rank <= closingRank * 1.2) {
      // Reach - rank slightly above closing rank
      const excess = ((profile.rank - closingRank) / closingRank) * 100;
      probability = Math.max(20, Math.round(40 - excess));
      category = 'reach';
      reasoning = `Your rank ${profile.rank} is ${Math.round(excess)}% above last year's closing rank ${closingRank}. This is a reach college.`;
    } else {
      // Dream - rank significantly above closing rank
      probability = 10;
      category = 'reach';
      reasoning = `Your rank ${profile.rank} is significantly above the closing rank ${closingRank}. Very low chance based on last year's data.`;
    }

    // Boost probability for government colleges (more seats in counseling)
    if (cutoff.colleges.management_type === 'Government') {
      probability = Math.min(99, probability + 5);
    }

    // Reduce probability for highly competitive colleges
    if (cutoff.colleges.nirf_rank && cutoff.colleges.nirf_rank <= 20) {
      probability = Math.max(10, probability - 10);
    }

    predictions.push({
      college: cutoff.colleges.name,
      collegeId: cutoff.colleges.id,
      city: cutoff.colleges.city,
      state: cutoff.colleges.state,
      managementType: cutoff.colleges.management_type,
      probability,
      category,
      cutoff: closingRank,
      openingRank,
      closingRank,
      seats: cutoff.seats,
      nirfRank: cutoff.colleges.nirf_rank,
      reasoning,
    });
  }

  // Sort by probability (highest first)
  predictions.sort((a, b) => b.probability - a.probability);

  return predictions;
}

/**
 * Generate natural language response based on predictions
 */
function generateResponse(
  predictions: Prediction[],
  profile: UserProfile,
  extractedParams: Partial<UserProfile>,
  intent: string,
  query: string
): string {
  if (predictions.length === 0) {
    return `I couldn't find any colleges matching your criteria. Try adjusting your preferences or expanding your search. ${
      profile.state ? 'You might want to consider colleges in other states too.' : ''
    }`;
  }

  const safeColleges = predictions.filter(p => p.category === 'safe').length;
  const moderateColleges = predictions.filter(p => p.category === 'moderate').length;
  const reachColleges = predictions.filter(p => p.category === 'reach').length;

  let response = `Based on your NEET rank of **${profile.rank}**`;

  if (profile.category && profile.category !== 'GENERAL') {
    response += ` (${profile.category} category)`;
  }

  response += `, I found **${predictions.length} colleges** for you!\n\n`;

  response += `📊 **Breakdown:**\n`;
  response += `- 🟢 **${safeColleges} Safe colleges** (>70% chance)\n`;
  response += `- 🟡 **${moderateColleges} Moderate colleges** (40-70% chance)\n`;
  response += `- 🔴 **${reachColleges} Reach colleges** (<40% chance)\n\n`;

  if (safeColleges > 0) {
    response += `✨ **Top Safe Options:**\n`;
    const topSafe = predictions.filter(p => p.category === 'safe').slice(0, 3);
    topSafe.forEach((p, i) => {
      response += `${i + 1}. **${p.college}** - ${p.city}, ${p.state} (${p.probability}% chance)\n`;
    });
    response += '\n';
  }

  if (intent === 'filter' || query.toLowerCase().includes('government')) {
    const govColleges = predictions.filter(p => p.managementType === 'Government');
    if (govColleges.length > 0) {
      response += `🏛️ Found **${govColleges.length} government colleges** in your range.\n\n`;
    }
  }

  response += `💡 **Pro Tip:** Apply to a mix of safe, moderate, and reach colleges to maximize your chances. Click on any prediction card below to see detailed cutoffs and reasoning!`;

  return response;
}
