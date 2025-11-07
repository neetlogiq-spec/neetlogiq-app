'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Filter, 
  X, 
  Plus, 
  Save, 
  FolderOpen, 
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  MapPin,
  GraduationCap,
  Award,
  BarChart3,
  Users,
  Settings,
  Download,
  Eye,
  EyeOff,
  FilterX
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface FilterRule {
  id: string;
  column: string;
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'range' | 'in' | 'notIn' | 'isEmpty' | 'isNotEmpty';
  value: any;
  values?: any[];
  min?: number;
  max?: number;
}

interface FilterGroup {
  id: string;
  rules: FilterRule[];
  logic: 'AND' | 'OR';
}

interface FilterBarProps {
  columns: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select' | 'boolean';
    options?: { value: string; label: string; count?: number }[];
  }>;
  data: any[];
  isDarkMode: boolean;
  onFiltersChange: (filteredData: any[]) => void;
  onExport?: () => void;
  getFilterOptions?: (columnKey: string) => { value: string; label: string; count?: number }[];
}

const FilterBar: React.FC<FilterBarProps> = ({
  columns,
  data,
  isDarkMode,
  onFiltersChange,
  onExport,
  getFilterOptions
}) => {
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([
    {
      id: 'group-1',
      rules: [],
      logic: 'AND'
    }
  ]);
  const [activeGroup, setActiveGroup] = useState<string>('group-1');
  const [isExpanded, setIsExpanded] = useState(false);
  const [savedPresets, setSavedPresets] = useState<any[]>([]);
  const [showPresets, setShowPresets] = useState(false);

  // Get unique values for filter options
  const getColumnOptions = (columnKey: string) => {
    if (getFilterOptions) {
      return getFilterOptions(columnKey);
    }
    
    const uniqueValues = [...new Set(data.map(row => row[columnKey]))]
      .filter(value => value !== null && value !== undefined && value !== '')
      .sort();

    return uniqueValues.map(value => ({
      value: String(value),
      label: String(value),
      count: data.filter(row => row[columnKey] === value).length
    }));
  };

  // Apply filters to data
  const filteredData = useMemo(() => {
    let result = [...data];

    filterGroups.forEach(group => {
      if (group.rules.length === 0) return;

      const groupResults = group.rules.map(rule => {
        return result.filter(row => {
          const cellValue = row[rule.column];
          const stringValue = String(cellValue).toLowerCase();

          switch (rule.operator) {
            case 'contains':
              return stringValue.includes(String(rule.value).toLowerCase());
            case 'equals':
              return stringValue === String(rule.value).toLowerCase();
            case 'startsWith':
              return stringValue.startsWith(String(rule.value).toLowerCase());
            case 'endsWith':
              return stringValue.endsWith(String(rule.value).toLowerCase());
            case 'range':
              const numValue = Number(cellValue);
              return numValue >= (rule.min || 0) && numValue <= (rule.max || Infinity);
            case 'in':
              return rule.values?.includes(cellValue) || false;
            case 'notIn':
              return !rule.values?.includes(cellValue);
            case 'isEmpty':
              return cellValue === null || cellValue === undefined || cellValue === '';
            case 'isNotEmpty':
              return cellValue !== null && cellValue !== undefined && cellValue !== '';
            default:
              return true;
          }
        });
      });

      if (group.logic === 'AND') {
        // Intersection of all rule results
        result = groupResults.reduce((acc, curr) => 
          acc.filter(item => curr.includes(item)), result);
      } else {
        // Union of all rule results
        result = groupResults.reduce((acc, curr) => 
          [...new Set([...acc, ...curr])], []);
      }
    });

    return result;
  }, [data, filterGroups]);

  // Notify parent of filtered data
  useEffect(() => {
    onFiltersChange(filteredData);
  }, [filteredData, onFiltersChange]);

  // Add new filter rule
  const addFilterRule = (groupId: string) => {
    const newRule: FilterRule = {
      id: `rule-${Date.now()}`,
      column: columns[0]?.key || '',
      operator: 'contains',
      value: ''
    };

    setFilterGroups(prev => prev.map(group => 
      group.id === groupId 
        ? { ...group, rules: [...group.rules, newRule] }
        : group
    ));
  };

  // Remove filter rule
  const removeFilterRule = (groupId: string, ruleId: string) => {
    setFilterGroups(prev => prev.map(group => 
      group.id === groupId 
        ? { ...group, rules: group.rules.filter(rule => rule.id !== ruleId) }
        : group
    ));
  };

  // Update filter rule
  const updateFilterRule = (groupId: string, ruleId: string, updates: Partial<FilterRule>) => {
    setFilterGroups(prev => prev.map(group => 
      group.id === groupId 
        ? { 
            ...group, 
            rules: group.rules.map(rule => 
              rule.id === ruleId ? { ...rule, ...updates } : rule
            )
          }
        : group
    ));
  };

  // Add new filter group
  const addFilterGroup = () => {
    const newGroup: FilterGroup = {
      id: `group-${Date.now()}`,
      rules: [],
      logic: 'AND'
    };
    setFilterGroups(prev => [...prev, newGroup]);
    setActiveGroup(newGroup.id);
  };

  // Remove filter group
  const removeFilterGroup = (groupId: string) => {
    if (filterGroups.length > 1) {
      setFilterGroups(prev => prev.filter(group => group.id !== groupId));
      if (activeGroup === groupId) {
        setActiveGroup(filterGroups[0]?.id || '');
      }
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilterGroups([{
      id: 'group-1',
      rules: [],
      logic: 'AND'
    }]);
    setActiveGroup('group-1');
  };

  // Save filter preset
  const savePreset = (name: string) => {
    const preset = {
      id: `preset-${Date.now()}`,
      name,
      filterGroups: [...filterGroups],
      createdAt: new Date().toISOString()
    };
    setSavedPresets(prev => [...prev, preset]);
    setShowPresets(false);
  };

  // Load filter preset
  const loadPreset = (preset: any) => {
    setFilterGroups(preset.filterGroups);
    setShowPresets(false);
  };

  // Get active filter count
  const activeFilterCount = filterGroups.reduce((total, group) => total + group.rules.length, 0);

  const FilterRuleComponent = ({ rule, groupId }: { rule: FilterRule; groupId: string }) => {
    const column = columns.find(col => col.key === rule.column);
    const options = getColumnOptions(rule.column);

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`p-4 rounded-lg border ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}
      >
        <div className="flex items-center space-x-3">
          {/* Column Selector */}
          <select
            value={rule.column}
            onChange={(e) => updateFilterRule(groupId, rule.id, { column: e.target.value, value: '' })}
            className={`px-3 py-2 rounded border text-sm ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            {columns.map(col => (
              <option key={col.key} value={col.key}>{col.label}</option>
            ))}
          </select>

          {/* Operator Selector */}
          <select
            value={rule.operator}
            onChange={(e) => updateFilterRule(groupId, rule.id, { operator: e.target.value as any, value: '' })}
            className={`px-3 py-2 rounded border text-sm ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="contains">Contains</option>
            <option value="equals">Equals</option>
            <option value="startsWith">Starts with</option>
            <option value="endsWith">Ends with</option>
            <option value="range">Range</option>
            <option value="in">In list</option>
            <option value="notIn">Not in list</option>
            <option value="isEmpty">Is empty</option>
            <option value="isNotEmpty">Is not empty</option>
          </select>

          {/* Value Input */}
          {rule.operator === 'range' ? (
            <div className="flex items-center space-x-2">
              <input
                type="number"
                placeholder="Min"
                value={rule.min || ''}
                onChange={(e) => updateFilterRule(groupId, rule.id, { min: Number(e.target.value) })}
                className={`w-20 px-2 py-1 rounded border text-sm ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                placeholder="Max"
                value={rule.max || ''}
                onChange={(e) => updateFilterRule(groupId, rule.id, { max: Number(e.target.value) })}
                className={`w-20 px-2 py-1 rounded border text-sm ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
          ) : rule.operator === 'in' || rule.operator === 'notIn' ? (
            <div className="flex-1">
              <select
                multiple
                value={rule.values || []}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  updateFilterRule(groupId, rule.id, { values });
                }}
                className={`w-full px-3 py-2 rounded border text-sm ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                size={3}
              >
                {options.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </div>
          ) : rule.operator !== 'isEmpty' && rule.operator !== 'isNotEmpty' ? (
            <input
              type="text"
              value={rule.value || ''}
              onChange={(e) => updateFilterRule(groupId, rule.id, { value: e.target.value })}
              placeholder={`Filter ${column?.label}...`}
              className={`flex-1 px-3 py-2 rounded border text-sm ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          ) : null}

          {/* Remove Rule Button */}
          <button
            onClick={() => removeFilterRule(groupId, rule.id)}
            className={`p-2 rounded ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className={`filter-bar ${isDarkMode ? 'dark' : ''}`}>
      {/* Filter Bar Header */}
      <div className={`flex items-center justify-between p-4 border-b ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center space-x-4">
          {/* Filter Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              isExpanded 
                ? isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                : isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className={`px-2 py-1 rounded-full text-xs ${
                isDarkMode ? 'bg-blue-500/30 text-blue-300' : 'bg-blue-200 text-blue-800'
              }`}>
                {activeFilterCount}
              </span>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div className="flex items-center space-x-2">
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Active:
              </span>
              {filterGroups.map(group => 
                group.rules.map(rule => {
                  const column = columns.find(col => col.key === rule.column);
                  return (
                    <div
                      key={rule.id}
                      className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm ${
                        isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      <span>{column?.label}: {rule.operator}</span>
                      <button
                        onClick={() => removeFilterRule(group.id, rule.id)}
                        className="ml-1 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Presets */}
          <div className="relative">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span>Presets</span>
            </button>

            <AnimatePresence>
              {showPresets && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`absolute top-full right-0 mt-1 w-64 p-4 rounded-lg shadow-lg border z-50 ${
                    isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="space-y-3">
                    <h4 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Saved Presets
                    </h4>
                    {savedPresets.length > 0 ? (
                      <div className="space-y-2">
                        {savedPresets.map(preset => (
                          <button
                            key={preset.id}
                            onClick={() => loadPreset(preset)}
                            className={`w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        No saved presets
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <button
            onClick={clearAllFilters}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <FilterX className="w-4 h-4" />
            <span>Clear All</span>
          </button>

          {onExport && (
            <button
              onClick={onExport}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                isDarkMode 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Rules */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-4 border-b ${
              isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="space-y-4">
              {filterGroups.map((group, groupIndex) => (
                <div key={group.id} className="space-y-3">
                  {/* Group Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Filter Group {groupIndex + 1}
                      </span>
                      <select
                        value={group.logic}
                        onChange={(e) => setFilterGroups(prev => prev.map(g => 
                          g.id === group.id ? { ...g, logic: e.target.value as 'AND' | 'OR' } : g
                        ))}
                        className={`px-3 py-1 rounded border text-sm ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      >
                        <option value="AND">AND (all rules must match)</option>
                        <option value="OR">OR (any rule can match)</option>
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => addFilterRule(group.id)}
                        className={`flex items-center space-x-1 px-3 py-1 rounded text-sm ${
                          isDarkMode 
                            ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Rule</span>
                      </button>
                      {filterGroups.length > 1 && (
                        <button
                          onClick={() => removeFilterGroup(group.id)}
                          className={`p-1 rounded ${
                            isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                          }`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter Rules */}
                  <div className="space-y-2">
                    {group.rules.map(rule => (
                      <FilterRuleComponent key={rule.id} rule={rule} groupId={group.id} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Add Group Button */}
              <button
                onClick={addFilterGroup}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 border-dashed ${
                  isDarkMode 
                    ? 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300' 
                    : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Add Filter Group</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FilterBar;
