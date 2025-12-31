'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  GraduationCap, 
  MapPin, 
  Award, 
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3
} from 'lucide-react';
import ExcelStyleTable from './ExcelStyleTableWithFilterBar';

interface Cutoff {
  id: string;
  college: string;
  course: string;
  stream: string;
  state: string;
  counsellingBody: string;
  collegeType: string;
  year: string;
  quota: string;
  category: string;
  rounds: { [year: string]: { [round: number]: { openingRank: number; closingRank: number } } };
  totalSeats: number;
}

interface CutoffExcelTableProps {
  data: Cutoff[];
  isDarkMode: boolean;
  multiYear: boolean;
  visibleRounds: number[];
  onRowClick?: (cutoff: Cutoff) => void;
  onDataChange?: (data: Cutoff[]) => void;
  onRemoveRound?: (round: number) => void;
  userRank?: number | null;
}

const CutoffExcelTable: React.FC<CutoffExcelTableProps> = ({
  data,
  isDarkMode,
  multiYear,
  visibleRounds,
  onRowClick,
  onDataChange,
  onRemoveRound,
  userRank
}) => {
  // Transform data for Excel table - group by unique combination
  const transformedData = useMemo(() => {
    // First, collect all round data by unique combination
    const groupedData = new Map();
    
    data.forEach(cutoff => {
      const key = `${cutoff.state}-${cutoff.college}-${cutoff.course}-${cutoff.quota}-${cutoff.category}`;
      
      if (!groupedData.has(key)) {
        groupedData.set(key, {
          id: cutoff.id,
          college: cutoff.college,
          course: cutoff.course,
          stream: cutoff.stream,
          state: cutoff.state,
          counsellingBody: cutoff.counsellingBody,
          collegeType: cutoff.collegeType,
          year: cutoff.year,
          quota: cutoff.quota,
          category: cutoff.category,
          totalSeats: cutoff.totalSeats,
        });
      }
      
      // Merge round data from this cutoff
      const cutoffRounds = cutoff.rounds || {};
      const currentYear = String(cutoff.year);
      
      visibleRounds.forEach(round => {
        const roundInfo = cutoffRounds[currentYear]?.[round];
        if (roundInfo) {
          const baseRow = groupedData.get(key);
          baseRow[`r${round}_opening`] = roundInfo.openingRank;
          baseRow[`r${round}_closing`] = roundInfo.closingRank;
          baseRow[`r${round}_range`] = roundInfo.closingRank - roundInfo.openingRank;
        }
      });
    });
    
    return Array.from(groupedData.values());
  }, [data, multiYear, visibleRounds]);

  // Define columns for Excel table
  const columns = useMemo(() => {
    const baseColumns = [
      {
        key: 'state',
        label: 'State',
        type: 'select' as const,
        width: 1, // Shrink to fit
        sortable: true,
        filterable: true,
        frozen: true,
        render: (value: string) => (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-gray-500 shrink-0" />
            <span className="text-xs whitespace-normal leading-tight" title={value}>{value}</span>
          </div>
        )
      },
      {
        key: 'college',
        label: 'College',
        type: 'text' as const,
        minWidth: 150,
        maxWidth: 280,
        frozen: true,
        sortable: true,
        filterable: true,
        render: (value: string, row: any) => {
          // Get management type with case-insensitive comparison
          const mgmt = (row.collegeType || '').toUpperCase();
          const isGovt = mgmt.includes('GOVERNMENT');
          const badgeLabel = mgmt === 'GOVERNMENT' ? 'GOVT' : 
                            mgmt === 'GOVERNMENT-SOCIETY' ? 'GOVT-SOC' :
                            mgmt === 'PRIVATE' ? 'PVT' : 'PVT';
          
          return (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="font-semibold line-clamp-2 text-sm leading-tight" title={value}>{value}</span>
              {/* Govt/Private Badge */}
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                isGovt
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}>
                {badgeLabel}
              </span>
            </div>
          );
        }
      },
      {
        key: 'course',
        label: 'Course',
        type: 'select' as const,
        minWidth: 120,
        sortable: true,
        filterable: true,
        render: (value: string) => (
          <span className="font-medium text-xs whitespace-normal leading-tight line-clamp-2" title={value}>{value}</span>
        )
      },
      {
        key: 'quota',
        label: 'Quota',
        type: 'select' as const,
        width: 1, // Shrink to fit
        minWidth: 60,
        sortable: true,
        filterable: true,
        render: (value: string) => (
          <div className="flex justify-center w-full">
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium text-center ${
              value === 'AIQ'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
            }`} title={value}>
              {value}
            </span>
          </div>
        )
      },
      {
        key: 'category',
        label: 'Category',
        type: 'select' as const,
        width: 1, // Shrink to fit
        minWidth: 40,
        sortable: true,
        filterable: true,
        render: (value: string) => (
          <span className={`px-1 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
            value === 'General'
              ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
              : value === 'OBC'
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
              : value === 'SC'
              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              : value === 'ST'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
          }`} title={value}>
            {value}
          </span>
        )
      }
    ];

    // Add round columns for current year - show opening and closing together
    const roundColumns = visibleRounds.map(round => ({
      key: `round${round}`,
      label: (
        <div className="flex items-center gap-1">
          <span>R{round}</span>
          {round > 2 && onRemoveRound && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveRound(round);
              }}
              className="ml-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"
            >
              <span className="text-sm font-bold">×</span>
            </button>
          )}
        </div>
      ),
      type: 'text' as const,
      width: 1, // Shrink to fit
      minWidth: 120,
      sortable: false,
      filterable: false,
      render: (value: any, row: any) => {
        const opening = row[`r${round}_opening`];
        const closing = row[`r${round}_closing`];
        
        if (opening === null || opening === undefined || closing === null || closing === undefined) {
          return <span className="text-gray-400">-</span>;
        }
        
        // Determine cell highlighting based on userRank
        // If userRank <= closing: achievable (green bg), otherwise not achievable (red bg)
        let cellBgClass = '';
        let closingColorClass = 'text-purple-600 dark:text-purple-400';
        
        if (userRank) {
          if (userRank <= closing) {
            // Achievable - green
            cellBgClass = isDarkMode 
              ? 'bg-emerald-900/40 rounded-md' 
              : 'bg-emerald-100 rounded-md';
            closingColorClass = 'text-emerald-700 dark:text-emerald-300 font-bold';
          } else {
            // Not achievable - red
            cellBgClass = isDarkMode 
              ? 'bg-rose-900/40 rounded-md' 
              : 'bg-rose-100 rounded-md';
            closingColorClass = 'text-rose-700 dark:text-rose-300 font-bold';
          }
        }
        
        return (
          <div className={`flex flex-col text-xs font-mono leading-relaxed min-w-[90px] p-1.5 ${cellBgClass}`} title={`Opening: ${opening.toLocaleString()} | Closing: ${closing.toLocaleString()}`}>
            <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden">
              Open: <span className="text-blue-600 dark:text-blue-400 font-medium">{opening.toLocaleString()}</span>
            </span>
            <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden">
              Close: <span className={`font-semibold ${closingColorClass}`}>{closing.toLocaleString()}</span>
            </span>
          </div>
        );
      }
    }));

    return [...baseColumns, ...roundColumns];
<<<<<<< Updated upstream
  }, [multiYear, visibleRounds]);
=======
  }, [multiYear, visibleRounds, isDarkMode, userRank]);
>>>>>>> Stashed changes

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full"
    >
      <ExcelStyleTable
        data={transformedData}
        columns={columns}
        isDarkMode={isDarkMode}
        onRowClick={onRowClick}
        height="100%"
        onDataChange={onDataChange}
        enableColumnResize={true}
        enableColumnReorder={true}
        enableFreezeColumns={true}
        enableExport={true}
        enableFilterBar={false}
      />
    </motion.div>
  );
};

export default CutoffExcelTable;
