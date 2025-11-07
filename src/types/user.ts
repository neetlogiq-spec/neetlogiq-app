// User-specific types for personalization features

export interface UserPreferences {
  favoriteColleges: string[];
  favoriteCourses: string[];
  watchlistCutoffs: WatchlistItem[];
  notifications: Notification[];
  dashboardWidgets: DashboardWidget[];
  recentActivity: ActivityItem[];
}

export interface WatchlistItem {
  id: string;
  type: 'college' | 'course' | 'cutoff';
  itemId: string;
  name: string;
  category?: string;
  state?: string;
  year?: string;
  addedAt: Date;
  alertEnabled: boolean;
  lastCutoff?: number;
}

export interface Notification {
  id: string;
  type: 'cutoff_update' | 'deadline' | 'new_college' | 'recommendation' | 'watchlist_alert';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface DashboardWidget {
  id: string;
  type: 'favorites' | 'watchlist' | 'recommendations' | 'recent_activity' | 'trends' | 'quick_stats';
  title: string;
  enabled: boolean;
  position: number;
  size: 'small' | 'medium' | 'large';
}

export interface ActivityItem {
  id: string;
  type: 'view_college' | 'view_course' | 'add_favorite' | 'add_watchlist' | 'search';
  title: string;
  description: string;
  timestamp: Date;
  itemId?: string;
  itemType?: string;
}

export interface RecommendationItem {
  id: string;
  type: 'college' | 'course' | 'cutoff';
  itemId: string;
  name: string;
  score: number;
  reason: string;
  metadata: Record<string, any>;
}

export interface DashboardStats {
  totalFavorites: number;
  totalWatchlist: number;
  unreadNotifications: number;
  recentActivity: number;
  recommendations: number;
}
