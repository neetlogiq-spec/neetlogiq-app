/**
 * FeatureFlags Component
 *
 * Allows admins to control feature availability across the application
 *
 * Features:
 * - Enable/disable features globally
 * - Stream-specific feature control
 * - Progressive rollout (percentage-based)
 * - User segment targeting
 * - A/B testing support
 * - Maintenance mode
 * - Emergency kill switches
 */

'use client';

import React, { useState, useEffect } from 'react';
import type { StreamType } from '@/components/admin/StreamManagement';

// Feature flag configuration
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  category: FeatureCategory;
  enabled: boolean;
  rollout: RolloutConfig;
  targeting: TargetingConfig;
  metadata: FeatureMetadata;
}

export type FeatureCategory =
  | 'core'           // Core functionality
  | 'ai'             // AI features
  | 'search'         // Search features
  | 'recommendation' // Recommendation features
  | 'analytics'      // Analytics features
  | 'social'         // Social features
  | 'experimental';  // Experimental features

export interface RolloutConfig {
  type: 'full' | 'percentage' | 'whitelist' | 'blacklist';
  percentage?: number; // 0-100
  whitelist?: string[]; // User IDs or emails
  blacklist?: string[]; // User IDs or emails
}

export interface TargetingConfig {
  streams: StreamType[]; // Which streams this feature is available in
  userSegments: string[]; // new_users, active_users, premium_users, etc.
  locations?: string[]; // States or cities
  minAppVersion?: string; // Minimum app version required
}

export interface FeatureMetadata {
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
  usageCount?: number; // How many times the feature has been used
  errorCount?: number; // Number of errors related to this feature
  notes?: string; // Admin notes
}

// Predefined feature flags
const defaultFeatures: FeatureFlag[] = [
  {
    id: 'ai-chatbot',
    name: 'AI Chatbot',
    description: 'Enable AI-powered chatbot for college recommendations',
    category: 'ai',
    enabled: true,
    rollout: { type: 'full' },
    targeting: {
      streams: ['UG', 'PG_MEDICAL', 'PG_DENTAL'],
      userSegments: ['all_users']
    },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin',
      lastModifiedBy: 'admin',
      usageCount: 0,
      errorCount: 0
    }
  },
  {
    id: 'cutoff-prediction',
    name: 'Cutoff Prediction',
    description: 'AI-powered cutoff prediction based on historical data',
    category: 'ai',
    enabled: true,
    rollout: { type: 'full' },
    targeting: {
      streams: ['UG', 'PG_MEDICAL', 'PG_DENTAL'],
      userSegments: ['all_users']
    },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin',
      lastModifiedBy: 'admin',
      usageCount: 0,
      errorCount: 0
    }
  },
  {
    id: 'hybrid-search',
    name: 'Hybrid Search Engine',
    description: 'Advanced search with fuzzy matching, abbreviations, and phonetic search',
    category: 'search',
    enabled: true,
    rollout: { type: 'full' },
    targeting: {
      streams: ['UG', 'PG_MEDICAL', 'PG_DENTAL'],
      userSegments: ['all_users']
    },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin',
      lastModifiedBy: 'admin',
      usageCount: 0,
      errorCount: 0
    }
  },
  {
    id: 'college-comparison',
    name: 'College Comparison',
    description: 'Side-by-side comparison of multiple colleges',
    category: 'core',
    enabled: true,
    rollout: { type: 'full' },
    targeting: {
      streams: ['UG', 'PG_MEDICAL', 'PG_DENTAL'],
      userSegments: ['all_users']
    },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin',
      lastModifiedBy: 'admin',
      usageCount: 0,
      errorCount: 0
    }
  },
  {
    id: 'social-sharing',
    name: 'Social Sharing',
    description: 'Share college details and recommendations on social media',
    category: 'social',
    enabled: false,
    rollout: { type: 'percentage', percentage: 0 },
    targeting: {
      streams: ['UG', 'PG_MEDICAL', 'PG_DENTAL'],
      userSegments: ['all_users']
    },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin',
      lastModifiedBy: 'admin',
      usageCount: 0,
      errorCount: 0,
      notes: 'Not yet implemented'
    }
  },
  {
    id: 'advanced-analytics',
    name: 'Advanced Analytics',
    description: 'Detailed user behavior analytics and heatmaps',
    category: 'analytics',
    enabled: true,
    rollout: { type: 'full' },
    targeting: {
      streams: ['UG', 'PG_MEDICAL', 'PG_DENTAL'],
      userSegments: ['all_users']
    },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin',
      lastModifiedBy: 'admin',
      usageCount: 0,
      errorCount: 0
    }
  },
  {
    id: 'gemini-ai',
    name: 'Gemini AI Integration',
    description: 'Google Gemini AI for enhanced natural language processing',
    category: 'ai',
    enabled: false,
    rollout: { type: 'percentage', percentage: 10 },
    targeting: {
      streams: ['UG'],
      userSegments: ['active_users'],
      minAppVersion: '1.5.0'
    },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin',
      lastModifiedBy: 'admin',
      usageCount: 0,
      errorCount: 0,
      notes: 'Testing with 10% of active UG users'
    }
  }
];

// System flags (maintenance, emergency)
export interface SystemFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  message?: string; // Message to display to users
}

const systemFlags: SystemFlag[] = [
  {
    id: 'maintenance-mode',
    name: 'Maintenance Mode',
    description: 'Put the entire application in maintenance mode',
    enabled: false,
    priority: 'critical',
    message: 'We are currently performing maintenance. Please check back soon.'
  },
  {
    id: 'read-only-mode',
    name: 'Read-Only Mode',
    description: 'Disable all write operations (profile updates, etc.)',
    enabled: false,
    priority: 'high',
    message: 'The application is currently in read-only mode.'
  },
  {
    id: 'emergency-banner',
    name: 'Emergency Banner',
    description: 'Show emergency banner across all pages',
    enabled: false,
    priority: 'critical',
    message: ''
  }
];

export default function FeatureFlags() {
  const [features, setFeatures] = useState<FeatureFlag[]>(defaultFeatures);
  const [systemSettings, setSystemSettings] = useState<SystemFlag[]>(systemFlags);
  const [selectedFeature, setSelectedFeature] = useState<FeatureFlag | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filterCategory, setFilterCategory] = useState<FeatureCategory | 'all'>('all');

  // Load feature flags from API
  useEffect(() => {
    loadFeatures();
    loadSystemFlags();
  }, []);

  const loadFeatures = async () => {
    try {
      const response = await fetch('/api/admin/feature-flags');
      if (response.ok) {
        const data = await response.json();
        setFeatures(data.features || defaultFeatures);
      }
    } catch (error) {
      console.error('Error loading features:', error);
    }
  };

  const loadSystemFlags = async () => {
    try {
      const response = await fetch('/api/admin/system-flags');
      if (response.ok) {
        const data = await response.json();
        setSystemSettings(data.flags || systemFlags);
      }
    } catch (error) {
      console.error('Error loading system flags:', error);
    }
  };

  const toggleFeature = async (featureId: string) => {
    const feature = features.find(f => f.id === featureId);
    if (!feature) return;

    const updated = { ...feature, enabled: !feature.enabled };
    await saveFeature(updated);
  };

  const toggleSystemFlag = async (flagId: string) => {
    const flag = systemSettings.find(f => f.id === flagId);
    if (!flag) return;

    try {
      const response = await fetch(`/api/admin/system-flags/${flagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !flag.enabled })
      });

      if (response.ok) {
        const data = await response.json();
        setSystemSettings(prev => prev.map(f => f.id === flagId ? data.flag : f));
      }
    } catch (error) {
      console.error('Error toggling system flag:', error);
    }
  };

  const saveFeature = async (feature: FeatureFlag) => {
    try {
      const response = await fetch(`/api/admin/feature-flags/${feature.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feature)
      });

      if (response.ok) {
        const data = await response.json();
        setFeatures(prev => prev.map(f => f.id === feature.id ? data.feature : f));
        setIsEditing(false);
        setSelectedFeature(null);
      } else {
        alert('Failed to save feature');
      }
    } catch (error) {
      console.error('Error saving feature:', error);
      alert('Error saving feature');
    }
  };

  const filteredFeatures = filterCategory === 'all'
    ? features
    : features.filter(f => f.category === filterCategory);

  const categoryColors: Record<FeatureCategory, string> = {
    core: 'blue',
    ai: 'purple',
    search: 'green',
    recommendation: 'yellow',
    analytics: 'pink',
    social: 'indigo',
    experimental: 'red'
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Feature Flags</h2>
        <p className="mt-2 text-gray-600">
          Control feature availability and progressive rollouts
        </p>
      </div>

      {/* System Flags */}
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-red-900 mb-4">
          ⚠️ System Controls
        </h3>
        <div className="space-y-3">
          {systemSettings.map(flag => (
            <div
              key={flag.id}
              className="flex items-start justify-between p-4 bg-white rounded-lg border border-red-200"
            >
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h4 className="font-semibold text-gray-900">{flag.name}</h4>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    flag.priority === 'critical' ? 'bg-red-100 text-red-700' :
                    flag.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {flag.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{flag.description}</p>
                {flag.enabled && flag.message && (
                  <p className="text-sm text-red-600 mt-2 font-medium">
                    Message: {flag.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => toggleSystemFlag(flag.id)}
                className={`ml-4 px-4 py-2 rounded-lg font-medium text-sm ${
                  flag.enabled
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {flag.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-gray-700">Category:</span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              filterCategory === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All ({features.length})
          </button>
          {(['core', 'ai', 'search', 'recommendation', 'analytics', 'social', 'experimental'] as FeatureCategory[]).map(cat => {
            const count = features.filter(f => f.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  filterCategory === cat
                    ? `bg-${categoryColors[cat]}-600 text-white`
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Feature List */}
      <div className="space-y-3">
        {filteredFeatures.map(feature => (
          <div
            key={feature.id}
            className={`border-2 rounded-lg p-5 cursor-pointer transition-all ${
              selectedFeature?.id === feature.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedFeature(feature)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="font-semibold text-gray-900">{feature.name}</h3>
                  <span className={`px-2 py-0.5 text-xs rounded-full bg-${categoryColors[feature.category]}-100 text-${categoryColors[feature.category]}-700`}>
                    {feature.category}
                  </span>
                  {feature.rollout.type === 'percentage' && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
                      {feature.rollout.percentage}% rollout
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-3">{feature.description}</p>

                {/* Targeting Info */}
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>Streams: {feature.targeting.streams.join(', ')}</span>
                  <span>•</span>
                  <span>Segments: {feature.targeting.userSegments.join(', ')}</span>
                  {feature.metadata.usageCount !== undefined && (
                    <>
                      <span>•</span>
                      <span>Used: {feature.metadata.usageCount}x</span>
                    </>
                  )}
                </div>

                {feature.metadata.notes && (
                  <p className="mt-2 text-sm text-blue-600">
                    📝 {feature.metadata.notes}
                  </p>
                )}
              </div>

              {/* Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFeature(feature.id);
                }}
                className={`ml-4 px-4 py-2 rounded-lg font-medium text-sm ${
                  feature.enabled
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {feature.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Feature Editor */}
      {selectedFeature && (
        <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              {selectedFeature.name} Settings
            </h3>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {isEditing ? (
            <FeatureFlagEditor
              feature={selectedFeature}
              onSave={saveFeature}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <FeatureFlagViewer feature={selectedFeature} />
          )}
        </div>
      )}
    </div>
  );
}

// Feature Flag Viewer
function FeatureFlagViewer({ feature }: { feature: FeatureFlag }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-gray-900 mb-2">Rollout Configuration</h4>
        <div className="text-sm">
          <span className="text-gray-600">Type:</span>
          <span className="ml-2 font-medium">{feature.rollout.type}</span>
          {feature.rollout.percentage !== undefined && (
            <>
              <span className="ml-4 text-gray-600">Percentage:</span>
              <span className="ml-2 font-medium">{feature.rollout.percentage}%</span>
            </>
          )}
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-900 mb-2">Targeting</h4>
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-gray-600">Streams:</span>
            <span className="ml-2 font-medium">{feature.targeting.streams.join(', ')}</span>
          </div>
          <div>
            <span className="text-gray-600">User Segments:</span>
            <span className="ml-2 font-medium">{feature.targeting.userSegments.join(', ')}</span>
          </div>
          {feature.targeting.minAppVersion && (
            <div>
              <span className="text-gray-600">Min App Version:</span>
              <span className="ml-2 font-medium">{feature.targeting.minAppVersion}</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-900 mb-2">Metadata</h4>
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-gray-600">Created:</span>
            <span className="ml-2 font-medium">{new Date(feature.metadata.createdAt).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-600">Last Modified:</span>
            <span className="ml-2 font-medium">{new Date(feature.metadata.updatedAt).toLocaleString()}</span>
          </div>
          {feature.metadata.usageCount !== undefined && (
            <div>
              <span className="text-gray-600">Usage Count:</span>
              <span className="ml-2 font-medium">{feature.metadata.usageCount}</span>
            </div>
          )}
          {feature.metadata.errorCount !== undefined && feature.metadata.errorCount > 0 && (
            <div>
              <span className="text-gray-600">Errors:</span>
              <span className="ml-2 font-medium text-red-600">{feature.metadata.errorCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Feature Flag Editor
function FeatureFlagEditor({
  feature,
  onSave,
  onCancel
}: {
  feature: FeatureFlag;
  onSave: (feature: FeatureFlag) => void;
  onCancel: () => void;
}) {
  const [edited, setEdited] = useState<FeatureFlag>(feature);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={edited.description}
          onChange={e => setEdited({ ...edited, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          rows={2}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Rollout Type
        </label>
        <select
          value={edited.rollout.type}
          onChange={e => setEdited({
            ...edited,
            rollout: { ...edited.rollout, type: e.target.value as any }
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="full">Full (100%)</option>
          <option value="percentage">Percentage</option>
          <option value="whitelist">Whitelist</option>
          <option value="blacklist">Blacklist</option>
        </select>
      </div>

      {edited.rollout.type === 'percentage' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rollout Percentage
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={edited.rollout.percentage || 0}
            onChange={e => setEdited({
              ...edited,
              rollout: { ...edited.rollout, percentage: parseInt(e.target.value) }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={edited.metadata.notes || ''}
          onChange={e => setEdited({
            ...edited,
            metadata: { ...edited.metadata, notes: e.target.value }
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          rows={3}
        />
      </div>

      <div className="flex space-x-3 pt-4 border-t border-gray-200">
        <button
          onClick={() => onSave(edited)}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Save Changes
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
