/**
 * Admin Activity Logging & Audit Trail Service
 * Tracks all admin actions for security and compliance
 */

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'success' | 'failure' | 'pending';
  sessionId?: string;
  duration?: number; // in milliseconds
  metadata?: Record<string, any>;
}

export interface AdminSession {
  id: string;
  adminId: string;
  adminEmail: string;
  startTime: string;
  endTime?: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  twoFactorVerified: boolean;
  lastActivity: string;
  actionsCount: number;
}

export interface AuditLogFilter {
  adminEmail?: string;
  action?: string;
  resource?: string;
  severity?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Activity severity levels based on action type
 */
const ACTION_SEVERITY_MAP: Record<string, AdminAuditLog['severity']> = {
  // User Management
  'view_users': 'low',
  'view_user_details': 'low',
  'edit_user': 'medium',
  'suspend_user': 'high',
  'activate_user': 'high',
  'delete_user': 'critical',
  'promote_user': 'critical',
  
  // Data Management
  'view_data': 'low',
  'upload_data': 'medium',
  'edit_data': 'medium',
  'delete_data': 'high',
  'bulk_delete': 'critical',
  'export_data': 'medium',
  
  // System Management
  'view_system_info': 'low',
  'view_analytics': 'low',
  'change_settings': 'high',
  'system_backup': 'critical',
  'system_restore': 'critical',
  'maintenance_mode': 'critical',
  
  // Security Actions
  'login': 'medium',
  'logout': 'low',
  'failed_login': 'high',
  'enable_2fa': 'high',
  'disable_2fa': 'critical',
  'reset_password': 'high',
  
  // Content Management
  'create_announcement': 'medium',
  'edit_announcement': 'medium',
  'delete_announcement': 'high',
  'publish_content': 'medium',
};

/**
 * Get activity severity for an action
 */
function getActionSeverity(action: string): AdminAuditLog['severity'] {
  return ACTION_SEVERITY_MAP[action] || 'medium';
}

/**
 * Generate a unique log ID
 */
function generateLogId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Log an admin action
 */
export function logAdminAction(
  adminId: string,
  adminEmail: string,
  action: string,
  options: {
    resource?: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    status?: AdminAuditLog['status'];
    duration?: number;
    metadata?: Record<string, any>;
  } = {}
): AdminAuditLog {
  const logEntry: AdminAuditLog = {
    id: generateLogId(),
    adminId,
    adminEmail,
    action,
    resource: options.resource,
    resourceId: options.resourceId,
    details: options.details,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    timestamp: new Date().toISOString(),
    severity: getActionSeverity(action),
    status: options.status || 'success',
    sessionId: options.sessionId,
    duration: options.duration,
    metadata: options.metadata
  };

  // In a real implementation, this would be stored in a database
  console.log('🔍 Admin Audit Log:', logEntry);
  
  // Store in local storage for demo (in production, use proper database)
  const existingLogs = getStoredAuditLogs();
  existingLogs.unshift(logEntry); // Add to beginning for recent-first order
  
  // Keep only last 1000 logs in local storage
  if (existingLogs.length > 1000) {
    existingLogs.splice(1000);
  }
  
  localStorage.setItem('admin_audit_logs', JSON.stringify(existingLogs));
  
  return logEntry;
}

/**
 * Get stored audit logs (demo implementation)
 */
function getStoredAuditLogs(): AdminAuditLog[] {
  try {
    const stored = localStorage.getItem('admin_audit_logs');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading audit logs:', error);
    return [];
  }
}

/**
 * Create a new admin session
 */
export function createAdminSession(
  adminId: string,
  adminEmail: string,
  ipAddress: string,
  userAgent: string,
  twoFactorVerified: boolean = false
): AdminSession {
  const session: AdminSession = {
    id: generateSessionId(),
    adminId,
    adminEmail,
    startTime: new Date().toISOString(),
    ipAddress,
    userAgent,
    isActive: true,
    twoFactorVerified,
    lastActivity: new Date().toISOString(),
    actionsCount: 0
  };

  // Log the session creation
  logAdminAction(adminId, adminEmail, 'login', {
    ipAddress,
    userAgent,
    sessionId: session.id,
    details: { twoFactorVerified }
  });

  return session;
}

/**
 * Update session activity
 */
export function updateSessionActivity(
  sessionId: string,
  action?: string
): void {
  const now = new Date().toISOString();
  
  // In production, update the session in database
  console.log(`📝 Session ${sessionId} activity updated:`, { action, timestamp: now });
}

/**
 * End an admin session
 */
export function endAdminSession(
  sessionId: string,
  adminId: string,
  adminEmail: string
): void {
  const endTime = new Date().toISOString();
  
  logAdminAction(adminId, adminEmail, 'logout', {
    sessionId,
    details: { endTime }
  });
  
  console.log(`🔚 Session ${sessionId} ended at ${endTime}`);
}

/**
 * Get audit logs with filtering
 */
export function getAuditLogs(filter: AuditLogFilter = {}): {
  logs: AdminAuditLog[];
  total: number;
  hasMore: boolean;
} {
  let logs = getStoredAuditLogs();
  
  // Apply filters
  if (filter.adminEmail) {
    logs = logs.filter(log => 
      log.adminEmail.toLowerCase().includes(filter.adminEmail!.toLowerCase())
    );
  }
  
  if (filter.action) {
    logs = logs.filter(log => 
      log.action.toLowerCase().includes(filter.action!.toLowerCase())
    );
  }
  
  if (filter.resource) {
    logs = logs.filter(log => 
      log.resource?.toLowerCase().includes(filter.resource!.toLowerCase())
    );
  }
  
  if (filter.severity) {
    logs = logs.filter(log => log.severity === filter.severity);
  }
  
  if (filter.status) {
    logs = logs.filter(log => log.status === filter.status);
  }
  
  if (filter.startDate) {
    logs = logs.filter(log => log.timestamp >= filter.startDate!);
  }
  
  if (filter.endDate) {
    logs = logs.filter(log => log.timestamp <= filter.endDate!);
  }
  
  const total = logs.length;
  const offset = filter.offset || 0;
  const limit = filter.limit || 50;
  
  const paginatedLogs = logs.slice(offset, offset + limit);
  const hasMore = offset + limit < total;
  
  return {
    logs: paginatedLogs,
    total,
    hasMore
  };
}

/**
 * Get audit log statistics
 */
export function getAuditLogStats(): {
  totalActions: number;
  actionsToday: number;
  criticalActionsToday: number;
  activeAdmins: number;
  failedActionsToday: number;
  topActions: { action: string; count: number }[];
} {
  const logs = getStoredAuditLogs();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();
  
  const todayLogs = logs.filter(log => log.timestamp >= todayISO);
  
  // Count actions
  const actionCounts: Record<string, number> = {};
  todayLogs.forEach(log => {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
  });
  
  const topActions = Object.entries(actionCounts)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    totalActions: logs.length,
    actionsToday: todayLogs.length,
    criticalActionsToday: todayLogs.filter(log => log.severity === 'critical').length,
    activeAdmins: new Set(todayLogs.map(log => log.adminEmail)).size,
    failedActionsToday: todayLogs.filter(log => log.status === 'failure').length,
    topActions
  };
}

/**
 * Check for suspicious activity patterns
 */
export function detectSuspiciousActivity(
  adminEmail: string,
  timeWindowMinutes: number = 10
): {
  isSuspicious: boolean;
  reasons: string[];
} {
  const logs = getStoredAuditLogs();
  const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString();
  
  const recentLogs = logs.filter(
    log => log.adminEmail === adminEmail && log.timestamp >= cutoffTime
  );
  
  const reasons: string[] = [];
  
  // Check for rapid-fire actions
  if (recentLogs.length > 20) {
    reasons.push(`Excessive actions: ${recentLogs.length} in ${timeWindowMinutes} minutes`);
  }
  
  // Check for multiple failed actions
  const failedActions = recentLogs.filter(log => log.status === 'failure');
  if (failedActions.length > 3) {
    reasons.push(`Multiple failed actions: ${failedActions.length}`);
  }
  
  // Check for critical actions without 2FA context
  const criticalActions = recentLogs.filter(log => log.severity === 'critical');
  if (criticalActions.length > 0) {
    reasons.push(`${criticalActions.length} critical actions performed`);
  }
  
  // Check for unusual IP addresses (simplified check)
  const ipAddresses = new Set(recentLogs.map(log => log.ipAddress).filter(Boolean));
  if (ipAddresses.size > 2) {
    reasons.push(`Actions from ${ipAddresses.size} different IP addresses`);
  }
  
  return {
    isSuspicious: reasons.length > 0,
    reasons
  };
}

/**
 * Export audit logs (for compliance)
 */
export function exportAuditLogs(
  filter: AuditLogFilter = {},
  format: 'json' | 'csv' = 'json'
): string {
  const { logs } = getAuditLogs(filter);
  
  if (format === 'csv') {
    const headers = [
      'Timestamp', 'Admin Email', 'Action', 'Resource', 'Resource ID',
      'Severity', 'Status', 'IP Address', 'Session ID'
    ].join(',');
    
    const rows = logs.map(log => [
      log.timestamp,
      log.adminEmail,
      log.action,
      log.resource || '',
      log.resourceId || '',
      log.severity,
      log.status,
      log.ipAddress || '',
      log.sessionId || ''
    ].join(','));
    
    return [headers, ...rows].join('\n');
  }
  
  return JSON.stringify(logs, null, 2);
}

/**
 * Clear old audit logs (for maintenance)
 */
export function cleanupOldAuditLogs(daysToKeep: number = 90): number {
  const logs = getStoredAuditLogs();
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
  
  const recentLogs = logs.filter(log => log.timestamp >= cutoffDate);
  const removedCount = logs.length - recentLogs.length;
  
  localStorage.setItem('admin_audit_logs', JSON.stringify(recentLogs));
  
  return removedCount;
}