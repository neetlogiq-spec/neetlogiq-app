#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

interface CombineFilesConfig {
  sourceDir: string;
  outputDir: string;
  filePattern: string;
  outputFileName: string;
}

class CounsellingFileCombiner {
  private config: CombineFilesConfig;

  constructor(config: CombineFilesConfig) {
    this.config = config;
  }

  async combineAIQ2024Files(): Promise<void> {
    console.log('🔄 COMBINING AIQ 2024 COUNSELLING FILES');
    console.log('=====================================');

    const sourceFiles = [
      'AIQ_PG_2024_R1.xlsx',
      'AIQ_PG_2024_R2.xlsx', 
      'AIQ_PG_2024_R3.xlsx',
      'AIQ_PG_2024_R4.xlsx',
      'AIQ_PG_2024_R5.xlsx'
    ];

    const outputPath = path.join(this.config.outputDir, this.config.outputFileName);
    
    // Create Python script to combine Excel files
    const pythonScript = `
import pandas as pd
import sys
import os

def combine_excel_files():
    source_dir = "${this.config.sourceDir}"
    output_path = "${outputPath}"
    
    files = [
        "AIQ_PG_2024_R1.xlsx",
        "AIQ_PG_2024_R2.xlsx", 
        "AIQ_PG_2024_R3.xlsx",
        "AIQ_PG_2024_R4.xlsx",
        "AIQ_PG_2024_R5.xlsx"
    ]
    
    combined_data = []
    total_records = 0
    
    for file in files:
        file_path = os.path.join(source_dir, file)
        if os.path.exists(file_path):
            print(f"📖 Reading {file}...")
            try:
                df = pd.read_excel(file_path)
                print(f"   ✅ Found {len(df)} records")
                combined_data.append(df)
                total_records += len(df)
            except Exception as e:
                print(f"   ❌ Error reading {file}: {e}")
        else:
            print(f"   ⚠️  File not found: {file}")
    
    if combined_data:
        print(f"\\n🔄 Combining {len(combined_data)} files...")
        combined_df = pd.concat(combined_data, ignore_index=True)
        
        # Sort by ROUND then by other columns for better organization
        if 'ROUND' in combined_df.columns:
            combined_df = combined_df.sort_values(['ROUND', 'COLLEGE/INSTITUTE', 'COURSE'])
        
        print(f"📊 Total combined records: {len(combined_df)}")
        print(f"📊 Unique rounds: {sorted(combined_df['ROUND'].unique()) if 'ROUND' in combined_df.columns else 'ROUND column not found'}")
        
        # Save combined file
        print(f"💾 Saving to {output_path}...")
        combined_df.to_excel(output_path, index=False)
        print(f"✅ Successfully created {output_path}")
        
        # Show summary
        if 'ROUND' in combined_df.columns:
            round_counts = combined_df['ROUND'].value_counts().sort_index()
            print("\\n📊 Records per round:")
            for round_name, count in round_counts.items():
                print(f"   {round_name}: {count} records")
        
        return True
    else:
        print("❌ No files were successfully read")
        return False

if __name__ == "__main__":
    success = combine_excel_files()
    sys.exit(0 if success else 1)
`;

    // Write Python script to temporary file
    const tempScriptPath = path.join(process.cwd(), 'temp_combine_script.py');
    fs.writeFileSync(tempScriptPath, pythonScript);

    try {
      // Run Python script
      console.log('🐍 Running Python combination script...');
      
      await new Promise<void>((resolve, reject) => {
        const pythonProcess = spawn('python3', [tempScriptPath], {
          stdio: 'inherit'
        });

        pythonProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Python script exited with code ${code}`));
          }
        });

        pythonProcess.on('error', (error) => {
          reject(error);
        });
      });

      console.log('\\n✅ File combination completed successfully!');
      
      // Verify the output file
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log(`📁 Output file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`📍 Location: ${outputPath}`);
      }

    } catch (error) {
      console.error('❌ Error combining files:', error);
      throw error;
    } finally {
      // Clean up temp script
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    }
  }

  async validateCombinedFile(filePath: string): Promise<void> {
    console.log('\\n🔍 VALIDATING COMBINED FILE');
    console.log('===========================');

    const pythonScript = `
import pandas as pd
import sys

def validate_file():
    file_path = "${filePath}"
    
    try:
        print(f"📖 Reading combined file: {file_path}")
        df = pd.read_excel(file_path)
        
        print(f"✅ Total records: {len(df)}")
        print(f"✅ Columns: {list(df.columns)}")
        
        if 'ROUND' in df.columns:
            rounds = df['ROUND'].value_counts().sort_index()
            print("\\n📊 Round distribution:")
            for round_name, count in rounds.items():
                print(f"   {round_name}: {count} records")
        
        if 'YEAR' in df.columns:
            years = df['YEAR'].value_counts().sort_index()
            print("\\n📊 Year distribution:")
            for year, count in years.items():
                print(f"   {year}: {count} records")
        
        if 'COLLEGE/INSTITUTE' in df.columns:
            unique_colleges = df['COLLEGE/INSTITUTE'].nunique()
            print(f"\\n📊 Unique colleges: {unique_colleges}")
            
            # Show top colleges by frequency
            top_colleges = df['COLLEGE/INSTITUTE'].value_counts().head(5)
            print("\\n📊 Top 5 colleges by frequency:")
            for college, count in top_colleges.items():
                print(f"   {college}: {count} records")
        
        return True
        
    except Exception as e:
        print(f"❌ Error validating file: {e}")
        return False

if __name__ == "__main__":
    success = validate_file()
    sys.exit(0 if success else 1)
`;

    const tempScriptPath = path.join(process.cwd(), 'temp_validate_script.py');
    fs.writeFileSync(tempScriptPath, pythonScript);

    try {
      await new Promise<void>((resolve, reject) => {
        const pythonProcess = spawn('python3', [tempScriptPath], {
          stdio: 'inherit'
        });

        pythonProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Validation script exited with code ${code}`));
          }
        });
      });

    } finally {
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    }
  }
}

async function main() {
  const combiner = new CounsellingFileCombiner({
    sourceDir: '/Users/kashyapanand/Desktop/EXPORT/AIQ_PG_2024',
    outputDir: '/Users/kashyapanand/Desktop/EXPORT/AIQ_PG_2024', 
    filePattern: 'AIQ_PG_2024_R*.xlsx',
    outputFileName: 'AIQ_PG_2024.xlsx'
  });

  try {
    await combiner.combineAIQ2024Files();
    
    const outputPath = path.join('/Users/kashyapanand/Desktop/EXPORT/AIQ_PG_2024', 'AIQ_PG_2024.xlsx');
    await combiner.validateCombinedFile(outputPath);
    
    console.log('\\n🎉 SUCCESS! Combined file is ready for editing.');
    console.log('\\n🔧 NEXT STEPS:');
    console.log('1. 📝 Edit the combined AIQ_PG_2024.xlsx file');
    console.log('2. 🔍 Apply Find & Replace from Master Mapping File');
    console.log('3. 💾 Save the edited file');
    console.log('4. 🔄 Re-run import with the single combined file');
    
  } catch (error) {
    console.error('❌ Failed to combine files:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { CounsellingFileCombiner };
