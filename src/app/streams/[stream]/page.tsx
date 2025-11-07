'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import StreamAwareComponent from '@/components/streams/StreamAwareComponent';
import StreamSpecificCutoffsTable from '@/components/streams/StreamSpecificCutoffsTable';
import StreamSpecificCollegesGrid from '@/components/streams/StreamSpecificCollegesGrid';
import { StreamType } from '@/services/StreamDataService';
import { 
  GraduationCap, 
  Stethoscope, 
  Activity, 
  ArrowLeft,
  BarChart3,
  Building2,
  BookOpen
} from 'lucide-react';

const StreamPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'colleges' | 'cutoffs'>('colleges');
  
  const stream = params.stream as StreamType;
  
  // Validate stream parameter
  const validStreams: StreamType[] = ['UG', 'PG_MEDICAL', 'PG_DENTAL'];
  if (!validStreams.includes(stream)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Stream</h1>
          <p className="text-gray-600 mb-4">The requested stream is not valid.</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const getStreamInfo = (stream: StreamType) => {
    switch (stream) {
      case 'UG':
        return {
          name: 'Undergraduate',
          description: 'MBBS, BDS and other undergraduate medical courses',
          icon: GraduationCap,
          color: 'blue',
          bgColor: isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50',
          borderColor: isDarkMode ? 'border-blue-700' : 'border-blue-200',
          textColor: isDarkMode ? 'text-blue-300' : 'text-blue-700'
        };
      case 'PG_MEDICAL':
        return {
          name: 'Postgraduate Medical',
          description: 'MD, MS, DM, MCh, DNB and other postgraduate medical courses',
          icon: Stethoscope,
          color: 'green',
          bgColor: isDarkMode ? 'bg-green-900/30' : 'bg-green-50',
          borderColor: isDarkMode ? 'border-green-700' : 'border-green-200',
          textColor: isDarkMode ? 'text-green-300' : 'text-green-700'
        };
      case 'PG_DENTAL':
        return {
          name: 'Postgraduate Dental',
          description: 'MDS and other postgraduate dental courses',
          icon: Activity,
          color: 'purple',
          bgColor: isDarkMode ? 'bg-purple-900/30' : 'bg-purple-50',
          borderColor: isDarkMode ? 'border-purple-700' : 'border-purple-200',
          textColor: isDarkMode ? 'text-purple-300' : 'text-purple-700'
        };
    }
  };

  const streamInfo = getStreamInfo(stream);
  const IconComponent = streamInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Back button */}
            <button
              onClick={() => router.back()}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-gray-300 hover:bg-gray-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {/* Stream info */}
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${streamInfo.bgColor} ${streamInfo.borderColor} border`}>
                <IconComponent className={`w-6 h-6 ${streamInfo.textColor}`} />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {streamInfo.name}
                </h1>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {streamInfo.description}
                </p>
              </div>
            </div>

            {/* User info */}
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full ${streamInfo.bgColor} flex items-center justify-center`}>
                <span className={`text-sm font-medium ${streamInfo.textColor}`}>
                  {user?.name?.charAt(0) || 'U'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mb-6">
          <button
            onClick={() => setActiveTab('colleges')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'colleges'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Colleges & Courses
          </button>
          <button
            onClick={() => setActiveTab('cutoffs')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'cutoffs'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Cutoffs
          </button>
        </div>

        {/* Content */}
        <StreamAwareComponent requireStream={true}>
          {({ currentStream, isStreamSelected }) => {
            // Check if current stream matches the URL stream
            if (currentStream !== stream) {
              return (
                <div className="text-center py-12">
                  <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Stream Mismatch
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Your selected stream ({currentStream}) doesn't match the requested stream ({stream}).
                    </p>
                    <button
                      onClick={() => router.push('/')}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Go to Dashboard
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {activeTab === 'colleges' && (
                  <StreamSpecificCollegesGrid 
                    showAllData={true}
                    className="min-h-[600px]"
                  />
                )}
                
                {activeTab === 'cutoffs' && (
                  <StreamSpecificCutoffsTable 
                    className="min-h-[600px]"
                  />
                )}
              </div>
            );
          }}
        </StreamAwareComponent>
      </div>
    </div>
  );
};

export default StreamPage;
