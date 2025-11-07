'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  Search,
  Monitor,
  Globe,
  Download,
  Upload,
  RotateCcw,
  Save,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Smartphone,
  Mail,
  Lock,
  Database,
  BarChart3,
  MapPin,
  Image,
  Play,
  Zap,
  Layout,
  Grid,
  List,
  Accessibility,
  Type,
  Contrast,
  MousePointer,
  Keyboard
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';

const SettingsPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { preferences, loading, updatePreference, resetPreferences, exportPreferences, importPreferences } = useUserPreferences();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'privacy' | 'accessibility' | 'data'>('general');
  const [saving, setSaving] = useState(false);
  const [importData, setImportData] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  const handlePreferenceUpdate = async (category: keyof typeof preferences, updates: any) => {
    try {
      setSaving(true);
      await updatePreference(category, updates);
    } catch (error) {
      console.error('Failed to update preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const data = exportPreferences();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neetlogiq-preferences-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    try {
      setSaving(true);
      await importPreferences(importData);
      setShowImportDialog(false);
      setImportData('');
      alert('Preferences imported successfully!');
    } catch (error) {
      alert('Failed to import preferences. Please check the file format.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all preferences to default? This action cannot be undone.')) {
      try {
        setSaving(true);
        await resetPreferences();
        alert('Preferences reset to default successfully!');
      } catch (error) {
        alert('Failed to reset preferences.');
      } finally {
        setSaving(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                <Settings className="w-8 h-8 mr-3 text-blue-600" />
                Settings & Preferences
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Customize your NeetLogIQ experience
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleExport}
                className="flex items-center px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
              <button
                onClick={() => setShowImportDialog(true)}
                className="flex items-center px-4 py-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import
              </button>
              <button
                onClick={handleReset}
                className="flex items-center px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              {[
                { id: 'general', name: 'General', icon: User },
                { id: 'notifications', name: 'Notifications', icon: Bell },
                { id: 'privacy', name: 'Privacy', icon: Shield },
                { id: 'accessibility', name: 'Accessibility', icon: Accessibility },
                { id: 'data', name: 'Data & Storage', icon: Database }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  <tab.icon className="w-5 h-5 mr-3" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">
            {/* General Settings */}
            {activeTab === 'general' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Theme Settings */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <Palette className="w-5 h-5 mr-2" />
                    Appearance
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Theme
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { value: 'light', label: 'Light', icon: '☀️' },
                          { value: 'dark', label: 'Dark', icon: '🌙' },
                          { value: 'system', label: 'System', icon: '💻' }
                        ].map((theme) => (
                          <button
                            key={theme.value}
                            onClick={() => handlePreferenceUpdate('theme', theme.value)}
                            className={`p-3 rounded-lg border-2 transition-colors ${
                              preferences.theme === theme.value
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                            }`}
                          >
                            <div className="text-2xl mb-1">{theme.icon}</div>
                            <div className="text-sm font-medium">{theme.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Font Size
                      </label>
                      <select
                        value={preferences.fontSize}
                        onChange={(e) => handlePreferenceUpdate('fontSize', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Density
                      </label>
                      <select
                        value={preferences.density}
                        onChange={(e) => handlePreferenceUpdate('density', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="compact">Compact</option>
                        <option value="comfortable">Comfortable</option>
                        <option value="spacious">Spacious</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Language
                      </label>
                      <select
                        value={preferences.language}
                        onChange={(e) => handlePreferenceUpdate('language', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="en">English</option>
                        <option value="hi">Hindi</option>
                        <option value="ta">Tamil</option>
                        <option value="te">Telugu</option>
                        <option value="bn">Bengali</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Content Settings */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <Layout className="w-5 h-5 mr-2" />
                    Content Display
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Show Images</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Display college and course images</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.content.showImages}
                          onChange={(e) => handlePreferenceUpdate('content', { showImages: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Autoplay Videos</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Automatically play video content</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.content.autoplayVideos}
                          onChange={(e) => handlePreferenceUpdate('content', { autoplayVideos: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Items per page
                      </label>
                      <select
                        value={preferences.content.itemsPerPage}
                        onChange={(e) => handlePreferenceUpdate('content', { itemsPerPage: parseInt(e.target.value) as any })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Dashboard Settings */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <Monitor className="w-5 h-5 mr-2" />
                    Dashboard
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Layout Style
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { value: 'cards', label: 'Cards', icon: Grid },
                          { value: 'list', label: 'List', icon: List },
                          { value: 'grid', label: 'Grid', icon: BarChart3 }
                        ].map((layout) => (
                          <button
                            key={layout.value}
                            onClick={() => handlePreferenceUpdate('dashboard', { layout: layout.value })}
                            className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center ${
                              preferences.dashboard.layout === layout.value
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                            }`}
                          >
                            <layout.icon className="w-5 h-5 mb-1" />
                            <div className="text-sm font-medium">{layout.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Default View
                      </label>
                      <select
                        value={preferences.dashboard.defaultView}
                        onChange={(e) => handlePreferenceUpdate('dashboard', { defaultView: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="overview">Overview</option>
                        <option value="colleges">Colleges</option>
                        <option value="courses">Courses</option>
                        <option value="cutoffs">Cutoffs</option>
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Notifications Settings */}
            {activeTab === 'notifications' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm"
              >
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  Notification Preferences
                </h3>
                <div className="space-y-6">
                  {[
                    { key: 'email', label: 'Email Notifications', description: 'Receive updates via email', icon: Mail },
                    { key: 'push', label: 'Push Notifications', description: 'Browser and mobile notifications', icon: Smartphone },
                    { key: 'marketing', label: 'Marketing Communications', description: 'Updates about new features and offers', icon: Volume2 },
                    { key: 'updates', label: 'System Updates', description: 'Important system and security updates', icon: Shield },
                    { key: 'reminders', label: 'Reminders', description: 'Application deadlines and important dates', icon: Bell }
                  ].map((notification) => (
                    <div key={notification.key} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <notification.icon className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">{notification.label}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{notification.description}</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.notifications[notification.key as keyof typeof preferences.notifications]}
                          onChange={(e) => handlePreferenceUpdate('notifications', { [notification.key]: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Privacy Settings */}
            {activeTab === 'privacy' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm"
              >
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Privacy & Data
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Profile Visibility
                    </label>
                    <select
                      value={preferences.privacy.profileVisibility}
                      onChange={(e) => handlePreferenceUpdate('privacy', { profileVisibility: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                      <option value="friends">Friends Only</option>
                    </select>
                  </div>

                  {[
                    { key: 'dataSharing', label: 'Data Sharing', description: 'Allow anonymous data sharing for service improvements', icon: Database },
                    { key: 'analytics', label: 'Analytics', description: 'Help us improve by sharing usage analytics', icon: BarChart3 },
                    { key: 'locationTracking', label: 'Location Tracking', description: 'Use your location for personalized content', icon: MapPin }
                  ].map((privacy) => (
                    <div key={privacy.key} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <privacy.icon className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">{privacy.label}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{privacy.description}</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.privacy[privacy.key as keyof typeof preferences.privacy]}
                          onChange={(e) => handlePreferenceUpdate('privacy', { [privacy.key]: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Accessibility Settings */}
            {activeTab === 'accessibility' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm"
              >
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center">
                  <Accessibility className="w-5 h-5 mr-2" />
                  Accessibility Options
                </h3>
                <div className="space-y-6">
                  {[
                    { key: 'highContrast', label: 'High Contrast', description: 'Increase contrast for better visibility', icon: Contrast },
                    { key: 'reduceMotion', label: 'Reduce Motion', description: 'Minimize animations and motion effects', icon: Zap },
                    { key: 'screenReader', label: 'Screen Reader Support', description: 'Optimize for screen reading software', icon: Volume2 },
                    { key: 'keyboardNavigation', label: 'Keyboard Navigation', description: 'Enhanced keyboard navigation support', icon: Keyboard }
                  ].map((accessibility) => (
                    <div key={accessibility.key} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <accessibility.icon className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">{accessibility.label}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{accessibility.description}</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.accessibility[accessibility.key as keyof typeof preferences.accessibility]}
                          onChange={(e) => handlePreferenceUpdate('accessibility', { [accessibility.key]: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Data & Storage Settings */}
            {activeTab === 'data' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center">
                    <Database className="w-5 h-5 mr-2" />
                    Data Management
                  </h3>
                  <div className="space-y-6">
                    {[
                      { key: 'saveHistory', label: 'Save Search History', description: 'Remember your search queries for quick access', icon: Search },
                      { key: 'autoSuggestions', label: 'Auto Suggestions', description: 'Show search suggestions as you type', icon: Type },
                      { key: 'personalizedResults', label: 'Personalized Results', description: 'Tailor results based on your preferences', icon: User }
                    ].map((search) => (
                      <div key={search.key} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <search.icon className="w-5 h-5 text-gray-400 mr-3" />
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">{search.label}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{search.description}</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={preferences.search[search.key as keyof typeof preferences.search]}
                            onChange={(e) => handlePreferenceUpdate('search', { [search.key]: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Import/Export Settings
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={handleExport}
                        className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export Preferences
                      </button>
                      <button
                        onClick={() => setShowImportDialog(true)}
                        className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Import Preferences
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Import Dialog */}
        {showImportDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Import Preferences
              </h3>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste your preferences JSON here..."
                className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={() => {
                    setShowImportDialog(false);
                    setImportData('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!importData.trim() || saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Importing...' : 'Import'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;