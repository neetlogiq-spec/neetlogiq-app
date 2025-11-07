#!/usr/bin/env node

/**
 * NeetLogIQ Data Pipeline
 * Converts Excel data to Parquet and JSON artifacts for Cloudflare R2
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  inputDir: './data/raw',
  outputDir: './data/processed',
  year: new Date().getFullYear(),
  r2Bucket: 'neetlogiq-data',
  r2Prefix: 'gold'
};

// Data schemas
const schemas = {
  colleges: {
    id: 'TEXT PRIMARY KEY',
    name: 'TEXT NOT NULL',
    city: 'TEXT',
    state: 'TEXT',
    management_type: 'TEXT',
    established_year: 'INTEGER',
    website: 'TEXT',
    description: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  courses: {
    id: 'TEXT PRIMARY KEY',
    name: 'TEXT NOT NULL',
    stream: 'TEXT',
    branch: 'TEXT',
    duration_years: 'INTEGER',
    description: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  college_courses: {
    id: 'TEXT PRIMARY KEY',
    college_id: 'TEXT REFERENCES colleges(id)',
    course_id: 'TEXT REFERENCES courses(id)',
    year: 'INTEGER',
    total_seats: 'INTEGER',
    general_seats: 'INTEGER',
    obc_seats: 'INTEGER',
    sc_seats: 'INTEGER',
    st_seats: 'INTEGER',
    ews_seats: 'INTEGER',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  cutoffs: {
    id: 'TEXT PRIMARY KEY',
    college_id: 'TEXT REFERENCES colleges(id)',
    course_id: 'TEXT REFERENCES courses(id)',
    year: 'INTEGER',
    round: 'INTEGER',
    category: 'TEXT',
    opening_rank: 'INTEGER',
    closing_rank: 'INTEGER',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  }
};

class DataPipeline {
  constructor() {
    this.ensureDirectories();
  }

  ensureDirectories() {
    const dirs = [
      config.inputDir,
      config.outputDir,
      `${config.outputDir}/parquet`,
      `${config.outputDir}/json`,
      `${config.outputDir}/docs`
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    });
  }

  async processExcelFiles() {
    console.log('🔄 Processing Excel files...');
    
    const excelFiles = fs.readdirSync(config.inputDir)
      .filter(file => file.endsWith('.xlsx') || file.endsWith('.xls'));
    
    if (excelFiles.length === 0) {
      console.log('⚠️  No Excel files found in input directory');
      return;
    }

    for (const file of excelFiles) {
      console.log(`📊 Processing: ${file}`);
      await this.convertExcelToCSV(file);
    }
  }

  async convertExcelToCSV(excelFile) {
    try {
      // Use Python pandas to convert Excel to CSV
      const pythonScript = `
import pandas as pd
import sys

file_path = '${path.join(config.inputDir, excelFile)}'
output_dir = '${config.outputDir}'

try:
    # Read Excel file
    excel_data = pd.read_excel(file_path, sheet_name=None)
    
    # Convert each sheet to CSV
    for sheet_name, df in excel_data.items():
        # Clean sheet name for filename
        clean_name = sheet_name.replace(' ', '_').replace('-', '_').lower()
        output_file = f'{output_dir}/{clean_name}.csv'
        
        # Save as CSV
        df.to_csv(output_file, index=False)
        print(f'Converted {sheet_name} to {output_file}')
        
except Exception as e:
    print(f'Error processing {file_path}: {e}')
    sys.exit(1)
      `;
      
      fs.writeFileSync('temp_convert.py', pythonScript);
      execSync('python3 temp_convert.py', { stdio: 'inherit' });
      fs.unlinkSync('temp_convert.py');
      
    } catch (error) {
      console.error(`❌ Error converting ${excelFile}:`, error.message);
    }
  }

  async createParquetFiles() {
    console.log('🔄 Creating Parquet files...');
    
    const duckdbScript = `
-- DuckDB script to create Parquet files
INSTALL httpfs;
LOAD httpfs;

-- Create tables from CSV files
CREATE TABLE colleges AS SELECT * FROM read_csv_auto('${config.outputDir}/*colleges*.csv');
CREATE TABLE courses AS SELECT * FROM read_csv_auto('${config.outputDir}/*courses*.csv');
CREATE TABLE college_courses AS SELECT * FROM read_csv_auto('${config.outputDir}/*college_courses*.csv');
CREATE TABLE cutoffs AS SELECT * FROM read_csv_auto('${config.outputDir}/*cutoffs*.csv');

-- Export to Parquet
COPY colleges TO '${config.outputDir}/parquet/colleges_${config.year}.parquet' (FORMAT PARQUET);
COPY courses TO '${config.outputDir}/parquet/courses_${config.year}.parquet' (FORMAT PARQUET);
COPY college_courses TO '${config.outputDir}/parquet/college_courses_${config.year}.parquet' (FORMAT PARQUET);
COPY cutoffs TO '${config.outputDir}/parquet/cutoffs_${config.year}.parquet' (FORMAT PARQUET);

-- Create summary statistics
CREATE TABLE stats AS SELECT 
  'colleges' as table_name, COUNT(*) as record_count FROM colleges
UNION ALL
SELECT 'courses', COUNT(*) FROM courses
UNION ALL
SELECT 'college_courses', COUNT(*) FROM college_courses
UNION ALL
SELECT 'cutoffs', COUNT(*) FROM cutoffs;

COPY stats TO '${config.outputDir}/parquet/stats_${config.year}.parquet' (FORMAT PARQUET);
    `;
    
    fs.writeFileSync('temp_duckdb.sql', duckdbScript);
    
    try {
      execSync('duckdb < temp_duckdb.sql', { stdio: 'inherit' });
      console.log('✅ Parquet files created successfully');
    } catch (error) {
      console.error('❌ Error creating Parquet files:', error.message);
    } finally {
      fs.unlinkSync('temp_duckdb.sql');
    }
  }

  async createJSONArtifacts() {
    console.log('🔄 Creating JSON artifacts...');
    
    const duckdbScript = `
-- Create JSON artifacts for SSR
INSTALL httpfs;
LOAD httpfs;

-- Load data from Parquet
CREATE TABLE colleges AS SELECT * FROM read_parquet('${config.outputDir}/parquet/colleges_${config.year}.parquet');
CREATE TABLE courses AS SELECT * FROM read_parquet('${config.outputDir}/parquet/courses_${config.year}.parquet');
CREATE TABLE college_courses AS SELECT * FROM read_parquet('${config.outputDir}/parquet/college_courses_${config.year}.parquet');
CREATE TABLE cutoffs AS SELECT * FROM read_parquet('${config.outputDir}/parquet/cutoffs_${config.year}.parquet');

-- Create college pages with courses and recent cutoffs
CREATE TABLE college_pages AS
SELECT 
  c.*,
  json_group_array(
    json_object(
      'id', cc.course_id,
      'name', co.name,
      'total_seats', cc.total_seats,
      'year', cc.year
    )
  ) as courses,
  json_group_array(
    json_object(
      'year', cu.year,
      'round', cu.round,
      'category', cu.category,
      'opening_rank', cu.opening_rank,
      'closing_rank', cu.closing_rank
    )
  ) as recent_cutoffs
FROM colleges c
LEFT JOIN college_courses cc ON c.id = cc.college_id
LEFT JOIN courses co ON cc.course_id = co.id
LEFT JOIN cutoffs cu ON c.id = cu.college_id AND cu.year = ${config.year}
GROUP BY c.id;

-- Export individual college pages
COPY (SELECT id, json_object('college', json(*)) as data FROM college_pages) 
TO '${config.outputDir}/json/colleges/' (FORMAT JSON, ARRAY false);

-- Create course pages
CREATE TABLE course_pages AS
SELECT 
  co.*,
  json_group_array(
    json_object(
      'id', cc.college_id,
      'name', c.name,
      'city', c.city,
      'state', c.state,
      'total_seats', cc.total_seats,
      'year', cc.year
    )
  ) as colleges
FROM courses co
LEFT JOIN college_courses cc ON co.id = cc.course_id
LEFT JOIN colleges c ON cc.college_id = c.id
GROUP BY co.id;

-- Export individual course pages
COPY (SELECT id, json_object('course', json(*)) as data FROM course_pages) 
TO '${config.outputDir}/json/courses/' (FORMAT JSON, ARRAY false);

-- Create search indexes
CREATE TABLE search_index AS
SELECT 
  'college' as type,
  id,
  name,
  city,
  state,
  management_type,
  description
FROM colleges
UNION ALL
SELECT 
  'course' as type,
  id,
  name,
  stream,
  branch,
  NULL as management_type,
  description
FROM courses;

COPY search_index TO '${config.outputDir}/json/search_index.json' (FORMAT JSON);
    `;
    
    fs.writeFileSync('temp_json.sql', duckdbScript);
    
    try {
      execSync('duckdb < temp_json.sql', { stdio: 'inherit' });
      console.log('✅ JSON artifacts created successfully');
    } catch (error) {
      console.error('❌ Error creating JSON artifacts:', error.message);
    } finally {
      fs.unlinkSync('temp_json.sql');
    }
  }

  async createSearchDocuments() {
    console.log('🔄 Creating search documents...');
    
    const duckdbScript = `
-- Create search documents for AutoRAG
INSTALL httpfs;
LOAD httpfs;

-- Load data
CREATE TABLE colleges AS SELECT * FROM read_parquet('${config.outputDir}/parquet/colleges_${config.year}.parquet');
CREATE TABLE courses AS SELECT * FROM read_parquet('${config.outputDir}/parquet/courses_${config.year}.parquet');
CREATE TABLE college_courses AS SELECT * FROM read_parquet('${config.outputDir}/parquet/college_courses_${config.year}.parquet');

-- Create college documents
CREATE TABLE college_docs AS
SELECT 
  c.id,
  c.name,
  c.city,
  c.state,
  c.management_type,
  c.description,
  json_group_array(co.name) as course_names,
  COUNT(cc.course_id) as total_courses
FROM colleges c
LEFT JOIN college_courses cc ON c.id = cc.college_id
LEFT JOIN courses co ON cc.course_id = co.id
GROUP BY c.id, c.name, c.city, c.state, c.management_type, c.description;

-- Export as markdown documents
COPY (SELECT 
  id,
  '# ' || name || '\\n\\n' ||
  '**Location:** ' || city || ', ' || state || '\\n' ||
  '**Type:** ' || management_type || '\\n' ||
  '**Courses:** ' || total_courses || '\\n\\n' ||
  COALESCE(description, '') || '\\n\\n' ||
  '**Available Courses:** ' || array_to_string(course_names, ', ') as content
FROM college_docs) 
TO '${config.outputDir}/docs/colleges/' (FORMAT CSV, HEADER false);

-- Create course documents
CREATE TABLE course_docs AS
SELECT 
  co.id,
  co.name,
  co.stream,
  co.branch,
  co.description,
  json_group_array(c.name) as college_names,
  COUNT(cc.college_id) as total_colleges
FROM courses co
LEFT JOIN college_courses cc ON co.id = cc.course_id
LEFT JOIN colleges c ON cc.college_id = c.id
GROUP BY co.id, co.name, co.stream, co.branch, co.description;

-- Export course documents
COPY (SELECT 
  id,
  '# ' || name || '\\n\\n' ||
  '**Stream:** ' || stream || '\\n' ||
  '**Branch:** ' || branch || '\\n' ||
  '**Colleges:** ' || total_colleges || '\\n\\n' ||
  COALESCE(description, '') || '\\n\\n' ||
  '**Available at:** ' || array_to_string(college_names, ', ') as content
FROM course_docs) 
TO '${config.outputDir}/docs/courses/' (FORMAT CSV, HEADER false);
    `;
    
    fs.writeFileSync('temp_docs.sql', duckdbScript);
    
    try {
      execSync('duckdb < temp_docs.sql', { stdio: 'inherit' });
      console.log('✅ Search documents created successfully');
    } catch (error) {
      console.error('❌ Error creating search documents:', error.message);
    } finally {
      fs.unlinkSync('temp_docs.sql');
    }
  }

  async uploadToR2() {
    console.log('🔄 Uploading to Cloudflare R2...');
    
    try {
      // Upload Parquet files
      execSync(`wrangler r2 object put ${config.r2Bucket}/${config.r2Prefix}/${config.year}/parquet/colleges_${config.year}.parquet --file ${config.outputDir}/parquet/colleges_${config.year}.parquet`, { stdio: 'inherit' });
      execSync(`wrangler r2 object put ${config.r2Bucket}/${config.r2Prefix}/${config.year}/parquet/courses_${config.year}.parquet --file ${config.outputDir}/parquet/courses_${config.year}.parquet`, { stdio: 'inherit' });
      execSync(`wrangler r2 object put ${config.r2Bucket}/${config.r2Prefix}/${config.year}/parquet/college_courses_${config.year}.parquet --file ${config.outputDir}/parquet/college_courses_${config.year}.parquet`, { stdio: 'inherit' });
      execSync(`wrangler r2 object put ${config.r2Bucket}/${config.r2Prefix}/${config.year}/parquet/cutoffs_${config.year}.parquet --file ${config.outputDir}/parquet/cutoffs_${config.year}.parquet`, { stdio: 'inherit' });
      
      // Upload JSON files
      execSync(`wrangler r2 object put ${config.r2Bucket}/${config.r2Prefix}/${config.year}/json/search_index.json --file ${config.outputDir}/json/search_index.json`, { stdio: 'inherit' });
      
      console.log('✅ Files uploaded to R2 successfully');
    } catch (error) {
      console.error('❌ Error uploading to R2:', error.message);
    }
  }

  async run() {
    console.log('🚀 Starting NeetLogIQ Data Pipeline...');
    console.log(`📅 Processing year: ${config.year}`);
    
    try {
      await this.processExcelFiles();
      await this.createParquetFiles();
      await this.createJSONArtifacts();
      await this.createSearchDocuments();
      await this.uploadToR2();
      
      console.log('🎉 Data pipeline completed successfully!');
    } catch (error) {
      console.error('❌ Pipeline failed:', error);
      process.exit(1);
    }
  }
}

// Run the pipeline
if (require.main === module) {
  const pipeline = new DataPipeline();
  pipeline.run();
}

module.exports = DataPipeline;
