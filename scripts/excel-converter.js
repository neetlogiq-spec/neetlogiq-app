#!/usr/bin/env node

/**
 * Excel Converter Utility
 * Converts Excel files to CSV format for data processing
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Configuration
const config = {
  inputDir: './data/excel',
  outputDir: './data/csv',
  supportedFormats: ['.xlsx', '.xls']
};

class ExcelConverter {
  constructor() {
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
      console.log(`✅ Created directory: ${config.outputDir}`);
    }
  }

  async convertAll() {
    console.log('🔄 Converting Excel files to CSV...');
    
    const files = fs.readdirSync(config.inputDir)
      .filter(file => config.supportedFormats.some(format => file.endsWith(format)));
    
    if (files.length === 0) {
      console.log('⚠️  No Excel files found in input directory');
      return;
    }

    for (const file of files) {
      await this.convertFile(file);
    }
    
    console.log('✅ Excel conversion completed!');
  }

  async convertFile(filename) {
    try {
      const filePath = path.join(config.inputDir, filename);
      const workbook = XLSX.readFile(filePath);
      
      // Get all sheet names
      const sheetNames = workbook.SheetNames;
      
      for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
        
        // Create output filename
        const baseName = path.parse(filename).name;
        const outputFilename = `${baseName}_${sheetName}.csv`;
        const outputPath = path.join(config.outputDir, outputFilename);
        
        // Write CSV file
        fs.writeFileSync(outputPath, csvData, 'utf8');
        console.log(`📊 Converted: ${filename} (${sheetName}) → ${outputFilename}`);
      }
      
    } catch (error) {
      console.error(`❌ Error converting ${filename}:`, error.message);
    }
  }

  async convertSingle(inputFile, outputFile) {
    try {
      const workbook = XLSX.readFile(inputFile);
      const sheetName = workbook.SheetNames[0]; // Use first sheet
      const worksheet = workbook.Sheets[sheetName];
      const csvData = XLSX.utils.sheet_to_csv(worksheet);
      
      fs.writeFileSync(outputFile, csvData, 'utf8');
      console.log(`✅ Converted: ${inputFile} → ${outputFile}`);
      
    } catch (error) {
      console.error(`❌ Error converting ${inputFile}:`, error.message);
    }
  }
}

// CLI usage
if (require.main === module) {
  const converter = new ExcelConverter();
  
  const args = process.argv.slice(2);
  
  if (args.length === 2) {
    // Convert single file
    converter.convertSingle(args[0], args[1]);
  } else {
    // Convert all files
    converter.convertAll();
  }
}

module.exports = ExcelConverter;
