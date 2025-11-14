'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Square, AlertTriangle, FileText, Download, Printer } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { showSuccess } from '@/lib/toast';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  required: boolean;
  category: string;
}

interface DocumentChecklistProps {
  items: ChecklistItem[];
  counsellingBody: string;
}

const DocumentChecklist: React.FC<DocumentChecklistProps> = ({ items, counsellingBody }) => {
  const { isDarkMode } = useTheme();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const categories = ['all', ...new Set(items.map(item => item.category))];

  const filteredItems = items.filter(item =>
    filterCategory === 'all' || item.category === filterCategory
  );

  const toggleItem = (id: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
    }
    setCheckedItems(newChecked);
  };

  const progress = (checkedItems.size / items.length) * 100;
  const requiredItems = items.filter(i => i.required);
  const requiredChecked = requiredItems.filter(i => checkedItems.has(i.id)).length;

  const handlePrint = () => {
    window.print();
    showSuccess('Opening print dialog');
  };

  const handleDownloadPDF = () => {
    showSuccess('Downloading checklist as PDF');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className={`text-2xl font-bold mb-2 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Document Checklist
          </h2>
          <p className={`text-sm ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {counsellingBody} counselling document requirements
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? 'hover:bg-white/10 text-gray-400'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Print Checklist"
          >
            <Printer className="w-5 h-5" />
          </button>
          <button
            onClick={handleDownloadPDF}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400'
                : 'bg-blue-100 hover:bg-blue-200 text-blue-600'
            }`}
            title="Download as PDF"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress Card */}
      <div className={`backdrop-blur-sm rounded-xl border p-6 ${
        isDarkMode
          ? 'bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-800/50'
          : 'bg-gradient-to-r from-blue-50/80 to-purple-50/80 border-blue-200/50'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Overall Progress
            </p>
            <p className={`text-3xl font-bold ${
              isDarkMode
                ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'
            }`}>
              {checkedItems.size} / {items.length}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Required Documents
            </p>
            <p className={`text-3xl font-bold ${
              requiredChecked === requiredItems.length
                ? 'text-green-500'
                : isDarkMode ? 'text-orange-400' : 'text-orange-600'
            }`}>
              {requiredChecked} / {requiredItems.length}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className={`w-full h-3 rounded-full overflow-hidden ${
          isDarkMode ? 'bg-white/10' : 'bg-gray-200'
        }`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
          />
        </div>

        {/* Warning for incomplete required documents */}
        {requiredChecked < requiredItems.length && (
          <div className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-orange-400' : 'text-orange-700'}`}>
                {requiredItems.length - requiredChecked} required documents pending
              </p>
              <p className={`text-xs mt-1 ${isDarkMode ? 'text-orange-300' : 'text-orange-600'}`}>
                Make sure to complete all required documents before counselling
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Category Filter */}
      <div className={`backdrop-blur-sm rounded-lg p-1 border inline-flex ${
        isDarkMode
          ? 'bg-white/5 border-white/10'
          : 'bg-gray-100/50 border-gray-200'
      }`}>
        <div className="flex gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${
                filterCategory === cat
                  ? isDarkMode
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-900 text-white'
                  : isDarkMode
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-3">
        {filteredItems.map((item, index) => {
          const isChecked = checkedItems.has(item.id);

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              onClick={() => toggleItem(item.id)}
              className={`backdrop-blur-sm rounded-xl border p-4 cursor-pointer transition-all duration-300 ${
                isChecked
                  ? isDarkMode
                    ? 'bg-green-900/20 border-green-700/50'
                    : 'bg-green-50 border-green-300'
                  : isDarkMode
                    ? 'bg-white/5 border-white/10 hover:bg-white/10'
                    : 'bg-white/60 border-gray-200 hover:bg-white/80'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <div className="flex-shrink-0 mt-1">
                  {isChecked ? (
                    <CheckSquare className="w-6 h-6 text-green-500" />
                  ) : (
                    <Square className={`w-6 h-6 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-400'
                    }`} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className={`font-semibold ${
                      isChecked
                        ? isDarkMode ? 'text-green-400' : 'text-green-700'
                        : isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {item.title}
                      {item.required && (
                        <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          REQUIRED
                        </span>
                      )}
                    </h3>
                  </div>

                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {item.description}
                  </p>

                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ${
                      isDarkMode ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-700'
                    }`}>
                      <FileText className="w-3 h-3" />
                      {item.category}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <div className={`text-center py-12 ${
          isDarkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No documents found in this category</p>
        </div>
      )}
    </div>
  );
};

export default DocumentChecklist;
