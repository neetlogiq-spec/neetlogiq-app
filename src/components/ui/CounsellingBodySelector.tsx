'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building, MapPin, Users, Info } from 'lucide-react';

interface CounsellingBodySelectorProps {
  selectedBody: 'AIQ' | 'KEA';
  onBodyChange: (body: 'AIQ' | 'KEA') => void;
  isDarkMode: boolean;
  className?: string;
}

interface CounsellingBodyInfo {
  id: 'AIQ' | 'KEA';
  name: string;
  fullName: string;
  description: string;
  coverage: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

const CounsellingBodySelector: React.FC<CounsellingBodySelectorProps> = ({
  selectedBody,
  onBodyChange,
  isDarkMode,
  className = ''
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const [bodyInfo, setBodyInfo] = useState<Record<'AIQ' | 'KEA', CounsellingBodyInfo>>({});

  useEffect(() => {
    const info: Record<'AIQ' | 'KEA', CounsellingBodyInfo> = {
      AIQ: {
        id: 'AIQ',
        name: 'AIQ',
        fullName: 'All India Quota',
        description: 'Central counselling for 15% of seats in all government medical colleges',
        coverage: 'All India (except Jammu & Kashmir)',
        icon: <Building className="w-5 h-5" />,
        color: isDarkMode ? 'text-blue-400' : 'text-blue-600',
        bgColor: isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100',
        borderColor: isDarkMode ? 'border-blue-500/30' : 'border-blue-200'
      },
      KEA: {
        id: 'KEA',
        name: 'KEA',
        fullName: 'Karnataka Examination Authority',
        description: 'State counselling for 85% of seats in Karnataka government medical colleges',
        coverage: 'Karnataka State only',
        icon: <MapPin className="w-5 h-5" />,
        color: isDarkMode ? 'text-green-400' : 'text-green-600',
        bgColor: isDarkMode ? 'bg-green-500/20' : 'bg-green-100',
        borderColor: isDarkMode ? 'border-green-500/30' : 'border-green-200'
      }
    };

    setBodyInfo(info);
  }, [isDarkMode]);

  const handleBodySelect = (body: 'AIQ' | 'KEA') => {
    onBodyChange(body);
  };

  return (
    <div className={`backdrop-blur-md rounded-xl p-4 border-2 ${isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className={`w-5 h-5 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
          <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Counselling Body
          </h3>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className={`p-1 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-600'}`}
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Body Info */}
      {showInfo && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className={`mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}
        >
          <div className="space-y-3">
            {Object.values(bodyInfo).map((body) => (
              <div key={body.id} className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${body.bgColor} ${body.borderColor} border`}>
                  {body.icon}
                </div>
                <div className="flex-1">
                  <h4 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {body.fullName}
                  </h4>
                  <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'} mt-1`}>
                    {body.description}
                  </p>
                  <p className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'} mt-1`}>
                    Coverage: {body.coverage}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Body Selection */}
      <div className="grid grid-cols-2 gap-3">
        {Object.values(bodyInfo).map((body) => (
          <button
            key={body.id}
            onClick={() => handleBodySelect(body.id)}
            className={`p-3 rounded-lg border-2 transition-all ${
              selectedBody === body.id
                ? `${body.bgColor} ${body.borderColor} ${body.color}`
                : isDarkMode
                ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className={`p-2 rounded-lg ${selectedBody === body.id ? body.bgColor + ' ' + body.borderColor + ' border' : isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}>
                {body.icon}
              </div>
              <div className="text-center">
                <div className={`font-medium ${selectedBody === body.id ? body.color : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {body.name}
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                  {body.fullName}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Selection Summary */}
      <div className={`mt-4 pt-3 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between text-sm">
          <span className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
            Selected:
          </span>
          <span className={`font-medium ${bodyInfo[selectedBody]?.color}`}>
            {bodyInfo[selectedBody]?.fullName}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CounsellingBodySelector;
