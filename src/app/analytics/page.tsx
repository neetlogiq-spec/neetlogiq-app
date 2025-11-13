'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Users, Award, ArrowLeft, Sparkles, Filter } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Vortex } from '@/components/ui/vortex';
import LightVortex from '@/components/ui/LightVortex';
import Footer from '@/components/ui/Footer';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';

const AnalyticsPage: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [showContent, setShowContent] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStream, setSelectedStream] = useState<string>('MBBS');

  // Sample data for charts
  const trendData = [
    { year: '2019', General: 50, OBC: 150, SC: 450, ST: 850, EWS: 100 },
    { year: '2020', General: 48, OBC: 145, SC: 440, ST: 840, EWS: 95 },
    { year: '2021', General: 45, OBC: 140, SC: 430, ST: 830, EWS: 90 },
    { year: '2022', General: 43, OBC: 135, SC: 420, ST: 820, EWS: 85 },
    { year: '2023', General: 40, OBC: 130, SC: 410, ST: 810, EWS: 80 },
    { year: '2024', General: 38, OBC: 125, SC: 400, ST: 800, EWS: 75 }
  ];

  const seatDistributionData = [
    { name: 'General', value: 50.2, color: '#3b82f6' },
    { name: 'OBC', value: 27.5, color: '#8b5cf6' },
    { name: 'SC', value: 15.0, color: '#10b981' },
    { name: 'ST', value: 7.5, color: '#f59e0b' },
    { name: 'EWS', value: 10.0, color: '#ec4899' }
  ];

  const collegeTypeData = [
    { type: 'Government', count: 547, color: '#3b82f6' },
    { type: 'Private', count: 1234, color: '#8b5cf6' },
    { type: 'Deemed', count: 623, color: '#10b981' }
  ];

  const popularCollegesData = [
    { college: 'AIIMS Delhi', applications: 45678, color: '#3b82f6' },
    { college: 'JIPMER Puducherry', applications: 38945, color: '#8b5cf6' },
    { college: 'CMC Vellore', applications: 32156, color: '#10b981' },
    { college: 'AFMC Pune', applications: 28934, color: '#f59e0b' },
    { college: 'KGMU Lucknow', applications: 25678, color: '#ec4899' }
  ];

  const studentsLikeYouData = [
    { college: 'AIIMS Bhubaneswar', branch: 'MBBS', probability: 92, category: 'Safe', rank: 1245 },
    { college: 'JIPMER Karaikal', branch: 'MBBS', probability: 88, category: 'Safe', rank: 1450 },
    { college: 'VMMC Delhi', branch: 'MBBS', probability: 75, category: 'Moderate', rank: 2100 },
    { college: 'UCMS Delhi', branch: 'MBBS', probability: 68, category: 'Moderate', rank: 2450 },
    { college: 'MAMC Delhi', branch: 'MBBS', probability: 52, category: 'Reach', rank: 3200 },
    { college: 'LHMC Delhi', branch: 'MBBS', probability: 45, category: 'Reach', rank: 3650 }
  ];

  const categoryPerformanceData = [
    { metric: 'Rank', value: 85 },
    { metric: 'Documents', value: 60 },
    { metric: 'Choices Filled', value: 40 },
    { metric: 'Counselling Ready', value: 70 },
    { metric: 'College Research', value: 90 },
    { metric: 'Backup Options', value: 55 }
  ];

  const floatingIcons = [
    { Icon: BarChart3, color: 'from-blue-500 to-cyan-500', delay: 0 },
    { Icon: PieChartIcon, color: 'from-purple-500 to-pink-500', delay: 0.2 },
    { Icon: TrendingUp, color: 'from-green-500 to-teal-500', delay: 0.4 },
    { Icon: Users, color: 'from-orange-500 to-red-500', delay: 0.6 },
    { Icon: Award, color: 'from-pink-500 to-rose-500', delay: 0.8 }
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-gray-900/95 border-white/20' : 'bg-white/95 border-gray-200'} backdrop-blur-md shadow-xl`}>
          <p className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {isDarkMode ? (
        <Vortex
          className="fixed inset-0 z-0"
          particleCount={800}
          baseHue={220}
          rangeHue={140}
          baseSpeed={0.2}
          rangeSpeed={2.0}
          baseRadius={1}
          rangeRadius={2.5}
          backgroundColor="#000000"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-black/30 z-10"></div>
        </Vortex>
      ) : (
        <LightVortex
          className="fixed inset-0 z-0"
          particleCount={400}
          baseHue={230}
          baseSpeed={0.1}
          rangeSpeed={1.5}
          baseRadius={1.5}
          rangeRadius={3}
          backgroundColor="#ffffff"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-purple-50/20 to-pink-50/30 z-10"></div>
        </LightVortex>
      )}

      <AnimatePresence mode="wait">
        {!showContent ? (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            className="relative z-20 min-h-screen flex items-center justify-center p-4"
          >
            <div className="max-w-6xl mx-auto text-center">
              <div className="relative mb-12">
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 flex gap-8">
                  {floatingIcons.map(({ Icon, color, delay }, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
                      animate={{
                        opacity: [0, 1, 0.8, 1],
                        scale: [0.5, 1, 1.1, 1],
                        rotate: [-180, 0, 10, 0],
                        y: [0, -10, 0]
                      }}
                      transition={{
                        duration: 2,
                        delay: delay,
                        repeat: Infinity,
                        repeatDelay: 3
                      }}
                    >
                      <div className={`bg-gradient-to-br ${color} p-3 rounded-xl shadow-2xl`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className={`text-6xl md:text-8xl font-bold mb-6 mt-16 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent'
                    : 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent'
                }`}
              >
                Analytics Hub
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className={`text-xl md:text-2xl mb-12 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent'
                    : 'bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent'
                }`}
              >
                Data-Driven Insights for Smarter Decisions
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex flex-wrap justify-center gap-8 mb-12"
              >
                {[
                  { label: '6 Years', sublabel: 'Trend Data' },
                  { label: '2.4K+', sublabel: 'Colleges' },
                  { label: '16K+', sublabel: 'Cutoffs' }
                ].map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className={`text-4xl md:text-5xl font-bold mb-2 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {stat.label}
                    </div>
                    <div className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {stat.sublabel}
                    </div>
                  </div>
                ))}
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                onClick={() => setShowContent(true)}
                className={`group relative px-8 py-4 rounded-2xl text-lg font-semibold transition-all duration-300 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-500 hover:via-purple-500 hover:to-pink-500 text-white'
                    : 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white'
                } shadow-2xl hover:shadow-purple-500/50 hover:scale-105`}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Explore Analytics
                  <Sparkles className="w-5 h-5" />
                </span>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative z-20 min-h-screen bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
          >
            <div className="max-w-7xl mx-auto px-4 py-8">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-8"
              >
                <button
                  onClick={() => setShowContent(false)}
                  className={`inline-flex items-center gap-2 mb-4 text-sm ${
                    isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                  } transition-colors`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Hero
                </button>

                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h1 className={`text-4xl md:text-5xl font-bold mb-3 ${
                      isDarkMode
                        ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'
                    }`}>
                      Analytics Dashboard
                    </h1>
                    <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Comprehensive insights and trend analysis
                    </p>
                  </div>
                </div>

                {/* Filters */}
                <div className={`backdrop-blur-md rounded-2xl border-2 p-4 flex flex-wrap gap-4 ${
                  isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'
                }`}>
                  <div className="flex items-center gap-2">
                    <Filter className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                    <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Filters:</span>
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className={`px-4 py-2 rounded-xl border transition-all ${
                      isDarkMode
                        ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                        : 'bg-gray-100 border-gray-200 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    <option value="All">All Categories</option>
                    <option value="General">General</option>
                    <option value="OBC">OBC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                    <option value="EWS">EWS</option>
                  </select>
                  <select
                    value={selectedStream}
                    onChange={(e) => setSelectedStream(e.target.value)}
                    className={`px-4 py-2 rounded-xl border transition-all ${
                      isDarkMode
                        ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                        : 'bg-gray-100 border-gray-200 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    <option value="MBBS">MBBS</option>
                    <option value="BDS">BDS</option>
                    <option value="AYUSH">AYUSH</option>
                  </select>
                </div>
              </motion.div>

              <div className="space-y-8">
                {/* Cutoff Trend Analysis */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className={`backdrop-blur-md rounded-2xl border-2 p-6 ${
                    isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Cutoff Trend Analysis
                      </h2>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        6-year closing rank trends by category
                      </p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorGeneral" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorOBC" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorSC" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorST" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorEWS" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                      <XAxis dataKey="year" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                      <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} reversed />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area type="monotone" dataKey="General" stroke="#3b82f6" fillOpacity={1} fill="url(#colorGeneral)" />
                      <Area type="monotone" dataKey="OBC" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorOBC)" />
                      <Area type="monotone" dataKey="SC" stroke="#10b981" fillOpacity={1} fill="url(#colorSC)" />
                      <Area type="monotone" dataKey="ST" stroke="#f59e0b" fillOpacity={1} fill="url(#colorST)" />
                      <Area type="monotone" dataKey="EWS" stroke="#ec4899" fillOpacity={1} fill="url(#colorEWS)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Seat Distribution */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className={`backdrop-blur-md rounded-2xl border-2 p-6 ${
                      isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                        <PieChartIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          Seat Distribution
                        </h2>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          By category percentage
                        </p>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={seatDistributionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {seatDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </motion.div>

                  {/* College Type Distribution */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className={`backdrop-blur-md rounded-2xl border-2 p-6 ${
                      isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-teal-500">
                        <BarChart3 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          College Types
                        </h2>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Distribution by ownership
                        </p>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={collegeTypeData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                        <XAxis dataKey="type" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                        <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                          {collegeTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </motion.div>
                </div>

                {/* Popular Colleges */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className={`backdrop-blur-md rounded-2xl border-2 p-6 ${
                    isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-500">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Most Popular Colleges
                      </h2>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        By number of applications
                      </p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={popularCollegesData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                      <XAxis type="number" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                      <YAxis dataKey="college" type="category" width={150} stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="applications" radius={[0, 8, 8, 0]}>
                        {popularCollegesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>

                {/* Students Like You */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className={`backdrop-blur-md rounded-2xl border-2 p-6 ${
                    isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Students Like You Got Into
                      </h2>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Based on your rank and category
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {studentsLikeYouData.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 * index }}
                        className={`p-4 rounded-xl border ${
                          item.category === 'Safe'
                            ? isDarkMode
                              ? 'bg-green-500/10 border-green-500/30'
                              : 'bg-green-50 border-green-200'
                            : item.category === 'Moderate'
                            ? isDarkMode
                              ? 'bg-yellow-500/10 border-yellow-500/30'
                              : 'bg-yellow-50 border-yellow-200'
                            : isDarkMode
                            ? 'bg-orange-500/10 border-orange-500/30'
                            : 'bg-orange-50 border-orange-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {item.college}
                          </h4>
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-medium ${
                              item.category === 'Safe'
                                ? 'bg-green-500 text-white'
                                : item.category === 'Moderate'
                                ? 'bg-yellow-500 text-white'
                                : 'bg-orange-500 text-white'
                            }`}
                          >
                            {item.category}
                          </span>
                        </div>
                        <p className={`text-sm mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {item.branch} • Rank {item.rank}
                        </p>
                        <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.probability}%` }}
                            transition={{ duration: 1, delay: 0.2 * index }}
                            className={`h-full ${
                              item.category === 'Safe'
                                ? 'bg-green-500'
                                : item.category === 'Moderate'
                                ? 'bg-yellow-500'
                                : 'bg-orange-500'
                            }`}
                          />
                        </div>
                        <p className={`text-xs mt-2 text-right font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {item.probability}% probability
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Counselling Readiness Radar */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                  className={`backdrop-blur-md rounded-2xl border-2 p-6 ${
                    isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Your Counselling Readiness
                      </h2>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Performance across key metrics
                      </p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    <RadarChart data={categoryPerformanceData}>
                      <PolarGrid stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                      <PolarAngleAxis dataKey="metric" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                      <PolarRadiusAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                      <Radar name="Your Score" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                      <Tooltip content={<CustomTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </motion.div>
              </div>
            </div>

            <Footer />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AnalyticsPage;
