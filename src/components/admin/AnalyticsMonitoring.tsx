'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  BarChart3, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  Server, 
  Clock, 
  Database, 
  Wifi, 
  HardDrive,
  Cpu,
  MemoryStick,
  Eye,
  EyeOff,
  Download,
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Plus,
  Edit,
  Trash2,
  Filter
} from 'lucide-react';
import {
  SystemMetrics,
  UserAnalytics,
  ErrorLog,
  PerformanceMetrics,
  AlertRule,
  Alert,
  getRealtimeAnalytics,
  resolveAlert,
  saveAlertRule,
  deleteAlertRule,
  exportAnalyticsData,
  getPrivacyCompliantAnalytics
} from '../../services/analytics';

interface AnalyticsMonitoringProps {
  currentUser: {
    uid: string;
    email: string;
  };
}

const AnalyticsMonitoring: React.FC<AnalyticsMonitoringProps> = ({ currentUser }) => {
  // State management
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'errors' | 'performance' | 'alerts'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAlertRuleModal, setShowAlertRuleModal] = useState(false);
  const [editingAlertRule, setEditingAlertRule] = useState<AlertRule | null>(null);
  const [errorFilter, setErrorFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  // Load analytics data
  const loadAnalyticsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = getRealtimeAnalytics();
      setSystemMetrics(data.systemMetrics);
      const analyticsData = privacyMode ? getPrivacyCompliantAnalytics() : data.userAnalytics;
      setUserAnalytics(analyticsData);
      setErrorLogs(data.errorLogs);
      setPerformanceMetrics(data.performanceMetrics);
      setAlerts(data.alerts);
      setAlertRules(data.alertRules);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [privacyMode]);

  // Auto-refresh effect
  useEffect(() => {
    loadAnalyticsData();
    
    if (autoRefresh) {
      const interval = setInterval(loadAnalyticsData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [loadAnalyticsData, autoRefresh]);

  // Handle alert resolution
  const handleResolveAlert = (alertId: string) => {
    resolveAlert(alertId, currentUser.email);
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, resolved: true, resolvedAt: new Date().toISOString(), resolvedBy: currentUser.email }
        : alert
    ));
  };

  // Handle alert rule save
  const handleSaveAlertRule = (rule: AlertRule) => {
    saveAlertRule(rule);
    setAlertRules(prev => {
      const index = prev.findIndex(r => r.id === rule.id);
      if (index >= 0) {
        return prev.map(r => r.id === rule.id ? rule : r);
      }
      return [...prev, rule];
    });
    setShowAlertRuleModal(false);
    setEditingAlertRule(null);
  };

  // Handle alert rule deletion
  const handleDeleteAlertRule = (ruleId: string) => {
    if (confirm('Are you sure you want to delete this alert rule?')) {
      deleteAlertRule(ruleId);
      setAlertRules(prev => prev.filter(r => r.id !== ruleId));
    }
  };

  // Export analytics data
  const handleExportData = () => {
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    const data = exportAnalyticsData(startDate, endDate, !privacyMode);
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${endDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  // Format uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const filteredErrorLogs = errorLogs.filter(log => 
    errorFilter === 'all' || log.level === errorFilter
  );

  const unresolvedAlerts = alerts.filter(alert => !alert.resolved);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Analytics & Monitoring
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time system monitoring and user analytics dashboard
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPrivacyMode(!privacyMode)}
            className={`p-2 rounded-lg border ${
              privacyMode 
                ? 'bg-blue-50 border-blue-200 text-blue-600' 
                : 'bg-white border-gray-300 text-gray-600'
            } hover:bg-gray-50`}
            title={privacyMode ? 'Privacy mode on' : 'Privacy mode off'}
          >
            {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-lg border ${
              autoRefresh 
                ? 'bg-green-50 border-green-200 text-green-600' 
                : 'bg-white border-gray-300 text-gray-600'
            } hover:bg-gray-50`}
            title={autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            title="Export data"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={loadAnalyticsData}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Alerts Banner */}
      {unresolvedAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="font-semibold text-red-800">
              {unresolvedAlerts.length} Active Alert{unresolvedAlerts.length !== 1 ? 's' : ''}
            </h3>
          </div>
          <div className="space-y-2">
            {unresolvedAlerts.slice(0, 3).map(alert => (
              <div key={alert.id} className="flex justify-between items-center">
                <div>
                  <span className={`font-medium ${getSeverityColor(alert.severity)}`}>
                    [{alert.severity.toUpperCase()}]
                  </span>
                  <span className="ml-2 text-red-700">{alert.message}</span>
                </div>
                <button
                  onClick={() => handleResolveAlert(alert.id)}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { key: 'overview', label: 'Overview', icon: Activity },
            { key: 'users', label: 'User Analytics', icon: Users },
            { key: 'errors', label: 'Error Logs', icon: AlertTriangle },
            { key: 'performance', label: 'Performance', icon: BarChart3 },
            { key: 'alerts', label: 'Alerts', icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 py-2 px-1 border-b-2 text-sm font-medium ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.key === 'alerts' && unresolvedAlerts.length > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {unresolvedAlerts.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && systemMetrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* System Health Cards */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <Server className="h-8 w-8 text-blue-500" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">System Health</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Uptime: {formatUptime(systemMetrics.uptime)}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">CPU Usage</span>
                <span className="text-sm font-medium">{systemMetrics.cpuUsage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${systemMetrics.cpuUsage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <MemoryStick className="h-8 w-8 text-green-500" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Memory Usage</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {systemMetrics.memoryUsage.toFixed(1)}% used
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    systemMetrics.memoryUsage > 80 ? 'bg-red-500' : 
                    systemMetrics.memoryUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${systemMetrics.memoryUsage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <HardDrive className="h-8 w-8 text-purple-500" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Disk Usage</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {systemMetrics.diskUsage.toFixed(1)}% used
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    systemMetrics.diskUsage > 90 ? 'bg-red-500' : 
                    systemMetrics.diskUsage > 70 ? 'bg-yellow-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${systemMetrics.diskUsage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="h-8 w-8 text-orange-500" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Performance</h3>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Avg Response Time</span>
                <span className="text-sm font-medium">{systemMetrics.averageResponseTime}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Throughput</span>
                <span className="text-sm font-medium">{systemMetrics.throughput.toFixed(1)} req/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Error Rate</span>
                <span className={`text-sm font-medium ${
                  systemMetrics.errorRate > 5 ? 'text-red-500' : 'text-green-500'
                }`}>
                  {systemMetrics.errorRate.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <Wifi className="h-8 w-8 text-cyan-500" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Connections</h3>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Active Connections</span>
                <span className="text-sm font-medium">{systemMetrics.activeConnections}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Requests/Min</span>
                <span className="text-sm font-medium">{systemMetrics.requestsPerMinute}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && userAnalytics && (
        <div className="space-y-6">
          {/* User Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {userAnalytics.totalUsers.toLocaleString()}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-green-500" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {userAnalytics.activeUsers.toLocaleString()}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-orange-500" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {userAnalytics.newUsersToday}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">New Today</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-purple-500" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(userAnalytics.userRetention.day7 * 100).toFixed(0)}%
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">7-Day Retention</p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Pages */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Top Pages</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Page
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Views
                    </th>
                    {!privacyMode && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Unique Users
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Avg Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {userAnalytics.topPages.map((page, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {page.path}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {page.views.toLocaleString()}
                      </td>
                      {!privacyMode && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {page.uniqueUsers.toLocaleString()}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {Math.floor(page.averageTimeSpent / 60)}m {page.averageTimeSpent % 60}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'errors' && (
        <div className="space-y-6">
          {/* Error Filter */}
          <div className="flex gap-2">
            <Filter className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="flex gap-2">
              {['all', 'error', 'warning', 'info'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setErrorFilter(filter as any)}
                  className={`px-3 py-1 rounded-md text-sm ${
                    errorFilter === filter
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Error Logs Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Error Logs ({filteredErrorLogs.length})
              </h3>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredErrorLogs.map(log => {
                    const LevelIcon = log.level === 'error' ? XCircle : 
                                     log.level === 'warning' ? AlertCircle : 
                                     log.level === 'info' ? Info : CheckCircle;
                    
                    return (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <LevelIcon className={`h-4 w-4 ${
                              log.level === 'error' ? 'text-red-500' :
                              log.level === 'warning' ? 'text-yellow-500' :
                              log.level === 'info' ? 'text-blue-500' : 'text-gray-500'
                            }`} />
                            <span className={`capitalize ${
                              log.level === 'error' ? 'text-red-700' :
                              log.level === 'warning' ? 'text-yellow-700' :
                              log.level === 'info' ? 'text-blue-700' : 'text-gray-700'
                            }`}>
                              {log.level}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                          {log.message}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {log.source}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {log.resolved ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Resolved
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Open
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'performance' && performanceMetrics && (
        <div className="space-y-6">
          {/* API Performance */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">API Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Endpoint
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Avg Response
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Requests
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Error Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      P95
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {performanceMetrics.apiEndpoints.map((endpoint, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {endpoint.endpoint}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span className={`px-2 py-1 text-xs rounded ${
                          endpoint.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                          endpoint.method === 'POST' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {endpoint.method}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {endpoint.averageResponseTime}ms
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {endpoint.requestCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={endpoint.errorRate > 5 ? 'text-red-500' : 'text-green-500'}>
                          {endpoint.errorRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {endpoint.p95ResponseTime}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cache Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Database className="h-8 w-8 text-green-500" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(performanceMetrics.cacheMetrics.hitRate * 100).toFixed(1)}%
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Cache Hit Rate</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Database className="h-8 w-8 text-red-500" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(performanceMetrics.cacheMetrics.missRate * 100).toFixed(1)}%
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Cache Miss Rate</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Database className="h-8 w-8 text-yellow-500" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(performanceMetrics.cacheMetrics.evictionRate * 100).toFixed(1)}%
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Eviction Rate</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <MemoryStick className="h-8 w-8 text-purple-500" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(performanceMetrics.cacheMetrics.memoryUsage).toFixed(1)}%
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Cache Memory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* Alert Rules Header */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Alert Rules</h3>
            <button
              onClick={() => {
                setEditingAlertRule(null);
                setShowAlertRuleModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Rule
            </button>
          </div>

          {/* Alert Rules Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Metric
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Condition
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {alertRules.map(rule => (
                    <tr key={rule.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {rule.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {rule.metric}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {rule.operator.replace('_', ' ')} {rule.threshold}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`capitalize ${getSeverityColor(rule.severity)}`}>
                          {rule.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          rule.enabled 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {rule.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingAlertRule(rule);
                              setShowAlertRuleModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAlertRule(rule.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Recent Alerts</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Alert
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {alerts.map(alert => (
                    <tr key={alert.id}>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <div>
                          <div className="font-medium">{alert.ruleName}</div>
                          <div className="text-gray-500 dark:text-gray-400 text-xs">{alert.message}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`capitalize ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(alert.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {alert.resolved ? (
                          <div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Resolved
                            </span>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              by {alert.resolvedBy}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {!alert.resolved && (
                          <button
                            onClick={() => handleResolveAlert(alert.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Export Analytics Data
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Export the last 30 days of analytics data. Personal data will be {privacyMode ? 'excluded' : 'included'} based on your privacy mode setting.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExportData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Rule Modal */}
      {showAlertRuleModal && <AlertRuleModal />}
    </div>
  );

  // Alert Rule Modal Component
  function AlertRuleModal() {
    const [formData, setFormData] = useState<Partial<AlertRule>>(
      editingAlertRule || {
        name: '',
        description: '',
        metric: 'memory_usage',
        operator: 'greater_than',
        threshold: 80,
        duration: 5,
        enabled: true,
        severity: 'medium',
        recipients: [currentUser.email]
      }
    );

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
    const rule: AlertRule = {
      ...formData as AlertRule,
      id: editingAlertRule?.id || `alert_rule_${Date.now()}`,
      createdAt: editingAlertRule?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
      handleSaveAlertRule(rule);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingAlertRule ? 'Edit Alert Rule' : 'Create Alert Rule'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Metric
                </label>
                <select
                  value={formData.metric || ''}
                  onChange={e => setFormData(prev => ({ ...prev, metric: e.target.value }))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="memory_usage">Memory Usage</option>
                  <option value="cpu_usage">CPU Usage</option>
                  <option value="disk_usage">Disk Usage</option>
                  <option value="error_rate">Error Rate</option>
                  <option value="response_time">Response Time</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Operator
                </label>
                <select
                  value={formData.operator || ''}
                  onChange={e => setFormData(prev => ({ ...prev, operator: e.target.value as any }))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="greater_than">Greater Than</option>
                  <option value="less_than">Less Than</option>
                  <option value="equals">Equals</option>
                  <option value="not_equals">Not Equals</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Threshold
                </label>
                <input
                  type="number"
                  value={formData.threshold || ''}
                  onChange={e => setFormData(prev => ({ ...prev, threshold: Number(e.target.value) }))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={formData.duration || ''}
                  onChange={e => setFormData(prev => ({ ...prev, duration: Number(e.target.value) }))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Severity
              </label>
              <select
                value={formData.severity || ''}
                onChange={e => setFormData(prev => ({ ...prev, severity: e.target.value as any }))}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled || false}
                onChange={e => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">
                Enable alert rule
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAlertRuleModal(false);
                  setEditingAlertRule(null);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingAlertRule ? 'Update' : 'Create'} Rule
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
};

export default AnalyticsMonitoring;