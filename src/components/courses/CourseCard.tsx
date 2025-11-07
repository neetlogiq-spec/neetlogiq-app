'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Clock, Users, GraduationCap, ExternalLink } from 'lucide-react';

interface Course {
  id: string;
  name: string;
  stream: string;
  duration: string;
  totalSeats: number;
  description: string;
  colleges: string[];
  eligibility: string;
  fees?: string;
}

interface CourseCardProps {
  course: Course;
  onClick: (course: Course) => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -5 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group"
      onClick={() => onClick(course)}
    >
      {/* Course Header */}
      <div className="h-32 bg-gradient-to-br from-green-500 to-teal-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute top-4 right-4">
          <div className="bg-white/90 dark:bg-gray-800/90 rounded-full px-3 py-1 flex items-center space-x-1">
            <BookOpen className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {course.stream}
            </span>
          </div>
        </div>
        <div className="absolute bottom-4 left-4">
          <h3 className="text-xl font-bold text-white group-hover:text-green-200 transition-colors">
            {course.name}
          </h3>
        </div>
      </div>

      {/* Course Info */}
      <div className="p-6">
        <div className="flex items-center text-gray-600 dark:text-gray-300 mb-3">
          <Clock className="h-4 w-4 mr-2" />
          <span className="text-sm">Duration: {course.duration}</span>
        </div>

        <div className="flex items-center text-gray-600 dark:text-gray-300 mb-3">
          <Users className="h-4 w-4 mr-2" />
          <span className="text-sm">{course.totalSeats} seats available</span>
        </div>

        <div className="flex items-center text-gray-600 dark:text-gray-300 mb-4">
          <GraduationCap className="h-4 w-4 mr-2" />
          <span className="text-sm">{course.colleges.length} colleges offer this course</span>
        </div>

        <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
          {course.description}
        </p>

        {course.fees && (
          <div className="mb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">Fees: </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{course.fees}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Available</span>
          </div>
          <div className="flex items-center text-green-600 dark:text-green-400 text-sm font-medium group-hover:text-green-700 dark:group-hover:text-green-300 transition-colors">
            <span>View Details</span>
            <ExternalLink className="h-4 w-4 ml-1" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CourseCard;
