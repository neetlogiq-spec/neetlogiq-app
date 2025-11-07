#!/usr/bin/env tsx

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

class FoundationSeatDataComparator {
  
  async compareFiles(): Promise<void> {
    console.log('🔍 COMPARING FOUNDATION VS SEAT DATA');
    console.log('===================================');
    console.log('📊 Foundation: med ad.xlsx (corrected)');
    console.log('📊 Seat Data: Book1.xlsx (extracted columns)');
    
    const pythonScript = `
import pandas as pd
import json
import sys

foundation_file = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/med ad.xlsx'
seat_extract_file = '/Users/kashyapanand/Desktop/EXPORT/match/Book1.xlsx'

try:
    # Load both files
    print('📊 Loading files...', file=sys.stderr)
    foundation_df = pd.read_excel(foundation_file)
    seat_df = pd.read_excel(seat_extract_file)
    
    print(f'Foundation: {len(foundation_df)} rows', file=sys.stderr)
    print(f'Seat data: {len(seat_df)} rows', file=sys.stderr)
    print(f'Foundation columns: {list(foundation_df.columns)}', file=sys.stderr)
    print(f'Seat columns: {list(seat_df.columns)}', file=sys.stderr)
    
    # Create foundation lookup
    foundation_combinations = set()
    foundation_colleges = {}  # Map college name to full entry
    
    for _, row in foundation_df.iterrows():
        college = str(row.get('COLLEGE/INSTITUTE', '')).strip()
        address = str(row.get('ADDRESS', '')).strip() if pd.notna(row.get('ADDRESS')) else ''
        state = str(row.get('STATE', '')).strip()
        
        college = ' '.join(college.split())  # Clean spaces
        combination = f'{college}|{address}|{state}'
        foundation_combinations.add(combination)
        
        # Store for lookup
        foundation_colleges[college] = {
            'college': college,
            'address': address,
            'state': state
        }
    
    # Create seat data combinations
    seat_combinations = set()
    seat_colleges = {}
    
    for _, row in seat_df.iterrows():
        college_col = None
        for col in seat_df.columns:
            if 'COLLEGE' in col.upper() or 'INSTITUTE' in col.upper():
                college_col = col
                break
        
        if not college_col:
            continue
            
        college = str(row.get(college_col, '')).strip()
        address = str(row.get('ADDRESS', '')).strip() if 'ADDRESS' in seat_df.columns and pd.notna(row.get('ADDRESS')) else ''
        state = str(row.get('STATE', '')).strip()
        
        college = ' '.join(college.split())  # Clean spaces
        combination = f'{college}|{address}|{state}'
        seat_combinations.add(combination)
        
        seat_colleges[college] = {
            'college': college,
            'address': address,
            'state': state
        }
    
    # Calculate differences
    common = foundation_combinations & seat_combinations
    in_foundation_only = foundation_combinations - seat_combinations
    in_seat_only = seat_combinations - foundation_combinations
    
    print(f'\\n📊 COMPARISON SUMMARY:')
    print(f'✅ Exact matches: {len(common)}')
    print(f'📋 In foundation only: {len(in_foundation_only)}')
    print(f'❌ In seat data only (need correction): {len(in_seat_only)}')
    print(f'📈 Match rate: {(len(common) / len(seat_combinations)) * 100:.1f}%')
    
    # Find Find & Replace opportunities
    find_replace_suggestions = []
    
    for seat_combo in in_seat_only:
        seat_parts = seat_combo.split('|')
        seat_college = seat_parts[0]
        seat_address = seat_parts[1]
        seat_state = seat_parts[2]
        
        # Look for similar college in foundation with same state
        best_match = None
        best_score = 0
        
        for foundation_combo in foundation_combinations:
            foundation_parts = foundation_combo.split('|')
            foundation_college = foundation_parts[0]
            foundation_address = foundation_parts[1]
            foundation_state = foundation_parts[2]
            
            # Must be same state
            if foundation_state != seat_state:
                continue
            
            # Calculate simple similarity score
            college_similarity = len(set(seat_college.upper().split()) & set(foundation_college.upper().split())) / max(len(set(seat_college.upper().split())), len(set(foundation_college.upper().split())))
            
            if college_similarity > best_score and college_similarity > 0.6:
                best_score = college_similarity
                best_match = foundation_combo
        
        if best_match:
            match_parts = best_match.split('|')
            find_replace_suggestions.append({
                'find_college': seat_college,
                'find_address': seat_address,
                'find_state': seat_state,
                'replace_college': match_parts[0],
                'replace_address': match_parts[1],
                'replace_state': match_parts[2],
                'similarity': best_score
            })
    
    # Sort by similarity score (highest first)
    find_replace_suggestions.sort(key=lambda x: x['similarity'], reverse=True)
    
    # Output results
    result = {
        'summary': {
            'foundation_entries': len(foundation_combinations),
            'seat_data_entries': len(seat_combinations),
            'exact_matches': len(common),
            'in_foundation_only': len(in_foundation_only),
            'in_seat_only': len(in_seat_only),
            'match_rate': (len(common) / len(seat_combinations)) * 100
        },
        'find_replace_suggestions': find_replace_suggestions[:100],  # Top 100 suggestions
        'unmatched_seat_entries': list(in_seat_only)[:50]  # First 50 unmatched
    }
    
    print(json.dumps(result, indent=2))
    
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)
`;

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['-c', pythonScript], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            this.displayResults(result);
            this.generateFindReplaceFile(result);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse result: ${error}`));
          }
        } else {
          reject(new Error(`Comparison failed: ${stderr}`));
        }
      });
    });
  }
  
  private displayResults(result: any): void {
    console.log('\n📊 FOUNDATION VS SEAT DATA COMPARISON RESULTS');
    console.log('=============================================');
    
    console.log(`📋 Foundation entries: ${result.summary.foundation_entries}`);
    console.log(`📋 Seat data entries: ${result.summary.seat_data_entries}`);
    console.log(`✅ Exact matches: ${result.summary.exact_matches}`);
    console.log(`📊 Match rate: ${result.summary.match_rate.toFixed(1)}%`);
    console.log(`❌ Need correction: ${result.summary.in_seat_only}`);
    
    console.log('\n🔧 TOP FIND & REPLACE SUGGESTIONS:');
    console.log('=================================');
    
    result.find_replace_suggestions.slice(0, 20).forEach((suggestion: any, index: number) => {
      console.log(`\n${index + 1}. ${(suggestion.similarity * 100).toFixed(1)}% match`);
      console.log(`   Find: "${suggestion.find_college}"`);
      console.log(`   Replace: "${suggestion.replace_college}"`);
      console.log(`   State: ${suggestion.find_state}`);
      
      if (suggestion.find_address !== suggestion.replace_address) {
        console.log(`   Address change: "${suggestion.find_address}" → "${suggestion.replace_address}"`);
      }
    });
  }
  
  private generateFindReplaceFile(result: any): void {
    const findReplaceContent = `# 🔧 FIND & REPLACE INSTRUCTIONS FOR SEAT DATA

## 📊 Summary
- **Foundation entries**: ${result.summary.foundation_entries}
- **Seat data entries**: ${result.summary.seat_data_entries}  
- **Exact matches**: ${result.summary.exact_matches}
- **Match rate**: ${result.summary.match_rate.toFixed(1)}%
- **Need correction**: ${result.summary.in_seat_only}

## 🎯 FIND & REPLACE OPERATIONS (Top 50)

Apply these in Excel using Find & Replace (Ctrl+H / Cmd+H):

${result.find_replace_suggestions.slice(0, 50).map((suggestion: any, index: number) => `
### ${index + 1}. ${(suggestion.similarity * 100).toFixed(1)}% Match Confidence

**Find this in seat data:**
\`\`\`
COLLEGE/INSTITUTE: ${suggestion.find_college}
ADDRESS: ${suggestion.find_address}
STATE: ${suggestion.find_state}
\`\`\`

**Replace with:**
\`\`\`
COLLEGE/INSTITUTE: ${suggestion.replace_college}
ADDRESS: ${suggestion.replace_address}
STATE: ${suggestion.replace_state}
\`\`\`

**Excel Find & Replace:**
- Find: \`${suggestion.find_college}\`
- Replace: \`${suggestion.replace_college}\`
${suggestion.find_address !== suggestion.replace_address ? `- Also update ADDRESS: \`${suggestion.find_address}\` → \`${suggestion.replace_address}\`` : ''}

---`).join('')}

## 📋 UNMATCHED ENTRIES (First 20)

These entries in seat data have no close match in foundation:

${result.unmatched_seat_entries.slice(0, 20).map((entry: string, index: number) => {
  const parts = entry.split('|');
  return `${index + 1}. **${parts[0]}**
   - Address: ${parts[1]}
   - State: ${parts[2]}`;
}).join('\n\n')}

## 🎯 RECOMMENDED WORKFLOW

1. **📁 Open**: \`/Users/kashyapanand/Desktop/EXPORT/match/Book1.xlsx\`
2. **🔍 Find & Replace**: Apply the top suggestions above
3. **💾 Save**: The corrected Book1.xlsx
4. **🔄 Re-run comparison** to verify improvements
5. **📊 Apply corrections** back to main medical.xlsx file

---
*Generated on ${new Date().toLocaleString()}*
`;

    const outputPath = path.join(process.cwd(), 'data', 'find-replace-instructions.md');
    fs.writeFileSync(outputPath, findReplaceContent);
    
    console.log(`\n💾 Find & Replace instructions saved to: ${outputPath}`);
  }
}

async function main() {
  const comparator = new FoundationSeatDataComparator();
  
  try {
    await comparator.compareFiles();
    
    console.log('\n🎉 COMPARISON COMPLETED!');
    console.log('========================');
    console.log('✅ Identified differences between foundation and seat data');
    console.log('✅ Generated Find & Replace suggestions');
    console.log('✅ Created instructions file for Excel editing');
    console.log('🔧 Use the suggestions above for quick corrections in Excel');
    
  } catch (error) {
    console.error('❌ Comparison failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { FoundationSeatDataComparator };
