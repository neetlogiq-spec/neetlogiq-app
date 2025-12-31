import { supabaseAdmin } from '@/lib/supabase';
import type {
  AdminNotification,
  NotificationTarget,
  StreamType,
  UserSegment
} from '@/components/admin/NotificationManagement';

export interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  selectedStream?: StreamType;
  category?: string;
  state?: string;
  city?: string;
  estimatedRank?: number;
  createdAt: Date;
  lastActive: Date;
  status: 'active' | 'inactive' | 'suspended';
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  userId: string;
  deliveredAt: Date;
  viewedAt?: Date;
  clickedAt?: Date;
  dismissedAt?: Date;
  channel: 'in-app' | 'push' | 'email' | 'desktop';
  status: 'pending' | 'delivered' | 'failed';
  error?: string;
}

export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // ============================================================================
  // USER TARGETING
  // ============================================================================

  /**
   * Get users that match the notification target
   */
  async getTargetedUsers(target: NotificationTarget): Promise<UserProfile[]> {
    try {
      if (!supabaseAdmin) {
        console.warn('Supabase Admin not available (client-side?)');
        return [];
      }

      // Cast to any to avoid type errors with 'never' return type
      let query = (supabaseAdmin as any)
        .from('user_profiles')
        .select('user_id, preferences, category, state, created_at, updated_at');

      // Filter by states
      if (target.states && target.states.length > 0) {
        query = query.in('state', target.states);
      }

      // Filter by categories
      if (target.categories && target.categories.length > 0) {
        query = query.in('category', target.categories);
      }

      const { data: profiles, error } = await query;

      if (error) {
        console.error('Error fetching profiles:', error);
        return [];
      }

      let users: UserProfile[] = (profiles as any[]).map(p => {
        const preferences = p.preferences as any;
        return {
          uid: p.user_id,
          selectedStream: preferences?.selectedStream,
          category: p.category || undefined,
          state: p.state || undefined,
          estimatedRank: preferences?.neet_rank, // Assuming rank is in preferences
          createdAt: new Date(p.created_at),
          lastActive: new Date(p.updated_at), // Using updated_at as proxy for lastActive
          status: 'active'
        };
      });

      // In-memory filtering for complex conditions

      // Filter by streams
      if (target.streams && !target.streams.includes('ALL')) {
        users = users.filter(user =>
          target.streams.includes(user.selectedStream as StreamType)
        );
      }

      // Filter by cities (if available in profile)
      if (target.cities && target.cities.length > 0) {
        users = users.filter(user =>
          target.cities!.includes(user.city || '')
        );
      }

      // Filter by rank range
      if (target.rankRange) {
        users = users.filter(user => {
          if (!user.estimatedRank) return false;
          return user.estimatedRank >= target.rankRange!.min &&
                 user.estimatedRank <= target.rankRange!.max;
        });
      }

      // Filter by user segments
      if (target.userSegments) {
        users = this.filterBySegments(users, target.userSegments);
      }

      return users;
    } catch (error) {
      console.error('Error getting targeted users:', error);
      return [];
    }
  }

  /**
   * Filter users by segments
   */
  private filterBySegments(users: UserProfile[], segments: UserSegment[]): UserProfile[] {
    if (segments.includes('all_users')) {
      return users;
    }

    let filtered: UserProfile[] = [];

    // New users (registered < 7 days)
    if (segments.includes('new_users')) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      filtered = [...filtered, ...users.filter(u => new Date(u.createdAt) > sevenDaysAgo)];
    }

    // Active users (active in last 30 days)
    if (segments.includes('active_users')) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filtered = [...filtered, ...users.filter(u =>
        new Date(u.lastActive) > thirtyDaysAgo
      )];
    }

    // Inactive users (not active in 30+ days)
    if (segments.includes('inactive_users')) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filtered = [...filtered, ...users.filter(u =>
        new Date(u.lastActive) <= thirtyDaysAgo
      )];
    }

    // Remove duplicates
    return Array.from(new Set(filtered.map(u => u.uid)))
      .map(uid => filtered.find(u => u.uid === uid)!);
  }

  // ============================================================================
  // NOTIFICATION SENDING
  // ============================================================================

  /**
   * Send notification to targeted users
   */
  async sendNotification(notification: AdminNotification): Promise<{
    success: boolean;
    delivered: number;
    failed: number;
    deliveries: NotificationDelivery[];
  }> {
    try {
      // Get targeted users
      const users = await this.getTargetedUsers(notification.target);

      if (users.length === 0) {
        return { success: false, delivered: 0, failed: 0, deliveries: [] };
      }

      // Send to each user
      const deliveries: NotificationDelivery[] = [];
      let delivered = 0;
      let failed = 0;

      // Batch in-app notifications for efficiency
      if (notification.display.showInApp && supabaseAdmin) {
        // Map AdminNotification type to database notification type
        // Database types: 'deadline' | 'seat_alert' | 'cutoff_update' | 'recommendation' | 'system'
        let dbType: 'deadline' | 'seat_alert' | 'cutoff_update' | 'recommendation' | 'system' = 'system';
        if (notification.type === 'deadline') dbType = 'deadline';
        else if (notification.type === 'cutoff_update') dbType = 'cutoff_update';
        
        const notificationsToInsert = users.map(user => ({
          user_id: user.uid,
          title: notification.title,
          message: notification.message,
          type: dbType,
          priority: notification.display.priority === 'critical' ? 'high' : notification.display.priority,
          link: notification.actions?.primary?.url || null,
          created_at: new Date().toISOString(),
          read: false
        }));

        const { error } = await (supabaseAdmin as any)
          .from('notifications')
          .insert(notificationsToInsert);

        if (error) {
          console.error('Error batch inserting notifications:', error);
          failed += users.length; // Assume all failed if batch insert fails
        } else {
          delivered += users.length;
          // Create delivery records (mock for now as we don't have a deliveries table)
          users.forEach(user => {
            deliveries.push({
              id: this.generateId(),
              notificationId: notification.id,
              userId: user.uid,
              deliveredAt: new Date(),
              channel: 'in-app',
              status: 'delivered'
            });
          });
        }
      }

      // Handle other channels (Push, Email) individually or in batches
      // For now, just logging as we don't have providers set up
      for (const user of users) {
        // Send via push
        if (notification.display.showPush) {
          // await this.sendPushNotification(notification, user);
        }

        // Send via email
        if (notification.display.showEmail) {
          // await this.sendEmailNotification(notification, user);
        }
      }

      return {
        success: true,
        delivered,
        failed,
        deliveries
      };
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, delivered: 0, failed: 0, deliveries: [] };
    }
  }

  /**
   * Send in-app notification (Single)
   */
  private async sendInAppNotification(
    notification: AdminNotification,
    user: UserProfile
  ): Promise<NotificationDelivery> {
    try {
      if (!supabaseAdmin) throw new Error('Supabase Admin not available');

      let dbType: 'deadline' | 'seat_alert' | 'cutoff_update' | 'recommendation' | 'system' = 'system';
      if (notification.type === 'deadline') dbType = 'deadline';
      else if (notification.type === 'cutoff_update') dbType = 'cutoff_update';

      const { error } = await (supabaseAdmin as any)
        .from('notifications')
        .insert({
          user_id: user.uid,
          title: notification.title,
          message: notification.message,
          type: dbType,
          priority: notification.display.priority === 'critical' ? 'high' : notification.display.priority,
          link: notification.actions?.primary?.url || null,
          read: false
        });

      if (error) throw error;

      return {
        id: this.generateId(),
        notificationId: notification.id,
        userId: user.uid,
        deliveredAt: new Date(),
        channel: 'in-app',
        status: 'delivered'
      };
    } catch (error) {
      console.error('Error sending in-app notification:', error);
      return {
        id: this.generateId(),
        notificationId: notification.id,
        userId: user.uid,
        deliveredAt: new Date(),
        channel: 'in-app',
        status: 'failed',
        error: (error as Error).message
      };
    }
  }

  // ... (Other methods like sendPushNotification, sendEmailNotification remain as placeholders/loggers)

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Estimate notification reach
   */
  async estimateReach(target: NotificationTarget): Promise<number> {
    try {
      const users = await this.getTargetedUsers(target);
      return users.length;
    } catch (error) {
      console.error('Error estimating reach:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

export default NotificationService;
