/**
 * ApplicationTracker Component
 *
 * Track application progress with:
 * - Document checklist
 * - Deadline countdown
 * - Status tracking
 * - Payment tracking
 * - Important dates
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  DollarSign,
  Calendar,
  Upload,
  Download
} from 'lucide-react';
import type { College } from './CollegeWorkspace';

interface Document {
  id: string;
  name: string;
  required: boolean;
  uploaded: boolean;
  file?: File;
  uploadedAt?: Date;
}

interface ApplicationStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: Date;
  description: string;
}

export default function ApplicationTracker({ college }: { college: College }) {
  const [documents, setDocuments] = useState<Document[]>([
    { id: '1', name: 'NEET Scorecard', required: true, uploaded: false },
    { id: '2', name: 'Class 10 Marksheet', required: true, uploaded: false },
    { id: '3', name: 'Class 12 Marksheet', required: true, uploaded: false },
    { id: '4', name: 'Category Certificate', required: false, uploaded: false },
    { id: '5', name: 'Domicile Certificate', required: false, uploaded: false },
    { id: '6', name: 'Aadhar Card', required: true, uploaded: false },
    { id: '7', name: 'Passport Photo', required: true, uploaded: false },
    { id: '8', name: 'Medical Certificate', required: true, uploaded: false }
  ]);

  const [steps, setSteps] = useState<ApplicationStep[]>([
    {
      id: '1',
      name: 'Register on Portal',
      status: 'completed',
      description: 'Create account and fill basic details'
    },
    {
      id: '2',
      name: 'Upload Documents',
      status: 'in_progress',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      description: 'Upload all required documents'
    },
    {
      id: '3',
      name: 'Pay Application Fee',
      status: 'pending',
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      description: 'Pay ₹2,000 application fee'
    },
    {
      id: '4',
      name: 'Submit Application',
      status: 'pending',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      description: 'Review and submit final application'
    },
    {
      id: '5',
      name: 'Await Results',
      status: 'pending',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      description: 'Wait for admission decision'
    }
  ]);

  const handleFileUpload = (docId: string, file: File) => {
    setDocuments(prev => prev.map(doc =>
      doc.id === docId
        ? { ...doc, uploaded: true, file, uploadedAt: new Date() }
        : doc
    ));
  };

  const completedDocs = documents.filter(d => d.uploaded).length;
  const requiredDocs = documents.filter(d => d.required && !d.uploaded).length;
  const progress = (completedDocs / documents.length) * 100;

  const getDaysUntil = (date?: Date) => {
    if (!date) return null;
    const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Application Progress</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Track your application to {college.name}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {Math.round(progress)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Complete</div>
          </div>
        </div>

        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
          />
        </div>

        {requiredDocs > 0 && (
          <div className="mt-4 flex items-center space-x-2 text-orange-600 dark:text-orange-400">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">
              {requiredDocs} required document{requiredDocs > 1 ? 's' : ''} pending
            </span>
          </div>
        )}
      </div>

      {/* Application Steps */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          Application Steps
        </h4>

        <div className="space-y-4">
          {steps.map((step, index) => {
            const daysLeft = getDaysUntil(step.dueDate);
            const isUrgent = daysLeft !== null && daysLeft <= 3;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-start space-x-4 p-4 rounded-lg border-2 transition-colors ${
                  step.status === 'completed'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : step.status === 'in_progress'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0 mt-1">
                  {step.status === 'completed' ? (
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  ) : step.status === 'in_progress' ? (
                    <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Circle className="w-6 h-6 text-gray-400 dark:text-gray-600" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-semibold text-gray-900 dark:text-white">
                      {index + 1}. {step.name}
                    </h5>
                    {daysLeft !== null && step.status !== 'completed' && (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        isUrgent
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                      }`}>
                        {daysLeft} days left
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
                  {step.dueDate && (
                    <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="w-4 h-4 mr-1" />
                      Due: {step.dueDate.toLocaleDateString()}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Document Checklist */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Document Checklist
          </h4>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {completedDocs}/{documents.length} uploaded
          </span>
        </div>

        <div className="space-y-3">
          {documents.map((doc, index) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                doc.uploaded
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center space-x-3">
                {doc.uploaded ? (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-400 dark:text-gray-600" />
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`font-medium ${
                      doc.uploaded
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {doc.name}
                    </span>
                    {doc.required && !doc.uploaded && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-xs rounded-full font-medium">
                        Required
                      </span>
                    )}
                  </div>
                  {doc.uploaded && doc.uploadedAt && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Uploaded on {doc.uploadedAt.toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {!doc.uploaded ? (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(doc.id, file);
                      }}
                    />
                    <span className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                      Upload
                    </span>
                  </label>
                ) : (
                  <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm font-medium rounded-lg transition-colors">
                    View
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Payment Information */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <DollarSign className="w-5 h-5 mr-2" />
          Fee Payment
        </h4>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Application Fee</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">One-time payment</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-900 dark:text-white">₹2,000</div>
              <button className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                Pay Now
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center space-x-2">
          <Download className="w-5 h-5" />
          <span>Download Form</span>
        </button>
        <button className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl font-medium transition-colors">
          Save Progress
        </button>
      </div>
    </div>
  );
}
