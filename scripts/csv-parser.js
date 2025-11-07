#!/usr/bin/env node

/**
 * CSV Parser Utility
 * Parses and processes CSV files for NeetLogIQ data pipeline
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Configuration
const config = {
  inputDir: './data/csv',
  outputDir: './data/processed',
  supportedFormats: ['.csv']
};

class CSVParser {
  constructor() {
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
      console.log(`✅ Created directory: ${config.outputDir}`);
    }
  }

  async parseAll() {
    console.log('🔄 Parsing CSV files...');
    
    const files = fs.readdirSync(config.inputDir)
      .filter(file => config.supportedFormats.some(format => file.endsWith(format)));
    
    if (files.length === 0) {
      console.log('⚠️  No CSV files found in input directory');
      return;
    }

    for (const file of files) {
      await this.parseFile(file);
    }
    
    console.log('✅ CSV parsing completed!');
  }

  async parseFile(filename) {
    try {
      const filePath = path.join(config.inputDir, filename);
      const results = [];
      
      return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            // Clean and validate data
            const cleanedData = this.cleanData(data);
            results.push(cleanedData);
          })
          .on('end', () => {
            // Save parsed data
            const outputFilename = path.parse(filename).name + '.json';
            const outputPath = path.join(config.outputDir, outputFilename);
            
            fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
            console.log(`📊 Parsed: ${filename} → ${outputFilename} (${results.length} records)`);
            resolve(results);
          })
          .on('error', (error) => {
            console.error(`❌ Error parsing ${filename}:`, error.message);
            reject(error);
          });
      });
      
    } catch (error) {
      console.error(`❌ Error processing ${filename}:`, error.message);
    }
  }

  cleanData(data) {
    const cleaned = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Clean key names
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      
      // Clean values
      let cleanValue = value;
      
      if (typeof cleanValue === 'string') {
        cleanValue = cleanValue.trim();
        
        // Convert numbers
        if (!isNaN(cleanValue) && !isNaN(parseFloat(cleanValue))) {
          cleanValue = parseFloat(cleanValue);
        }
        
        // Convert booleans
        if (cleanValue.toLowerCase() === 'true') cleanValue = true;
        if (cleanValue.toLowerCase() === 'false') cleanValue = false;
        
        // Handle empty values
        if (cleanValue === '' || cleanValue === 'null') cleanValue = null;
      }
      
      cleaned[cleanKey] = cleanValue;
    }
    
    return cleaned;
  }

  async parseWithSchema(filename, schema) {
    try {
      const filePath = path.join(config.inputDir, filename);
      const results = [];
      
      return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            try {
              // Validate against schema
              const validatedData = schema.parse(data);
              results.push(validatedData);
            } catch (error) {
              console.warn(`⚠️  Schema validation failed for record: ${error.message}`);
            }
          })
          .on('end', () => {
            console.log(`📊 Parsed with schema: ${filename} (${results.length} valid records)`);
            resolve(results);
          })
          .on('error', (error) => {
            console.error(`❌ Error parsing ${filename}:`, error.message);
            reject(error);
          });
      });
      
    } catch (error) {
      console.error(`❌ Error processing ${filename}:`, error.message);
    }
  }

  async getStats(filename) {
    try {
      const filePath = path.join(config.inputDir, filename);
      let rowCount = 0;
      let columnCount = 0;
      const columns = new Set();
      
      return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            rowCount++;
            Object.keys(data).forEach(key => columns.add(key));
            columnCount = columns.size;
          })
          .on('end', () => {
            const stats = {
              filename,
              rows: rowCount,
              columns: columnCount,
              columnNames: Array.from(columns)
            };
            console.log(`📊 Stats for ${filename}:`, stats);
            resolve(stats);
          })
          .on('error', (error) => {
            console.error(`❌ Error getting stats for ${filename}:`, error.message);
            reject(error);
          });
      });
      
    } catch (error) {
      console.error(`❌ Error processing ${filename}:`, error.message);
    }
  }
}

// CLI usage
if (require.main === module) {
  const parser = new CSVParser();
  
  const args = process.argv.slice(2);
  
  if (args.length === 1 && args[0] === '--stats') {
    // Get stats for all files
    const files = fs.readdirSync(config.inputDir)
      .filter(file => config.supportedFormats.some(format => file.endsWith(format)));
    
    files.forEach(file => parser.getStats(file));
  } else {
    // Parse all files
    parser.parseAll();
  }
}

module.exports = CSVParser;
