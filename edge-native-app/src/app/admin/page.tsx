'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Building2, 
  GraduationCap, 
  BarChart3, 
  Upload, 
  Database, 
  Search, 
  Settings,
  Users,
  Shield,
  Activity,
  TrendingUp,
  UserCheck,
  UserX,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Filter,
  FileText
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import TwoFactorAuth from '@/components/admin/TwoFactorAuth';
import SessionManager from '@/components/admin/SessionManager';
import DataManagement from '@/components/admin/DataManagement';
import SystemAdministration from '@/components/admin/SystemAdministration';
import AnalyticsMonitoring from '@/components/admin/AnalyticsMonitoring';
import ContentManagement from '@/components/admin/ContentManagement';
import { logAdminAction } from '@/services/adminAuditLog';
import { firebaseAdminService, UserProfile, UserStats } from '@/services/firebaseAdmin';

interface AdminStats {
  totalColleges: number;
  totalCourses: number;
  totalCutoffs: number;
  lastUpdated: string;
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalLogins: number;
  averageSessionDuration: number;
  errorRate: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

// Using UserProfile from firebaseAdmin service
type UserData = UserProfile;

const AdminPage: React.FC = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'pending'>('all');
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFactorMode, setTwoFactorMode] = useState<'setup' | 'verify' | 'disable'>('setup');
  const [currentDataType, setCurrentDataType] = useState<'colleges' | 'courses' | 'cutoffs' | 'users'>('colleges');

  // Redirect if not admin or not in whitelist
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!authLoading && user) {
        // Import admin configuration
        const { isAdminEmail } = await import('@/config/admin');
        const hasAdminAccess = isAdmin && isAdminEmail(user.email);
        
        if (!hasAdminAccess) {
          console.warn('🚫 Unauthorized admin access attempt:', user.email);
          router.push('/');
          return;
        }
        
        console.log('✅ Admin access granted:', user.email);
      } else if (!authLoading && !user) {
        router.push('/login');
      }
    };
    
    checkAdminAccess();
  }, [user, isAdmin, authLoading, router]);

  useEffect(() => {
    if (user && isAdmin) {
      loadAdminStats();
      loadUsers();
      
      // Log admin dashboard access
      logAdminAction(user.uid, user.email!, 'view_admin_dashboard', {
        details: { timestamp: new Date().toISOString() }
      });
    }
  }, [user, isAdmin]);

  const loadAdminStats = async () => {
    try {
      // Try to fetch API stats first
      const response = await fetch('/api/admin/stats');
      let apiStats = null;
      
      if (response.ok) {
        const data = await response.json();
        apiStats = data.data;
      }
      
      // Get real Firebase user statistics
      const firebaseUserStats = await firebaseAdminService.getUserStats();
      
      // Combine API stats with Firebase user stats
      const combinedStats: AdminStats = {
        totalColleges: apiStats?.totalColleges || 2108,
        totalCourses: apiStats?.totalCourses || 450,
        totalCutoffs: apiStats?.totalCutoffs || 15600,
        lastUpdated: apiStats?.lastUpdated || new Date().toISOString(),
        // Use real Firebase user stats
        totalUsers: firebaseUserStats.totalUsers,
        activeUsers: firebaseUserStats.activeUsers,
        newUsersToday: firebaseUserStats.newUsersToday,
        totalLogins: apiStats?.totalLogins || 5680,
        averageSessionDuration: apiStats?.averageSessionDuration || 25,
        errorRate: apiStats?.errorRate || 0.02,
        systemHealth: apiStats?.systemHealth || 'healthy'
      };
      
      setStats(combinedStats);
    } catch (error) {
      console.error('Error loading admin stats:', error);
      // Fallback to mock data
      const mockStats: AdminStats = {
        totalColleges: 2108,
        totalCourses: 450,
        totalCutoffs: 15600,
        lastUpdated: new Date().toISOString(),
        totalUsers: 1250,
        activeUsers: 892,
        newUsersToday: 23,
        totalLogins: 5680,
        averageSessionDuration: 25,
        errorRate: 0.02,
        systemHealth: 'healthy'
      };
      setStats(mockStats);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      
      // Try to load real Firebase users first
      const result = await firebaseAdminService.getUsers(50);
      setUsers(result.users);
      
      // Log admin action
      if (user) {
        logAdminAction(user.uid, user.email!, 'view_users', {
          details: { count: result.users.length }
        });
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert('File uploaded successfully!');
        loadAdminStats();
      } else {
        alert('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    }
  };

  const runDataPipeline = async () => {
    try {
      const response = await fetch('/api/admin/pipeline', {
        method: 'POST',
      });

      if (response.ok) {
        alert('Data pipeline started successfully!');
      } else {
        alert('Pipeline failed to start');
      }
    } catch (error) {
      console.error('Pipeline error:', error);
      alert('Pipeline failed to start');
    }
  };

  const handleUserAction = async (userId: string, action: 'suspend' | 'activate' | 'delete') => {
    try {
      console.log(`Performing ${action} on user ${userId}`);
      
      let success = false;
      
      // Perform the actual Firebase operation
      switch (action) {
        case 'suspend':
          success = await firebaseAdminService.toggleUserStatus(userId, 'suspended');
          break;
        case 'activate':
          success = await firebaseAdminService.toggleUserStatus(userId, 'active');
          break;
        case 'delete':
          success = await firebaseAdminService.deleteUser(userId, false); // Soft delete
          break;
      }
      
      if (success) {
        // Log admin action
        if (user) {
          logAdminAction(user.uid, user.email!, `${action}_user`, {
            resource: 'user',
            resourceId: userId,
            details: { action, success }
          });
        }
        
        // Refresh the user list
        await loadUsers();
      } else {
        console.error(`Failed to ${action} user ${userId}`);
      }
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'suspended':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center">
                <Shield className="w-8 h-8 text-blue-600 mr-3" />
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  NeetLogIQ Admin Dashboard
                </h1>
              </div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Manage users, system, data pipeline, colleges, and courses
              </p>
            </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShow2FAModal(true)}
                  className="flex items-center px-3 py-2 text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/40"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  2FA Setup
                </button>
                <button
                  onClick={() => {loadAdminStats(); loadUsers();}}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="Refresh"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  stats?.systemHealth === 'healthy' ? 'bg-green-500' : 
                  stats?.systemHealth === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  System {stats?.systemHealth || 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp },
              { id: 'content', label: 'Content', icon: FileText },
              { id: 'colleges', label: 'Colleges', icon: Building2 },
              { id: 'courses', label: 'Courses', icon: GraduationCap },
              { id: 'data', label: 'Data Pipeline', icon: Database },
              { id: 'search', label: 'Search', icon: Search },
              { id: 'system', label: 'System Admin', icon: Shield },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: 'Total Users',
                  value: stats?.totalUsers?.toLocaleString() || '0',
                  change: '+12%',
                  icon: Users,
                  color: 'blue'
                },
                {
                  title: 'Active Users',
                  value: stats?.activeUsers?.toLocaleString() || '0',
                  change: '+8%',
                  icon: UserCheck,
                  color: 'green'
                },
                {
                  title: 'New Today',
                  value: stats?.newUsersToday?.toString() || '0',
                  change: '+23%',
                  icon: Plus,
                  color: 'purple'
                },
                {
                  title: 'Total Logins',
                  value: stats?.totalLogins?.toLocaleString() || '0',
                  change: '+15%',
                  icon: Activity,
                  color: 'orange'
                }
              ].map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {stat.title}
                      </p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {stat.value}
                      </p>
                      <p className={`text-sm font-medium mt-1 ${
                        stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stat.change} from last month
                      </p>
                    </div>
                    <div className={`p-3 rounded-full bg-${stat.color}-100 dark:bg-${stat.color}-900/20`}>
                      <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Data Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Building2 className="w-8 h-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Colleges</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats?.totalColleges?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <GraduationCap className="w-8 h-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Courses</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats?.totalCourses?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <BarChart3 className="w-8 h-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Cutoffs</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats?.totalCutoffs?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* System Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  System Health
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">API Health</span>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      <span className="text-sm font-medium text-green-600">Healthy</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Database</span>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      <span className="text-sm font-medium text-green-600">Connected</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Error Rate</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {(stats?.errorRate ? stats.errorRate * 100 : 0).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Avg Session</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {stats?.averageSessionDuration || 0}m
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Recent Activity
                </h3>
                <div className="space-y-3">
                  {[
                    { action: 'New user registered', time: '2 minutes ago', type: 'user' },
                    { action: 'System backup completed', time: '1 hour ago', type: 'system' },
                    { action: 'Database optimization', time: '3 hours ago', type: 'system' },
                    { action: 'User login spike detected', time: '5 hours ago', type: 'alert' }
                  ].map((activity, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.type === 'user' ? 'bg-blue-500' :
                        activity.type === 'system' ? 'bg-green-500' : 'bg-yellow-500'
                      }`}></div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 dark:text-white">{activity.action}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <DataManagement
              dataType="users"
              data={users}
              onDataChange={(data) => setUsers(data)}
              onRefresh={loadUsers}
            />
            
            {/* Legacy Filters - Keep for reference */}
            <div className="hidden">{/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-3 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => loadUsers()}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Users ({filteredUsers.length})
                </h3>
              </div>
              
              {usersLoading ? (
                <div className="p-6 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Last Login
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Logins
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredUsers.map((userData) => (
                        <tr key={userData.uid} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {userData.photoURL ? (
                                <img
                                  className="h-10 w-10 rounded-full"
                                  src={userData.photoURL}
                                  alt={userData.displayName}
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                                  <Users className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                </div>
                              )}
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {userData.displayName}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {userData.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              userData.role === 'admin'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {userData.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {getStatusIcon(userData.status)}
                              <span className={`ml-2 text-sm font-medium ${
                                userData.status === 'active'
                                  ? 'text-green-600 dark:text-green-400'
                                  : userData.status === 'suspended'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-yellow-600 dark:text-yellow-400'
                              }`}>
                                {userData.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(userData.lastLogin)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {userData.loginCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => console.log('View user:', userData.uid)}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => console.log('Edit user:', userData.uid)}
                                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {userData.status === 'active' ? (
                                <button
                                  onClick={() => handleUserAction(userData.uid, 'suspend')}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                  title="Suspend"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUserAction(userData.uid, 'activate')}
                                  className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                  title="Activate"
                                >
                                  <UserCheck className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleUserAction(userData.uid, 'delete')}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
            </div> {/* End hidden legacy filters */}
          </motion.div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <AnalyticsMonitoring
              currentUser={{
                uid: user?.uid || '',
                email: user?.email || ''
              }}
            />
          </motion.div>
        )}

        {/* Content Management Tab */}
        {activeTab === 'content' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <ContentManagement
              currentUser={{
                uid: user?.uid || '',
                email: user?.email || ''
              }}
            />
          </motion.div>
        )}

        {/* Data Pipeline Tab */}
        {activeTab === 'data' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Data Pipeline Management
            </h2>

            <div className="space-y-6">
              {/* File Upload */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Upload Excel Files
                </h3>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
                  <div className="text-center">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Upload your Excel files (colleges.xlsx, courses.xlsx, cutoffs.xlsx)
                    </p>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                    >
                      Choose File
                    </label>
                  </div>
                </div>
              </div>

              {/* Pipeline Actions */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Pipeline Actions
                </h3>
                <div className="flex space-x-4">
                  <button
                    onClick={runDataPipeline}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Run Data Pipeline
                  </button>
                  <button
                    onClick={loadAdminStats}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Refresh Stats
                  </button>
                </div>
              </div>

              {/* Pipeline Status */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Pipeline Status
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last updated: {stats?.lastUpdated || 'Never'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Status: <span className="text-green-600">Ready</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Colleges Tab */}
        {activeTab === 'colleges' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <DataManagement
              dataType="colleges"
              data={[]} // TODO: Replace with actual colleges data
              onDataChange={(data) => console.log('Colleges data changed:', data)}
              onRefresh={() => console.log('Refreshing colleges data')}
            />
          </motion.div>
        )}

        {/* Courses Tab */}
        {activeTab === 'courses' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <DataManagement
              dataType="courses"
              data={[]} // TODO: Replace with actual courses data
              onDataChange={(data) => console.log('Courses data changed:', data)}
              onRefresh={() => console.log('Refreshing courses data')}
            />
          </motion.div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Search Configuration & AutoRAG Management
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Search Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Search Settings
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Default Search Limit
                      </label>
                      <input
                        type="number"
                        defaultValue="20"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Search Timeout (ms)
                      </label>
                      <input
                        type="number"
                        defaultValue="5000"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="enableFuzzySearch"
                        defaultChecked
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="enableFuzzySearch" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        Enable Fuzzy Search
                      </label>
                    </div>
                  </div>
                </div>

                {/* AutoRAG Configuration */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    AutoRAG Configuration
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Vector Model
                      </label>
                      <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white">
                        <option value="bge-base-en-v1.5">BGE Base EN v1.5</option>
                        <option value="bge-large-en-v1.5">BGE Large EN v1.5</option>
                        <option value="text-embedding-ada-002">OpenAI Ada 002</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Similarity Threshold
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        defaultValue="0.7"
                        className="w-full"
                      />
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Current: 0.7
                      </div>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="enableAutoRAG"
                        defaultChecked
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="enableAutoRAG" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        Enable AutoRAG
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search Index Status */}
              <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Search Index Status
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">2,440</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Colleges Indexed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">208</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Courses Indexed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">15,600</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Cutoffs Indexed</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex space-x-4">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Rebuild Index
                </button>
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Test Search
                </button>
                <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                  Export Index
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* System Administration Tab */}
        {activeTab === 'system' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <SystemAdministration 
              adminUser={{
                uid: user?.uid || '',
                email: user?.email || ''
              }}
            />
          </motion.div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              System Settings
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Basic system settings and preferences will be implemented here.
            </p>
          </div>
        )}
      </div>
      
      {/* Session Manager - Auto logout and session warnings */}
      <SessionManager
        timeoutMinutes={30}
        warningMinutes={5}
        onSessionExpired={() => {
          console.log('Admin session expired - redirecting to login');
        }}
        onSessionWarning={(remainingMinutes) => {
          console.log(`Session warning: ${remainingMinutes} minutes remaining`);
        }}
      />
      
      {/* Two-Factor Authentication Modal */}
      <TwoFactorAuth
        isOpen={show2FAModal}
        onClose={() => setShow2FAModal(false)}
        mode={twoFactorMode}
        userEmail={user?.email || ''}
        onComplete={(success) => {
          console.log('2FA setup completed:', success);
          setShow2FAModal(false);
          if (success && user) {
            logAdminAction(user.uid, user.email!, 'enable_2fa', {
              details: { timestamp: new Date().toISOString() }
            });
          }
        }}
      />
    </div>
  );
};

export default AdminPage;
