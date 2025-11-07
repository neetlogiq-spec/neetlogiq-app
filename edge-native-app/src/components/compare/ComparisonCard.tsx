'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface College {
  id: string;
  name: string;
  city: string;
  state: string;
  type: string;
  established: number;
  logo?: string;
  courses: number;
  medicalCourses: number;
  dentalCourses: number;
  avgCutoff: number;
  totalSeats: number;
  acceptanceRate: number;
}

interface ComparisonCardProps {
  title: string;
  icon: string;
  colleges: College[];
  data: Array<{
    label: string;
    key: string;
    format: string;
  }>;
  formatValue: (value: any, format: string) => string;
  getValue: (college: College, key: string) => any;
  isDarkMode: boolean;
}

const ComparisonCard: React.FC<ComparisonCardProps> = ({
  title,
  icon,
  colleges,
  data,
  formatValue,
  getValue,
  isDarkMode
}) => {
  return (
    <div className={`rounded-2xl p-6 ${
      isDarkMode 
        ? 'bg-gray-800/50 border border-gray-700' 
        : 'bg-white border border-gray-200'
    } shadow-lg`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{icon}</span>
        <h3 className={`text-xl font-semibold ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          {title}
        </h3>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={`border-b ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <th className={`text-left py-3 px-4 font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Criteria
              </th>
              {colleges.map((college, index) => (
                <th 
                  key={college.id}
                  className={`text-center py-3 px-4 font-medium ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  <div className="max-w-32">
                    <div className={`text-sm font-semibold truncate ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {college.name}
                    </div>
                    <div className={`text-xs ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {college.city}, {college.state}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, itemIndex) => (
              <motion.tr
                key={item.label}
                className={`border-b ${
                  isDarkMode ? 'border-gray-700' : 'border-gray-200'
                } hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors duration-200`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: itemIndex * 0.1 }}
              >
                <td className={`py-4 px-4 font-medium ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {item.label}
                </td>
                {colleges.map((college, collegeIndex) => {
                  const value = getValue(college, item.key);
                  const formattedValue = formatValue(value, item.format);
                  
                  // Find best and worst values for highlighting
                  const allValues = colleges.map(c => getValue(c, item.key));
                  const isNumeric = typeof value === 'number';
                  const isBest = isNumeric && value === Math.max(...allValues);
                  const isWorst = isNumeric && value === Math.min(...allValues);
                  
                  return (
                    <td 
                      key={`${college.id}-${item.key}`}
                      className={`py-4 px-4 text-center ${
                        isBest && isNumeric
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : isWorst && isNumeric
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          : isDarkMode 
                            ? 'text-gray-300' 
                            : 'text-gray-700'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-medium">
                          {formattedValue}
                        </span>
                        {isBest && isNumeric && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            Best
                          </span>
                        )}
                        {isWorst && isNumeric && (
                          <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                            Lowest
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ComparisonCard;
