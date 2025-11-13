'use client';

import React, { useState } from 'react';
import { Building2, BarChart3, BookOpen, History, Download, Upload, RefreshCw } from 'lucide-react';
import CollegesManager from './CollegesManager';
import CutoffsManager from './CutoffsManager';
import AuditLogViewer from './AuditLogViewer';

type Tab = 'colleges' | 'cutoffs' | 'courses' | 'audit';

const DataManagementSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('colleges');

  const tabs = [
    {
      id: 'colleges' as Tab,
      label: 'Colleges',
      icon: Building2,
      count: 2442,
      color: 'blue'
    },
    {
      id: 'cutoffs' as Tab,
      label: 'Cutoffs',
      icon: BarChart3,
      count: 16284,
      color: 'purple'
    },
    {
      id: 'courses' as Tab,
      label: 'Courses',
      icon: BookOpen,
      count: 500,
      color: 'green'
    },
    {
      id: 'audit' as Tab,
      label: 'Audit Log',
      icon: History,
      count: null,
      color: 'gray'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Data Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Create, read, update, and delete database records
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all">
            <Upload className="h-4 w-4 mr-2" />
            Import Data
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-2">
        <div className="flex space-x-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-white' : ''}`} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                    {tab.count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-fadeIn">
        {activeTab === 'colleges' && <CollegesManager />}
        {activeTab === 'cutoffs' && <CutoffsManager />}
        {activeTab === 'courses' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl mb-6">
              <BookOpen className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Courses Management
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Manage all medical and dental courses. Coming soon with advanced features.
            </p>
            <button className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all">
              Request Early Access
            </button>
          </div>
        )}
        {activeTab === 'audit' && <AuditLogViewer />}
      </div>
    </div>
  );
};

export default DataManagementSection;
