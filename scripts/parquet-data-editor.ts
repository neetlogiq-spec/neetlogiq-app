#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import * as parquet from 'parquetjs';

interface ParquetRecord {
  [key: string]: any;
}

class ParquetDataEditor {
  private parquetPath: string;

  constructor(parquetPath: string) {
    this.parquetPath = parquetPath;
  }

  async readParquetFile(): Promise<ParquetRecord[]> {
    console.log(`📖 Reading Parquet file: ${this.parquetPath}`);
    
    if (!fs.existsSync(this.parquetPath)) {
      throw new Error(`Parquet file not found: ${this.parquetPath}`);
    }

    const reader = await parquet.ParquetReader.openFile(this.parquetPath);
    const cursor = reader.getCursor();
    const records: ParquetRecord[] = [];

    let record = null;
    while (record = await cursor.next()) {
      records.push(record);
    }

    await reader.close();
    console.log(`✅ Read ${records.length} records from Parquet file`);
    return records;
  }

  async updateRecords(
    records: ParquetRecord[], 
    updates: { find: string; replace: string; column: string }[]
  ): Promise<{ updated: number; records: ParquetRecord[] }> {
    console.log('🔧 Applying updates to records...');
    
    let totalUpdated = 0;
    const updatedRecords = records.map(record => {
      const newRecord = { ...record };
      let recordUpdated = false;

      updates.forEach(({ find, replace, column }) => {
        if (newRecord[column] && typeof newRecord[column] === 'string') {
          const originalValue = newRecord[column];
          const newValue = originalValue.replace(new RegExp(find, 'gi'), replace);
          
          if (newValue !== originalValue) {
            newRecord[column] = newValue;
            recordUpdated = true;
          }
        }
      });

      if (recordUpdated) {
        totalUpdated++;
        newRecord.updated_at = new Date().toISOString();
      }

      return newRecord;
    });

    console.log(`✅ Updated ${totalUpdated} records`);
    return { updated: totalUpdated, records: updatedRecords };
  }

  async writeParquetFile(records: ParquetRecord[], outputPath: string): Promise<void> {
    console.log(`💾 Writing updated records to: ${outputPath}`);

    // Create backup
    const backupPath = `${this.parquetPath}.backup.${Date.now()}`;
    if (fs.existsSync(this.parquetPath)) {
      fs.copyFileSync(this.parquetPath, backupPath);
      console.log(`📋 Backup created: ${backupPath}`);
    }

    // Determine schema from first record
    if (records.length === 0) {
      throw new Error('No records to write');
    }

    const firstRecord = records[0];
    const schema: any = {};
    
    Object.keys(firstRecord).forEach(key => {
      const value = firstRecord[key];
      if (typeof value === 'string') {
        schema[key] = { type: 'UTF8', optional: true };
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          schema[key] = { type: 'INT64', optional: true };
        } else {
          schema[key] = { type: 'DOUBLE', optional: true };
        }
      } else if (typeof value === 'boolean') {
        schema[key] = { type: 'BOOLEAN', optional: true };
      } else {
        schema[key] = { type: 'UTF8', optional: true }; // Default to string
      }
    });

    const parquetSchema = new parquet.ParquetSchema(schema);
    const writer = await parquet.ParquetWriter.openFile(parquetSchema, outputPath);

    for (const record of records) {
      await writer.appendRow(record);
    }

    await writer.close();
    console.log(`✅ Successfully wrote ${records.length} records to ${outputPath}`);
  }
}

async function editCollegeNames() {
  console.log('🏥 PARQUET COLLEGE NAME EDITOR');
  console.log('==============================');

  const parquetPath = path.join(process.cwd(), 'data', 'colleges.parquet');
  const editor = new ParquetDataEditor(parquetPath);

  try {
    // Read existing data
    const records = await editor.readParquetFile();
    
    // Define updates based on Master Mapping File
    const updates = [
      { find: 'SMS MEDICAL COLLEGE', replace: 'SAWAI MAN SINGH MEDICAL COLLEGE', column: 'name' },
      { find: 'OSMANIA MEDICAL COLLGE', replace: 'OSMANIA MEDICAL COLLEGE', column: 'name' },
      { find: 'VARDHMAN MAHAVIR', replace: 'VARDHAMAN MAHAVIR', column: 'name' },
      { find: 'GOVT MEDICAL COLLEGE', replace: 'GOVERNMENT MEDICAL COLLEGE', column: 'name' },
      { find: 'MGM MEDICAL COLLEGE', replace: 'MAHATMA GANDHI MEMORIAL MEDICAL COLLEGE', column: 'name' },
      { find: 'KING GEORGES', replace: 'KING GEORGE', column: 'name' },
      { find: 'BJGOVERNMENT', replace: 'B.J. GOVERNMENT', column: 'name' },
      { find: 'SAVEETHA MEDICAL COLLEGE ND HOSPITAL', replace: 'SAVEETHA MEDICAL COLLEGE AND HOSPITAL', column: 'name' }
    ];

    // Apply updates
    const { updated, records: updatedRecords } = await editor.updateRecords(records, updates);
    
    if (updated > 0) {
      // Write back to file
      await editor.writeParquetFile(updatedRecords, parquetPath);
      
      console.log('\n📊 EDIT SUMMARY:');
      console.log(`Total records processed: ${records.length}`);
      console.log(`Records updated: ${updated}`);
      console.log(`Success rate: ${((updated / records.length) * 100).toFixed(2)}%`);
    } else {
      console.log('ℹ️ No records needed updating');
    }

  } catch (error) {
    console.error('❌ Error editing Parquet file:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  editCollegeNames();
}

export { ParquetDataEditor };
