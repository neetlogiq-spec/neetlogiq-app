'use client';

import React from 'react';
import { TrendingUp, Star, MapPin, Users, Award, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface College {
  id: string;
  name: string;
  city: string;
  state: string;
  rating: number;
  students: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: string;
  image?: string;
  description: string;
  specialties: string[];
}

interface TrendingCollegesProps {
  className?: string;
}

const TrendingColleges: React.FC<TrendingCollegesProps> = ({ className = '' }) => {
  const colleges: College[] = [
    {
      id: '1',
      name: 'All India Institute of Medical Sciences, New Delhi',
      city: 'New Delhi',
      state: 'Delhi',
      rating: 4.9,
      students: 1200,
      trend: 'up',
      trendValue: '+15%',
      description: 'Premier medical institute with world-class facilities and research opportunities.',
      specialties: ['MBBS', 'MD', 'MS', 'DM', 'MCh']
    },
    {
      id: '2',
      name: 'Maulana Azad Medical College',
      city: 'New Delhi',
      state: 'Delhi',
      rating: 4.7,
      students: 800,
      trend: 'up',
      trendValue: '+8%',
      description: 'Renowned for excellent clinical training and affordable education.',
      specialties: ['MBBS', 'MD', 'MS', 'BDS']
    },
    {
      id: '3',
      name: 'King George Medical University',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      rating: 4.6,
      students: 1500,
      trend: 'stable',
      trendValue: '0%',
      description: 'One of the oldest and most prestigious medical institutions in India.',
      specialties: ['MBBS', 'MD', 'MS', 'BDS', 'Nursing']
    },
    {
      id: '4',
      name: 'Christian Medical College',
      city: 'Vellore',
      state: 'Tamil Nadu',
      rating: 4.8,
      students: 900,
      trend: 'up',
      trendValue: '+12%',
      description: 'Internationally recognized for medical education and healthcare services.',
      specialties: ['MBBS', 'MD', 'MS', 'BDS', 'Nursing', 'Allied Health']
    }
  ];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
      default:
        return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-600 dark:text-green-400';
      case 'down':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-orange-600" />
          Trending Colleges
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Most searched and popular medical colleges
        </p>
      </div>
      
      <div className="p-6">
        <div className="space-y-4">
          {colleges.map((college) => (
            <div key={college.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                    {college.name}
                  </h4>
                  <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 mb-2">
                    <MapPin className="h-3 w-3 mr-1" />
                    {college.city}, {college.state}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {college.description}
                  </p>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <div className="flex items-center">
                    <Star className="h-3 w-3 text-yellow-500 mr-1" />
                    <span className="text-xs font-medium text-gray-900 dark:text-white">
                      {college.rating}
                    </span>
                  </div>
                  <div className={`flex items-center text-xs ${getTrendColor(college.trend)}`}>
                    {getTrendIcon(college.trend)}
                    <span className="ml-1">{college.trendValue}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                  <Users className="h-3 w-3 mr-1" />
                  {college.students.toLocaleString()} students
                </div>
                <Link
                  href={`/colleges/${college.id}`}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center"
                >
                  View Details
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Link>
              </div>
              
              <div className="mt-3 flex flex-wrap gap-1">
                {college.specialties.slice(0, 3).map((specialty, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs rounded-full"
                  >
                    {specialty}
                  </span>
                ))}
                {college.specialties.length > 3 && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                    +{college.specialties.length - 3} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/colleges"
            className="w-full text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center justify-center"
          >
            View All Colleges
            <ExternalLink className="h-4 w-4 ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TrendingColleges;

