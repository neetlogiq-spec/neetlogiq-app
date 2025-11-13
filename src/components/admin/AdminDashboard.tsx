'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  Building2,
  BookOpen,
  BarChart3,
  Users,
  TrendingUp,
  Activity,
  Clock,
  Shield,
  Menu,
  X,
  FileText,
  Gift,
  Repeat
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import DataManagementSection from './DataManagementSection';
import StatisticsCards from './StatisticsCards';
import DocumentsManager from './DocumentsManager';
import SubscriptionGiftManager from './SubscriptionGiftManager';
import UserStreamChangeManager from './UserStreamChangeManager';

const AdminDashboard: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<'overview' | 'data' | 'documents' | 'subscriptions' | 'stream-changes'>('overview');

  const navigation = [
    { id: 'overview', name: 'Overview', icon: Activity, description: 'Dashboard & Stats' },
    { id: 'data', name: 'Data Management', icon: Database, description: 'Colleges, Cutoffs, Courses' },
    { id: 'documents', name: 'Documents', icon: FileText, description: 'Counselling Documents' },
    { id: 'subscriptions', name: 'Gift Subscriptions', icon: Gift, description: 'Activate user subscriptions' },
    { id: 'stream-changes', name: 'Stream Changes', icon: Repeat, description: 'Manage stream requests' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors lg:hidden"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Admin Panel
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  NEETLogiq Data Management
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                System Online
              </span>
            </div>
            <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed lg:relative lg:translate-x-0 z-40 w-64 h-[calc(100vh-73px)] bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-r border-gray-200 dark:border-gray-800 transition-transform duration-300 ease-in-out`}
        >
          <nav className="p-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as any)}
                  className={`w-full flex items-start space-x-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/50'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Icon className={`h-5 w-5 mt-0.5 ${isActive ? 'text-white' : ''}`} />
                  <div className="text-left">
                    <div className={`font-semibold ${isActive ? 'text-white' : ''}`}>
                      {item.name}
                    </div>
                    <div className={`text-xs ${isActive ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Quick Stats in Sidebar */}
          <div className="p-4 mt-6">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Quick Stats
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Colleges</span>
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">2,442</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Cutoffs</span>
                </div>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">16,284</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Courses</span>
                </div>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">500</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
          {activeSection === 'overview' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Welcome Section */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white shadow-2xl">
                <h2 className="text-3xl font-bold mb-2">Welcome Back, Admin! 👋</h2>
                <p className="text-blue-100 mb-6">
                  Manage your entire database with ease. Update colleges, cutoffs, and courses in seconds.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => setActiveSection('data')}
                    className="px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    Go to Data Management
                  </button>
                  <button className="px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl font-semibold hover:bg-white/30 transition-all">
                    View Reports
                  </button>
                </div>
              </div>

              {/* Statistics Cards */}
              <StatisticsCards />

              {/* Recent Activity */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-blue-600" />
                    Recent Activity
                  </h3>
                  <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    View All
                  </button>
                </div>
                <div className="space-y-4">
                  {[
                    { action: 'Updated cutoff', resource: 'MBBS at AIIMS Delhi', time: '2 minutes ago', type: 'update' },
                    { action: 'Created college', resource: 'XYZ Medical College', time: '1 hour ago', type: 'create' },
                    { action: 'Deleted cutoff', resource: 'Outdated 2020 data', time: '3 hours ago', type: 'delete' },
                  ].map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-2 h-2 rounded-full ${
                          activity.type === 'update' ? 'bg-blue-500' :
                          activity.type === 'create' ? 'bg-green-500' :
                          'bg-red-500'
                        }`}></div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {activity.action}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {activity.resource}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {activity.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'data' && (
            <div className="animate-fadeIn">
              <DataManagementSection />
            </div>
          )}

          {activeSection === 'documents' && (
            <div className="animate-fadeIn">
              <DocumentsManager />
            </div>
          )}

          {activeSection === 'subscriptions' && (
            <div className="animate-fadeIn">
              <SubscriptionGiftManager />
            </div>
          )}

          {activeSection === 'stream-changes' && (
            <div className="animate-fadeIn">
              <UserStreamChangeManager />
            </div>
          )}
        </main>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
};

export default AdminDashboard;
