const sqlite3 = require('sqlite3').verbose();
const parquet = require('parquetjs');
const fs = require('fs');
const path = require('path');

class SQLiteToParquetConverter {
  constructor() {
    this.masterDbPath = path.join(process.cwd(), 'data/sqlite/master_data.db');
    this.counsellingDbPath = path.join(process.cwd(), 'data/sqlite/counselling_data_partitioned.db');
    this.seatDbPath = path.join(process.cwd(), 'data/sqlite/seat_data.db');
    this.outputDir = path.join(process.cwd(), 'data/parquet');
  }

  async convertAll() {
    console.log('🚀 Starting SQLite to Parquet conversion...');
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    try {
      // Convert master data
      await this.convertMasterData();
      
      // Convert counselling data
      await this.convertCounsellingData();
      
      // Convert seat data
      await this.convertSeatData();
      
      console.log('\n🎉 All SQLite to Parquet conversions completed successfully!');
    } catch (error) {
      console.error('❌ Error during conversion:', error);
      throw error;
    }
  }

  async convertMasterData() {
    console.log('\n📊 Converting master data...');
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.masterDbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Convert states
        this.convertTableToParquet(db, 'states', 'states.parquet')
          .then(() => this.convertTableToParquet(db, 'categories', 'categories.parquet'))
          .then(() => this.convertTableToParquet(db, 'quotas', 'quotas.parquet'))
          .then(() => this.convertTableToParquet(db, 'courses', 'courses.parquet'))
          .then(() => this.convertTableToParquet(db, 'medical_colleges', 'medical_colleges.parquet'))
          .then(() => {
            db.close();
            resolve();
          })
          .catch((err) => {
            db.close();
            reject(err);
          });
      });
    });
  }

  async convertCounsellingData() {
    console.log('\n📊 Converting counselling data...');
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.counsellingDbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.convertTableToParquet(db, 'counselling_records', 'counselling_records.parquet')
          .then(() => {
            db.close();
            resolve();
          })
          .catch((err) => {
            db.close();
            reject(err);
          });
      });
    });
  }

  async convertSeatData() {
    console.log('\n📊 Converting seat data...');
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.seatDbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.convertTableToParquet(db, 'seat_records', 'seat_records.parquet')
          .then(() => {
            db.close();
            resolve();
          })
          .catch((err) => {
            db.close();
            reject(err);
          });
      });
    });
  }

  async convertTableToParquet(db, tableName, outputFileName) {
    console.log(`  Converting ${tableName}...`);
    
    return new Promise((resolve, reject) => {
      // Get table schema
      db.all(`PRAGMA table_info(${tableName})`, (err, schemaInfo) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log(`    Schema: ${schemaInfo.map(col => `${col.name}(${col.type})`).join(', ')}`);
        
        // Get all data
        db.all(`SELECT * FROM ${tableName}`, async (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          console.log(`    Records: ${rows.length}`);
          
          if (rows.length === 0) {
            console.log(`    ⚠️  No data found in ${tableName}, skipping...`);
            resolve();
            return;
          }
          
          try {
            // Create Parquet schema
            const schema = this.createParquetSchema(schemaInfo, rows[0]);
            
            // Write to Parquet
            const outputPath = path.join(this.outputDir, outputFileName);
            const writer = await parquet.ParquetWriter.openFile(schema, outputPath, {
              compression: 'GZIP',
              compression_level: 3,
              pageSize: 65536,
              rowGroupSize: 10000,
            });
            
            for (const row of rows) {
              await writer.appendRow(row);
            }
            
            await writer.close();
            
            // Get file stats
            const stats = fs.statSync(outputPath);
            console.log(`    ✅ ${outputFileName}: ${stats.size} bytes`);
            
            resolve();
          } catch (error) {
            console.error(`    ❌ Error converting ${tableName}:`, error.message);
            reject(error);
          }
        });
      });
    });
  }

  createParquetSchema(schemaInfo, sampleRow) {
    const schemaFields = {};
    
    for (const column of schemaInfo) {
      const fieldName = column.name;
      const fieldType = column.type.toLowerCase();
      const sampleValue = sampleRow[fieldName];
      
      // Map SQLite types to Parquet types
      if (fieldType.includes('int') || fieldType.includes('integer')) {
        schemaFields[fieldName] = { type: 'INT64' };
      } else if (fieldType.includes('real') || fieldType.includes('float') || fieldType.includes('double')) {
        schemaFields[fieldName] = { type: 'DOUBLE' };
      } else if (fieldType.includes('text') || fieldType.includes('varchar') || fieldType.includes('char')) {
        schemaFields[fieldName] = { type: 'UTF8' };
      } else if (fieldType.includes('blob')) {
        schemaFields[fieldName] = { type: 'BYTE_ARRAY' };
      } else {
        // Fallback based on sample value
        if (typeof sampleValue === 'number') {
          schemaFields[fieldName] = { type: 'DOUBLE' };
        } else if (typeof sampleValue === 'boolean') {
          schemaFields[fieldName] = { type: 'BOOLEAN' };
        } else {
          schemaFields[fieldName] = { type: 'UTF8' };
        }
      }
    }
    
    return new parquet.ParquetSchema(schemaFields);
  }
}

// Run the conversion
async function main() {
  const converter = new SQLiteToParquetConverter();
  await converter.convertAll();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SQLiteToParquetConverter;