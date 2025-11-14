/**
 * ProgressTracker Component
 *
 * Comprehensive counseling journey tracker with:
 * - Multi-phase timeline (Pre-counseling, Registration, Choice Filling, Allotment, Admission)
 * - Visual progress indicators
 * - Task completion tracking
 * - Milestone achievements
 * - Date-based progression
 * - Interactive step details
 * - Next action recommendations
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  Calendar,
  FileText,
  Upload,
  DollarSign,
  Award,
  ChevronRight,
  ChevronDown,
  Target,
  TrendingUp,
  Users,
  BookOpen,
  Home as HomeIcon,
  Sparkles
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
  icon: React.ComponentType<{ className?: string }>;
}

interface Phase {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'upcoming' | 'locked';
  progress: number; // 0-100
  startDate?: Date;
  endDate?: Date;
  tasks: Task[];
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  achievedDate?: Date;
  icon: React.ComponentType<{ className?: string }>;
  reward?: string;
}

export default function ProgressTracker() {
  const [expandedPhase, setExpandedPhase] = useState<string | null>('registration');
  const [phases, setPhases] = useState<Phase[]>([
    {
      id: 'precounseling',
      title: 'Pre-Counseling Preparation',
      description: 'Research colleges and prepare for counseling',
      status: 'completed',
      progress: 100,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-05-31'),
      icon: BookOpen,
      color: 'green',
      tasks: [
        {
          id: 'p1',
          title: 'Research Colleges',
          description: 'Explore and shortlist potential colleges',
          completed: true,
          icon: TrendingUp,
          priority: 'high'
        },
        {
          id: 'p2',
          title: 'Check Cutoff Trends',
          description: 'Analyze last 3 years cutoff data',
          completed: true,
          icon: TrendingUp,
          priority: 'high'
        },
        {
          id: 'p3',
          title: 'Understand Seat Matrix',
          description: 'Learn about seat availability and reservations',
          completed: true,
          icon: Users,
          priority: 'medium'
        },
        {
          id: 'p4',
          title: 'Plan Budget',
          description: 'Calculate total education costs',
          completed: true,
          icon: DollarSign,
          priority: 'medium'
        }
      ]
    },
    {
      id: 'registration',
      title: 'Counseling Registration',
      description: 'Register for counseling and verify documents',
      status: 'in_progress',
      progress: 65,
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-06-15'),
      icon: FileText,
      color: 'blue',
      tasks: [
        {
          id: 'r1',
          title: 'Create Counseling Account',
          description: 'Register on official counseling portal',
          completed: true,
          dueDate: new Date('2024-06-05'),
          icon: FileText,
          priority: 'high'
        },
        {
          id: 'r2',
          title: 'Upload Documents',
          description: 'Upload all required documents',
          completed: true,
          dueDate: new Date('2024-06-08'),
          icon: Upload,
          priority: 'high'
        },
        {
          id: 'r3',
          title: 'Pay Registration Fee',
          description: 'Complete fee payment (₹2,000)',
          completed: false,
          dueDate: new Date('2024-06-10'),
          icon: DollarSign,
          priority: 'high'
        },
        {
          id: 'r4',
          title: 'Document Verification',
          description: 'Attend document verification (online/offline)',
          completed: false,
          dueDate: new Date('2024-06-12'),
          icon: CheckCircle,
          priority: 'high'
        }
      ]
    },
    {
      id: 'choicefilling',
      title: 'Choice Filling',
      description: 'Submit your college preferences',
      status: 'upcoming',
      progress: 0,
      startDate: new Date('2024-06-16'),
      endDate: new Date('2024-06-25'),
      icon: Target,
      color: 'purple',
      tasks: [
        {
          id: 'c1',
          title: 'Prepare Choice List',
          description: 'Finalize 150+ college-course combinations',
          completed: false,
          dueDate: new Date('2024-06-18'),
          icon: Target,
          priority: 'high'
        },
        {
          id: 'c2',
          title: 'Fill Choices Online',
          description: 'Enter choices on counseling portal',
          completed: false,
          dueDate: new Date('2024-06-22'),
          icon: FileText,
          priority: 'high'
        },
        {
          id: 'c3',
          title: 'Lock Choices',
          description: 'Lock and submit final choice list',
          completed: false,
          dueDate: new Date('2024-06-25'),
          icon: CheckCircle,
          priority: 'high'
        }
      ]
    },
    {
      id: 'allotment',
      title: 'Seat Allotment',
      description: 'Wait for and accept seat allotment',
      status: 'locked',
      progress: 0,
      startDate: new Date('2024-06-26'),
      endDate: new Date('2024-07-10'),
      icon: Award,
      color: 'orange',
      tasks: [
        {
          id: 'a1',
          title: 'Check Allotment Result',
          description: 'View your allotted college',
          completed: false,
          dueDate: new Date('2024-06-28'),
          icon: Award,
          priority: 'high'
        },
        {
          id: 'a2',
          title: 'Accept Allotment',
          description: 'Accept or decline allotted seat',
          completed: false,
          dueDate: new Date('2024-07-01'),
          icon: CheckCircle,
          priority: 'high'
        },
        {
          id: 'a3',
          title: 'Pay Seat Acceptance Fee',
          description: 'Pay fee to confirm seat',
          completed: false,
          dueDate: new Date('2024-07-03'),
          icon: DollarSign,
          priority: 'high'
        },
        {
          id: 'a4',
          title: 'Download Allotment Letter',
          description: 'Get official allotment letter',
          completed: false,
          dueDate: new Date('2024-07-05'),
          icon: FileText,
          priority: 'high'
        }
      ]
    },
    {
      id: 'admission',
      title: 'College Admission',
      description: 'Complete admission formalities',
      status: 'locked',
      progress: 0,
      startDate: new Date('2024-07-11'),
      endDate: new Date('2024-07-31'),
      icon: HomeIcon,
      color: 'green',
      tasks: [
        {
          id: 'ad1',
          title: 'Visit College',
          description: 'Report to allotted college',
          completed: false,
          dueDate: new Date('2024-07-15'),
          icon: HomeIcon,
          priority: 'high'
        },
        {
          id: 'ad2',
          title: 'Submit Original Documents',
          description: 'Submit all original certificates',
          completed: false,
          dueDate: new Date('2024-07-17'),
          icon: FileText,
          priority: 'high'
        },
        {
          id: 'ad3',
          title: 'Pay College Fee',
          description: 'Pay first year tuition and other fees',
          completed: false,
          dueDate: new Date('2024-07-20'),
          icon: DollarSign,
          priority: 'high'
        },
        {
          id: 'ad4',
          title: 'Complete Admission',
          description: 'Get admission confirmation',
          completed: false,
          dueDate: new Date('2024-07-25'),
          icon: CheckCircle,
          priority: 'high'
        }
      ]
    }
  ]);

  const [milestones] = useState<Milestone[]>([
    {
      id: 'm1',
      title: 'First College Saved',
      description: 'Saved your first college to favorites',
      achieved: true,
      achievedDate: new Date('2024-05-10'),
      icon: Award,
      reward: '10 points'
    },
    {
      id: 'm2',
      title: 'Registration Complete',
      description: 'Completed counseling registration',
      achieved: false,
      icon: FileText
    },
    {
      id: 'm3',
      title: 'Choice Master',
      description: 'Filled 100+ college choices',
      achieved: false,
      icon: Target,
      reward: '50 points'
    },
    {
      id: 'm4',
      title: 'Seat Secured',
      description: 'Got seat allotment',
      achieved: false,
      icon: Award,
      reward: '100 points'
    }
  ]);

  const overallProgress = phases.reduce((acc, phase) => acc + phase.progress, 0) / phases.length;
  const completedTasks = phases.flatMap(p => p.tasks).filter(t => t.completed).length;
  const totalTasks = phases.flatMap(p => p.tasks).length;

  const getStatusColor = (status: Phase['status']) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'in_progress':
        return 'blue';
      case 'upcoming':
        return 'yellow';
      case 'locked':
        return 'gray';
    }
  };

  const getStatusIcon = (status: Phase['status']) => {
    switch (status) {
      case 'completed':
        return CheckCircle;
      case 'in_progress':
        return Clock;
      case 'upcoming':
        return Calendar;
      case 'locked':
        return Circle;
    }
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhase(expandedPhase === phaseId ? null : phaseId);
  };

  return (
    <div className="space-y-6">
      {/* Header with Overall Progress */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <Sparkles className="w-7 h-7 mr-2 text-blue-600" />
              Counseling Journey
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Track your progress through the admission process
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {Math.round(overallProgress)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Overall Progress</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
          />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {phases.filter(p => p.status === 'completed').length}/{phases.length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Phases Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {completedTasks}/{totalTasks}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Tasks Done</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {milestones.filter(m => m.achieved).length}/{milestones.length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Milestones</div>
          </div>
        </div>
      </div>

      {/* Phase Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Phases</h3>

        <div className="space-y-4">
          {phases.map((phase, index) => {
            const Icon = phase.icon;
            const StatusIcon = getStatusIcon(phase.status);
            const color = getStatusColor(phase.status);
            const isExpanded = expandedPhase === phase.id;
            const isLocked = phase.status === 'locked';

            return (
              <motion.div
                key={phase.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`border-2 rounded-xl overflow-hidden transition-all ${
                  phase.status === 'completed'
                    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                    : phase.status === 'in_progress'
                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                    : phase.status === 'upcoming'
                    ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
                }`}
              >
                {/* Phase Header */}
                <button
                  onClick={() => !isLocked && togglePhase(phase.id)}
                  disabled={isLocked}
                  className="w-full p-5 text-left flex items-center justify-between hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors disabled:cursor-not-allowed"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl bg-${color}-500 flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-1">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                          {phase.title}
                        </h4>
                        <StatusIcon className={`w-5 h-5 text-${color}-600 dark:text-${color}-400`} />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{phase.description}</p>

                      {/* Progress bar for in_progress phases */}
                      {phase.status === 'in_progress' && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                            <span>{phase.progress}% Complete</span>
                            <span>
                              {phase.tasks.filter(t => t.completed).length}/{phase.tasks.length} tasks
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${phase.progress}%` }}
                              className={`h-full bg-${color}-500 rounded-full`}
                            />
                          </div>
                        </div>
                      )}

                      {/* Date range */}
                      {phase.startDate && phase.endDate && (
                        <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3 h-3 mr-1" />
                          <span>
                            {phase.startDate.toLocaleDateString()} - {phase.endDate.toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expand Icon */}
                  {!isLocked && (
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    </motion.div>
                  )}
                </button>

                {/* Tasks List */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-gray-200 dark:border-gray-700"
                    >
                      <div className="p-5 space-y-3">
                        {phase.tasks.map((task) => {
                          const TaskIcon = task.icon;
                          const isOverdue =
                            task.dueDate && new Date() > task.dueDate && !task.completed;

                          return (
                            <div
                              key={task.id}
                              className={`flex items-start space-x-3 p-3 rounded-lg ${
                                task.completed
                                  ? 'bg-white dark:bg-gray-700'
                                  : 'bg-gray-50 dark:bg-gray-800'
                              }`}
                            >
                              <div className="flex-shrink-0 mt-0.5">
                                {task.completed ? (
                                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                ) : (
                                  <Circle className="w-5 h-5 text-gray-400 dark:text-gray-600" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <h5
                                    className={`font-semibold ${
                                      task.completed
                                        ? 'text-gray-500 dark:text-gray-400 line-through'
                                        : 'text-gray-900 dark:text-white'
                                    }`}
                                  >
                                    {task.title}
                                  </h5>
                                  {task.priority === 'high' && !task.completed && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-xs rounded-full font-medium">
                                      High Priority
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {task.description}
                                </p>
                                {task.dueDate && (
                                  <div
                                    className={`mt-2 flex items-center text-xs ${
                                      isOverdue
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                  >
                                    <Calendar className="w-3 h-3 mr-1" />
                                    <span>
                                      Due: {task.dueDate.toLocaleDateString()}
                                      {isOverdue && ' (Overdue!)'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Milestones */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <Award className="w-6 h-6 mr-2 text-yellow-500" />
          Milestones & Achievements
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {milestones.map((milestone, index) => {
            const Icon = milestone.icon;

            return (
              <motion.div
                key={milestone.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-xl border-2 ${
                  milestone.achieved
                    ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-300 dark:border-yellow-800'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      milestone.achieved
                        ? 'bg-yellow-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {milestone.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {milestone.description}
                    </p>
                    {milestone.achieved && milestone.achievedDate && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Achieved on {milestone.achievedDate.toLocaleDateString()}
                      </p>
                    )}
                    {milestone.reward && (
                      <div className="mt-2 inline-flex items-center px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs rounded-full">
                        <Award className="w-3 h-3 mr-1" />
                        {milestone.reward}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
