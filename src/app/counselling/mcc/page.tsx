'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Calendar, Download, CheckSquare, Clock, AlertCircle, ArrowLeft, ExternalLink, FileCheck } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Vortex } from '@/components/ui/vortex';
import LightVortex from '@/components/ui/LightVortex';
import Footer from '@/components/ui/Footer';
import Link from 'next/link';
import PDFViewer from '@/components/counselling/PDFViewer';
import ImportantDates from '@/components/counselling/ImportantDates';
import DocumentChecklist from '@/components/counselling/DocumentChecklist';

const MCCPage: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [selectedTab, setSelectedTab] = useState<'documents' | 'dates' | 'checklist'>('documents');
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  // Mock data - will be replaced with API calls
  const documents = [
    {
      id: '1',
      title: 'NEET UG 2024 Seat Matrix - Round 1',
      category: 'Seat Matrix',
      fileUrl: '/documents/mcc-seat-matrix-2024.pdf',
      officialUrl: 'https://mcc.nic.in/WebInfo/Page/Page?PageId=1&LangId=P',
      uploadDate: '2024-06-15',
      fileSize: '12.5 MB',
      downloads: 45231,
      icon: FileText,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: '2',
      title: 'Round 1 Schedule & Important Dates',
      category: 'Schedule',
      fileUrl: '/documents/mcc-round1-schedule.pdf',
      officialUrl: 'https://mcc.nic.in/WebInfo/Page/Page?PageId=2&LangId=P',
      uploadDate: '2024-06-10',
      fileSize: '2.1 MB',
      downloads: 38450,
      icon: Calendar,
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: '3',
      title: 'Document Verification Guidelines',
      category: 'Guidelines',
      fileUrl: '/documents/mcc-document-guidelines.pdf',
      officialUrl: 'https://mcc.nic.in/WebInfo/Page/Page?PageId=3&LangId=P',
      uploadDate: '2024-06-05',
      fileSize: '5.8 MB',
      downloads: 29340,
      icon: FileCheck,
      color: 'from-green-500 to-teal-500'
    },
    {
      id: '4',
      title: 'NEET UG 2024 Information Bulletin',
      category: 'Information',
      fileUrl: '/documents/mcc-information-bulletin.pdf',
      officialUrl: 'https://mcc.nic.in/WebInfo/Page/Page?PageId=4&LangId=P',
      uploadDate: '2024-05-20',
      fileSize: '8.3 MB',
      downloads: 56120,
      icon: FileText,
      color: 'from-orange-500 to-red-500'
    }
  ];

  const importantDates = [
    {
      id: '1',
      title: 'Round 1 Registration',
      date: '2024-07-15',
      endDate: '2024-07-20',
      description: 'Online registration and choice filling',
      status: 'upcoming' as const,
      category: 'registration'
    },
    {
      id: '2',
      title: 'Round 1 Seat Allotment',
      date: '2024-07-25',
      description: 'Seat allotment result declaration',
      status: 'upcoming' as const,
      category: 'allotment'
    },
    {
      id: '3',
      title: 'Document Verification',
      date: '2024-07-26',
      endDate: '2024-07-30',
      description: 'Physical document verification at allotted college',
      status: 'upcoming' as const,
      category: 'verification'
    },
    {
      id: '4',
      title: 'Round 2 Registration',
      date: '2024-08-05',
      endDate: '2024-08-10',
      description: 'Second round registration opens',
      status: 'upcoming' as const,
      category: 'registration'
    }
  ];

  const checklistItems = [
    {
      id: '1',
      title: 'NEET UG Admit Card',
      description: 'Original and photocopy',
      required: true,
      category: 'Academic'
    },
    {
      id: '2',
      title: 'NEET UG Scorecard',
      description: 'Original and photocopy',
      required: true,
      category: 'Academic'
    },
    {
      id: '3',
      title: 'Class 10th Marksheet',
      description: 'Original and photocopy (for age proof)',
      required: true,
      category: 'Academic'
    },
    {
      id: '4',
      title: 'Class 12th Marksheet',
      description: 'Original and photocopy',
      required: true,
      category: 'Academic'
    },
    {
      id: '5',
      title: 'Category Certificate',
      description: 'SC/ST/OBC/EWS certificate (if applicable)',
      required: false,
      category: 'Identity'
    },
    {
      id: '6',
      title: 'PwD Certificate',
      description: 'Person with Disability certificate (if applicable)',
      required: false,
      category: 'Identity'
    },
    {
      id: '7',
      title: 'Passport Size Photos',
      description: '10-15 recent passport size photographs',
      required: true,
      category: 'Documents'
    },
    {
      id: '8',
      title: 'ID Proof',
      description: 'Aadhar Card/Voter ID/Driving License',
      required: true,
      category: 'Identity'
    },
    {
      id: '9',
      title: 'Domicile Certificate',
      description: 'For state quota seats',
      required: false,
      category: 'Identity'
    },
    {
      id: '10',
      title: 'Migration Certificate',
      description: 'If applicable for different board students',
      required: false,
      category: 'Academic'
    }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Dynamic Background */}
      {isDarkMode ? (
        <Vortex
          className="fixed inset-0 z-0"
          particleCount={700}
          baseHue={200}
          rangeHue={120}
          baseSpeed={0.15}
          rangeSpeed={1.8}
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
          particleCount={350}
          baseHue={210}
          baseSpeed={0.1}
          rangeSpeed={1.3}
          baseRadius={1.5}
          rangeRadius={3}
          backgroundColor="#ffffff"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-cyan-50/20 to-indigo-50/30 z-10"></div>
        </LightVortex>
      )}

      {/* Content */}
      <div className="relative z-20 min-h-screen bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <Link
              href="/counselling"
              className={`inline-flex items-center gap-2 mb-4 text-sm ${
                isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              } transition-colors`}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Counselling
            </Link>

            <div className="flex items-start justify-between">
              <div>
                <h1 className={`text-4xl md:text-5xl font-bold mb-3 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent'
                }`}>
                  MCC Counselling
                </h1>
                <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Medical Counselling Committee - All India Quota
                </p>
              </div>

              <a
                href="https://mcc.nic.in"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isDarkMode
                    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-200'
                }`}
              >
                Official Website
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={`backdrop-blur-md rounded-2xl border-2 p-2 mb-8 ${
              isDarkMode
                ? 'bg-white/10 border-white/20'
                : 'bg-white/80 border-gray-200/60'
            }`}
          >
            <div className="flex gap-2">
              {[
                { key: 'documents', label: 'Documents', icon: FileText },
                { key: 'dates', label: 'Important Dates', icon: Calendar },
                { key: 'checklist', label: 'Document Checklist', icon: CheckSquare }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setSelectedTab(tab.key as any)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-300 ${
                      selectedTab === tab.key
                        ? isDarkMode
                          ? 'bg-white/20 text-white border border-white/30 shadow-lg'
                          : 'bg-gray-900 text-white border border-gray-800 shadow-lg'
                        : isDarkMode
                          ? 'text-gray-400 hover:text-white hover:bg-white/10'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Tab Content */}
          <motion.div
            key={selectedTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {selectedTab === 'documents' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Document List */}
                <div className="space-y-4">
                  {documents.map((doc, index) => {
                    const Icon = doc.icon;
                    return (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className={`backdrop-blur-sm rounded-xl border p-6 transition-all duration-300 ${
                          selectedDocument?.id === doc.id
                            ? isDarkMode
                              ? 'bg-white/20 border-white/40'
                              : 'bg-blue-50 border-blue-300'
                            : isDarkMode
                              ? 'bg-white/5 border-white/10 hover:bg-white/10'
                              : 'bg-white/60 border-gray-200 hover:bg-white/80'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-xl bg-gradient-to-br ${doc.color}`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {doc.title}
                            </h3>
                            <p className={`text-sm mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {doc.category}
                            </p>
                            <div className={`flex items-center gap-4 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(doc.uploadDate).toLocaleDateString()}
                              </span>
                              <span>{doc.fileSize}</span>
                              <span className="flex items-center gap-1">
                                <Download className="w-3 h-3" />
                                {doc.downloads.toLocaleString()}
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 mt-4">
                              <button
                                onClick={() => setSelectedDocument(doc)}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                  selectedDocument?.id === doc.id
                                    ? isDarkMode
                                      ? 'bg-blue-600/30 text-blue-400 border border-blue-500/50'
                                      : 'bg-blue-100 text-blue-700 border border-blue-300'
                                    : isDarkMode
                                      ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-200'
                                }`}
                              >
                                <FileText className="w-4 h-4" />
                                Preview
                              </button>

                              <a
                                href={doc.officialUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                  isDarkMode
                                    ? 'bg-gradient-to-r from-blue-600/20 to-cyan-600/20 hover:from-blue-600/30 hover:to-cyan-600/30 text-blue-400 border border-blue-500/30'
                                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border border-blue-400'
                                }`}
                              >
                                <ExternalLink className="w-4 h-4" />
                                Official Link
                              </a>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* PDF Viewer */}
                <div className={`backdrop-blur-md rounded-xl border-2 overflow-hidden sticky top-4 ${
                  isDarkMode
                    ? 'bg-white/10 border-white/20'
                    : 'bg-white/80 border-gray-200/60'
                }`}>
                  {selectedDocument ? (
                    <PDFViewer document={selectedDocument} />
                  ) : (
                    <div className="h-[600px] flex items-center justify-center">
                      <div className="text-center">
                        <FileText className={`w-16 h-16 mx-auto mb-4 ${
                          isDarkMode ? 'text-gray-600' : 'text-gray-400'
                        }`} />
                        <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Select a document to preview
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedTab === 'dates' && (
              <ImportantDates dates={importantDates} counsellingBody="MCC" />
            )}

            {selectedTab === 'checklist' && (
              <DocumentChecklist items={checklistItems} counsellingBody="MCC" />
            )}
          </motion.div>
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default MCCPage;
