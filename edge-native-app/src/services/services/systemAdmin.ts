/**
 * System Administration Service
 * Handles backup/restore, configuration management, feature flags, and maintenance mode
 */

export interface SystemBackup {
  id: string;
  name: string;
  description?: string;
  type: 'full' | 'data' | 'config' | 'users';
  size: number; // in bytes
  createdAt: string;
  createdBy: string;
  status: 'creating' | 'completed' | 'failed' | 'corrupted';
  metadata: {
    tables?: string[];
    recordCount?: number;
    compression?: string;
    checksum?: string;
    version?: string;
  };
}

export interface BackupOperation {
  id: string;
  type: 'backup' | 'restore';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  startTime: string;
  endTime?: string;
  message?: string;
  error?: string;
  backupId?: string;
}

export interface SystemConfiguration {
  id: string;
  category: string;
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  description: string;
  isSecure?: boolean; // If true, value should be encrypted
  updatedAt: string;
  updatedBy: string;
  environment?: 'development' | 'staging' | 'production' | 'all';
  requiresRestart?: boolean;
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'boolean' | 'percentage' | 'user_list' | 'user_attribute';
  value?: any; // For percentage (0-100) or user lists
  conditions?: FeatureFlagCondition[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  environment: 'development' | 'staging' | 'production' | 'all';
  tags?: string[];
}

export interface FeatureFlagCondition {
  attribute: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface MaintenanceMode {
  enabled: boolean;
  message: string;
  startTime?: string;
  endTime?: string;
  allowedEmails?: string[]; // Admins who can access during maintenance
  bypassCode?: string; // Emergency bypass code
  updatedAt: string;
  updatedBy: string;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical' | 'maintenance';
  uptime: number; // in seconds
  lastChecked: string;
  components: {
    database: 'healthy' | 'warning' | 'error';
    storage: 'healthy' | 'warning' | 'error';
    api: 'healthy' | 'warning' | 'error';
    search: 'healthy' | 'warning' | 'error';
    auth: 'healthy' | 'warning' | 'error';
  };
  metrics: {
    memoryUsage: number;
    diskUsage: number;
    activeUsers: number;
    errorRate: number;
    responseTime: number;
  };
}

// Default system configurations
export const DEFAULT_SYSTEM_CONFIG: SystemConfiguration[] = [
  {
    id: 'session_timeout',
    category: 'security',
    key: 'session_timeout_minutes',
    value: 30,
    type: 'number',
    description: 'Session timeout in minutes for regular users',
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
    environment: 'all'
  },
  {
    id: 'admin_session_timeout',
    category: 'security',
    key: 'admin_session_timeout_minutes',
    value: 30,
    type: 'number',
    description: 'Session timeout in minutes for admin users',
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
    environment: 'all'
  },
  {
    id: 'max_file_upload_size',
    category: 'upload',
    key: 'max_file_size_mb',
    value: 50,
    type: 'number',
    description: 'Maximum file upload size in MB',
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
    environment: 'all'
  },
  {
    id: 'search_results_limit',
    category: 'search',
    key: 'default_search_limit',
    value: 20,
    type: 'number',
    description: 'Default number of search results per page',
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
    environment: 'all'
  },
  {
    id: 'enable_analytics',
    category: 'analytics',
    key: 'analytics_enabled',
    value: true,
    type: 'boolean',
    description: 'Enable user analytics tracking',
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
    environment: 'all'
  },
  {
    id: 'api_rate_limit',
    category: 'api',
    key: 'requests_per_minute',
    value: 60,
    type: 'number',
    description: 'API rate limit per user per minute',
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
    environment: 'all'
  }
];

// Default feature flags
export const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: 'new_search_ui',
    key: 'new_search_ui',
    name: 'New Search UI',
    description: 'Enable the new search interface with advanced filters',
    enabled: false,
    type: 'percentage',
    value: 10, // 10% rollout
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
    environment: 'production'
  },
  {
    id: 'college_comparison',
    key: 'college_comparison',
    name: 'College Comparison',
    description: 'Enable side-by-side college comparison feature',
    enabled: true,
    type: 'boolean',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
    environment: 'all'
  },
  {
    id: 'ai_recommendations',
    key: 'ai_recommendations',
    name: 'AI Recommendations',
    description: 'Enable AI-powered college recommendations',
    enabled: false,
    type: 'user_list',
    value: ['admin@neetlogiq.com'], // Specific users
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
    environment: 'development'
  },
  {
    id: 'beta_features',
    key: 'beta_features',
    name: 'Beta Features',
    description: 'Enable beta features for testing',
    enabled: true,
    type: 'user_attribute',
    conditions: [
      {
        attribute: 'role',
        operator: 'equals',
        value: 'admin'
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
    environment: 'all'
  }
];

/**
 * Generate unique operation ID
 */
function generateOperationId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create system backup
 */
export async function createBackup(
  type: SystemBackup['type'],
  name: string,
  description?: string,
  createdBy: string = 'system'
): Promise<BackupOperation> {
  const operationId = generateOperationId();
  const backupId = `backup_${Date.now()}`;

  const operation: BackupOperation = {
    id: operationId,
    type: 'backup',
    status: 'pending',
    progress: 0,
    startTime: new Date().toISOString(),
    backupId
  };

  // Simulate backup process
  setTimeout(async () => {
    operation.status = 'running';
    
    // Simulate progress
    for (let progress = 0; progress <= 100; progress += 10) {
      operation.progress = progress;
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Create backup record
    const backup: SystemBackup = {
      id: backupId,
      name,
      description,
      type,
      size: Math.floor(Math.random() * 1000000000), // Random size for demo
      createdAt: new Date().toISOString(),
      createdBy,
      status: 'completed',
      metadata: {
        tables: type === 'full' ? ['colleges', 'courses', 'cutoffs', 'users'] : [type],
        recordCount: Math.floor(Math.random() * 10000),
        compression: 'gzip',
        checksum: Math.random().toString(36).substring(2, 15),
        version: '1.0.0'
      }
    };

    // Store backup (in production, this would be in a database)
    const existingBackups = getStoredBackups();
    existingBackups.unshift(backup);
    localStorage.setItem('system_backups', JSON.stringify(existingBackups));

    operation.status = 'completed';
    operation.endTime = new Date().toISOString();
    operation.message = `Backup ${name} created successfully`;
  }, 1000);

  return operation;
}

/**
 * Restore from backup
 */
export async function restoreBackup(
  backupId: string,
  restoredBy: string = 'system'
): Promise<BackupOperation> {
  const operationId = generateOperationId();

  const operation: BackupOperation = {
    id: operationId,
    type: 'restore',
    status: 'pending',
    progress: 0,
    startTime: new Date().toISOString(),
    backupId
  };

  // Simulate restore process
  setTimeout(async () => {
    operation.status = 'running';
    
    // Simulate progress
    for (let progress = 0; progress <= 100; progress += 15) {
      operation.progress = progress;
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    operation.status = 'completed';
    operation.endTime = new Date().toISOString();
    operation.message = `System restored from backup ${backupId}`;
  }, 1000);

  return operation;
}

/**
 * Get all backups
 */
export function getBackups(): SystemBackup[] {
  return getStoredBackups();
}

/**
 * Delete backup
 */
export function deleteBackup(backupId: string): boolean {
  const backups = getStoredBackups();
  const filteredBackups = backups.filter(backup => backup.id !== backupId);
  localStorage.setItem('system_backups', JSON.stringify(filteredBackups));
  return filteredBackups.length < backups.length;
}

/**
 * Get stored backups from localStorage (demo implementation)
 */
function getStoredBackups(): SystemBackup[] {
  try {
    const stored = localStorage.getItem('system_backups');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading backups:', error);
    return [];
  }
}

/**
 * Get system configuration
 */
export function getSystemConfig(): SystemConfiguration[] {
  try {
    const stored = localStorage.getItem('system_config');
    return stored ? JSON.parse(stored) : DEFAULT_SYSTEM_CONFIG;
  } catch (error) {
    console.error('Error reading system config:', error);
    return DEFAULT_SYSTEM_CONFIG;
  }
}

/**
 * Update system configuration
 */
export function updateSystemConfig(
  key: string,
  value: any,
  updatedBy: string
): boolean {
  try {
    const configs = getSystemConfig();
    const configIndex = configs.findIndex(config => config.key === key);
    
    if (configIndex !== -1) {
      configs[configIndex] = {
        ...configs[configIndex],
        value,
        updatedAt: new Date().toISOString(),
        updatedBy
      };
    } else {
      // Create new config
      configs.push({
        id: `config_${Date.now()}`,
        category: 'custom',
        key,
        value,
        type: typeof value as any,
        description: `Custom configuration: ${key}`,
        updatedAt: new Date().toISOString(),
        updatedBy,
        environment: 'all'
      });
    }

    localStorage.setItem('system_config', JSON.stringify(configs));
    return true;
  } catch (error) {
    console.error('Error updating system config:', error);
    return false;
  }
}

/**
 * Get configuration value by key
 */
export function getConfigValue(key: string, defaultValue?: any): any {
  const configs = getSystemConfig();
  const config = configs.find(c => c.key === key);
  return config ? config.value : defaultValue;
}

/**
 * Get feature flags
 */
export function getFeatureFlags(): FeatureFlag[] {
  try {
    const stored = localStorage.getItem('feature_flags');
    return stored ? JSON.parse(stored) : DEFAULT_FEATURE_FLAGS;
  } catch (error) {
    console.error('Error reading feature flags:', error);
    return DEFAULT_FEATURE_FLAGS;
  }
}

/**
 * Update feature flag
 */
export function updateFeatureFlag(
  key: string,
  updates: Partial<FeatureFlag>,
  updatedBy: string
): boolean {
  try {
    const flags = getFeatureFlags();
    const flagIndex = flags.findIndex(flag => flag.key === key);
    
    if (flagIndex !== -1) {
      flags[flagIndex] = {
        ...flags[flagIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy
      };
    } else {
      // Create new flag
      flags.push({
        id: `flag_${Date.now()}`,
        key,
        name: updates.name || key,
        description: updates.description || '',
        enabled: updates.enabled || false,
        type: updates.type || 'boolean',
        value: updates.value,
        conditions: updates.conditions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy,
        environment: updates.environment || 'all',
        tags: updates.tags
      });
    }

    localStorage.setItem('feature_flags', JSON.stringify(flags));
    return true;
  } catch (error) {
    console.error('Error updating feature flag:', error);
    return false;
  }
}

/**
 * Check if feature is enabled for user
 */
export function isFeatureEnabled(
  key: string,
  userContext?: {
    email?: string;
    role?: string;
    attributes?: Record<string, any>;
  }
): boolean {
  const flags = getFeatureFlags();
  const flag = flags.find(f => f.key === key);
  
  if (!flag) return false;
  if (!flag.enabled) return false;

  switch (flag.type) {
    case 'boolean':
      return true;

    case 'percentage':
      if (typeof flag.value !== 'number') return false;
      // Simple hash-based percentage rollout
      const hash = userContext?.email ? 
        userContext.email.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 
        Math.random() * 100;
      return (hash % 100) < flag.value;

    case 'user_list':
      if (!Array.isArray(flag.value) || !userContext?.email) return false;
      return flag.value.includes(userContext.email);

    case 'user_attribute':
      if (!flag.conditions || !userContext) return false;
      return flag.conditions.every(condition => {
        const userValue = userContext.attributes?.[condition.attribute] || 
                         userContext[condition.attribute as keyof typeof userContext];
        
        switch (condition.operator) {
          case 'equals':
            return userValue === condition.value;
          case 'not_equals':
            return userValue !== condition.value;
          case 'contains':
            return String(userValue).includes(String(condition.value));
          case 'not_contains':
            return !String(userValue).includes(String(condition.value));
          case 'greater_than':
            return Number(userValue) > Number(condition.value);
          case 'less_than':
            return Number(userValue) < Number(condition.value);
          default:
            return false;
        }
      });

    default:
      return false;
  }
}

/**
 * Delete feature flag
 */
export function deleteFeatureFlag(key: string): boolean {
  try {
    const flags = getFeatureFlags();
    const filteredFlags = flags.filter(flag => flag.key !== key);
    localStorage.setItem('feature_flags', JSON.stringify(filteredFlags));
    return filteredFlags.length < flags.length;
  } catch (error) {
    console.error('Error deleting feature flag:', error);
    return false;
  }
}

/**
 * Get maintenance mode status
 */
export function getMaintenanceMode(): MaintenanceMode {
  try {
    const stored = localStorage.getItem('maintenance_mode');
    return stored ? JSON.parse(stored) : {
      enabled: false,
      message: 'System is currently under maintenance. Please try again later.',
      allowedEmails: [],
      updatedAt: new Date().toISOString(),
      updatedBy: 'system'
    };
  } catch (error) {
    console.error('Error reading maintenance mode:', error);
    return {
      enabled: false,
      message: 'System is currently under maintenance. Please try again later.',
      updatedAt: new Date().toISOString(),
      updatedBy: 'system'
    };
  }
}

/**
 * Update maintenance mode
 */
export function updateMaintenanceMode(
  updates: Partial<MaintenanceMode>,
  updatedBy: string
): boolean {
  try {
    const current = getMaintenanceMode();
    const updated: MaintenanceMode = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy
    };

    localStorage.setItem('maintenance_mode', JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error('Error updating maintenance mode:', error);
    return false;
  }
}

/**
 * Check if user can access during maintenance
 */
export function canAccessDuringMaintenance(email?: string, bypassCode?: string): boolean {
  const maintenance = getMaintenanceMode();
  
  if (!maintenance.enabled) return true;
  
  // Check bypass code
  if (bypassCode && maintenance.bypassCode && bypassCode === maintenance.bypassCode) {
    return true;
  }
  
  // Check allowed emails
  if (email && maintenance.allowedEmails?.includes(email)) {
    return true;
  }
  
  return false;
}

/**
 * Get system health status
 */
export function getSystemHealth(): SystemHealth {
  try {
    // In production, this would check actual system metrics
    // For demo, return simulated health data
    return {
      status: 'healthy',
      uptime: Math.floor(Math.random() * 86400), // Random uptime in seconds
      lastChecked: new Date().toISOString(),
      components: {
        database: 'healthy',
        storage: 'healthy',
        api: 'healthy',
        search: 'healthy',
        auth: 'healthy'
      },
      metrics: {
        memoryUsage: Math.floor(Math.random() * 80) + 10, // 10-90%
        diskUsage: Math.floor(Math.random() * 70) + 10, // 10-80%
        activeUsers: Math.floor(Math.random() * 1000) + 100,
        errorRate: Math.random() * 0.05, // 0-5% error rate
        responseTime: Math.floor(Math.random() * 500) + 50 // 50-550ms
      }
    };
  } catch (error) {
    console.error('Error getting system health:', error);
    return {
      status: 'warning',
      uptime: 0,
      lastChecked: new Date().toISOString(),
      components: {
        database: 'error',
        storage: 'error',
        api: 'error',
        search: 'error',
        auth: 'error'
      },
      metrics: {
        memoryUsage: 0,
        diskUsage: 0,
        activeUsers: 0,
        errorRate: 1,
        responseTime: 0
      }
    };
  }
}

/**
 * Export system configuration
 */
export function exportSystemConfig(): string {
  const config = {
    configurations: getSystemConfig(),
    featureFlags: getFeatureFlags(),
    maintenanceMode: getMaintenanceMode(),
    exportedAt: new Date().toISOString(),
    version: '1.0.0'
  };

  return JSON.stringify(config, null, 2);
}

/**
 * Import system configuration
 */
export function importSystemConfig(
  configData: string,
  importedBy: string
): { success: boolean; message: string } {
  try {
    const config = JSON.parse(configData);
    
    if (config.configurations) {
      localStorage.setItem('system_config', JSON.stringify(config.configurations));
    }
    
    if (config.featureFlags) {
      localStorage.setItem('feature_flags', JSON.stringify(config.featureFlags));
    }
    
    if (config.maintenanceMode) {
      localStorage.setItem('maintenance_mode', JSON.stringify({
        ...config.maintenanceMode,
        updatedBy: importedBy,
        updatedAt: new Date().toISOString()
      }));
    }

    return {
      success: true,
      message: 'System configuration imported successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: `Import failed: ${error}`
    };
  }
}