'use client';

import React from 'react';
import { GraduationCap, BookOpen } from 'lucide-react';

interface CourseLevelBadgeProps {
  courseName: string;
  getCourseLevel: (courseName: string) => 'UG' | 'PG' | 'UNKNOWN';
  getCourseStream: (courseName: string) => 'MEDICAL' | 'DENTAL' | 'UNKNOWN';
  className?: string;
}

const CourseLevelBadge: React.FC<CourseLevelBadgeProps> = ({
  courseName,
  getCourseLevel,
  getCourseStream,
  className = ''
}) => {
  const level = getCourseLevel(courseName);
  const stream = getCourseStream(courseName);

  if (level === 'UNKNOWN') return null;

  const getBadgeConfig = () => {
    if (level === 'UG') {
      return {
        text: 'UG',
        icon: GraduationCap,
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        textColor: 'text-blue-700 dark:text-blue-300',
        borderColor: 'border-blue-200 dark:border-blue-700'
      };
    } else if (level === 'PG') {
      return {
        text: 'PG',
        icon: BookOpen,
        bgColor: stream === 'DENTAL' 
          ? 'bg-purple-100 dark:bg-purple-900/30'
          : 'bg-green-100 dark:bg-green-900/30',
        textColor: stream === 'DENTAL'
          ? 'text-purple-700 dark:text-purple-300'
          : 'text-green-700 dark:text-green-300',
        borderColor: stream === 'DENTAL'
          ? 'border-purple-200 dark:border-purple-700'
          : 'border-green-200 dark:border-green-700'
      };
    }
    return null;
  };

  const config = getBadgeConfig();
  if (!config) return null;

  const IconComponent = config.icon;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}>
      <IconComponent className="w-3 h-3" />
      <span>{config.text}</span>
    </div>
  );
};

export default CourseLevelBadge;
