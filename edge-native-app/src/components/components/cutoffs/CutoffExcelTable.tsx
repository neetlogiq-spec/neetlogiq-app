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
}

const CutoffExcelTable: React.FC<CutoffExcelTableProps> = ({
  data,
  isDarkMode,
  multiYear,
  visibleRounds,
  onRowClick,
  onDataChange
}) => {
  // Transform data for Excel table
  const transformedData = useMemo(() => {
    return data.map(cutoff => {
      const baseData = {
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
      };

      // Add round data for current year
      const currentYear = cutoff.year;
      const roundData: any = {};
      
      visibleRounds.forEach(round => {
        const roundInfo = cutoff.rounds[currentYear]?.[round];
        if (roundInfo) {
          roundData[`r${round}_opening`] = roundInfo.openingRank;
          roundData[`r${round}_closing`] = roundInfo.closingRank;
          roundData[`r${round}_range`] = roundInfo.closingRank - roundInfo.openingRank;
        } else {
          roundData[`r${round}_opening`] = null;
          roundData[`r${round}_closing`] = null;
          roundData[`r${round}_range`] = null;
        }
      });

      // Add previous year data if multi-year is enabled
      if (multiYear) {
        const prevYear = String(parseInt(currentYear) - 1);
        const prevYearRounds = cutoff.rounds[prevYear];
        
        if (prevYearRounds) {
          visibleRounds.forEach(round => {
            const roundInfo = prevYearRounds[round];
            if (roundInfo) {
              roundData[`prev_r${round}_opening`] = roundInfo.openingRank;
              roundData[`prev_r${round}_closing`] = roundInfo.closingRank;
              roundData[`prev_r${round}_range`] = roundInfo.closingRank - roundInfo.openingRank;
            } else {
              roundData[`prev_r${round}_opening`] = null;
              roundData[`prev_r${round}_closing`] = null;
              roundData[`prev_r${round}_range`] = null;
            }
          });
        }
      }

      return { ...baseData, ...roundData };
    });
  }, [data, multiYear, visibleRounds]);

  // Define columns for Excel table
  const columns = useMemo(() => {
    const baseColumns = [
      {
        key: 'college',
        label: 'College',
        type: 'text' as const,
        width: 200,
        minWidth: 150,
        maxWidth: 300,
        frozen: true,
        sortable: true,
        filterable: true,
        render: (value: string, row: any) => (
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="font-medium truncate" title={value}>{value}</span>
          </div>
        )
      },
      {
        key: 'course',
        label: 'Course',
        type: 'select' as const,
        width: 120,
        sortable: true,
        filterable: true,
        render: (value: string, row: any) => (
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className="truncate" title={value}>{value}</span>
          </div>
        )
      },
      {
        key: 'stream',
        label: 'Stream',
        type: 'select' as const,
        width: 100,
        sortable: true,
        filterable: true,
        render: (value: string) => (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            value === 'Medical' 
              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
          }`}>
            {value}
          </span>
        )
      },
      {
        key: 'state',
        label: 'State',
        type: 'select' as const,
        width: 120,
        sortable: true,
        filterable: true,
        render: (value: string) => (
          <div className="flex items-center space-x-1">
            <MapPin className="w-3 h-3 text-gray-500" />
            <span className="truncate" title={value}>{value}</span>
          </div>
        )
      },
      {
        key: 'collegeType',
        label: 'Type',
        type: 'select' as const,
        width: 100,
        sortable: true,
        filterable: true,
        render: (value: string) => (
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            value === 'Government'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : value === 'Private'
              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
              : 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
          }`}>
            {value}
          </span>
        )
      },
      {
        key: 'quota',
        label: 'Quota',
        type: 'select' as const,
        width: 80,
        sortable: true,
        filterable: true,
        render: (value: string) => (
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            value === 'AIQ'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
          }`}>
            {value}
          </span>
        )
      },
      {
        key: 'category',
        label: 'Category',
        type: 'select' as const,
        width: 80,
        sortable: true,
        filterable: true,
        render: (value: string) => (
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            value === 'General'
              ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
              : value === 'OBC'
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
              : value === 'SC'
              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              : value === 'ST'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
          }`}>
            {value}
          </span>
        )
      },
      {
        key: 'totalSeats',
        label: 'Seats',
        type: 'number' as const,
        width: 80,
        sortable: true,
        filterable: true,
        render: (value: number) => (
          <div className="flex items-center space-x-1">
            <Users className="w-3 h-3 text-gray-500" />
            <span className="font-mono text-sm">{value}</span>
          </div>
        )
      }
    ];

    // Add round columns for current year
    const roundColumns = visibleRounds.flatMap(round => [
      {
        key: `r${round}_opening`,
        label: `R${round} Opening`,
        type: 'number' as const,
        width: 100,
        sortable: true,
        filterable: true,
        render: (value: number, row: any) => {
          if (value === null || value === undefined) return <span className="text-gray-400">-</span>;
          
          const prevValue = row[`prev_r${round}_opening`];
          const trend = prevValue ? value - prevValue : 0;
          
          return (
            <div className="flex items-center space-x-1">
              <span className="font-mono text-sm">{value.toLocaleString()}</span>
              {trend !== 0 && (
                <div className={`flex items-center ${
                  trend < 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {trend < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <TrendingUp className="w-3 h-3" />
                  )}
                </div>
              )}
            </div>
          );
        }
      },
      {
        key: `r${round}_closing`,
        label: `R${round} Closing`,
        type: 'number' as const,
        width: 100,
        sortable: true,
        filterable: true,
        render: (value: number, row: any) => {
          if (value === null || value === undefined) return <span className="text-gray-400">-</span>;
          
          const prevValue = row[`prev_r${round}_closing`];
          const trend = prevValue ? value - prevValue : 0;
          
          return (
            <div className="flex items-center space-x-1">
              <span className="font-mono text-sm">{value.toLocaleString()}</span>
              {trend !== 0 && (
                <div className={`flex items-center ${
                  trend < 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {trend < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <TrendingUp className="w-3 h-3" />
                  )}
                </div>
              )}
            </div>
          );
        }
      },
      {
        key: `r${round}_range`,
        label: `R${round} Range`,
        type: 'number' as const,
        width: 80,
        sortable: true,
        filterable: true,
        render: (value: number) => {
          if (value === null || value === undefined) return <span className="text-gray-400">-</span>;
          
          return (
            <div className="flex items-center space-x-1">
              <BarChart3 className="w-3 h-3 text-gray-500" />
              <span className="font-mono text-sm">{value.toLocaleString()}</span>
            </div>
          );
        }
      }
    ]);

    // Add previous year columns if multi-year is enabled
    const prevYearColumns = multiYear ? visibleRounds.flatMap(round => [
      {
        key: `prev_r${round}_opening`,
        label: `Prev R${round} Opening`,
        type: 'number' as const,
        width: 100,
        sortable: true,
        filterable: true,
        render: (value: number) => {
          if (value === null || value === undefined) return <span className="text-gray-400">-</span>;
          return <span className="font-mono text-sm text-gray-500">{value.toLocaleString()}</span>;
        }
      },
      {
        key: `prev_r${round}_closing`,
        label: `Prev R${round} Closing`,
        type: 'number' as const,
        width: 100,
        sortable: true,
        filterable: true,
        render: (value: number) => {
          if (value === null || value === undefined) return <span className="text-gray-400">-</span>;
          return <span className="font-mono text-sm text-gray-500">{value.toLocaleString()}</span>;
        }
      },
      {
        key: `prev_r${round}_range`,
        label: `Prev R${round} Range`,
        type: 'number' as const,
        width: 80,
        sortable: true,
        filterable: true,
        render: (value: number) => {
          if (value === null || value === undefined) return <span className="text-gray-400">-</span>;
          return <span className="font-mono text-sm text-gray-500">{value.toLocaleString()}</span>;
        }
      }
    ]) : [];

    return [...baseColumns, ...roundColumns, ...prevYearColumns];
  }, [multiYear, visibleRounds]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <ExcelStyleTable
        data={transformedData}
        columns={columns}
        isDarkMode={isDarkMode}
        onRowClick={onRowClick}
        onDataChange={onDataChange}
        height="70vh"
        enableColumnResize={true}
        enableColumnReorder={true}
        enableFreezeColumns={true}
        enableExport={true}
      />
    </motion.div>
  );
};

export default CutoffExcelTable;
