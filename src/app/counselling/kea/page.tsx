'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Calendar, CheckSquare, ArrowLeft, ExternalLink } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Vortex } from '@/components/ui/vortex';
import LightVortex from '@/components/ui/LightVortex';
import Footer from '@/components/ui/Footer';
import Link from 'next/link';
import PDFViewer from '@/components/counselling/PDFViewer';
import ImportantDates from '@/components/counselling/ImportantDates';
import DocumentChecklist from '@/components/counselling/DocumentChecklist';

const KEAPage: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [selectedTab, setSelectedTab] = useState<'documents' | 'dates' | 'checklist'>('documents');
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  const documents = [
    {
      id: '1',
      title: 'Karnataka CET 2024 Seat Matrix',
      category: 'Seat Matrix',
      fileUrl: '/documents/kea-seat-matrix-2024.pdf',
      officialUrl: 'https://kea.kar.nic.in/ugmedical2024/seat_matrix.aspx',
      uploadDate: '2024-06-20',
      fileSize: '8.2 MB',
      downloads: 28450,
      icon: FileText,
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: '2',
      title: 'KEA Counselling Schedule 2024',
      category: 'Schedule',
      fileUrl: '/documents/kea-schedule-2024.pdf',
      officialUrl: 'https://kea.kar.nic.in/ugmedical2024/schedule.aspx',
      uploadDate: '2024-06-18',
      fileSize: '1.9 MB',
      downloads: 22130,
      icon: Calendar,
      color: 'from-blue-500 to-cyan-500'
    }
  ];

  const importantDates = [
    {
      id: '1',
      title: 'Round 1 Option Entry',
      date: '2024-07-18',
      endDate: '2024-07-23',
      description: 'Online option entry and locking',
      status: 'upcoming' as const,
      category: 'registration'
    },
    {
      id: '2',
      title: 'Round 1 Seat Allotment',
      date: '2024-07-28',
      description: 'First round seat allotment result',
      status: 'upcoming' as const,
      category: 'allotment'
    }
  ];

  const checklistItems = [
    {
      id: '1',
      title: 'Karnataka CET Admit Card',
      description: 'Original and photocopy',
      required: true,
      category: 'Academic'
    },
    {
      id: '2',
      title: 'Karnataka CET Score Card',
      description: 'Original and photocopy',
      required: true,
      category: 'Academic'
    },
    {
      id: '3',
      title: 'SSLC Marks Card',
      description: 'For age and qualification proof',
      required: true,
      category: 'Academic'
    },
    {
      id: '4',
      title: 'PUC/12th Marks Card',
      description: 'Original and photocopy',
      required: true,
      category: 'Academic'
    },
    {
      id: '5',
      title: 'Karnataka Domicile Certificate',
      description: 'For state quota seats',
      required: true,
      category: 'Identity'
    },
    {
      id: '6',
      title: 'Category Certificate',
      description: 'SC/ST/OBC/Cat-1 certificate if applicable',
      required: false,
      category: 'Identity'
    },
    {
      id: '7',
      title: 'Income Certificate',
      description: 'For fee concession claims',
      required: false,
      category: 'Identity'
    },
    {
      id: '8',
      title: 'Passport Size Photos',
      description: '8-10 recent photographs',
      required: true,
      category: 'Documents'
    }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {isDarkMode ? (
        <Vortex className="fixed inset-0 z-0" particleCount={700} baseHue={270} rangeHue={90} baseSpeed={0.15} rangeSpeed={1.8} baseRadius={1} rangeRadius={2.5} backgroundColor="#000000" containerClassName="fixed inset-0">
          <div className="absolute inset-0 bg-black/30 z-10"></div>
        </Vortex>
      ) : (
        <LightVortex className="fixed inset-0 z-0" particleCount={350} baseHue={280} baseSpeed={0.1} rangeSpeed={1.3} baseRadius={1.5} rangeRadius={3} backgroundColor="#ffffff" containerClassName="fixed inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 via-pink-50/20 to-indigo-50/30 z-10"></div>
        </LightVortex>
      )}

      <div className="relative z-20 min-h-screen bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
            <Link href="/counselling" className={`inline-flex items-center gap-2 mb-4 text-sm ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}>
              <ArrowLeft className="w-4 h-4" />
              Back to Counselling
            </Link>

            <div className="flex items-start justify-between">
              <div>
                <h1 className={`text-4xl md:text-5xl font-bold mb-3 ${isDarkMode ? 'bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent' : 'bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent'}`}>
                  KEA Counselling
                </h1>
                <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Karnataka Examinations Authority - State Quota
                </p>
              </div>

              <a href="https://kea.kar.nic.in" target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isDarkMode ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-200'}`}>
                Official Website
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className={`backdrop-blur-md rounded-2xl border-2 p-2 mb-8 ${isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'}`}>
            <div className="flex gap-2">
              {[
                { key: 'documents', label: 'Documents', icon: FileText },
                { key: 'dates', label: 'Important Dates', icon: Calendar },
                { key: 'checklist', label: 'Document Checklist', icon: CheckSquare }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.key} onClick={() => setSelectedTab(tab.key as any)} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-300 ${selectedTab === tab.key ? isDarkMode ? 'bg-white/20 text-white border border-white/30 shadow-lg' : 'bg-gray-900 text-white border border-gray-800 shadow-lg' : isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>
                    <Icon className="w-5 h-5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          <motion.div key={selectedTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {selectedTab === 'documents' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                              : 'bg-purple-50 border-purple-300'
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

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 mt-4">
                              <button
                                onClick={() => setSelectedDocument(doc)}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                  selectedDocument?.id === doc.id
                                    ? isDarkMode
                                      ? 'bg-purple-600/30 text-purple-400 border border-purple-500/50'
                                      : 'bg-purple-100 text-purple-700 border border-purple-300'
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
                                    ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30 text-purple-400 border border-purple-500/30'
                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border border-purple-400'
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

                <div className={`backdrop-blur-md rounded-xl border-2 overflow-hidden sticky top-4 ${isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'}`}>
                  {selectedDocument ? <PDFViewer document={selectedDocument} /> : (
                    <div className="h-[600px] flex items-center justify-center">
                      <div className="text-center">
                        <FileText className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                        <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Select a document to preview</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedTab === 'dates' && <ImportantDates dates={importantDates} counsellingBody="KEA" />}
            {selectedTab === 'checklist' && <DocumentChecklist items={checklistItems} counsellingBody="KEA" />}
          </motion.div>
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default KEAPage;
