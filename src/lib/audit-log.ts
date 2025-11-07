// Audit Log System for tracking all changes in staging review

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  user: string;
  action: AuditAction;
  itemType: 'college' | 'course' | 'cutoff';
  itemId: string;
  itemName: string;
  details: Record<string, any>;
  previousState?: any;
  newState?: any;
}

export type AuditAction =
  | 'approve'
  | 'reject'
  | 'manual-match'
  | 'bulk-approve'
  | 'bulk-reject'
  | 'create-alias'
  | 'delete'
  | 'edit'
  | 'add-comment'
  | 'add-note'
  | 'import'
  | 'export';

export interface AuditLogFilter {
  user?: string;
  action?: AuditAction;
  itemType?: 'college' | 'course' | 'cutoff';
  startDate?: number;
  endDate?: number;
  searchQuery?: string;
}

class AuditLogManager {
  private logs: AuditLogEntry[] = [];
  private storageKey = 'staging-review-audit-log';
  private maxLogs = 1000;

  constructor() {
    this.loadFromStorage();
  }

  log(
    action: AuditAction,
    itemType: 'college' | 'course' | 'cutoff',
    itemId: string,
    itemName: string,
    details: Record<string, any> = {},
    user: string = 'User',
    previousState?: any,
    newState?: any
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      user,
      action,
      itemType,
      itemId,
      itemName,
      details,
      previousState,
      newState
    };

    this.logs.unshift(entry); // Add to beginning

    // Limit log size
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    this.saveToStorage();
    return entry;
  }

  getLogs(filter?: AuditLogFilter): AuditLogEntry[] {
    let result = [...this.logs];

    if (!filter) return result;

    if (filter.user) {
      result = result.filter(log => log.user === filter.user);
    }

    if (filter.action) {
      result = result.filter(log => log.action === filter.action);
    }

    if (filter.itemType) {
      result = result.filter(log => log.itemType === filter.itemType);
    }

    if (filter.startDate) {
      result = result.filter(log => log.timestamp >= filter.startDate!);
    }

    if (filter.endDate) {
      result = result.filter(log => log.timestamp <= filter.endDate!);
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      result = result.filter(log =>
        log.itemName.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        JSON.stringify(log.details).toLowerCase().includes(query)
      );
    }

    return result;
  }

  getRecentLogs(count: number = 50): AuditLogEntry[] {
    return this.logs.slice(0, count);
  }

  getLogsByItem(itemId: string, itemType: 'college' | 'course' | 'cutoff'): AuditLogEntry[] {
    return this.logs.filter(
      log => log.itemId === itemId && log.itemType === itemType
    );
  }

  getLogsByUser(user: string): AuditLogEntry[] {
    return this.logs.filter(log => log.user === user);
  }

  getLogsByDateRange(startDate: number, endDate: number): AuditLogEntry[] {
    return this.logs.filter(
      log => log.timestamp >= startDate && log.timestamp <= endDate
    );
  }

  getStatistics() {
    const stats = {
      totalLogs: this.logs.length,
      byAction: {} as Record<AuditAction, number>,
      byItemType: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
      firstLog: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null,
      lastLog: this.logs.length > 0 ? this.logs[0].timestamp : null
    };

    this.logs.forEach(log => {
      // Count by action
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;

      // Count by item type
      stats.byItemType[log.itemType] = (stats.byItemType[log.itemType] || 0) + 1;

      // Count by user
      stats.byUser[log.user] = (stats.byUser[log.user] || 0) + 1;
    });

    return stats;
  }

  clearLogs() {
    this.logs = [];
    this.saveToStorage();
  }

  clearOldLogs(daysOld: number = 30) {
    const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    this.logs = this.logs.filter(log => log.timestamp >= cutoffDate);
    this.saveToStorage();
  }

  exportToCSV(): string {
    const headers = ['Timestamp', 'User', 'Action', 'Item Type', 'Item Name', 'Details'];
    const rows = this.logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.user,
      log.action,
      log.itemType,
      log.itemName,
      JSON.stringify(log.details)
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  exportToJSON(): string {
    return JSON.stringify({
      logs: this.logs,
      stats: this.getStatistics(),
      exportedAt: Date.now()
    }, null, 2);
  }

  importFromJSON(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.logs && Array.isArray(data.logs)) {
        this.logs = data.logs;
        this.saveToStorage();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to import audit logs:', error);
      return false;
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save audit logs:', error);
    }
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.logs = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    }
  }
}

export const auditLogManager = new AuditLogManager();
