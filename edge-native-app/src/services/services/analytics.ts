/**
 * Analytics & Monitoring Service
 * Handles real-time system monitoring, user analytics, error tracking, and performance metrics
 */

export interface SystemMetrics {
  timestamp: string;
  uptime: number; // in seconds
  memoryUsage: number; // percentage
  diskUsage: number; // percentage
  cpuUsage: number; // percentage
  activeConnections: number;
  requestsPerMinute: number;
  averageResponseTime: number; // milliseconds
  errorRate: number; // percentage
  throughput: number; // requests per second
}

export interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  userRetention: {
    day1: number;
    day7: number;
    day30: number;
  };
  topPages: Array<{
    path: string;
    views: number;
    uniqueUsers: number;
    averageTimeSpent: number;
  }>;
  userGrowthData: Array<{
    date: string;
    totalUsers: number;
    newUsers: number;
    activeUsers: number;
  }>;
  demographicData: {
    byDevice: Record<string, number>;
    byLocation: Record<string, number>;
    byReferrer: Record<string, number>;
  };
}

export interface ErrorLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  source: string;
  stack?: string;
  userAgent?: string;
  userId?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface PerformanceMetrics {
  apiEndpoints: Array<{
    endpoint: string;
    method: string;
    averageResponseTime: number;
    requestCount: number;
    errorRate: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  }>;
  pageLoadTimes: Array<{
    page: string;
    averageLoadTime: number;
    medianLoadTime: number;
    p95LoadTime: number;
    bounceRate: number;
  }>;
  databaseQueries: Array<{
    query: string;
    averageExecutionTime: number;
    executionCount: number;
    slowQueryThreshold: number;
  }>;
  cacheMetrics: {
    hitRate: number;
    missRate: number;
    evictionRate: number;
    memoryUsage: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  duration: number; // minutes
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recipients: string[];
  lastTriggered?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  metadata?: Record<string, any>;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'alert' | 'heatmap';
  title: string;
  description?: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
  dataSource: string;
  refreshInterval: number; // seconds
  visibility: 'public' | 'admin' | 'private';
}

// Mock data generators for demonstration
export function generateSystemMetrics(): SystemMetrics {
  const now = new Date();
  return {
    timestamp: now.toISOString(),
    uptime: Math.floor(Math.random() * 86400 * 30), // Up to 30 days
    memoryUsage: Math.floor(Math.random() * 40) + 40, // 40-80%
    diskUsage: Math.floor(Math.random() * 30) + 20, // 20-50%
    cpuUsage: Math.floor(Math.random() * 60) + 10, // 10-70%
    activeConnections: Math.floor(Math.random() * 1000) + 100,
    requestsPerMinute: Math.floor(Math.random() * 500) + 50,
    averageResponseTime: Math.floor(Math.random() * 200) + 50,
    errorRate: Math.random() * 5, // 0-5%
    throughput: Math.random() * 100 + 20
  };
}

export function generateUserAnalytics(): UserAnalytics {
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      date: date.toISOString().split('T')[0],
      totalUsers: Math.floor(Math.random() * 1000) + 500 + i * 10,
      newUsers: Math.floor(Math.random() * 50) + 10,
      activeUsers: Math.floor(Math.random() * 300) + 100
    };
  });

  return {
    totalUsers: 1250,
    activeUsers: 892,
    newUsersToday: 23,
    newUsersThisWeek: 156,
    newUsersThisMonth: 645,
    userRetention: {
      day1: 0.85,
      day7: 0.68,
      day30: 0.45
    },
    topPages: [
      { path: '/colleges', views: 15420, uniqueUsers: 8920, averageTimeSpent: 180 },
      { path: '/search', views: 12340, uniqueUsers: 7650, averageTimeSpent: 240 },
      { path: '/courses', views: 9870, uniqueUsers: 6540, averageTimeSpent: 150 },
      { path: '/compare', views: 5670, uniqueUsers: 3890, averageTimeSpent: 300 },
      { path: '/', views: 8920, uniqueUsers: 4560, averageTimeSpent: 120 }
    ],
    userGrowthData: last30Days,
    demographicData: {
      byDevice: {
        'Desktop': 65,
        'Mobile': 30,
        'Tablet': 5
      },
      byLocation: {
        'Maharashtra': 25,
        'Delhi': 18,
        'Karnataka': 15,
        'Uttar Pradesh': 12,
        'Tamil Nadu': 10,
        'Other': 20
      },
      byReferrer: {
        'Organic Search': 45,
        'Direct': 30,
        'Social Media': 15,
        'Referral': 10
      }
    }
  };
}

export function generateErrorLogs(): ErrorLog[] {
  const errorTypes = [
    'Database connection timeout',
    'API rate limit exceeded',
    'File upload failed',
    'Authentication error',
    'Search service unavailable',
    'Cache miss - performance warning',
    'Memory usage high',
    'Slow query detected'
  ];

  const sources = [
    '/api/colleges',
    '/api/search',
    '/api/upload',
    '/api/auth',
    '/api/users',
    'search-service',
    'database',
    'cache-layer'
  ];

  return Array.from({ length: 50 }, (_, i) => {
    const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    return {
      id: `error_${Date.now()}_${i}`,
      timestamp: timestamp.toISOString(),
      level: Math.random() > 0.7 ? 'error' : Math.random() > 0.5 ? 'warning' : Math.random() > 0.3 ? 'info' : 'debug',
      message: errorTypes[Math.floor(Math.random() * errorTypes.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      stack: Math.random() > 0.6 ? 'Error stack trace would be here...' : undefined,
      userAgent: Math.random() > 0.5 ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' : undefined,
      userId: Math.random() > 0.7 ? `user_${Math.floor(Math.random() * 1000)}` : undefined,
      url: Math.random() > 0.4 ? sources[Math.floor(Math.random() * sources.length)] : undefined,
      method: Math.random() > 0.5 ? 'GET' : 'POST',
      statusCode: Math.random() > 0.6 ? 500 : Math.random() > 0.3 ? 404 : 200,
      duration: Math.floor(Math.random() * 5000) + 100,
      resolved: Math.random() > 0.3,
      resolvedBy: Math.random() > 0.5 ? 'admin@neetlogiq.com' : undefined,
      resolvedAt: Math.random() > 0.5 ? new Date(timestamp.getTime() + Math.random() * 86400000).toISOString() : undefined
    };
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function generatePerformanceMetrics(): PerformanceMetrics {
  const endpoints = [
    { endpoint: '/api/colleges', method: 'GET' },
    { endpoint: '/api/search', method: 'POST' },
    { endpoint: '/api/courses', method: 'GET' },
    { endpoint: '/api/cutoffs', method: 'GET' },
    { endpoint: '/api/compare', method: 'POST' },
    { endpoint: '/api/users', method: 'GET' },
    { endpoint: '/api/auth', method: 'POST' }
  ];

  const pages = [
    '/colleges',
    '/search', 
    '/courses',
    '/compare',
    '/',
    '/profile',
    '/login'
  ];

  return {
    apiEndpoints: endpoints.map(ep => ({
      endpoint: ep.endpoint,
      method: ep.method,
      averageResponseTime: Math.floor(Math.random() * 300) + 50,
      requestCount: Math.floor(Math.random() * 10000) + 1000,
      errorRate: Math.random() * 5,
      p95ResponseTime: Math.floor(Math.random() * 500) + 200,
      p99ResponseTime: Math.floor(Math.random() * 1000) + 500
    })),
    pageLoadTimes: pages.map(page => ({
      page,
      averageLoadTime: Math.floor(Math.random() * 2000) + 500,
      medianLoadTime: Math.floor(Math.random() * 1500) + 400,
      p95LoadTime: Math.floor(Math.random() * 4000) + 1000,
      bounceRate: Math.random() * 0.6 + 0.1
    })),
    databaseQueries: [
      {
        query: 'SELECT * FROM colleges WHERE state = ?',
        averageExecutionTime: Math.floor(Math.random() * 100) + 10,
        executionCount: Math.floor(Math.random() * 5000) + 1000,
        slowQueryThreshold: 1000
      },
      {
        query: 'SELECT * FROM cutoffs WHERE college_id = ? AND year = ?',
        averageExecutionTime: Math.floor(Math.random() * 200) + 50,
        executionCount: Math.floor(Math.random() * 3000) + 500,
        slowQueryThreshold: 1000
      }
    ],
    cacheMetrics: {
      hitRate: Math.random() * 0.3 + 0.7, // 70-100%
      missRate: Math.random() * 0.3, // 0-30%
      evictionRate: Math.random() * 0.1, // 0-10%
      memoryUsage: Math.random() * 40 + 40 // 40-80%
    }
  };
}

export function getStoredAlertRules(): AlertRule[] {
  try {
    const stored = localStorage.getItem('alert_rules');
    return stored ? JSON.parse(stored) : getDefaultAlertRules();
  } catch (error) {
    return getDefaultAlertRules();
  }
}

export function getDefaultAlertRules(): AlertRule[] {
  return [
    {
      id: 'high_memory_usage',
      name: 'High Memory Usage',
      description: 'Alert when memory usage exceeds 85%',
      metric: 'memory_usage',
      operator: 'greater_than',
      threshold: 85,
      duration: 5,
      enabled: true,
      severity: 'high',
      recipients: ['admin@neetlogiq.com'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'high_error_rate',
      name: 'High Error Rate',
      description: 'Alert when error rate exceeds 5%',
      metric: 'error_rate',
      operator: 'greater_than',
      threshold: 5,
      duration: 2,
      enabled: true,
      severity: 'critical',
      recipients: ['admin@neetlogiq.com'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'slow_response_time',
      name: 'Slow Response Time',
      description: 'Alert when average response time exceeds 1000ms',
      metric: 'response_time',
      operator: 'greater_than',
      threshold: 1000,
      duration: 3,
      enabled: true,
      severity: 'medium',
      recipients: ['admin@neetlogiq.com'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'low_disk_space',
      name: 'Low Disk Space',
      description: 'Alert when disk usage exceeds 90%',
      metric: 'disk_usage',
      operator: 'greater_than',
      threshold: 90,
      duration: 10,
      enabled: true,
      severity: 'high',
      recipients: ['admin@neetlogiq.com'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

export function saveAlertRule(rule: AlertRule): void {
  const rules = getStoredAlertRules();
  const existingIndex = rules.findIndex(r => r.id === rule.id);
  
  if (existingIndex >= 0) {
    rules[existingIndex] = { ...rule, updatedAt: new Date().toISOString() };
  } else {
    rules.push({ ...rule, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  
  localStorage.setItem('alert_rules', JSON.stringify(rules));
}

export function deleteAlertRule(ruleId: string): void {
  const rules = getStoredAlertRules();
  const filteredRules = rules.filter(r => r.id !== ruleId);
  localStorage.setItem('alert_rules', JSON.stringify(filteredRules));
}

export function getActiveAlerts(): Alert[] {
  try {
    const stored = localStorage.getItem('active_alerts');
    return stored ? JSON.parse(stored) : generateMockAlerts();
  } catch (error) {
    return generateMockAlerts();
  }
}

export function generateMockAlerts(): Alert[] {
  const now = new Date();
  return [
    {
      id: 'alert_1',
      ruleId: 'high_memory_usage',
      ruleName: 'High Memory Usage',
      message: 'Memory usage has exceeded 85% for the last 5 minutes',
      severity: 'high',
      timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      resolved: false
    },
    {
      id: 'alert_2',
      ruleId: 'slow_response_time',
      ruleName: 'Slow Response Time',
      message: 'Average response time exceeded 1000ms',
      severity: 'medium',
      timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      resolved: true,
      resolvedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      resolvedBy: 'admin@neetlogiq.com'
    }
  ];
}

export function resolveAlert(alertId: string, resolvedBy: string): void {
  const alerts = getActiveAlerts();
  const alertIndex = alerts.findIndex(a => a.id === alertId);
  
  if (alertIndex >= 0) {
    alerts[alertIndex] = {
      ...alerts[alertIndex],
      resolved: true,
      resolvedAt: new Date().toISOString(),
      resolvedBy
    };
    localStorage.setItem('active_alerts', JSON.stringify(alerts));
  }
}

export function createCustomDashboard(): DashboardWidget[] {
  return [
    {
      id: 'system_overview',
      type: 'metric',
      title: 'System Overview',
      position: { x: 0, y: 0, w: 6, h: 3 },
      config: { metrics: ['cpu', 'memory', 'disk'] },
      dataSource: 'system_metrics',
      refreshInterval: 30,
      visibility: 'admin'
    },
    {
      id: 'user_growth',
      type: 'chart',
      title: 'User Growth',
      position: { x: 6, y: 0, w: 6, h: 3 },
      config: { chartType: 'line', timeRange: '30d' },
      dataSource: 'user_analytics',
      refreshInterval: 300,
      visibility: 'admin'
    },
    {
      id: 'error_log',
      type: 'table',
      title: 'Recent Errors',
      position: { x: 0, y: 3, w: 12, h: 4 },
      config: { limit: 10, severity: 'all' },
      dataSource: 'error_logs',
      refreshInterval: 60,
      visibility: 'admin'
    },
    {
      id: 'performance_metrics',
      type: 'chart',
      title: 'API Performance',
      position: { x: 0, y: 7, w: 8, h: 3 },
      config: { chartType: 'bar', metric: 'response_time' },
      dataSource: 'performance_metrics',
      refreshInterval: 120,
      visibility: 'admin'
    },
    {
      id: 'active_alerts',
      type: 'alert',
      title: 'Active Alerts',
      position: { x: 8, y: 7, w: 4, h: 3 },
      config: { showResolved: false },
      dataSource: 'alerts',
      refreshInterval: 30,
      visibility: 'admin'
    }
  ];
}

/**
 * Get real-time analytics data
 */
export function getRealtimeAnalytics() {
  return {
    systemMetrics: generateSystemMetrics(),
    userAnalytics: generateUserAnalytics(),
    errorLogs: generateErrorLogs(),
    performanceMetrics: generatePerformanceMetrics(),
    alerts: getActiveAlerts(),
    alertRules: getStoredAlertRules(),
    dashboardWidgets: createCustomDashboard()
  };
}

/**
 * Export analytics data for compliance/reporting
 */
export function exportAnalyticsData(
  startDate: string,
  endDate: string,
  includePersonalData: boolean = false
): string {
  const data = {
    exportDate: new Date().toISOString(),
    dateRange: { startDate, endDate },
    includePersonalData,
    systemMetrics: generateSystemMetrics(),
    userAnalytics: includePersonalData ? generateUserAnalytics() : {
      ...generateUserAnalytics(),
      topPages: generateUserAnalytics().topPages.map(page => ({
        ...page,
        uniqueUsers: '[REDACTED]' // Privacy-compliant
      }))
    },
    performanceMetrics: generatePerformanceMetrics(),
    errorSummary: {
      totalErrors: 150,
      errorsByLevel: {
        error: 45,
        warning: 78,
        info: 27
      },
      topErrorSources: ['/api/search', '/api/colleges', '/api/auth']
    }
  };
  
  return JSON.stringify(data, null, 2);
}

/**
 * Privacy-compliant user analytics
 */
export function getPrivacyCompliantAnalytics() {
  const analytics = generateUserAnalytics();
  
  // Remove potentially identifying information
  return {
    ...analytics,
    topPages: analytics.topPages.map(page => ({
      path: page.path,
      views: page.views,
      // Remove unique user tracking for privacy
      averageTimeSpent: page.averageTimeSpent
    })),
    demographicData: {
      // Only include aggregated, non-identifying demographic data
      byDevice: analytics.demographicData.byDevice,
      // Remove location data for privacy
      byReferrer: analytics.demographicData.byReferrer
    }
  };
}