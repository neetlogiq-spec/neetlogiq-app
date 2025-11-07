'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Megaphone, 
  HelpCircle, 
  Globe, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  Eye,
  Calendar,
  Users,
  Tag,
  BarChart3,
  BookOpen,
  MessageSquare,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Star,
  ThumbsUp,
  ThumbsDown,
  Copy,
  ExternalLink,
  Save,
  X
} from 'lucide-react';
import {
  contentManagementService,
  Announcement,
  HelpDocument,
  FAQ,
  StaticPage,
  ContentCategory,
  ContentStats
} from '../../services/contentManagement';

interface ContentManagementProps {
  currentUser: {
    uid: string;
    email: string;
  };
}

const ContentManagement: React.FC<ContentManagementProps> = ({ currentUser }) => {
  // State management
  const [activeTab, setActiveTab] = useState<'overview' | 'announcements' | 'help' | 'faq' | 'pages' | 'categories'>('overview');
  const [contentStats, setContentStats] = useState<ContentStats | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [helpDocs, setHelpDocs] = useState<HelpDocument[]>([]);
  const [faqs, setFAQs] = useState<FAQ[]>([]);
  const [staticPages, setStaticPages] = useState<StaticPage[]>([]);
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [modalType, setModalType] = useState<'announcement' | 'help' | 'faq' | 'page' | 'category'>('announcement');

  // Load all content data
  const loadContentData = useCallback(async () => {
    setLoading(true);
    try {
      const [stats, announcementsData, helpData, faqData, pagesData, categoriesData] = await Promise.all([
        contentManagementService.getContentStats(),
        contentManagementService.getAnnouncements(),
        contentManagementService.getHelpDocuments(),
        contentManagementService.getFAQs(),
        contentManagementService.getStaticPages(),
        contentManagementService.getCategories()
      ]);

      setContentStats(stats);
      setAnnouncements(announcementsData);
      setHelpDocs(helpData);
      setFAQs(faqData);
      setStaticPages(pagesData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading content data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContentData();
  }, [loadContentData]);

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'text-green-600 bg-green-100';
      case 'draft': return 'text-yellow-600 bg-yellow-100';
      case 'archived': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'info': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter functions
  const filteredAnnouncements = announcements.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredHelpDocs = helpDocs.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredFAQs = faqs.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPages = staticPages.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Action handlers
  const handleCreate = (type: typeof modalType) => {
    setModalType(type);
    setEditingItem(null);
    setShowCreateModal(true);
  };

  const handleEdit = (item: any, type: typeof modalType) => {
    setModalType(type);
    setEditingItem(item);
    setShowCreateModal(true);
  };

  const handleDelete = async (id: string, type: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      switch (type) {
        case 'announcement':
          await contentManagementService.deleteAnnouncement(id);
          setAnnouncements(prev => prev.filter(item => item.id !== id));
          break;
        case 'help':
          await contentManagementService.deleteHelpDocument(id);
          setHelpDocs(prev => prev.filter(item => item.id !== id));
          break;
        case 'faq':
          await contentManagementService.deleteFAQ(id);
          setFAQs(prev => prev.filter(item => item.id !== id));
          break;
        case 'page':
          await contentManagementService.deleteStaticPage(id);
          setStaticPages(prev => prev.filter(item => item.id !== id));
          break;
      }
      await loadContentData(); // Refresh stats
    } catch (error) {
      console.error('Error deleting content:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Content Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage announcements, help documentation, FAQs, and static pages
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadContentData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'announcements', label: 'Announcements', icon: Megaphone },
            { key: 'help', label: 'Help Docs', icon: BookOpen },
            { key: 'faq', label: 'FAQs', icon: HelpCircle },
            { key: 'pages', label: 'Static Pages', icon: Globe },
            { key: 'categories', label: 'Categories', icon: Tag }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 py-2 px-1 border-b-2 text-sm font-medium ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && contentStats && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Megaphone className="h-8 w-8 text-blue-500" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {contentStats.activeAnnouncements}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Announcements</p>
                  <p className="text-xs text-gray-500">
                    {contentStats.totalAnnouncements} total
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-green-500" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {contentStats.publishedHelpDocs}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Published Help Docs</p>
                  <p className="text-xs text-gray-500">
                    {contentStats.totalHelpDocs} total
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <HelpCircle className="h-8 w-8 text-purple-500" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {contentStats.publishedFAQs}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Published FAQs</p>
                  <p className="text-xs text-gray-500">
                    {contentStats.totalFAQs} total
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Eye className="h-8 w-8 text-orange-500" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {contentStats.totalViews.toLocaleString()}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Views</p>
                </div>
              </div>
            </div>
          </div>

          {/* Popular Content */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Most Popular Content</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Views
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {contentStats.popularContent.map((content, index) => (
                    <tr key={content.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                              {index + 1}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {content.title}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(content.type)}`}>
                          {content.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {content.viewCount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      {activeTab !== 'overview' && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <button
              onClick={() => handleCreate(activeTab as any)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create New
            </button>
          </div>
        </div>
      )}

      {/* Announcements Tab */}
      {activeTab === 'announcements' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAnnouncements.map(item => (
                  <tr key={item.id}>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          {item.title}
                          {item.sticky && <Star className="h-4 w-4 text-yellow-500" />}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {item.content}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(item.type)}`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.viewCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(item.updatedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(item, 'announcement')}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, 'announcement')}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Help Documents Tab */}
      {activeTab === 'help' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Feedback
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredHelpDocs.map(item => (
                  <tr key={item.id}>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {item.difficulty} • {item.estimatedReadTime} min read
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center text-green-600">
                          <ThumbsUp className="h-3 w-3" />
                          <span className="ml-1 text-xs">{item.helpful}</span>
                        </div>
                        <div className="flex items-center text-red-600">
                          <ThumbsDown className="h-3 w-3" />
                          <span className="ml-1 text-xs">{item.notHelpful}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.viewCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(item, 'help')}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, 'help')}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FAQs Tab */}
      {activeTab === 'faq' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Question
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Feedback
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredFAQs.map(item => (
                  <tr key={item.id}>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.question}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {item.answer}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center text-green-600">
                          <ThumbsUp className="h-3 w-3" />
                          <span className="ml-1 text-xs">{item.helpful}</span>
                        </div>
                        <div className="flex items-center text-red-600">
                          <ThumbsDown className="h-3 w-3" />
                          <span className="ml-1 text-xs">{item.notHelpful}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.viewCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(item, 'faq')}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, 'faq')}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Static Pages Tab */}
      {activeTab === 'pages' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Slug
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Template
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPages.map(item => (
                  <tr key={item.id}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {item.title}
                        {item.seoOptimized && <CheckCircle className="h-4 w-4 text-green-500" title="SEO Optimized" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      /{item.slug}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.template}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(item.updatedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => window.open(`/${item.slug}`, '_blank')}
                          className="text-gray-600 hover:text-gray-900"
                          title="View"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(item, 'page')}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, 'page')}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map(category => (
            <div key={category.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: category.color }}
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {category.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {category.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(category.type)}`}>
                        {category.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        Order: {category.order}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(category, 'category')}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && <ContentModal />}
    </div>
  );

  // Content Modal Component (simplified for brevity)
  function ContentModal() {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingItem ? 'Edit' : 'Create'} {modalType}
            </h3>
            <button
              onClick={() => setShowCreateModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              Content editing form would be implemented here with rich text editor, 
              form fields for metadata, status controls, etc.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
};

export default ContentManagement;