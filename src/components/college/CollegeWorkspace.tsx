/**
 * CollegeWorkspace Component
 *
 * Comprehensive intelligence hub for saved colleges
 * Provides cutoff analysis, chance calculation, cost breakdown,
 * application tracking, and personalized insights
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Building2,
  TrendingUp,
  Calculator,
  DollarSign,
  FileText,
  StickyNote,
  Share2,
  Download,
  Bell,
  MapPin,
  Calendar,
  Users,
  Award,
  Target,
  BookOpen,
  Heart,
  ExternalLink
} from 'lucide-react';
import CutoffAnalyzer from './CutoffAnalyzer';
import ChanceCalculator from './ChanceCalculator';
import CostAnalyzer from './CostAnalyzer';
import ApplicationTracker from './ApplicationTracker';
import CollegeNotes from './CollegeNotes';

export interface College {
  id: string;
  name: string;
  state: string;
  city?: string;
  college_type: string;
  management_type: string;
  establishment_year?: number;
  university?: string;
  address?: string;
  pincode?: string;
  status?: string;
  nirf_rank?: number;
  course_count?: number;
}

export interface CollegeWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  college: College;
  userRank?: number;
  userCategory?: string;
  userProfile?: any;
}

type TabType = 'overview' | 'cutoffs' | 'chances' | 'cost' | 'apply' | 'notes';

export default function CollegeWorkspace({
  isOpen,
  onClose,
  college,
  userRank,
  userCategory = 'General',
  userProfile
}: CollegeWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isSaved, setIsSaved] = useState(true);
  const [alertEnabled, setAlertEnabled] = useState(false);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !college) return null;

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'cutoffs', label: 'Cutoffs', icon: TrendingUp },
    { id: 'chances', label: 'Your Chances', icon: Target },
    { id: 'cost', label: 'Cost', icon: DollarSign },
    { id: 'apply', label: 'Apply', icon: FileText },
    { id: 'notes', label: 'Notes', icon: StickyNote }
  ];

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: college.name,
        text: `Check out ${college.name} on NeetLogIQ`,
        url: window.location.href
      });
    }
  };

  const handleDownloadReport = () => {
    // TODO: Generate PDF report
    console.log('Downloading report for', college.name);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-7xl max-h-[95vh] mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
              <div className="p-4 sm:p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {college.name}
                      </h2>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-3 flex-wrap gap-2">
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {college.city && `${college.city}, `}{college.state}
                        </div>
                        {college.establishment_year && (
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            Est. {college.establishment_year}
                          </div>
                        )}
                        {college.nirf_rank && (
                          <div className="flex items-center">
                            <Award className="w-4 h-4 mr-1" />
                            NIRF #{college.nirf_rank}
                          </div>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          college.management_type === 'Government'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {college.management_type}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                          {college.college_type}
                        </span>
                        {isSaved && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 flex items-center">
                            <Heart className="w-3 h-3 mr-1 fill-current" />
                            Saved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={handleShare}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
                      title="Share"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleDownloadReport}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
                      title="Download Report"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setAlertEnabled(!alertEnabled)}
                      className={`p-2 rounded-lg transition-colors ${
                        alertEnabled
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                      title="Alerts"
                    >
                      <Bell className="w-5 h-5" />
                    </button>
                    <button
                      onClick={onClose}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 overflow-x-auto pb-2 scrollbar-hide">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                          activeTab === tab.id
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <OverviewTab college={college} userRank={userRank} />
                  </motion.div>
                )}

                {activeTab === 'cutoffs' && (
                  <motion.div
                    key="cutoffs"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CutoffAnalyzer
                      collegeId={college.id}
                      collegeName={college.name}
                      userRank={userRank}
                      userCategory={userCategory}
                    />
                  </motion.div>
                )}

                {activeTab === 'chances' && (
                  <motion.div
                    key="chances"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChanceCalculator
                      college={college}
                      userRank={userRank}
                      userCategory={userCategory}
                      userProfile={userProfile}
                    />
                  </motion.div>
                )}

                {activeTab === 'cost' && (
                  <motion.div
                    key="cost"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CostAnalyzer college={college} />
                  </motion.div>
                )}

                {activeTab === 'apply' && (
                  <motion.div
                    key="apply"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ApplicationTracker college={college} />
                  </motion.div>
                )}

                {activeTab === 'notes' && (
                  <motion.div
                    key="notes"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CollegeNotes collegeId={college.id} collegeName={college.name} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Overview Tab Component
function OverviewTab({ college, userRank }: { college: College; userRank?: number }) {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-700 dark:text-green-400 font-medium">Your Chances</span>
            <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-3xl font-bold text-green-900 dark:text-green-300 mb-1">87%</div>
          <div className="text-sm text-green-700 dark:text-green-400">Safe Match 🟢</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-700 dark:text-blue-400 font-medium">Annual Cost</span>
            <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-300 mb-1">₹1.4L</div>
          <div className="text-sm text-blue-700 dark:text-blue-400">Very Affordable</div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-6 rounded-xl border border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-orange-700 dark:text-orange-400 font-medium">Application</span>
            <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-3xl font-bold text-orange-900 dark:text-orange-300 mb-1">15 days</div>
          <div className="text-sm text-orange-700 dark:text-orange-400">Deadline Approaching</div>
        </div>
      </div>

      {/* Personalized Insights */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2 text-blue-600" />
          Personalized Insights
        </h3>
        <ul className="space-y-3">
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span className="text-gray-700 dark:text-gray-300">
              This college matches <strong>5/5</strong> of your preferences
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span className="text-gray-700 dark:text-gray-300">
              Students with your profile: <strong>92% admission rate</strong>
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span className="text-gray-700 dark:text-gray-300">
              Your rank is <strong>+50 better</strong> than last year's cutoff
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">ℹ</span>
            <span className="text-gray-700 dark:text-gray-300">
              <strong>12 students</strong> from your city are studying here
            </span>
          </li>
        </ul>
      </div>

      {/* College Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">College Information</h3>
          <div className="space-y-3">
            {college.university && (
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Affiliated University</div>
                <div className="text-gray-900 dark:text-white font-medium">{college.university}</div>
              </div>
            )}
            {college.address && (
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Address</div>
                <div className="text-gray-900 dark:text-white">{college.address}</div>
              </div>
            )}
            {college.course_count && (
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Courses Offered</div>
                <div className="text-gray-900 dark:text-white font-medium">{college.course_count} courses</div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center">
              <BookOpen className="w-5 h-5 mr-2" />
              View Detailed Cutoffs
            </button>
            <button className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors flex items-center justify-center">
              <Users className="w-5 h-5 mr-2" />
              Compare with Others
            </button>
            <button className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors flex items-center justify-center">
              <ExternalLink className="w-5 h-5 mr-2" />
              Visit College Website
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
