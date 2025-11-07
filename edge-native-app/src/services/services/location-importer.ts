/**
 * Location Lookup Importer for College Disambiguation
 * Processes Excel files with State → College → Locations mapping
 */

import * as XLSX from 'xlsx';

interface LocationLookup {
  [state: string]: {
    [collegeName: string]: string[]; // college name -> locations
  };
}

interface LocationRecord {
  state: string;
  college_name: string;
  locations: string[];
}

export class LocationImporter {
  
  /**
   * Import location lookup data from Excel file
   * Expected format:
   * Column A: STATE
   * Column B: COLLEGE NAME  
   * Column C: LOCATION (can be multiple, comma-separated or in separate rows)
   */
  async importLocationLookup(filePath: string): Promise<{
    success: boolean;
    data: LocationLookup;
    stats: {
      totalStates: number;
      totalColleges: number;
      totalLocations: number;
      multiLocationColleges: number;
    };
    errors: string[];
  }> {
    console.log('📍 Importing location lookup data from:', filePath);
    
    try {
      const workbook = XLSX.readFile(filePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]; // First sheet
      const rawData = XLSX.utils.sheet_to_json(worksheet);
      
      console.log(`📊 Processing ${rawData.length} location records...`);
      
      const locationLookup: LocationLookup = {};
      const errors: string[] = [];
      let totalLocations = 0;
      let multiLocationColleges = 0;
      
      // Process each record
      for (let i = 0; i < rawData.length; i++) {
        try {
          const record = this.processLocationRecord(rawData[i], i + 1);
          if (record) {
            // Initialize state if not exists
            if (!locationLookup[record.state]) {
              locationLookup[record.state] = {};
            }
            
            // Initialize college if not exists
            if (!locationLookup[record.state][record.college_name]) {
              locationLookup[record.state][record.college_name] = [];
            }
            
            // Add locations (avoiding duplicates)
            const existingLocations = new Set(locationLookup[record.state][record.college_name]);
            for (const location of record.locations) {
              if (!existingLocations.has(location)) {
                locationLookup[record.state][record.college_name].push(location);
                totalLocations++;
              }
            }
          }
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Calculate statistics
      const totalStates = Object.keys(locationLookup).length;
      let totalColleges = 0;
      
      for (const state of Object.values(locationLookup)) {
        for (const [collegeName, locations] of Object.entries(state)) {
          totalColleges++;
          if (locations.length > 1) {
            multiLocationColleges++;
          }
        }
      }
      
      console.log(`✅ Location import complete:`);
      console.log(`   📍 ${totalStates} states`);
      console.log(`   🏥 ${totalColleges} colleges`);
      console.log(`   📍 ${totalLocations} total locations`);
      console.log(`   🔀 ${multiLocationColleges} colleges with multiple locations`);
      
      // Show examples of multi-location colleges
      console.log(`\n🔍 Examples of multi-location colleges:`);
      let exampleCount = 0;
      for (const [state, colleges] of Object.entries(locationLookup)) {
        for (const [collegeName, locations] of Object.entries(colleges)) {
          if (locations.length > 1 && exampleCount < 5) {
            console.log(`   ${state} → ${collegeName}: ${locations.join(', ')}`);
            exampleCount++;
          }
        }
      }
      
      return {
        success: errors.length === 0,
        data: locationLookup,
        stats: {
          totalStates,
          totalColleges,
          totalLocations,
          multiLocationColleges
        },
        errors
      };
      
    } catch (error) {
      console.error('❌ Location import failed:', error);
      return {
        success: false,
        data: {},
        stats: {
          totalStates: 0,
          totalColleges: 0,
          totalLocations: 0,
          multiLocationColleges: 0
        },
        errors: [String(error)]
      };
    }
  }
  
  /**
   * Process individual location record from Excel
   */
  private processLocationRecord(record: any, rowNumber: number): LocationRecord | null {
    // Handle different possible column names
    const state = this.getFieldValue(record, ['state', 'State', 'STATE', 'STATE_NAME']);
    const collegeName = this.getFieldValue(record, [
      'college_name', 'college', 'College', 'COLLEGE', 'COLLEGE_NAME', 'COLLEGE/INSTITUTE'
    ]);
    const locationField = this.getFieldValue(record, [
      'location', 'Location', 'LOCATION', 'locations', 'Locations', 'LOCATIONS',
      'address', 'Address', 'ADDRESS', 'city', 'City', 'CITY'
    ]);
    
    if (!state || !collegeName || !locationField) {
      throw new Error(`Missing required fields: state=${!!state}, college=${!!collegeName}, location=${!!locationField}`);
    }
    
    // Parse locations (could be comma-separated or single)
    const locations = this.parseLocations(locationField);
    
    if (locations.length === 0) {
      throw new Error('No valid locations found');
    }
    
    return {
      state: state.trim().toUpperCase(),
      college_name: collegeName.trim().toUpperCase(),
      locations: locations.map(loc => loc.trim().toUpperCase())
    };
  }
  
  /**
   * Get field value from record using multiple possible field names
   */
  private getFieldValue(record: any, possibleFields: string[]): string | null {
    for (const field of possibleFields) {
      if (record[field] && String(record[field]).trim()) {
        return String(record[field]).trim();
      }
    }
    return null;
  }
  
  /**
   * Parse locations from field (handles comma-separated values)
   */
  private parseLocations(locationField: string): string[] {
    const locations = locationField
      .split(/[,\n\r]+/) // Split by commas or newlines
      .map(loc => loc.trim())
      .filter(loc => loc.length > 0);
    
    return locations;
  }
  
  /**
   * Validate and demonstrate location lookup functionality
   */
  async validateLocationLookup(locationLookup: LocationLookup): Promise<void> {
    console.log('\n🔍 VALIDATING LOCATION LOOKUP');
    console.log('-'.repeat(40));
    
    // Example validation cases
    const testCases = [
      {
        state: 'ANDHRA PRADESH',
        collegeName: 'GOVERNMENT MEDICAL COLLEGE',
        expectedLocations: ['ANANTHAPURAM', 'ELURU', 'KADAPA', 'MACHILIPATNAM', 'NANDYAL', 'PADERU', 'RAJAMAHENDRAVARAM', 'VIZIANAGARAM']
      },
      {
        state: 'INDIA', // ALL INDIA
        collegeName: 'ALL INDIA INSTITUTE OF MEDICAL SCIENCES',
        expectedLocations: [] // Should have multiple locations across states
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n🧪 Test: ${testCase.state} → ${testCase.collegeName}`);
      const stateData = locationLookup[testCase.state];
      if (stateData && stateData[testCase.collegeName]) {
        const locations = stateData[testCase.collegeName];
        console.log(`   ✅ Found ${locations.length} locations: ${locations.join(', ')}`);
      } else {
        console.log(`   ❌ Not found in lookup data`);
      }
    }
  }
  
  /**
   * Generate location statistics report
   */
  generateLocationReport(locationLookup: LocationLookup): string {
    const stats = {
      totalStates: Object.keys(locationLookup).length,
      totalColleges: 0,
      totalLocations: 0,
      multiLocationColleges: [] as Array<{state: string; college: string; locations: string[]}>
    };
    
    for (const [state, colleges] of Object.entries(locationLookup)) {
      for (const [collegeName, locations] of Object.entries(colleges)) {
        stats.totalColleges++;
        stats.totalLocations += locations.length;
        
        if (locations.length > 1) {
          stats.multiLocationColleges.push({
            state,
            college: collegeName,
            locations
          });
        }
      }
    }
    
    const multiLocationExamples = stats.multiLocationColleges
      .slice(0, 10) // Show top 10
      .map(item => `${item.state} → ${item.college}: ${item.locations.join(', ')}`)
      .join('\n');
    
    return `
📍 LOCATION LOOKUP REPORT
=========================
Total States: ${stats.totalStates}
Total Colleges: ${stats.totalColleges}
Total Location Entries: ${stats.totalLocations}
Multi-Location Colleges: ${stats.multiLocationColleges.length}

🔀 DISAMBIGUATION EXAMPLES
===========================
${multiLocationExamples}

📊 LOCATION BENEFITS
====================
- Reduces ambiguity for ${stats.multiLocationColleges.length} college names
- Average locations per multi-location college: ${(stats.totalLocations / Math.max(stats.multiLocationColleges.length, 1)).toFixed(1)}
- Enables precise matching for colleges like AIIMS, Govt Medical College, etc.
    `.trim();
  }
  
  /**
   * Export location lookup as JSON for caching
   */
  exportToJson(locationLookup: LocationLookup, outputPath: string): void {
    try {
      const fs = eval('require')('fs');
      fs.writeFileSync(outputPath, JSON.stringify(locationLookup, null, 2));
      console.log(`📄 Location lookup exported to: ${outputPath}`);
    } catch (error) {
      console.warn('⚠️ Could not write location lookup file:', error);
    }
  }
}