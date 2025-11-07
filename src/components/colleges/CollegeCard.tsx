'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, MapPin, Users, Star, ExternalLink } from 'lucide-react';

interface College {
  id: string;
  name: string;
  location: string;
  state: string;
  type: string;
  established: number;
  rating: number;
  totalSeats: number;
  image?: string;
  description?: string;
}

interface CollegeCardProps {
  college: College;
  onClick: (college: College) => void;
}

const CollegeCard: React.FC<CollegeCardProps> = ({ college, onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -5 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group"
      onClick={() => onClick(college)}
    >
      {/* College Image */}
      <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute top-4 right-4">
          <div className="bg-white/90 dark:bg-gray-800/90 rounded-full px-3 py-1 flex items-center space-x-1">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {college.rating}
            </span>
          </div>
        </div>
        <div className="absolute bottom-4 left-4">
          <div className="bg-white/90 dark:bg-gray-800/90 rounded-full px-3 py-1 flex items-center space-x-1">
            <GraduationCap className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {college.type}
            </span>
          </div>
        </div>
      </div>

      {/* College Info */}
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {college.name}
        </h3>
        
        <div className="flex items-center text-gray-600 dark:text-gray-300 mb-3">
          <MapPin className="h-4 w-4 mr-2" />
          <span className="text-sm">{college.location}, {college.state}</span>
        </div>

        <div className="flex items-center text-gray-600 dark:text-gray-300 mb-4">
          <Users className="h-4 w-4 mr-2" />
          <span className="text-sm">Est. {college.established} • {college.totalSeats} seats</span>
        </div>

        {college.description && (
          <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
            {college.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Available</span>
          </div>
          <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
            <span>View Details</span>
            <ExternalLink className="h-4 w-4 ml-1" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CollegeCard;
