/**
 * Admin Streams API
 *
 * Endpoints:
 * - GET /api/admin/streams - List all streams with their configuration
 * - POST /api/admin/streams - Create/update stream configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAccess } from '@/lib/admin-middleware';
import type { StreamConfig } from '@/components/admin/StreamManagement';

/**
 * GET /api/admin/streams
 * Get all stream configurations
 */
export async function GET(request: NextRequest) {
  // Check admin authentication
  const authCheck = await checkAdminAccess(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: 401 }
    );
  }

  try {

    // TODO: Load stream configurations from database
    // For now, return default configuration
    // In production:
    // const streams = await db.collection('streamConfigs').get();

    const defaultStreams: StreamConfig[] = [
      {
        id: 'UG',
        name: 'UG',
        fullName: 'Undergraduate Medical (MBBS)',
        description: 'Undergraduate medical programs including MBBS',
        enabled: true,
        icon: '🎓',
        color: '#3B82F6',
        priority: 1,
        features: [
          { id: 'cutoff-prediction', name: 'Cutoff Prediction', description: 'AI-powered cutoff prediction', enabled: true },
          { id: 'college-recommendation', name: 'College Recommendation', description: 'Personalized college recommendations', enabled: true },
          { id: 'rank-estimation', name: 'Rank Estimation', description: 'Estimate rank from percentile', enabled: true }
        ],
        settings: {
          showInNavigation: true,
          showInFilters: true,
          showOnHomepage: true,
          enableCutoffPrediction: true,
          enableCollegeRecommendation: true,
          enableRankEstimation: true,
          allowNotifications: true,
          minYear: 2018,
          maxYear: 2024,
          defaultYear: 2024,
          availableCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'],
          availableQuotas: ['AIQ', 'State Quota', 'Management', 'NRI'],
          searchWeight: 1.0
        },
        analytics: {
          totalUsers: 0,
          activeUsers30d: 0,
          totalColleges: 0,
          totalCourses: 0,
          totalCutoffs: 0,
          avgSearchesPerUser: 0,
          popularSearches: [],
          popularColleges: []
        }
      },
      {
        id: 'PG_MEDICAL',
        name: 'PG Medical',
        fullName: 'Postgraduate Medical (MD/MS)',
        description: 'Postgraduate medical programs including MD/MS',
        enabled: true,
        icon: '🏥',
        color: '#10B981',
        priority: 2,
        features: [
          { id: 'cutoff-prediction', name: 'Cutoff Prediction', description: 'AI-powered cutoff prediction', enabled: true },
          { id: 'college-recommendation', name: 'College Recommendation', description: 'Personalized college recommendations', enabled: true },
          { id: 'specialty-matching', name: 'Specialty Matching', description: 'Match to best specialty based on profile', enabled: true }
        ],
        settings: {
          showInNavigation: true,
          showInFilters: true,
          showOnHomepage: true,
          enableCutoffPrediction: true,
          enableCollegeRecommendation: true,
          enableRankEstimation: true,
          allowNotifications: true,
          minYear: 2018,
          maxYear: 2024,
          defaultYear: 2024,
          availableCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'],
          availableQuotas: ['AIQ', 'State Quota', 'DNB', 'Management'],
          searchWeight: 1.0
        },
        analytics: {
          totalUsers: 0,
          activeUsers30d: 0,
          totalColleges: 0,
          totalCourses: 0,
          totalCutoffs: 0,
          avgSearchesPerUser: 0,
          popularSearches: [],
          popularColleges: []
        }
      },
      {
        id: 'PG_DENTAL',
        name: 'PG Dental',
        fullName: 'Postgraduate Dental (MDS)',
        description: 'Postgraduate dental programs including MDS',
        enabled: true,
        icon: '🦷',
        color: '#8B5CF6',
        priority: 3,
        features: [
          { id: 'cutoff-prediction', name: 'Cutoff Prediction', description: 'AI-powered cutoff prediction', enabled: true },
          { id: 'college-recommendation', name: 'College Recommendation', description: 'Personalized college recommendations', enabled: true },
          { id: 'specialty-matching', name: 'Specialty Matching', description: 'Match to best specialty based on profile', enabled: true }
        ],
        settings: {
          showInNavigation: true,
          showInFilters: true,
          showOnHomepage: true,
          enableCutoffPrediction: true,
          enableCollegeRecommendation: true,
          enableRankEstimation: true,
          allowNotifications: true,
          minYear: 2018,
          maxYear: 2024,
          defaultYear: 2024,
          availableCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'],
          availableQuotas: ['AIQ', 'State Quota', 'Management'],
          searchWeight: 1.0
        },
        analytics: {
          totalUsers: 0,
          activeUsers30d: 0,
          totalColleges: 0,
          totalCourses: 0,
          totalCutoffs: 0,
          avgSearchesPerUser: 0,
          popularSearches: [],
          popularColleges: []
        }
      }
    ];

    return NextResponse.json({
      success: true,
      streams: defaultStreams
    });
  } catch (error) {
    console.error('Error fetching streams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch streams' },
      { status: 500 }
    );
  }
}

