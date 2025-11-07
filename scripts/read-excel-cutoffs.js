const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_DIR = '/Users/kashyapanand/Desktop/EXPORT/cutoffs';
const OUTPUT_DIR = path.join(__dirname, '../public/data/cutoffs');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function readExcelFile(filePath) {
  console.log(`Reading ${filePath}...`);
  
  try {
    const workbook = XLSX.readFile(filePath);
    const results = [];
    
    // Read all sheets
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      results.push({
        sheetName,
        data,
        rowCount: data.length,
        columns: data.length > 0 ? Object.keys(data[0]) : []
      });
    });
    
    return results;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

function extractCutoffInfo(filename) {
  // Extract info from filename like: AIQ-PG-2024.xlsx
  const parts = filename.replace('.xlsx', '').split('-');
  return {
    quota: parts[0] || 'Unknown',
    stream: parts[1] || 'Unknown',
    year: parts[2] || 'Unknown',
    filename
  };
}

function processAllFiles() {
  const files = fs.readdirSync(EXCEL_DIR)
    .filter(file => file.endsWith('.xlsx') && !file.startsWith('~$'));
  
  console.log(`Found ${files.length} Excel files`);
  
  const allCutoffs = [];
  
  files.forEach(file => {
    const filePath = path.join(EXCEL_DIR, file);
    const info = extractCutoffInfo(file);
    const results = readExcelFile(filePath);
    
    if (results) {
      results.forEach(result => {
        const cutoffData = {
          source: info.filename,
          sheet: result.sheetName,
          metadata: info,
          data: result.data,
          summary: {
            rowCount: result.rowCount,
            columns: result.columns
          }
        };
        
        allCutoffs.push(cutoffData);
        
        // Save individual file
        const outputPath = path.join(OUTPUT_DIR, file.replace('.xlsx', '.json'));
        fs.writeFileSync(outputPath, JSON.stringify(cutoffData, null, 2));
        console.log(`✓ Saved ${outputPath}`);
      });
    }
  });
  
  // Save combined data
  const combinedPath = path.join(OUTPUT_DIR, 'all-cutoffs.json');
  fs.writeFileSync(combinedPath, JSON.stringify(allCutoffs, null, 2));
  console.log(`\n✓ Saved combined data to ${combinedPath}`);
  
  // Save summary
  const summaryPath = path.join(OUTPUT_DIR, 'summary.json');
  const summary = {
    totalFiles: files.length,
    totalCutoffs: allCutoffs.length,
    byQuota: {},
    byStream: {},
    byYear: {}
  };
  
  allCutoffs.forEach(cutoff => {
    const quota = cutoff.metadata.quota;
    const stream = cutoff.metadata.stream;
    const year = cutoff.metadata.year;
    
    summary.byQuota[quota] = (summary.byQuota[quota] || 0) + 1;
    summary.byStream[stream] = (summary.byStream[stream] || 0) + 1;
    summary.byYear[year] = (summary.byYear[year] || 0) + 1;
  });
  
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Saved summary to ${summaryPath}`);
  
  console.log('\n📊 Summary:');
  console.log(JSON.stringify(summary, null, 2));
}

// Run the script
console.log('🚀 Starting Excel to JSON conversion...\n');
processAllFiles();
console.log('\n✅ Conversion complete!');




















