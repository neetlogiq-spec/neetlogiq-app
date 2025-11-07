'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Star, TrendingUp, Target, Filter, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Recommendation {
  id: string;
  type: 'college' | 'course' | 'cutoff';
  data: any;
  score: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  tags: string[];
}

interface UserPreferences {
  preferredStates: string[];
  preferredCities: string[];
  preferredStreams: string[];
  preferredManagementTypes: string[];
  budgetRange: [number, number];
  cutoffRange: [number, number];
  durationRange: [number, number];
  interests: string[];
}

const RecommendationEngine: React.FC = () => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    preferredStates: [],
    preferredCities: [],
    preferredStreams: ['Medical'],
    preferredManagementTypes: ['Government'],
    budgetRange: [0, 1000000],
    cutoffRange: [1, 1000],
    durationRange: [1, 6],
    interests: []
  });
  const [loading, setLoading] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, 'like' | 'dislike' | null>>({});

  useEffect(() => {
    if (user) {
      loadUserPreferences();
    }
  }, [user]);

  useEffect(() => {
    if (preferences.preferredStreams.length > 0) {
      generateRecommendations();
    }
  }, [preferences]);

  const loadUserPreferences = () => {
    if (!user) return;
    
    // Load from localStorage (in real app, this would be from API)
    const savedPreferences = localStorage.getItem(`preferences_${user.uid}`);
    if (savedPreferences) {
      setPreferences(JSON.parse(savedPreferences));
    }
  };

  const saveUserPreferences = (newPreferences: UserPreferences) => {
    if (!user) return;
    localStorage.setItem(`preferences_${user.uid}`, JSON.stringify(newPreferences));
    setPreferences(newPreferences);
  };

  const generateRecommendations = async () => {
    setLoading(true);
    
    try {
      // Simulate AI-powered recommendations
      const mockRecommendations: Recommendation[] = [
        {
          id: 'rec_1',
          type: 'college',
          data: {
            id: 1,
            name: 'All India Institute of Medical Sciences, New Delhi',
            city: 'New Delhi',
            state: 'Delhi',
            stream: 'Medical',
            management_type: 'GOVERNMENT',
            rating: 4.9,
            cutoff_rank: 1,
            fees: 'Rs. 1,000 per year'
          },
          score: 95,
          reason: 'Matches your preference for government medical colleges in Delhi with excellent reputation',
          confidence: 'high',
          tags: ['top-rated', 'government', 'delhi', 'medical']
        },
        {
          id: 'rec_2',
          type: 'course',
          data: {
            id: 1,
            name: 'MBBS',
            stream: 'Medical',
            branch: 'UG',
            duration: 66,
            degree_type: 'MEDICAL',
            total_seats: 100,
            fees: 'Rs. 1,000 per year',
            college_name: 'AIIMS New Delhi'
          },
          score: 92,
          reason: 'Perfect match for your medical stream preference with 66-month duration',
          confidence: 'high',
          tags: ['mbbs', 'medical', 'ug', 'government']
        },
        {
          id: 'rec_3',
          type: 'cutoff',
          data: {
            id: 1,
            college_name: 'AIIMS New Delhi',
            course_name: 'MBBS',
            year: 2024,
            category: 'General',
            opening_rank: 1,
            closing_rank: 50,
            opening_score: 720.0,
            closing_score: 680.0
          },
          score: 88,
          reason: 'Recent cutoff data shows strong performance and good admission chances',
          confidence: 'medium',
          tags: ['2024', 'general', 'aiims', 'mbbs']
        },
        {
          id: 'rec_4',
          type: 'college',
          data: {
            id: 2,
            name: 'Maulana Azad Medical College',
            city: 'New Delhi',
            state: 'Delhi',
            stream: 'Medical',
            management_type: 'GOVERNMENT',
            rating: 4.7,
            cutoff_rank: 45,
            fees: 'Rs. 1,000 per year'
          },
          score: 85,
          reason: 'Good alternative to AIIMS with similar location and management type',
          confidence: 'medium',
          tags: ['government', 'delhi', 'medical', 'alternative']
        }
      ];

      // Filter based on preferences
      const filtered = mockRecommendations.filter(rec => {
        const data = rec.data;
        
        // Check state preference
        if (preferences.preferredStates.length > 0 && !preferences.preferredStates.includes(data.state)) {
          return false;
        }
        
        // Check stream preference
        if (preferences.preferredStreams.length > 0 && !preferences.preferredStreams.includes(data.stream)) {
          return false;
        }
        
        // Check management type preference
        if (preferences.preferredManagementTypes.length > 0 && !preferences.preferredManagementTypes.includes(data.management_type)) {
          return false;
        }
        
        return true;
      });

      setRecommendations(filtered);
    } catch (error) {
      console.error('Error generating recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = (recommendationId: string, feedbackType: 'like' | 'dislike') => {
    setFeedback(prev => ({
      ...prev,
      [recommendationId]: feedbackType
    }));
    
    // In real app, send feedback to API to improve recommendations
    console.log(`Feedback for ${recommendationId}: ${feedbackType}`);
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'low': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getConfidenceBg = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 dark:bg-green-900';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900';
      case 'low': return 'bg-red-100 dark:bg-red-900';
      default: return 'bg-gray-100 dark:bg-gray-700';
    }
  };

  const RecommendationCard: React.FC<{ recommendation: Recommendation }> = ({ recommendation }) => {
    const { data, score, reason, confidence, tags } = recommendation;
    const currentFeedback = feedback[recommendation.id];

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {data.name || data.college_name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {data.city && data.state && `${data.city}, ${data.state}`}
              {data.course_name && ` • ${data.course_name}`}
            </p>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceBg(confidence)} ${getConfidenceColor(confidence)}`}>
                {confidence.toUpperCase()} CONFIDENCE
              </span>
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                {recommendation.type.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{score}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Match Score</div>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 italic">
            "{reason}"
          </p>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="flex space-x-2">
            <button
              onClick={() => handleFeedback(recommendation.id, 'like')}
              className={`p-2 rounded-lg transition-colors ${
                currentFeedback === 'like'
                  ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                  : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900'
              }`}
            >
              <ThumbsUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleFeedback(recommendation.id, 'dislike')}
              className={`p-2 rounded-lg transition-colors ${
                currentFeedback === 'dislike'
                  ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
                  : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900'
              }`}
            >
              <ThumbsDown className="h-4 w-4" />
            </button>
          </div>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View Details
          </button>
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Sign in for personalized recommendations
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Get AI-powered recommendations based on your preferences and interests.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Brain className="h-6 w-6 mr-2 text-blue-600" />
            AI Recommendations
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Personalized suggestions based on your preferences
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowPreferences(true)}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center"
          >
            <Filter className="h-4 w-4 mr-2" />
            Preferences
          </button>
          <button
            onClick={generateRecommendations}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Preferences Modal */}
      {showPreferences && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Preferences</h3>
              <button
                onClick={() => setShowPreferences(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preferred States
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat'].map(state => (
                    <button
                      key={state}
                      onClick={() => {
                        setPreferences(prev => ({
                          ...prev,
                          preferredStates: prev.preferredStates.includes(state)
                            ? prev.preferredStates.filter(s => s !== state)
                            : [...prev.preferredStates, state]
                        }));
                      }}
                      className={`px-3 py-1 rounded-full text-sm ${
                        preferences.preferredStates.includes(state)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {state}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preferred Streams
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Medical', 'Dental', 'Ayurveda', 'Homeopathy'].map(stream => (
                    <button
                      key={stream}
                      onClick={() => {
                        setPreferences(prev => ({
                          ...prev,
                          preferredStreams: prev.preferredStreams.includes(stream)
                            ? prev.preferredStreams.filter(s => s !== stream)
                            : [...prev.preferredStreams, stream]
                        }));
                      }}
                      className={`px-3 py-1 rounded-full text-sm ${
                        preferences.preferredStreams.includes(stream)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {stream}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Management Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Government', 'Private', 'Deemed', 'Central'].map(type => (
                    <button
                      key={type}
                      onClick={() => {
                        setPreferences(prev => ({
                          ...prev,
                          preferredManagementTypes: prev.preferredManagementTypes.includes(type)
                            ? prev.preferredManagementTypes.filter(t => t !== type)
                            : [...prev.preferredManagementTypes, type]
                        }));
                      }}
                      className={`px-3 py-1 rounded-full text-sm ${
                        preferences.preferredManagementTypes.includes(type)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowPreferences(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  saveUserPreferences(preferences);
                  setShowPreferences(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No recommendations yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Set your preferences to get personalized recommendations
          </p>
          <button
            onClick={() => setShowPreferences(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Set Preferences
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendations.map((recommendation) => (
            <RecommendationCard key={recommendation.id} recommendation={recommendation} />
          ))}
        </div>
      )}
    </div>
  );
};

export default RecommendationEngine;
