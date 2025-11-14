/**
 * NotificationManagement Component
 *
 * Comprehensive notification management system for admins
 * Features:
 * - Create/Edit/Delete notifications
 * - Stream targeting (UG, PG_MEDICAL, PG_DENTAL, ALL)
 * - User segmentation
 * - Scheduling (immediate, scheduled, recurring)
 * - Priority levels
 * - Multi-channel delivery
 * - Analytics tracking
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Plus,
  Edit2,
  Trash2,
  Send,
  Calendar,
  Users,
  Target,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Eye,
  Filter,
  Search,
  Download,
  Upload,
  Copy,
  Settings
} from 'lucide-react';

export type NotificationType =
  | 'announcement'
  | 'cutoff_update'
  | 'college_update'
  | 'deadline'
  | 'feature'
  | 'maintenance'
  | 'alert'
  | 'success'
  | 'info'
  | 'warning'
  | 'error';

export type StreamType = 'UG' | 'PG_MEDICAL' | 'PG_DENTAL' | 'ALL';
export type UserSegment = 'all_users' | 'new_users' | 'active_users' | 'inactive_users' | 'specific_users';
export type DeliveryType = 'immediate' | 'scheduled';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';
export type NotificationStatus = 'draft' | 'scheduled' | 'sent' | 'cancelled';

export interface NotificationTarget {
  streams: StreamType[];
  userSegments: UserSegment[];
  states?: string[];
  cities?: string[];
  categories?: string[];
  rankRange?: {
    min: number;
    max: number;
  };
}

export interface NotificationSchedule {
  deliveryType: DeliveryType;
  scheduleDate?: Date;
  scheduleTime?: string;
  timezone: string;
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    endDate?: Date;
    daysOfWeek?: number[];
  };
  expiryDate?: Date;
}

export interface NotificationDisplay {
  priority: PriorityLevel;
  showInApp: boolean;
  showPush: boolean;
  showEmail: boolean;
  showDesktop: boolean;
  persistent: boolean;
  requireAction: boolean;
  autoClose?: number;
  icon?: string;
  color?: string;
  image?: string;
}

export interface NotificationAction {
  text: string;
  url: string;
  type: 'link' | 'button' | 'modal';
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  target: NotificationTarget;
  schedule: NotificationSchedule;
  display: NotificationDisplay;
  actions?: {
    primary?: NotificationAction;
    secondary?: NotificationAction;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  status: NotificationStatus;
  stats?: {
    delivered: number;
    viewed: number;
    clicked: number;
    dismissed: number;
  };
  template?: string;
  variables?: Record<string, string>;
}

interface NotificationManagementProps {
  currentUser: {
    uid: string;
    email: string;
  };
}

const NotificationManagement: React.FC<NotificationManagementProps> = ({ currentUser }) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState<AdminNotification | null>(null);
  const [filterStatus, setFilterStatus] = useState<NotificationStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

  // Form state
  const [formData, setFormData] = useState<Partial<AdminNotification>>({
    title: '',
    message: '',
    type: 'announcement',
    target: {
      streams: ['ALL'],
      userSegments: ['all_users']
    },
    schedule: {
      deliveryType: 'immediate',
      timezone: 'Asia/Kolkata'
    },
    display: {
      priority: 'medium',
      showInApp: true,
      showPush: false,
      showEmail: false,
      showDesktop: false,
      persistent: false,
      requireAction: false
    },
    status: 'draft'
  });

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingNotification(null);
    setFormData({
      title: '',
      message: '',
      type: 'announcement',
      target: {
        streams: ['ALL'],
        userSegments: ['all_users']
      },
      schedule: {
        deliveryType: 'immediate',
        timezone: 'Asia/Kolkata'
      },
      display: {
        priority: 'medium',
        showInApp: true,
        showPush: false,
        showEmail: false,
        showDesktop: false,
        persistent: false,
        requireAction: false
      },
      status: 'draft'
    });
    setShowCreateModal(true);
  };

  const handleEdit = (notification: AdminNotification) => {
    setEditingNotification(notification);
    setFormData(notification);
    setShowCreateModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;

    try {
      const response = await fetch(`/api/admin/notifications/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setNotifications(notifications.filter(n => n.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleSave = async () => {
    try {
      const url = editingNotification
        ? `/api/admin/notifications/${editingNotification.id}`
        : '/api/admin/notifications';

      const method = editingNotification ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          createdBy: currentUser.uid
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (editingNotification) {
          setNotifications(notifications.map(n =>
            n.id === data.notification.id ? data.notification : n
          ));
        } else {
          setNotifications([data.notification, ...notifications]);
        }
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error('Failed to save notification:', error);
    }
  };

  const handleSend = async (id: string) => {
    if (!confirm('Send this notification now?')) return;

    try {
      const response = await fetch(`/api/admin/notifications/${id}/send`, {
        method: 'POST'
      });

      if (response.ok) {
        await loadNotifications();
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesStatus = filterStatus === 'all' || n.status === filterStatus;
    const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         n.message.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: NotificationStatus) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      sent: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Notification Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create and manage user notifications with stream targeting
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Notification
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Notifications', value: notifications.length, icon: Bell, color: 'blue' },
          { label: 'Scheduled', value: notifications.filter(n => n.status === 'scheduled').length, icon: Clock, color: 'yellow' },
          { label: 'Sent', value: notifications.filter(n => n.status === 'sent').length, icon: CheckCircle, color: 'green' },
          { label: 'Total Delivered', value: notifications.reduce((sum, n) => sum + (n.stats?.delivered || 0), 0), icon: Users, color: 'purple' }
        ].map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stat.value.toLocaleString()}
                </p>
              </div>
              <div className={`p-3 bg-${stat.color}-100 dark:bg-${stat.color}-900/20 rounded-full`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="sent">Sent</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No notifications found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredNotifications.map((notification) => (
              <div key={notification.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getTypeIcon(notification.type)}
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {notification.title}
                      </h3>
                      {getStatusBadge(notification.status)}
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        notification.display.priority === 'critical' ? 'bg-red-100 text-red-800' :
                        notification.display.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        notification.display.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {notification.display.priority}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">
                      {notification.message}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <Target className="w-4 h-4 mr-1" />
                        Streams: {notification.target.streams.join(', ')}
                      </div>
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        Segments: {notification.target.userSegments.join(', ')}
                      </div>
                      {notification.schedule.deliveryType === 'scheduled' && (
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Scheduled: {new Date(notification.schedule.scheduleDate!).toLocaleString()}
                        </div>
                      )}
                      {notification.stats && (
                        <div className="flex items-center">
                          <BarChart3 className="w-4 h-4 mr-1" />
                          {notification.stats.delivered} delivered, {notification.stats.viewed} viewed
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {notification.status === 'draft' && (
                      <button
                        onClick={() => handleSend(notification.id)}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                        title="Send Now"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(notification)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(notification.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingNotification ? 'Edit Notification' : 'Create Notification'}
                </h3>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Basic Information</h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., New 2024 Cutoffs Available"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Message *
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Enter notification message..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Type
                      </label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as NotificationType })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="announcement">Announcement</option>
                        <option value="cutoff_update">Cutoff Update</option>
                        <option value="college_update">College Update</option>
                        <option value="deadline">Deadline</option>
                        <option value="feature">New Feature</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="alert">Alert</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Priority
                      </label>
                      <select
                        value={formData.display?.priority}
                        onChange={(e) => setFormData({
                          ...formData,
                          display: { ...formData.display!, priority: e.target.value as PriorityLevel }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Target Audience */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Target Audience</h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Streams
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['ALL', 'UG', 'PG_MEDICAL', 'PG_DENTAL'].map((stream) => (
                        <label key={stream} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.target?.streams.includes(stream as StreamType)}
                            onChange={(e) => {
                              const streams = e.target.checked
                                ? [...(formData.target?.streams || []), stream as StreamType]
                                : (formData.target?.streams || []).filter(s => s !== stream);
                              setFormData({
                                ...formData,
                                target: { ...formData.target!, streams }
                              });
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{stream}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      User Segments
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['all_users', 'new_users', 'active_users', 'inactive_users'].map((segment) => (
                        <label key={segment} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.target?.userSegments.includes(segment as UserSegment)}
                            onChange={(e) => {
                              const segments = e.target.checked
                                ? [...(formData.target?.userSegments || []), segment as UserSegment]
                                : (formData.target?.userSegments || []).filter(s => s !== segment);
                              setFormData({
                                ...formData,
                                target: { ...formData.target!, userSegments: segments }
                              });
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            {segment.replace('_', ' ')}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Schedule */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Schedule</h4>

                  <div>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={formData.schedule?.deliveryType === 'immediate'}
                        onChange={() => setFormData({
                          ...formData,
                          schedule: { ...formData.schedule!, deliveryType: 'immediate' }
                        })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Send Immediately</span>
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center mb-2">
                      <input
                        type="radio"
                        checked={formData.schedule?.deliveryType === 'scheduled'}
                        onChange={() => setFormData({
                          ...formData,
                          schedule: { ...formData.schedule!, deliveryType: 'scheduled' }
                        })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Schedule for Later</span>
                    </label>
                    {formData.schedule?.deliveryType === 'scheduled' && (
                      <div className="ml-6 grid grid-cols-2 gap-4">
                        <input
                          type="date"
                          value={formData.schedule.scheduleDate ? new Date(formData.schedule.scheduleDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            schedule: { ...formData.schedule!, scheduleDate: new Date(e.target.value) }
                          })}
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                        <input
                          type="time"
                          value={formData.schedule.scheduleTime || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            schedule: { ...formData.schedule!, scheduleTime: e.target.value }
                          })}
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Display Options */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Display Options</h4>

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'showInApp', label: 'In-App Notification' },
                      { key: 'showPush', label: 'Push Notification' },
                      { key: 'showEmail', label: 'Email Notification' },
                      { key: 'showDesktop', label: 'Desktop Notification' },
                      { key: 'persistent', label: 'Persistent (no auto-close)' },
                      { key: 'requireAction', label: 'Require Action' }
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.display?.[key as keyof NotificationDisplay] as boolean}
                          onChange={(e) => setFormData({
                            ...formData,
                            display: { ...formData.display!, [key]: e.target.checked }
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingNotification ? 'Update' : 'Create'} Notification
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationManagement;
