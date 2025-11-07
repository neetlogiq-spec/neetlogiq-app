'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  ArrowRight,
  BarChart3,
  Building2
} from 'lucide-react';

const StreamsPage: React.FC = () => {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'colleges' | 'cutoffs'>('colleges');

  const streams: Array<{
    id: StreamType;
    name: string;
    description: string;
    icon: React.ComponentType<any>;
    color: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
    route: string;
  }> = [
    {
      id: 'UG',
      name: 'Undergraduate',
      description: 'MBBS, BDS and other undergraduate medical courses',
      icon: GraduationCap,
      color: 'blue',
      bgColor: isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50',
      borderColor: isDarkMode ? 'border-blue-700' : 'border-blue-200',
      textColor: isDarkMode ? 'text-blue-300' : 'text-blue-700',
      route: '/streams/UG'
    },
    {
      id: 'PG_MEDICAL',
      name: 'Postgraduate Medical',
      description: 'MD, MS, DM, MCh, DNB and other postgraduate medical courses',
      icon: Stethoscope,
      color: 'green',
      bgColor: isDarkMode ? 'bg-green-900/30' : 'bg-green-50',
      borderColor: isDarkMode ? 'border-green-700' : 'border-green-200',
      textColor: isDarkMode ? 'text-green-300' : 'text-green-700',
      route: '/streams/PG_MEDICAL'
    },
    {
      id: 'PG_DENTAL',
      name: 'Postgraduate Dental',
      description: 'MDS and other postgraduate dental courses',
      icon: Activity,
      color: 'purple',
      bgColor: isDarkMode ? 'bg-purple-900/30' : 'bg-purple-50',
      borderColor: isDarkMode ? 'border-purple-700' : 'border-purple-200',
      textColor: isDarkMode ? 'text-purple-300' : 'text-purple-700',
      route: '/streams/PG_DENTAL'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className={`text-4xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Stream-Specific Data
            </h1>
            <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Access colleges, courses, and cutoffs filtered by your selected stream
            </p>
          </div>
        </div>
      </div>

      {/* Stream Selection */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Choose Your Stream
          </h2>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Select a stream to view stream-specific data
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {streams.map((stream) => {
            const IconComponent = stream.icon;
            return (
              <div
                key={stream.id}
                onClick={() => router.push(stream.route)}
                className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg ${stream.bgColor} ${stream.borderColor} border`}
              >
                <div className="text-center">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${stream.bgColor} ${stream.borderColor} border-2 flex items-center justify-center`}>
                    <IconComponent className={`w-8 h-8 ${stream.textColor}`} />
                  </div>
                  <h3 className={`text-xl font-bold mb-2 ${stream.textColor}`}>
                    {stream.name}
                  </h3>
                  <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {stream.description}
                  </p>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${stream.bgColor} ${stream.borderColor} border text-sm font-medium ${stream.textColor} hover:opacity-80 transition-opacity`}>
                    View Data
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current Stream Data */}
        <StreamAwareComponent requireStream={true}>
          {({ currentStream, streamConfig, isStreamSelected }) => {
            if (!isStreamSelected) {
              return (
                <div className="text-center py-12">
                  <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      No Stream Selected
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Please select a stream from above to view stream-specific data.
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-8">
                {/* Stream Info */}
                <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-full ${streamConfig?.bgColor} ${streamConfig?.borderColor} border-2 flex items-center justify-center`}>
                      {currentStream === 'UG' && <GraduationCap className={`w-6 h-6 ${streamConfig?.textColor}`} />}
                      {currentStream === 'PG_MEDICAL' && <Stethoscope className={`w-6 h-6 ${streamConfig?.textColor}`} />}
                      {currentStream === 'PG_DENTAL' && <Activity className={`w-6 h-6 ${streamConfig?.textColor}`} />}
                    </div>
                    <div>
                      <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {streamConfig?.name}
                      </h3>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {streamConfig?.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>College Types</p>
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {streamConfig?.collegeTypes.join(', ')}
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Course Types</p>
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {streamConfig?.courseTypes.join(', ')}
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Cutoff Types</p>
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {streamConfig?.cutoffTypes.join(', ')}
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Excluded Streams</p>
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {streamConfig?.excludeStreams?.length ? streamConfig.excludeStreams.join(', ') : 'None'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Navigation tabs */}
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
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
              </div>
            );
          }}
        </StreamAwareComponent>
      </div>
    </div>
  );
};

export default StreamsPage;
