// Alias Import/Export Utility for bulk operations

export interface AliasRecord {
  stagingName: string;
  unifiedId: string;
  unifiedName: string;
  type: 'college' | 'course';
  confidence?: number;
  notes?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ row: number; error: string; data: any }>;
}

export class AliasImportExport {
  // Export aliases to CSV
  exportToCSV(aliases: AliasRecord[]): string {
    const headers = ['Staging Name', 'Unified ID', 'Unified Name', 'Type', 'Confidence', 'Notes'];
    const rows = aliases.map(alias => [
      alias.stagingName,
      alias.unifiedId,
      alias.unifiedName,
      alias.type,
      alias.confidence?.toString() || '',
      alias.notes || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');
  }

  // Export aliases to JSON
  exportToJSON(aliases: AliasRecord[]): string {
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      count: aliases.length,
      aliases
    }, null, 2);
  }

  // Parse CSV string to alias records
  parseCSV(csvContent: string): AliasRecord[] {
    const lines = csvContent.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      throw new Error('CSV must contain headers and at least one data row');
    }

    // Skip header row
    const dataLines = lines.slice(1);
    const aliases: AliasRecord[] = [];

    for (const line of dataLines) {
      // Simple CSV parsing (handles quoted fields)
      const fields: string[] = [];
      let currentField = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            // Escaped quote
            currentField += '"';
            i++;
          } else {
            // Toggle quote mode
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          fields.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      fields.push(currentField.trim());

      if (fields.length >= 4) {
        aliases.push({
          stagingName: fields[0],
          unifiedId: fields[1],
          unifiedName: fields[2],
          type: fields[3] as 'college' | 'course',
          confidence: fields[4] ? parseFloat(fields[4]) : undefined,
          notes: fields[5] || undefined
        });
      }
    }

    return aliases;
  }

  // Parse JSON string to alias records
  parseJSON(jsonContent: string): AliasRecord[] {
    try {
      const data = JSON.parse(jsonContent);

      if (data.aliases && Array.isArray(data.aliases)) {
        return data.aliases;
      } else if (Array.isArray(data)) {
        return data;
      } else {
        throw new Error('Invalid JSON format: expected aliases array');
      }
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${error}`);
    }
  }

  // Import aliases (dry run validation)
  validateImport(aliases: AliasRecord[]): ImportResult {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    aliases.forEach((alias, index) => {
      // Validate required fields
      if (!alias.stagingName || alias.stagingName.trim() === '') {
        result.failed++;
        result.errors.push({
          row: index + 2, // +2 for header and 0-index
          error: 'Missing staging name',
          data: alias
        });
        return;
      }

      if (!alias.unifiedId || alias.unifiedId.trim() === '') {
        result.failed++;
        result.errors.push({
          row: index + 2,
          error: 'Missing unified ID',
          data: alias
        });
        return;
      }

      if (!alias.type || !['college', 'course'].includes(alias.type)) {
        result.failed++;
        result.errors.push({
          row: index + 2,
          error: 'Invalid type (must be "college" or "course")',
          data: alias
        });
        return;
      }

      // Validate confidence if provided
      if (alias.confidence !== undefined) {
        const conf = alias.confidence;
        if (isNaN(conf) || conf < 0 || conf > 1) {
          result.failed++;
          result.errors.push({
            row: index + 2,
            error: 'Confidence must be between 0 and 1',
            data: alias
          });
          return;
        }
      }

      result.success++;
    });

    return result;
  }

  // Import aliases to database
  async importAliases(aliases: AliasRecord[]): Promise<ImportResult> {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    for (let i = 0; i < aliases.length; i++) {
      const alias = aliases[i];

      try {
        // Validate
        if (!alias.stagingName || !alias.unifiedId || !alias.type) {
          result.failed++;
          result.errors.push({
            row: i + 2,
            error: 'Missing required fields',
            data: alias
          });
          continue;
        }

        // Make API call to create alias
        const response = await fetch('/api/staging/alias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stagingName: alias.stagingName,
            unifiedId: alias.unifiedId,
            type: alias.type,
            confidence: alias.confidence,
            notes: alias.notes
          })
        });

        if (response.ok) {
          result.success++;
        } else if (response.status === 409) {
          // Alias already exists
          result.skipped++;
        } else {
          result.failed++;
          const errorData = await response.json().catch(() => ({}));
          result.errors.push({
            row: i + 2,
            error: errorData.error || `HTTP ${response.status}`,
            data: alias
          });
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          error: String(error),
          data: alias
        });
      }
    }

    return result;
  }

  // Download file helper
  downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Export template
  exportTemplate(type: 'college' | 'course' | 'both'): string {
    const examples: AliasRecord[] = [];

    if (type === 'college' || type === 'both') {
      examples.push({
        stagingName: 'AIIMS DELHI',
        unifiedId: 'MED0001',
        unifiedName: 'All India Institute of Medical Sciences, New Delhi',
        type: 'college',
        confidence: 0.95,
        notes: 'Example college alias'
      });
    }

    if (type === 'course' || type === 'both') {
      examples.push({
        stagingName: 'MBBS',
        unifiedId: 'CRS0001',
        unifiedName: 'Bachelor of Medicine and Bachelor of Surgery',
        type: 'course',
        confidence: 1.0,
        notes: 'Example course alias'
      });
    }

    return this.exportToCSV(examples);
  }
}

export const aliasImportExport = new AliasImportExport();
