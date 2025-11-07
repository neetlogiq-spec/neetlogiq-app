'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  AlertTriangle,
  X,
  RefreshCw,
  Filter,
  Search,
  Trash2,
  Edit2,
  Eye,
  FileSpreadsheet,
  Database,
  Settings,
  Play,
  Pause,
  MoreVertical,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import {
  importData,
  exportData,
  validateData,
  batchDelete,
  batchUpdate,
  VALIDATION_RULES,
  type ImportResult,
  type DataValidationError,
  type ExportOptions
} from '@/services/dataManagement';

interface DataManagementProps {
  dataType: 'colleges' | 'courses' | 'cutoffs' | 'users';
  data: any[];
  onDataChange: (data: any[]) => void;
  onRefresh: () => void;
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataType: string;
  onImportComplete: (result: ImportResult) => void;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataType: string;
  data: any[];
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, dataType, onImportComplete }) => {
  const [step, setStep] = useState<'upload' | 'validate' | 'import' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<DataValidationError[]>([]);
  const [importOptions, setImportOptions] = useState({
    hasHeaders: true,
    validateOnly: false,
    skipRows: 0,
    batchSize: 1000
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setStep('validate');
  };

  const handleValidate = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const result = await importData(file, dataType as any, {
        ...importOptions,
        validateOnly: true
      });

      setImportResult(result);
      setPreviewData(result.previewData || []);
      setValidationErrors(result.errors);

      if (result.errors.length === 0) {
        setStep('import');
      } else {
        // Show validation errors
        setStep('validate');
      }
    } catch (error) {
      console.error('Validation error:', error);
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const result = await importData(file, dataType as any, {
        ...importOptions,
        validateOnly: false
      });

      setImportResult(result);
      setStep('complete');
      onImportComplete(result);
    } catch (error) {
      console.error('Import error:', error);
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStep('upload');
    setFile(null);
    setImportResult(null);
    setPreviewData([]);
    setValidationErrors([]);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Upload className="w-6 h-6 text-blue-600 mr-3" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Import {dataType} Data
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Step {step === 'upload' ? '1' : step === 'validate' ? '2' : step === 'import' ? '3' : '4'} of 4
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {/* Step 1: Upload File */}
            {step === 'upload' && (
              <div className="space-y-6">
                <div className="text-center">
                  <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Upload File
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Select a CSV or Excel file to import {dataType} data
                  </p>
                </div>

                {/* File Drop Zone */}
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) handleFileSelect(selectedFile);
                    }}
                    className="hidden"
                  />
                  
                  {file ? (
                    <div className="flex items-center justify-center space-x-3">
                      <FileSpreadsheet className="w-8 h-8 text-green-600" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Drag and drop your file here, or click to browse
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Browse Files
                      </button>
                    </div>
                  )}
                </div>

                {/* Import Options */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Import Options</h4>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={importOptions.hasHeaders}
                        onChange={(e) => setImportOptions({ ...importOptions, hasHeaders: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        First row contains headers
                      </span>
                    </label>
                    
                    <div className="flex items-center space-x-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Skip Rows
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={importOptions.skipRows}
                          onChange={(e) => setImportOptions({ ...importOptions, skipRows: parseInt(e.target.value) || 0 })}
                          className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Batch Size
                        </label>
                        <input
                          type="number"
                          min="100"
                          max="10000"
                          step="100"
                          value={importOptions.batchSize}
                          onChange={(e) => setImportOptions({ ...importOptions, batchSize: parseInt(e.target.value) || 1000 })}
                          className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={resetModal}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleValidate}
                    disabled={!file}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Validate Data
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Validation Results */}
            {step === 'validate' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                    {loading ? (
                      <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                    ) : validationErrors.length === 0 ? (
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-8 h-8 text-amber-600" />
                    )}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Validation Results
                  </h3>
                  {importResult && (
                    <div className="flex justify-center space-x-8 text-sm">
                      <div>
                        <span className="font-semibold text-green-600">{importResult.successCount}</span>
                        <span className="text-gray-500 dark:text-gray-400"> valid</span>
                      </div>
                      <div>
                        <span className="font-semibold text-red-600">{importResult.errorCount}</span>
                        <span className="text-gray-500 dark:text-gray-400"> errors</span>
                      </div>
                      <div>
                        <span className="font-semibold text-blue-600">{importResult.totalRecords}</span>
                        <span className="text-gray-500 dark:text-gray-400"> total</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <h4 className="font-medium text-red-800 dark:text-red-400 mb-2">
                      Validation Errors ({validationErrors.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {validationErrors.slice(0, 10).map((error, index) => (
                        <div key={index} className="text-sm text-red-700 dark:text-red-300">
                          Row {error.row}, {error.field}: {error.message}
                        </div>
                      ))}
                      {validationErrors.length > 10 && (
                        <div className="text-sm text-red-600 dark:text-red-400 font-medium">
                          ... and {validationErrors.length - 10} more errors
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Preview Data */}
                {previewData.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                      Data Preview (First 5 rows)
                    </h4>
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            {Object.keys(previewData[0] || {}).map((key) => (
                              <th
                                key={key}
                                className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {previewData.slice(0, 5).map((row, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              {Object.values(row as Record<string, any>).map((value, cellIndex) => (
                                <td
                                  key={cellIndex}
                                  className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white"
                                >
                                  {String(value || '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep('upload')}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Back
                  </button>
                  <div className="space-x-3">
                    <button
                      onClick={handleValidate}
                      disabled={loading}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Re-validate
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={loading || validationErrors.length > 0}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Import Data
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Import Progress */}
            {step === 'import' && (
              <div className="space-y-6 text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Importing Data...
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Please wait while we import your {dataType} data
                </p>
                <div className="w-64 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            )}

            {/* Step 4: Complete */}
            {step === 'complete' && importResult && (
              <div className="space-y-6 text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Import Complete!
                </h3>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">{importResult.successCount}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Imported</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{importResult.errorCount}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Errors</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{importResult.totalRecords}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    resetModal();
                    onClose();
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, dataType, data }) => {
  const [loading, setLoading] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    includeHeaders: true,
    dateFormat: 'YYYY-MM-DD',
    delimiter: ',',
    fields: []
  });

  const handleExport = async () => {
    setLoading(true);
    try {
      const filename = `${dataType}_export_${new Date().toISOString().split('T')[0]}`;
      const { url, filename: finalFilename } = await exportData(data, filename, exportOptions);
      
      // Download the file
      const link = document.createElement('a');
      link.href = url;
      link.download = finalFilename;
      link.click();
      
      // Clean up
      URL.revokeObjectURL(url);
      onClose();
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const availableFields = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full"
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Download className="w-6 h-6 text-green-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Export {dataType} Data
              </h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Export Format
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['csv', 'excel', 'json'].map((format) => (
                  <label key={format} className="flex items-center">
                    <input
                      type="radio"
                      value={format}
                      checked={exportOptions.format === format}
                      onChange={(e) => setExportOptions({ ...exportOptions, format: e.target.value as any })}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm capitalize">{format}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeHeaders}
                  onChange={(e) => setExportOptions({ ...exportOptions, includeHeaders: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Include headers
                </span>
              </label>

              {exportOptions.format === 'csv' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Delimiter
                  </label>
                  <select
                    value={exportOptions.delimiter}
                    onChange={(e) => setExportOptions({ ...exportOptions, delimiter: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value=",">Comma (,)</option>
                    <option value=";">Semicolon (;)</option>
                    <option value="\t">Tab</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date Format
                </label>
                <select
                  value={exportOptions.dateFormat}
                  onChange={(e) => setExportOptions({ ...exportOptions, dateFormat: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </div>
            </div>

            {/* Field Selection */}
            {availableFields.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fields to Export (leave empty for all)
                </label>
                <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 space-y-1">
                  {availableFields.map((field) => (
                    <label key={field} className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        checked={exportOptions.fields?.includes(field) || exportOptions.fields?.length === 0}
                        onChange={(e) => {
                          const fields = exportOptions.fields || [];
                          if (e.target.checked) {
                            if (!fields.includes(field)) {
                              setExportOptions({ ...exportOptions, fields: [...fields, field] });
                            }
                          } else {
                            setExportOptions({ ...exportOptions, fields: fields.filter(f => f !== field) });
                          }
                        }}
                        className="mr-2 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">{field}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="text-sm text-gray-600 dark:text-gray-400">
              Exporting {data.length} records
            </div>

            <div className="flex justify-between">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const DataManagement: React.FC<DataManagementProps> = ({
  dataType,
  data,
  onDataChange,
  onRefresh
}) => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const filteredData = data.filter(item => {
    if (!searchTerm) return true;
    return Object.values(item).some(value =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortField) return 0;
    
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSelectAll = () => {
    if (selectedItems.length === sortedData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(sortedData.map(item => item.id || item.email || ''));
    }
  };

  const handleSelectItem = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(item => item !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedItems.length === 0) return;
    
    try {
      await batchDelete(selectedItems, dataType);
      // Refresh data
      onRefresh();
      setSelectedItems([]);
    } catch (error) {
      console.error('Batch delete error:', error);
    }
  };

  const getColumns = () => {
    if (data.length === 0) return [];
    return Object.keys(data[0]).filter(key => !key.startsWith('_'));
  };

  const columns = getColumns();

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={`Search ${dataType}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>

          {/* Batch Actions */}
          {selectedItems.length > 0 && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <span className="text-sm text-blue-700 dark:text-blue-400">
                {selectedItems.length} selected
              </span>
              <button
                onClick={handleBatchDelete}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </button>
          
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>

          <button
            onClick={onRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === sortedData.length && sortedData.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => {
                      if (sortField === column) {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField(column);
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center">
                      {column.replace(/_/g, ' ')}
                      {sortField === column && (
                        sortDirection === 'asc' ? 
                          <ChevronDown className="w-3 h-3 ml-1" /> : 
                          <ChevronRight className="w-3 h-3 ml-1" />
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedData.map((item, index) => {
                const itemId = item.id || item.email || index.toString();
                return (
                  <tr key={itemId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(itemId)}
                        onChange={() => handleSelectItem(itemId)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    {columns.map((column) => (
                      <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {String(item[column] || '')}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing {sortedData.length} of {data.length} {dataType}
        </div>
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        dataType={dataType}
        onImportComplete={(result) => {
          console.log('Import completed:', result);
          onRefresh();
        }}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        dataType={dataType}
        data={sortedData}
      />
    </div>
  );
};

export default DataManagement;