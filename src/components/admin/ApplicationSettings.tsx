/**
 * ApplicationSettings Component
 *
 * System-wide configuration and settings
 *
 * Features:
 * - Cache configuration (TTL, size limits)
 * - API rate limiting
 * - Performance thresholds
 * - Search configuration
 * - Data refresh intervals
 * - Email/notification settings
 * - Third-party integrations
 * - Security settings
 */

'use client';

import React, { useState, useEffect } from 'react';

// Application settings interface
export interface ApplicationSettings {
  cache: CacheSettings;
  api: APISettings;
  performance: PerformanceSettings;
  search: SearchSettings;
  data: DataSettings;
  notifications: NotificationSettings;
  integrations: IntegrationSettings;
  security: SecuritySettings;
}

export interface CacheSettings {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum cache size in MB
  strategy: 'lru' | 'lfu' | 'fifo';

  // Specific cache TTLs
  collegeCacheTTL: number;
  cutoffCacheTTL: number;
  courseCacheTTL: number;
  searchCacheTTL: number;

  // LocalStorage settings
  useLocalStorage: boolean;
  localStorageQuota: number; // MB
}

export interface APISettings {
  // Rate limiting
  rateLimitEnabled: boolean;
  requestsPerMinute: number;
  requestsPerHour: number;
  burstSize: number;

  // Timeouts
  defaultTimeout: number; // milliseconds
  longTimeout: number; // For heavy operations

  // Retry settings
  maxRetries: number;
  retryDelay: number; // milliseconds
  exponentialBackoff: boolean;
}

export interface PerformanceSettings {
  // Progressive loading
  progressiveLoadingEnabled: boolean;
  initialYearsToLoad: number;
  lazyLoadThreshold: number; // pixels

  // Rendering
  virtualScrolling: boolean;
  itemsPerPage: number;
  preloadPages: number;

  // Monitoring
  rumEnabled: boolean; // Real User Monitoring
  performanceAlerts: boolean;
  slowQueryThreshold: number; // milliseconds
}

export interface SearchSettings {
  // Search engine
  hybridSearchEnabled: boolean;
  fuzzyMatchingEnabled: boolean;
  phoneticSearchEnabled: boolean;
  abbreviationSearchEnabled: boolean;

  // Search parameters
  maxResults: number;
  fuzzyThreshold: number; // 0-1
  minQueryLength: number;

  // Indexing
  autoIndexing: boolean;
  indexUpdateInterval: number; // minutes
}

export interface DataSettings {
  // Data refresh
  autoRefreshEnabled: boolean;
  refreshInterval: number; // hours
  refreshTime: string; // HH:MM format

  // Data validation
  validateOnUpload: boolean;
  strictValidation: boolean;
  allowDuplicates: boolean;

  // Progressive loading
  streamChunkingEnabled: boolean;
  chunkSize: number; // rows
}

export interface NotificationSettings {
  // Email
  emailNotificationsEnabled: boolean;
  emailProvider: 'sendgrid' | 'aws-ses' | 'smtp';
  emailFrom: string;
  emailReplyTo: string;

  // Push notifications
  pushNotificationsEnabled: boolean;
  pushProvider: 'firebase' | 'onesignal' | 'custom';

  // In-app
  inAppNotificationsEnabled: boolean;
  notificationRetentionDays: number;

  // Batching
  batchNotifications: boolean;
  batchSize: number;
  batchInterval: number; // minutes
}

export interface IntegrationSettings {
  // AI Services
  geminiApiEnabled: boolean;
  geminiApiKey?: string;
  geminiModel: string;
  geminiRateLimit: number; // requests per minute

  // Analytics
  googleAnalyticsEnabled: boolean;
  googleAnalyticsId?: string;
  customAnalyticsEndpoint?: string;

  // Storage
  cloudStorageProvider: 'firebase' | 'aws-s3' | 'cloudinary';
  cloudStorageBucket?: string;

  // Payment (if applicable)
  paymentGateway?: 'stripe' | 'razorpay' | 'paypal';
  paymentEnabled: boolean;
}

export interface SecuritySettings {
  // Authentication
  requireEmailVerification: boolean;
  passwordMinLength: number;
  passwordRequireSpecialChar: boolean;
  sessionTimeout: number; // minutes

  // Rate limiting
  loginAttemptsLimit: number;
  loginAttemptWindowMinutes: number;

  // CORS
  corsEnabled: boolean;
  allowedOrigins: string[];

  // Security headers
  cspEnabled: boolean;
  hsts Enabled: boolean;
}

// Default settings
const defaultSettings: ApplicationSettings = {
  cache: {
    enabled: true,
    ttl: 86400, // 24 hours
    maxSize: 50, // 50 MB
    strategy: 'lru',
    collegeCacheTTL: 86400,
    cutoffCacheTTL: 43200, // 12 hours
    courseCacheTTL: 86400,
    searchCacheTTL: 3600, // 1 hour
    useLocalStorage: true,
    localStorageQuota: 10 // 10 MB
  },
  api: {
    rateLimitEnabled: true,
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    burstSize: 10,
    defaultTimeout: 30000, // 30 seconds
    longTimeout: 60000, // 60 seconds
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true
  },
  performance: {
    progressiveLoadingEnabled: true,
    initialYearsToLoad: 2,
    lazyLoadThreshold: 200,
    virtualScrolling: true,
    itemsPerPage: 50,
    preloadPages: 1,
    rumEnabled: true,
    performanceAlerts: true,
    slowQueryThreshold: 1000
  },
  search: {
    hybridSearchEnabled: true,
    fuzzyMatchingEnabled: true,
    phoneticSearchEnabled: true,
    abbreviationSearchEnabled: true,
    maxResults: 50,
    fuzzyThreshold: 0.6,
    minQueryLength: 2,
    autoIndexing: true,
    indexUpdateInterval: 60
  },
  data: {
    autoRefreshEnabled: true,
    refreshInterval: 24,
    refreshTime: '02:00',
    validateOnUpload: true,
    strictValidation: false,
    allowDuplicates: false,
    streamChunkingEnabled: true,
    chunkSize: 1000
  },
  notifications: {
    emailNotificationsEnabled: true,
    emailProvider: 'sendgrid',
    emailFrom: 'noreply@example.com',
    emailReplyTo: 'support@example.com',
    pushNotificationsEnabled: true,
    pushProvider: 'firebase',
    inAppNotificationsEnabled: true,
    notificationRetentionDays: 30,
    batchNotifications: false,
    batchSize: 10,
    batchInterval: 5
  },
  integrations: {
    geminiApiEnabled: false,
    geminiModel: 'gemini-1.5-flash',
    geminiRateLimit: 15,
    googleAnalyticsEnabled: false,
    cloudStorageProvider: 'firebase',
    paymentEnabled: false
  },
  security: {
    requireEmailVerification: true,
    passwordMinLength: 8,
    passwordRequireSpecialChar: true,
    sessionTimeout: 60,
    loginAttemptsLimit: 5,
    loginAttemptWindowMinutes: 15,
    corsEnabled: true,
    allowedOrigins: ['*'],
    cspEnabled: true,
    hstsEnabled: true
  }
};

export default function ApplicationSettings() {
  const [settings, setSettings] = useState<ApplicationSettings>(defaultSettings);
  const [activeSection, setActiveSection] = useState<keyof ApplicationSettings>('cache');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || defaultSettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        setHasChanges(false);
        alert('Settings saved successfully');
      } else {
        alert('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof ApplicationSettings>(
    section: K,
    key: keyof ApplicationSettings[K],
    value: any
  ) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
    setHasChanges(true);
  };

  const sections: { id: keyof ApplicationSettings; name: string; icon: string }[] = [
    { id: 'cache', name: 'Cache', icon: '💾' },
    { id: 'api', name: 'API', icon: '🔌' },
    { id: 'performance', name: 'Performance', icon: '⚡' },
    { id: 'search', name: 'Search', icon: '🔍' },
    { id: 'data', name: 'Data', icon: '📊' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
    { id: 'integrations', name: 'Integrations', icon: '🔗' },
    { id: 'security', name: 'Security', icon: '🔒' }
  ];

  return (
    <div className="p-6 flex space-x-6">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Settings</h3>
          <div className="space-y-1">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-sm ${
                  activeSection === section.id
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>{section.icon}</span>
                <span>{section.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-700 mb-3">
              You have unsaved changes
            </p>
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          {activeSection === 'cache' && (
            <CacheSettingsPanel
              settings={settings.cache}
              onChange={(key, value) => updateSetting('cache', key, value)}
            />
          )}
          {activeSection === 'api' && (
            <APISettingsPanel
              settings={settings.api}
              onChange={(key, value) => updateSetting('api', key, value)}
            />
          )}
          {activeSection === 'performance' && (
            <PerformanceSettingsPanel
              settings={settings.performance}
              onChange={(key, value) => updateSetting('performance', key, value)}
            />
          )}
          {activeSection === 'search' && (
            <SearchSettingsPanel
              settings={settings.search}
              onChange={(key, value) => updateSetting('search', key, value)}
            />
          )}
          {/* Add other sections as needed */}
        </div>
      </div>
    </div>
  );
}

// Cache Settings Panel
function CacheSettingsPanel({
  settings,
  onChange
}: {
  settings: CacheSettings;
  onChange: (key: keyof CacheSettings, value: any) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Cache Configuration</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure caching behavior for improved performance
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={e => onChange('enabled', e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium">Enable Caching</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default TTL (seconds)
          </label>
          <input
            type="number"
            value={settings.ttl}
            onChange={e => onChange('ttl', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <p className="mt-1 text-xs text-gray-500">
            Current: {Math.round(settings.ttl / 3600)} hours
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Maximum Cache Size (MB)
          </label>
          <input
            type="number"
            value={settings.maxSize}
            onChange={e => onChange('maxSize', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cache Strategy
          </label>
          <select
            value={settings.strategy}
            onChange={e => onChange('strategy', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="lru">LRU (Least Recently Used)</option>
            <option value="lfu">LFU (Least Frequently Used)</option>
            <option value="fifo">FIFO (First In First Out)</option>
          </select>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3">Specific Cache TTLs</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                College Cache (seconds)
              </label>
              <input
                type="number"
                value={settings.collegeCacheTTL}
                onChange={e => onChange('collegeCacheTTL', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Cutoff Cache (seconds)
              </label>
              <input
                type="number"
                value={settings.cutoffCacheTTL}
                onChange={e => onChange('cutoffCacheTTL', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Course Cache (seconds)
              </label>
              <input
                type="number"
                value={settings.courseCacheTTL}
                onChange={e => onChange('courseCacheTTL', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Search Cache (seconds)
              </label>
              <input
                type="number"
                value={settings.searchCacheTTL}
                onChange={e => onChange('searchCacheTTL', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// API Settings Panel
function APISettingsPanel({
  settings,
  onChange
}: {
  settings: APISettings;
  onChange: (key: keyof APISettings, value: any) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">API Configuration</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure API rate limiting, timeouts, and retry behavior
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.rateLimitEnabled}
            onChange={e => onChange('rateLimitEnabled', e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium">Enable Rate Limiting</span>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requests Per Minute
            </label>
            <input
              type="number"
              value={settings.requestsPerMinute}
              onChange={e => onChange('requestsPerMinute', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requests Per Hour
            </label>
            <input
              type="number"
              value={settings.requestsPerHour}
              onChange={e => onChange('requestsPerHour', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Timeout (ms)
            </label>
            <input
              type="number"
              value={settings.defaultTimeout}
              onChange={e => onChange('defaultTimeout', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Long Timeout (ms)
            </label>
            <input
              type="number"
              value={settings.longTimeout}
              onChange={e => onChange('longTimeout', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Retries
          </label>
          <input
            type="number"
            value={settings.maxRetries}
            onChange={e => onChange('maxRetries', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.exponentialBackoff}
            onChange={e => onChange('exponentialBackoff', e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium">Use Exponential Backoff</span>
        </label>
      </div>
    </div>
  );
}

// Performance Settings Panel
function PerformanceSettingsPanel({
  settings,
  onChange
}: {
  settings: PerformanceSettings;
  onChange: (key: keyof PerformanceSettings, value: any) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Configuration</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure performance optimizations and monitoring
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.progressiveLoadingEnabled}
            onChange={e => onChange('progressiveLoadingEnabled', e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium">Enable Progressive Loading</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Initial Years to Load
          </label>
          <input
            type="number"
            value={settings.initialYearsToLoad}
            onChange={e => onChange('initialYearsToLoad', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.virtualScrolling}
            onChange={e => onChange('virtualScrolling', e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium">Enable Virtual Scrolling</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Items Per Page
          </label>
          <input
            type="number"
            value={settings.itemsPerPage}
            onChange={e => onChange('itemsPerPage', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.rumEnabled}
            onChange={e => onChange('rumEnabled', e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium">Enable Real User Monitoring</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Slow Query Threshold (ms)
          </label>
          <input
            type="number"
            value={settings.slowQueryThreshold}
            onChange={e => onChange('slowQueryThreshold', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}

// Search Settings Panel
function SearchSettingsPanel({
  settings,
  onChange
}: {
  settings: SearchSettings;
  onChange: (key: keyof SearchSettings, value: any) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Search Configuration</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure search engine behavior and features
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.hybridSearchEnabled}
            onChange={e => onChange('hybridSearchEnabled', e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium">Enable Hybrid Search</span>
        </label>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.fuzzyMatchingEnabled}
            onChange={e => onChange('fuzzyMatchingEnabled', e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium">Enable Fuzzy Matching</span>
        </label>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.phoneticSearchEnabled}
            onChange={e => onChange('phoneticSearchEnabled', e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium">Enable Phonetic Search</span>
        </label>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.abbreviationSearchEnabled}
            onChange={e => onChange('abbreviationSearchEnabled', e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium">Enable Abbreviation Search</span>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Results
            </label>
            <input
              type="number"
              value={settings.maxResults}
              onChange={e => onChange('maxResults', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fuzzy Threshold (0-1)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={settings.fuzzyThreshold}
              onChange={e => onChange('fuzzyThreshold', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.autoIndexing}
            onChange={e => onChange('autoIndexing', e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium">Auto-Index New Data</span>
        </label>
      </div>
    </div>
  );
}
