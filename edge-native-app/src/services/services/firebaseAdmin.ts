/**
 * Firebase Admin Service
 * Handles Firebase user management for admin panel
 */

import { auth, db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  DocumentSnapshot,
  Timestamp,
  addDoc
} from '@firebase/firestore';

export interface FirebaseUserData {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  disabled: boolean;
  metadata: {
    creationTime: string;
    lastSignInTime: string;
    lastRefreshTime?: string;
  };
  providerData: Array<{
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    providerId: string;
  }>;
  customClaims?: Record<string, any>;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended' | 'pending';
  loginCount: number;
  lastLogin: string;
  createdAt: string;
  updatedAt: string;
  preferences?: Record<string, any>;
  profile?: {
    phone?: string;
    dateOfBirth?: string;
    location?: string;
    interests?: string[];
  };
}

export interface UserActivity {
  id: string;
  uid: string;
  email: string;
  action: string;
  details: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  suspendedUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  adminUsers: number;
  regularUsers: number;
}

/**
 * Firebase Admin User Management Service
 */
export class FirebaseAdminService {
  private usersCollection = 'users';
  private userProfilesCollection = 'user_profiles';
  private userActivitiesCollection = 'user_activities';

  /**
   * Get all users with pagination
   */
  async getUsers(
    pageSize: number = 50,
    lastDoc?: DocumentSnapshot,
    filters?: {
      role?: 'admin' | 'user';
      status?: 'active' | 'suspended' | 'pending';
      emailVerified?: boolean;
    }
  ): Promise<{ users: UserProfile[]; lastDoc?: DocumentSnapshot; hasMore: boolean }> {
    try {
      let q = query(
        collection(db, this.userProfilesCollection),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );

      // Apply filters
      if (filters?.role) {
        q = query(q, where('role', '==', filters.role));
      }
      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }

      // Add pagination
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const users: UserProfile[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        users.push({
          uid: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
          lastLogin: data.lastLogin?.toDate?.()?.toISOString() || data.lastLogin,
        } as UserProfile);
      });

      const lastVisible = snapshot.docs[snapshot.docs.length - 1];
      const hasMore = snapshot.docs.length === pageSize;

      return { users, lastDoc: lastVisible, hasMore };
    } catch (error) {
      console.error('Error fetching users:', error);
      return this.getFallbackUsers(pageSize);
    }
  }

  /**
   * Get user by UID
   */
  async getUser(uid: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, this.userProfilesCollection, uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          uid: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
          lastLogin: data.lastLogin?.toDate?.()?.toISOString() || data.lastLogin,
        } as UserProfile;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateUser(uid: string, updates: Partial<UserProfile>): Promise<boolean> {
    try {
      const docRef = doc(db, this.userProfilesCollection, uid);
      
      // Remove uid from updates to avoid overwriting document ID
      const { uid: _, ...updateData } = updates;
      
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: Timestamp.now()
      });
      
      await this.logUserActivity(uid, 'user_updated', { updates: updateData });
      return true;
    } catch (error) {
      console.error('Error updating user:', error);
      return false;
    }
  }

  /**
   * Suspend/Unsuspend user
   */
  async toggleUserStatus(uid: string, status: 'active' | 'suspended'): Promise<boolean> {
    try {
      const success = await this.updateUser(uid, { status });
      if (success) {
        await this.logUserActivity(uid, `user_${status}`, { status });
      }
      return success;
    } catch (error) {
      console.error('Error toggling user status:', error);
      return false;
    }
  }

  /**
   * Delete user (soft delete by setting status to 'deleted')
   */
  async deleteUser(uid: string, hardDelete: boolean = false): Promise<boolean> {
    try {
      if (hardDelete) {
        const docRef = doc(db, this.userProfilesCollection, uid);
        await deleteDoc(docRef);
      } else {
        await this.updateUser(uid, { status: 'suspended' }); // Soft delete
      }
      
      await this.logUserActivity(uid, hardDelete ? 'user_hard_deleted' : 'user_soft_deleted', {
        hardDelete
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    try {
      const usersRef = collection(db, this.userProfilesCollection);
      const allUsersQuery = query(usersRef);
      const allUsersSnapshot = await getDocs(allUsersQuery);
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      let totalUsers = 0;
      let activeUsers = 0;
      let newUsersToday = 0;
      let newUsersThisWeek = 0;
      let newUsersThisMonth = 0;
      let suspendedUsers = 0;
      let verifiedUsers = 0;
      let unverifiedUsers = 0;
      let adminUsers = 0;
      let regularUsers = 0;
      
      allUsersSnapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
        const lastLogin = data.lastLogin?.toDate?.() || new Date(data.lastLogin || 0);
        
        totalUsers++;
        
        // Status counts
        if (data.status === 'active') activeUsers++;
        if (data.status === 'suspended') suspendedUsers++;
        
        // Role counts
        if (data.role === 'admin') adminUsers++;
        else regularUsers++;
        
        // Email verification
        if (data.emailVerified) verifiedUsers++;
        else unverifiedUsers++;
        
        // New users
        if (createdAt >= today) newUsersToday++;
        if (createdAt >= weekAgo) newUsersThisWeek++;
        if (createdAt >= monthAgo) newUsersThisMonth++;
      });
      
      return {
        totalUsers,
        activeUsers,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        suspendedUsers,
        verifiedUsers,
        unverifiedUsers,
        adminUsers,
        regularUsers
      };
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return this.getFallbackStats();
    }
  }

  /**
   * Search users
   */
  async searchUsers(searchTerm: string, limit: number = 20): Promise<UserProfile[]> {
    try {
      // Firestore doesn't support full-text search, so we'll search by email and displayName
      const usersRef = collection(db, this.userProfilesCollection);
      
      // Search by email
      const emailQuery = query(
        usersRef,
        where('email', '>=', searchTerm),
        where('email', '<=', searchTerm + '\uf8ff'),
        orderBy('email'),
        limit(limit)
      );
      
      const emailSnapshot = await getDocs(emailQuery);
      const users: UserProfile[] = [];
      
      emailSnapshot.forEach((doc) => {
        const data = doc.data();
        users.push({
          uid: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
          lastLogin: data.lastLogin?.toDate?.()?.toISOString() || data.lastLogin,
        } as UserProfile);
      });
      
      return users;
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  /**
   * Get user activities/audit logs
   */
  async getUserActivities(uid?: string, limit: number = 50): Promise<UserActivity[]> {
    try {
      let q = query(
        collection(db, this.userActivitiesCollection),
        orderBy('timestamp', 'desc'),
        limit(limit)
      );
      
      if (uid) {
        q = query(q, where('uid', '==', uid));
      }
      
      const snapshot = await getDocs(q);
      const activities: UserActivity[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
        } as UserActivity);
      });
      
      return activities;
    } catch (error) {
      console.error('Error fetching user activities:', error);
      return [];
    }
  }

  /**
   * Log user activity
   */
  async logUserActivity(
    uid: string,
    action: string,
    details: Record<string, any> = {},
    email?: string
  ): Promise<void> {
    try {
      await addDoc(collection(db, this.userActivitiesCollection), {
        uid,
        email: email || 'unknown',
        action,
        details,
        timestamp: Timestamp.now(),
        ipAddress: details.ipAddress || 'unknown',
        userAgent: details.userAgent || 'unknown'
      });
    } catch (error) {
      console.error('Error logging user activity:', error);
    }
  }

  /**
   * Sync Firebase Auth user to Firestore profile
   */
  async syncUserProfile(firebaseUser: any): Promise<void> {
    try {
      const docRef = doc(db, this.userProfilesCollection, firebaseUser.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        // Create new profile
        await updateDoc(docRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || 'Unknown User',
          photoURL: firebaseUser.photoURL,
          role: 'user', // Default role
          status: firebaseUser.emailVerified ? 'active' : 'pending',
          loginCount: 1,
          lastLogin: Timestamp.now(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          emailVerified: firebaseUser.emailVerified
        });
      } else {
        // Update existing profile
        const currentData = docSnap.data();
        await updateDoc(docRef, {
          displayName: firebaseUser.displayName || currentData.displayName,
          photoURL: firebaseUser.photoURL || currentData.photoURL,
          loginCount: (currentData.loginCount || 0) + 1,
          lastLogin: Timestamp.now(),
          updatedAt: Timestamp.now(),
          emailVerified: firebaseUser.emailVerified
        });
      }
    } catch (error) {
      console.error('Error syncing user profile:', error);
    }
  }

  /**
   * Fallback mock data for development/testing
   */
  private getFallbackUsers(pageSize: number): { users: UserProfile[]; hasMore: boolean } {
    const mockUsers: UserProfile[] = [
      {
        uid: 'mock_user_1',
        email: 'john.doe@example.com',
        displayName: 'John Doe',
        photoURL: null,
        role: 'user',
        status: 'active',
        loginCount: 15,
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        uid: 'mock_user_2',
        email: 'jane.smith@example.com',
        displayName: 'Jane Smith',
        photoURL: 'https://example.com/avatar.jpg',
        role: 'user',
        status: 'active',
        loginCount: 8,
        lastLogin: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        uid: 'mock_user_3',
        email: 'pending.user@example.com',
        displayName: 'Pending User',
        photoURL: null,
        role: 'user',
        status: 'pending',
        loginCount: 1,
        lastLogin: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    return {
      users: mockUsers.slice(0, pageSize),
      hasMore: mockUsers.length > pageSize
    };
  }

  private getFallbackStats(): UserStats {
    return {
      totalUsers: 1250,
      activeUsers: 892,
      newUsersToday: 23,
      newUsersThisWeek: 156,
      newUsersThisMonth: 645,
      suspendedUsers: 8,
      verifiedUsers: 1180,
      unverifiedUsers: 70,
      adminUsers: 3,
      regularUsers: 1247
    };
  }
}

// Export singleton instance
export const firebaseAdminService = new FirebaseAdminService();