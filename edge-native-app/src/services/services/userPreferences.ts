// User preferences service for managing personalization data

import { UserPreferences, WatchlistItem, Notification, ActivityItem, RecommendationItem, DashboardStats } from '@/types/user';

interface DashboardWidget {
  id: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: any;
}

class UserPreferencesService {
  private readonly STORAGE_KEY = 'neetlogiq_user_preferences';
  private preferences: UserPreferences | null = null;

  constructor() {
    this.loadPreferences();
  }

  // Load preferences from localStorage
  private loadPreferences(): UserPreferences {
    if (typeof window === 'undefined') return this.getDefaultPreferences();
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        this.preferences = {
          ...parsed,
          notifications: parsed.notifications?.map((n: any) => ({
            ...n,
            createdAt: new Date(n.createdAt)
          })) || [],
          watchlistCutoffs: parsed.watchlistCutoffs?.map((w: any) => ({
            ...w,
            addedAt: new Date(w.addedAt)
          })) || [],
          recentActivity: parsed.recentActivity?.map((a: any) => ({
            ...a,
            timestamp: new Date(a.timestamp)
          })) || []
        };
        return this.preferences!;
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
    
    this.preferences = this.getDefaultPreferences();
    return this.preferences;
  }

  // Save preferences to localStorage
  private savePreferences(): void {
    if (typeof window === 'undefined' || !this.preferences) return;
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.preferences));
    } catch (error) {
      console.error('Error saving user preferences:', error);
    }
  }

  // Get default preferences
  private getDefaultPreferences(): UserPreferences {
    return {
      favoriteColleges: [],
      favoriteCourses: [],
      watchlistCutoffs: [],
      notifications: [],
      dashboardWidgets: [
        { id: 'quick_stats', type: 'quick_stats', title: 'Quick Stats', enabled: true, position: 0, size: 'medium' },
        { id: 'favorites', type: 'favorites', title: 'Favorites', enabled: true, position: 1, size: 'medium' },
        { id: 'watchlist', type: 'watchlist', title: 'Watchlist', enabled: true, position: 2, size: 'medium' },
        { id: 'recent_activity', type: 'recent_activity', title: 'Recent Activity', enabled: true, position: 3, size: 'large' }
      ],
      recentActivity: []
    };
  }

  // Public methods
  getPreferences(): UserPreferences {
    return this.preferences || this.getDefaultPreferences();
  }

  updatePreferences(updates: Partial<UserPreferences>): void {
    if (!this.preferences) this.preferences = this.getDefaultPreferences();
    this.preferences = { ...this.preferences, ...updates };
    this.savePreferences();
  }

  // Favorites management
  addFavorite(type: 'college' | 'course', itemId: string, name: string): void {
    if (!this.preferences) this.preferences = this.getDefaultPreferences();
    
    const favorites = type === 'college' ? this.preferences.favoriteColleges : this.preferences.favoriteCourses;
    if (!favorites.includes(itemId)) {
      favorites.push(itemId);
      this.addActivity('add_favorite', `Added ${name} to favorites`, `Added ${name} to your favorites list`, itemId, type);
      this.savePreferences();
    }
  }

  removeFavorite(type: 'college' | 'course', itemId: string): void {
    if (!this.preferences) return;
    
    const favorites = type === 'college' ? this.preferences.favoriteColleges : this.preferences.favoriteCourses;
    const index = favorites.indexOf(itemId);
    if (index > -1) {
      favorites.splice(index, 1);
      this.savePreferences();
    }
  }

  isFavorite(type: 'college' | 'course', itemId: string): boolean {
    if (!this.preferences) return false;
    const favorites = type === 'college' ? this.preferences.favoriteColleges : this.preferences.favoriteCourses;
    return favorites.includes(itemId);
  }

  // Watchlist management
  addToWatchlist(item: Omit<WatchlistItem, 'id' | 'addedAt'>): void {
    if (!this.preferences) this.preferences = this.getDefaultPreferences();
    
    const watchlistItem: WatchlistItem = {
      ...item,
      id: `watchlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      addedAt: new Date()
    };
    
    this.preferences.watchlistCutoffs.push(watchlistItem);
    this.addActivity('add_watchlist', `Added ${item.name} to watchlist`, `Added ${item.name} to your watchlist`, item.itemId, item.type);
    this.savePreferences();
  }

  removeFromWatchlist(itemId: string): void {
    if (!this.preferences) return;
    
    const index = this.preferences.watchlistCutoffs.findIndex(item => item.id === itemId);
    if (index > -1) {
      this.preferences.watchlistCutoffs.splice(index, 1);
      this.savePreferences();
    }
  }

  updateWatchlistAlert(itemId: string, alertEnabled: boolean): void {
    if (!this.preferences) return;
    
    const item = this.preferences.watchlistCutoffs.find(w => w.id === itemId);
    if (item) {
      item.alertEnabled = alertEnabled;
      this.savePreferences();
    }
  }

  // Notifications management
  addNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): void {
    if (!this.preferences) this.preferences = this.getDefaultPreferences();
    
    const newNotification: Notification = {
      ...notification,
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      read: false
    };
    
    this.preferences.notifications.unshift(newNotification);
    // Keep only last 100 notifications
    if (this.preferences.notifications.length > 100) {
      this.preferences.notifications = this.preferences.notifications.slice(0, 100);
    }
    this.savePreferences();
  }

  markNotificationAsRead(notificationId: string): void {
    if (!this.preferences) return;
    
    const notification = this.preferences.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.savePreferences();
    }
  }

  markAllNotificationsAsRead(): void {
    if (!this.preferences) return;
    
    this.preferences.notifications.forEach(notification => {
      notification.read = true;
    });
    this.savePreferences();
  }

  // Activity tracking
  addActivity(type: ActivityItem['type'], title: string, description: string, itemId?: string, itemType?: string): void {
    if (!this.preferences) this.preferences = this.getDefaultPreferences();
    
    const activity: ActivityItem = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      description,
      timestamp: new Date(),
      itemId,
      itemType
    };
    
    this.preferences.recentActivity.unshift(activity);
    // Keep only last 50 activities
    if (this.preferences.recentActivity.length > 50) {
      this.preferences.recentActivity = this.preferences.recentActivity.slice(0, 50);
    }
    this.savePreferences();
  }

  // Dashboard widgets management
  updateWidget(widgetId: string, updates: Partial<DashboardWidget>): void {
    if (!this.preferences) this.preferences = this.getDefaultPreferences();
    
    const widget = this.preferences.dashboardWidgets.find(w => w.id === widgetId);
    if (widget) {
      Object.assign(widget, updates);
      this.savePreferences();
    }
  }

  reorderWidgets(widgetIds: string[]): void {
    if (!this.preferences) return;
    
    widgetIds.forEach((id, index) => {
      const widget = this.preferences!.dashboardWidgets.find(w => w.id === id);
      if (widget) {
        widget.position = index;
      }
    });
    this.savePreferences();
  }

  // Dashboard stats
  getDashboardStats(): DashboardStats {
    if (!this.preferences) this.preferences = this.getDefaultPreferences();
    
    return {
      totalFavorites: this.preferences.favoriteColleges.length + this.preferences.favoriteCourses.length,
      totalWatchlist: this.preferences.watchlistCutoffs.length,
      unreadNotifications: this.preferences.notifications.filter(n => !n.read).length,
      recentActivity: this.preferences.recentActivity.length,
      recommendations: 0 // Will be calculated based on AI recommendations
    };
  }

  // Search tracking
  trackSearch(query: string, results: number): void {
    this.addActivity('search', `Searched for "${query}"`, `Found ${results} results for "${query}"`);
  }

  // View tracking
  trackView(type: 'college' | 'course', itemId: string, name: string): void {
    this.addActivity(`view_${type}` as ActivityItem['type'], `Viewed ${name}`, `Viewed ${name} details`, itemId, type);
  }

  // Clear all data
  clearAllData(): void {
    this.preferences = this.getDefaultPreferences();
    this.savePreferences();
  }
}

// Export singleton instance
const userPreferences = new UserPreferencesService();
export default userPreferences;
