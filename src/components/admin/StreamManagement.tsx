/**
 * StreamManagement Component
 *
 * Allows admins to control stream visibility, settings, and analytics
 *
 * Features:
 * - Enable/disable streams
 * - Customize stream metadata (name, description, features)
 * - View stream-specific analytics
 * - Configure stream cutoff rules
 * - Set stream priority and ordering
 */

'use client';

import React, { useState, useEffect } from 'react';

// Stream configuration interface
export interface StreamConfig {
  id: StreamType;
  name: string;
  fullName: string;
  description: string;
  enabled: boolean;
  icon: string;
  color: string;
  priority: number; // Display order
  features: StreamFeature[];
  settings: StreamSettings;
  analytics?: StreamAnalytics;
}

export type StreamType = 'UG' | 'PG_MEDICAL' | 'PG_DENTAL' | 'ALL';

export interface StreamFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface StreamSettings {
  // Display settings
  showInNavigation: boolean;
  showInFilters: boolean;
  showOnHomepage: boolean;

  // Data settings
  enableCutoffPrediction: boolean;
  enableCollegeRecommendation: boolean;
  enableRankEstimation: boolean;

  // Notification settings
  allowNotifications: boolean;

  // Cutoff settings
  minYear: number;
  maxYear: number;
  defaultYear: number;
  availableCategories: string[];
  availableQuotas: string[];

  // Search settings
  searchWeight: number; // 0-1, affects search ranking
}

export interface StreamAnalytics {
  totalUsers: number;
  activeUsers30d: number;
  totalColleges: number;
  totalCourses: number;
  totalCutoffs: number;
  avgSearchesPerUser: number;
  popularSearches: Array<{ query: string; count: number }>;
  popularColleges: Array<{ name: string; views: number }>;
}

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
    }
  }
];

export default function StreamManagement() {
  const [streams, setStreams] = useState<StreamConfig[]>(defaultStreams);
  const [selectedStream, setSelectedStream] = useState<StreamConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load streams from API
  useEffect(() => {
    loadStreams();
  }, []);

  const loadStreams = async () => {
    try {
      const response = await fetch('/api/admin/streams');
      if (response.ok) {
        const data = await response.json();
        setStreams(data.streams || defaultStreams);
      }
    } catch (error) {
      console.error('Error loading streams:', error);
    }
  };

  const saveStream = async (stream: StreamConfig) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/streams/${stream.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stream)
      });

      if (response.ok) {
        const data = await response.json();
        setStreams(prev => prev.map(s => s.id === stream.id ? data.stream : s));
        setIsEditing(false);
        setSelectedStream(null);
      } else {
        alert('Failed to save stream');
      }
    } catch (error) {
      console.error('Error saving stream:', error);
      alert('Error saving stream');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStreamEnabled = async (streamId: StreamType) => {
    const stream = streams.find(s => s.id === streamId);
    if (!stream) return;

    const updated = { ...stream, enabled: !stream.enabled };
    await saveStream(updated);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Stream Management</h2>
        <p className="mt-2 text-gray-600">
          Control stream visibility, features, and settings
        </p>
      </div>

      {/* Stream Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {streams.map(stream => (
          <div
            key={stream.id}
            className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
              selectedStream?.id === stream.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedStream(stream)}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <span className="text-3xl">{stream.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-900">{stream.name}</h3>
                  <p className="text-sm text-gray-500">{stream.fullName}</p>
                </div>
              </div>

              {/* Enable/Disable Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStreamEnabled(stream.id);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  stream.enabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {stream.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-4">{stream.description}</p>

            {/* Analytics */}
            {stream.analytics && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Users:</span>
                  <span className="font-medium">{stream.analytics.totalUsers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Active (30d):</span>
                  <span className="font-medium">{stream.analytics.activeUsers30d}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Colleges:</span>
                  <span className="font-medium">{stream.analytics.totalColleges}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cutoffs:</span>
                  <span className="font-medium">{stream.analytics.totalCutoffs}</span>
                </div>
              </div>
            )}

            {/* Features Badge */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                {stream.features.filter(f => f.enabled).map(feature => (
                  <span
                    key={feature.id}
                    className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                  >
                    {feature.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stream Details Editor */}
      {selectedStream && (
        <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              {selectedStream.icon} {selectedStream.name} Settings
            </h3>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {isEditing ? (
            <StreamEditor
              stream={selectedStream}
              onSave={saveStream}
              onCancel={() => setIsEditing(false)}
              isSaving={isSaving}
            />
          ) : (
            <StreamViewer stream={selectedStream} />
          )}
        </div>
      )}
    </div>
  );
}

// Stream Viewer Component
function StreamViewer({ stream }: { stream: StreamConfig }) {
  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Basic Information</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">ID:</span>
            <span className="ml-2 font-medium">{stream.id}</span>
          </div>
          <div>
            <span className="text-gray-500">Priority:</span>
            <span className="ml-2 font-medium">{stream.priority}</span>
          </div>
          <div>
            <span className="text-gray-500">Status:</span>
            <span className={`ml-2 font-medium ${stream.enabled ? 'text-green-600' : 'text-red-600'}`}>
              {stream.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Color:</span>
            <span className="ml-2 font-medium" style={{ color: stream.color }}>{stream.color}</span>
          </div>
        </div>
      </div>

      {/* Display Settings */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Display Settings</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center">
            <span className={`w-3 h-3 rounded-full mr-2 ${stream.settings.showInNavigation ? 'bg-green-500' : 'bg-gray-300'}`} />
            Show in Navigation
          </div>
          <div className="flex items-center">
            <span className={`w-3 h-3 rounded-full mr-2 ${stream.settings.showInFilters ? 'bg-green-500' : 'bg-gray-300'}`} />
            Show in Filters
          </div>
          <div className="flex items-center">
            <span className={`w-3 h-3 rounded-full mr-2 ${stream.settings.showOnHomepage ? 'bg-green-500' : 'bg-gray-300'}`} />
            Show on Homepage
          </div>
        </div>
      </div>

      {/* Features */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Features</h4>
        <div className="space-y-3">
          {stream.features.map(feature => (
            <div key={feature.id} className="flex items-start">
              <span className={`w-3 h-3 rounded-full mr-3 mt-1 ${feature.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div>
                <div className="font-medium text-sm">{feature.name}</div>
                <div className="text-xs text-gray-500">{feature.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cutoff Settings */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Cutoff Settings</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Year Range:</span>
            <span className="ml-2 font-medium">{stream.settings.minYear} - {stream.settings.maxYear}</span>
          </div>
          <div>
            <span className="text-gray-500">Default Year:</span>
            <span className="ml-2 font-medium">{stream.settings.defaultYear}</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">Categories:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {stream.settings.availableCategories.map(cat => (
                <span key={cat} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                  {cat}
                </span>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">Quotas:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {stream.settings.availableQuotas.map(quota => (
                <span key={quota} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                  {quota}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stream Editor Component
function StreamEditor({
  stream,
  onSave,
  onCancel,
  isSaving
}: {
  stream: StreamConfig;
  onSave: (stream: StreamConfig) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [editedStream, setEditedStream] = useState<StreamConfig>(stream);

  const updateSetting = (key: keyof StreamSettings, value: any) => {
    setEditedStream(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]: value
      }
    }));
  };

  const toggleFeature = (featureId: string) => {
    setEditedStream(prev => ({
      ...prev,
      features: prev.features.map(f =>
        f.id === featureId ? { ...f, enabled: !f.enabled } : f
      )
    }));
  };

  return (
    <div className="space-y-6">
      {/* Basic Settings */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={editedStream.fullName}
            onChange={e => setEditedStream({ ...editedStream, fullName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={editedStream.description}
            onChange={e => setEditedStream({ ...editedStream, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <input
              type="number"
              value={editedStream.priority}
              onChange={e => setEditedStream({ ...editedStream, priority: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color
            </label>
            <input
              type="color"
              value={editedStream.color}
              onChange={e => setEditedStream({ ...editedStream, color: e.target.value })}
              className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Display Settings */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Display Settings</h4>
        <div className="space-y-2">
          {(['showInNavigation', 'showInFilters', 'showOnHomepage'] as const).map(key => (
            <label key={key} className="flex items-center">
              <input
                type="checkbox"
                checked={editedStream.settings[key]}
                onChange={e => updateSetting(key, e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Features */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Features</h4>
        <div className="space-y-2">
          {editedStream.features.map(feature => (
            <label key={feature.id} className="flex items-center">
              <input
                type="checkbox"
                checked={feature.enabled}
                onChange={() => toggleFeature(feature.id)}
                className="mr-2"
              />
              <span className="text-sm font-medium">{feature.name}</span>
              <span className="text-xs text-gray-500 ml-2">- {feature.description}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Save/Cancel Buttons */}
      <div className="flex space-x-3 pt-4 border-t border-gray-200">
        <button
          onClick={() => onSave(editedStream)}
          disabled={isSaving}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
