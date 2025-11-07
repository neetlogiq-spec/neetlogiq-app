/**
 * Advanced Data Management Service
 * Handles CSV/Excel import/export, batch processing, and data validation
 */

import * as XLSX from 'xlsx';
import { parse as parseCSV, unparse as unparseCVS } from 'papaparse';

export interface DataValidationRule {
  field: string;
  type: 'required' | 'email' | 'number' | 'date' | 'enum' | 'regex' | 'length' | 'range';
  value?: any;
  message?: string;
}

export interface DataValidationError {
  row: number;
  field: string;
  value: any;
  message: string;
}

export interface DataValidationResult {
  isValid: boolean;
  errors: DataValidationError[];
  warnings: DataValidationError[];
  validRecords: any[];
  invalidRecords: any[];
}

export interface BatchOperation {
  id: string;
  type: 'import' | 'export' | 'delete' | 'update' | 'validate';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalRecords: number;
  processedRecords: number;
  successCount: number;
  errorCount: number;
  startTime: string;
  endTime?: string;
  errors: string[];
  metadata?: Record<string, any>;
}

export interface ImportResult {
  operationId: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  errors: DataValidationError[];
  warnings: DataValidationError[];
  previewData?: any[];
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'json';
  includeHeaders: boolean;
  dateFormat?: string;
  encoding?: string;
  delimiter?: string;
  fields?: string[];
  filters?: Record<string, any>;
}

// Predefined validation rules for different data types
export const VALIDATION_RULES: Record<string, DataValidationRule[]> = {
  colleges: [
    { field: 'name', type: 'required', message: 'College name is required' },
    { field: 'state', type: 'required', message: 'State is required' },
    { field: 'type', type: 'enum', value: ['MEDICAL', 'DENTAL', 'DNB'], message: 'Invalid college type' },
    { field: 'management_type', type: 'enum', value: ['GOVERNMENT', 'PRIVATE', 'DEEMED'], message: 'Invalid management type' },
    { field: 'established_year', type: 'range', value: [1800, new Date().getFullYear()], message: 'Invalid establishment year' }
  ],
  courses: [
    { field: 'name', type: 'required', message: 'Course name is required' },
    { field: 'stream', type: 'enum', value: ['MEDICAL', 'DENTAL'], message: 'Invalid stream' },
    { field: 'duration_years', type: 'range', value: [1, 10], message: 'Duration must be between 1-10 years' }
  ],
  cutoffs: [
    { field: 'college_id', type: 'required', message: 'College ID is required' },
    { field: 'course_id', type: 'required', message: 'Course ID is required' },
    { field: 'academic_year_id', type: 'required', message: 'Academic year is required' },
    { field: 'opening_rank', type: 'number', message: 'Opening rank must be a number' },
    { field: 'closing_rank', type: 'number', message: 'Closing rank must be a number' },
    { field: 'category', type: 'enum', value: ['GENERAL', 'OBC', 'SC', 'ST'], message: 'Invalid category' }
  ],
  users: [
    { field: 'email', type: 'email', message: 'Invalid email format' },
    { field: 'displayName', type: 'required', message: 'Display name is required' },
    { field: 'role', type: 'enum', value: ['admin', 'user'], message: 'Invalid role' },
    { field: 'status', type: 'enum', value: ['active', 'suspended', 'pending'], message: 'Invalid status' }
  ]
};

/**
 * Generate a unique operation ID
 */
export function generateOperationId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate data against rules
 */
export function validateData(
  data: any[],
  rules: DataValidationRule[]
): DataValidationResult {
  const errors: DataValidationError[] = [];
  const warnings: DataValidationError[] = [];
  const validRecords: any[] = [];
  const invalidRecords: any[] = [];

  data.forEach((record, index) => {
    const rowNumber = index + 1;
    let isRowValid = true;
    const rowErrors: DataValidationError[] = [];

    rules.forEach(rule => {
      const value = record[rule.field];
      const error = validateField(value, rule, rowNumber);
      
      if (error) {
        errors.push(error);
        rowErrors.push(error);
        if (rule.type === 'required') {
          isRowValid = false;
        }
      }
    });

    if (isRowValid) {
      validRecords.push(record);
    } else {
      invalidRecords.push({ ...record, _errors: rowErrors });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validRecords,
    invalidRecords
  };
}

/**
 * Validate individual field
 */
function validateField(
  value: any,
  rule: DataValidationRule,
  row: number
): DataValidationError | null {
  const createError = (message?: string) => ({
    row,
    field: rule.field,
    value,
    message: message || rule.message || `Invalid ${rule.field}`
  });

  switch (rule.type) {
    case 'required':
      if (value === null || value === undefined || value === '') {
        return createError();
      }
      break;

    case 'email':
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return createError();
      }
      break;

    case 'number':
      if (value && (isNaN(Number(value)) || !isFinite(Number(value)))) {
        return createError();
      }
      break;

    case 'date':
      if (value && isNaN(Date.parse(value))) {
        return createError();
      }
      break;

    case 'enum':
      if (value && rule.value && !rule.value.includes(value)) {
        return createError(`Must be one of: ${rule.value.join(', ')}`);
      }
      break;

    case 'regex':
      if (value && rule.value && !new RegExp(rule.value).test(value)) {
        return createError();
      }
      break;

    case 'length':
      if (value && typeof value === 'string') {
        const [min, max] = Array.isArray(rule.value) ? rule.value : [0, rule.value];
        if (value.length < min || value.length > max) {
          return createError(`Length must be between ${min} and ${max} characters`);
        }
      }
      break;

    case 'range':
      if (value && rule.value && Array.isArray(rule.value)) {
        const [min, max] = rule.value;
        const numValue = Number(value);
        if (numValue < min || numValue > max) {
          return createError(`Must be between ${min} and ${max}`);
        }
      }
      break;
  }

  return null;
}

/**
 * Parse uploaded file (CSV or Excel)
 */
export async function parseUploadedFile(
  file: File,
  options: {
    hasHeaders?: boolean;
    sheetName?: string;
    skipRows?: number;
    maxRows?: number;
  } = {}
): Promise<{ data: any[]; headers: string[] }> {
  return new Promise((resolve, reject) => {
    const { hasHeaders = true, sheetName, skipRows = 0, maxRows } = options;
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      // Parse CSV
      parseCSV(file, {
        header: hasHeaders,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (result) => {
          let data = result.data as any[];
          
          if (skipRows > 0) {
            data = data.slice(skipRows);
          }
          
          if (maxRows) {
            data = data.slice(0, maxRows);
          }

          resolve({
            data,
            headers: hasHeaders ? Object.keys(data[0] || {}) : []
          });
        },
        error: (error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        }
      });
    } else if (['xlsx', 'xls'].includes(fileExtension!)) {
      // Parse Excel
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          
          const worksheet = sheetName 
            ? workbook.Sheets[sheetName]
            : workbook.Sheets[workbook.SheetNames[0]];
          
          if (!worksheet) {
            reject(new Error(`Sheet ${sheetName || 'default'} not found`));
            return;
          }

          let data = XLSX.utils.sheet_to_json(worksheet, { 
            header: hasHeaders ? undefined : 1,
            defval: '',
            blankrows: false
          }) as any[];

          if (skipRows > 0) {
            data = data.slice(skipRows);
          }
          
          if (maxRows) {
            data = data.slice(0, maxRows);
          }

          const headers = hasHeaders && data.length > 0 ? Object.keys(data[0]) : [];

          resolve({ data, headers });
        } catch (error) {
          reject(new Error(`Excel parsing error: ${error}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error(`Unsupported file format: ${fileExtension}`));
    }
  });
}

/**
 * Import data with validation and batch processing
 */
export async function importData(
  file: File,
  dataType: keyof typeof VALIDATION_RULES,
  options: {
    validateOnly?: boolean;
    batchSize?: number;
    hasHeaders?: boolean;
    sheetName?: string;
    skipRows?: number;
    maxRows?: number;
  } = {}
): Promise<ImportResult> {
  const operationId = generateOperationId();
  const { validateOnly = false, batchSize = 1000 } = options;

  try {
    // Parse file
    const { data, headers } = await parseUploadedFile(file, options);
    
    if (data.length === 0) {
      throw new Error('No data found in file');
    }

    // Validate data
    const validationRules = VALIDATION_RULES[dataType] || [];
    const validationResult = validateData(data, validationRules);

    if (validateOnly) {
      return {
        operationId,
        totalRecords: data.length,
        successCount: validationResult.validRecords.length,
        errorCount: validationResult.errors.length,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        previewData: data.slice(0, 10) // Return first 10 rows for preview
      };
    }

    // If validation passed and not validate-only, proceed with import
    if (validationResult.isValid) {
      // TODO: Implement actual database import here
      // For now, simulate batch processing
      console.log(`Importing ${validationResult.validRecords.length} ${dataType} records`);
      
      return {
        operationId,
        totalRecords: data.length,
        successCount: validationResult.validRecords.length,
        errorCount: 0,
        errors: [],
        warnings: validationResult.warnings
      };
    } else {
      return {
        operationId,
        totalRecords: data.length,
        successCount: 0,
        errorCount: validationResult.errors.length,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      };
    }
  } catch (error) {
    throw new Error(`Import failed: ${error}`);
  }
}

/**
 * Export data to file
 */
export async function exportData(
  data: any[],
  filename: string,
  options: ExportOptions
): Promise<{ url: string; filename: string }> {
  const { format, includeHeaders, fields, dateFormat = 'YYYY-MM-DD' } = options;
  
  // Filter fields if specified
  let exportData = data;
  if (fields && fields.length > 0) {
    exportData = data.map(record => {
      const filteredRecord: any = {};
      fields.forEach(field => {
        if (field in record) {
          filteredRecord[field] = record[field];
        }
      });
      return filteredRecord;
    });
  }

  // Format dates if needed
  exportData = exportData.map(record => {
    const formatted: any = {};
    Object.keys(record).forEach(key => {
      const value = record[key];
      if (value instanceof Date) {
        formatted[key] = formatDate(value, dateFormat);
      } else if (typeof value === 'string' && isDateString(value)) {
        formatted[key] = formatDate(new Date(value), dateFormat);
      } else {
        formatted[key] = value;
      }
    });
    return formatted;
  });

  let blob: Blob;
  let finalFilename = filename;

  switch (format) {
    case 'csv':
      const csvContent = unparseCVS(exportData, {
        header: includeHeaders,
        delimiter: options.delimiter || ','
      });
      blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      finalFilename += '.csv';
      break;

    case 'excel':
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      finalFilename += '.xlsx';
      break;

    case 'json':
      const jsonContent = JSON.stringify(exportData, null, 2);
      blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      finalFilename += '.json';
      break;

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  // Create download URL
  const url = URL.createObjectURL(blob);
  
  return { url, filename: finalFilename };
}

/**
 * Batch delete records
 */
export async function batchDelete(
  ids: string[],
  dataType: string
): Promise<BatchOperation> {
  const operationId = generateOperationId();
  
  // TODO: Implement actual batch delete
  // For now, simulate the operation
  const operation: BatchOperation = {
    id: operationId,
    type: 'delete',
    status: 'processing',
    totalRecords: ids.length,
    processedRecords: 0,
    successCount: 0,
    errorCount: 0,
    startTime: new Date().toISOString(),
    errors: []
  };

  // Simulate batch processing
  setTimeout(() => {
    operation.status = 'completed';
    operation.processedRecords = ids.length;
    operation.successCount = ids.length;
    operation.endTime = new Date().toISOString();
  }, 1000);

  return operation;
}

/**
 * Batch update records
 */
export async function batchUpdate(
  updates: Array<{ id: string; data: Record<string, any> }>,
  dataType: string
): Promise<BatchOperation> {
  const operationId = generateOperationId();
  
  // TODO: Implement actual batch update
  const operation: BatchOperation = {
    id: operationId,
    type: 'update',
    status: 'processing',
    totalRecords: updates.length,
    processedRecords: 0,
    successCount: 0,
    errorCount: 0,
    startTime: new Date().toISOString(),
    errors: []
  };

  // Simulate batch processing
  setTimeout(() => {
    operation.status = 'completed';
    operation.processedRecords = updates.length;
    operation.successCount = updates.length;
    operation.endTime = new Date().toISOString();
  }, 1000);

  return operation;
}

/**
 * Clean and normalize data
 */
export function cleanData(data: any[], rules?: Record<string, (value: any) => any>): any[] {
  return data.map(record => {
    const cleaned: any = {};
    
    Object.keys(record).forEach(key => {
      let value = record[key];
      
      // Apply custom cleaning rule if provided
      if (rules && rules[key]) {
        value = rules[key](value);
      } else {
        // Default cleaning
        if (typeof value === 'string') {
          value = value.trim();
          // Remove extra whitespace
          value = value.replace(/\s+/g, ' ');
          // Convert empty strings to null
          if (value === '') {
            value = null;
          }
        }
      }
      
      cleaned[key] = value;
    });
    
    return cleaned;
  });
}

// Helper functions
function formatDate(date: Date, format: string): string {
  // Simple date formatting - in production, use a proper date library like date-fns
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  return format
    .replace('YYYY', year.toString())
    .replace('MM', month)
    .replace('DD', day);
}

function isDateString(value: string): boolean {
  return !isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}/.test(value);
}

/**
 * Get batch operation status
 */
export function getBatchOperationStatus(operationId: string): BatchOperation | null {
  // TODO: Implement actual status retrieval from database/cache
  // For now, return null
  return null;
}