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
}

const CutoffExcelTable: React.FC<CutoffExcelTableProps> = ({
  data,
  isDarkMode,
  multiYear,
  visibleRounds,
  onRowClick,
  onDataChange,
  onRemoveRound
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
        width: 120,
        minWidth: 120,
        sortable: true,
        filterable: true,
        frozen: true,
        render: (value: string) => (
          <div className="flex items-center space-x-1">
            <MapPin className="w-3 h-3 text-gray-500" />
            <span className="truncate" title={value}>{value}</span>
          </div>
        )
      },
      {
        key: 'college',
        label: 'College',
        type: 'text' as const,
        width: 200,
        minWidth: 180,
        maxWidth: 300,
        frozen: true,
        sortable: true,
        filterable: true,
        render: (value: string, row: any) => (
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="font-medium truncate" title={value}>{value}</span>
          </div>
        )
      },
      {
        key: 'course',
        label: 'Course',
        type: 'select' as const,
        width: 120,
        minWidth: 100,
        sortable: true,
        filterable: true,
        render: (value: string, row: any) => (
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-green-500 shrink-0" />
            <span className="truncate" title={value}>{value}</span>
          </div>
        )
      },
      {
        key: 'quota',
        label: 'Quota',
        type: 'select' as const,
        width: 80,
        minWidth: 80,
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
        minWidth: 80,
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
      width: 120,
      minWidth: 120,
      sortable: false,
      filterable: false,
      render: (value: any, row: any) => {
        const opening = row[`r${round}_opening`];
        const closing = row[`r${round}_closing`];
        
        if (opening === null || opening === undefined || closing === null || closing === undefined) {
          return <span className="text-gray-400">-</span>;
        }
        
        return (
          <div className="flex flex-col space-y-1 text-xs">
            <div className="font-mono">
              <span className="text-blue-600 dark:text-blue-400">open: {opening.toLocaleString()}</span>
            </div>
            <div className="font-mono">
              <span className="text-purple-600 dark:text-purple-400">close: {closing.toLocaleString()}</span>
            </div>
          </div>
        );
      }
    }));

    return [...baseColumns, ...roundColumns];
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
        enableFilterBar={false}
      />
    </motion.div>
  );
};

export default CutoffExcelTable;
