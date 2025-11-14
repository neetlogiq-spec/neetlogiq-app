/**
 * CSV Export/Import Utilities
 * Helper functions for working with CSV data
 */

/**
 * Convert array of objects to CSV string
 */
export function convertToCSV(data: any[], headers?: string[]): string {
  if (data.length === 0) {
    return '';
  }

  // Use provided headers or extract from first object
  const csvHeaders = headers || Object.keys(data[0]);

  // Create header row
  const headerRow = csvHeaders.join(',');

  // Create data rows
  const dataRows = data.map(item => {
    return csvHeaders.map(header => {
      const value = item[header];

      // Handle different data types
      if (value === null || value === undefined) {
        return '';
      }

      // Convert to string and escape quotes
      const stringValue = String(value).replace(/"/g, '""');

      // Wrap in quotes if contains comma, newline, or quote
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue}"`;
      }

      return stringValue;
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(csvString: string, filename: string): void {
  // Create blob
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up URL
  URL.revokeObjectURL(url);
}

/**
 * Export data to CSV and download
 */
export function exportToCSV(data: any[], filename: string, headers?: string[]): void {
  const csvString = convertToCSV(data, headers);
  downloadCSV(csvString, filename);
}

/**
 * Parse CSV string to array of objects
 */
export function parseCSV(csvString: string): any[] {
  const lines = csvString.trim().split('\n');

  if (lines.length === 0) {
    return [];
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    if (values.length === headers.length) {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index];
      });
      data.push(obj);
    }
  }

  return data;
}

/**
 * Parse a single CSV line (handles quoted values)
 */
function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current);

  return result;
}

/**
 * Read CSV file from input
 */
export function readCSVFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = parseCSV(text);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Format date for CSV export
 */
export function formatDateForCSV(date: Date | string): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Format timestamp for CSV export
 */
export function formatTimestampForCSV(date: Date | string): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString(); // Full ISO string
}

/**
 * Clean data for CSV export (remove nested objects, format dates, etc.)
 */
export function cleanDataForCSV(data: any[]): any[] {
  return data.map(item => {
    const cleaned: any = {};

    Object.keys(item).forEach(key => {
      const value = item[key];

      // Skip nested objects and arrays (except for simple cases)
      if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
        if (Array.isArray(value)) {
          cleaned[key] = value.join('; ');
        } else {
          // Try to get a simple representation
          cleaned[key] = value.name || value.id || JSON.stringify(value);
        }
      } else if (value instanceof Date) {
        cleaned[key] = formatTimestampForCSV(value);
      } else {
        cleaned[key] = value;
      }
    });

    return cleaned;
  });
}
