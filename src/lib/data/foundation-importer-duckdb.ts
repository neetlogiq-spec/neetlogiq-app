import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

export interface FoundationData {
  states: string[];
  quotas: string[];
  categories: string[];
  medicalColleges: string[];
  dentalColleges: string[];
  dnbColleges: string[];
}

export interface FoundationCollege {
  id: string;
  name: string;
  type: 'MEDICAL' | 'DENTAL' | 'DNB';
  state?: string;
  address?: string;
  city?: string;
  pincode?: string;
  university?: string;
  management?: 'GOVERNMENT' | 'PRIVATE' | 'DEEMED';
  establishedYear?: number;
  website?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  sourceFile: string;
  createdAt: string;
  updatedAt: string;
}

export class FoundationImporterDuckDB {
  private foundationPath: string;
  private dataDir: string;

  constructor() {
    // Use local foundation files in project directory
    this.foundationPath = path.join(process.cwd(), 'data', 'Foundation');
    this.dataDir = path.join(process.cwd(), 'data');
  }

  async importAllFoundationData(): Promise<FoundationData> {
    console.log('🚀 Starting foundation data import with DuckDB + Parquet...');
    
    try {
      // Create data directory if it doesn't exist
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // Import all foundation data
      const foundationData = await this.extractFoundationData();
      
      // Convert to Parquet format
      await this.convertToParquet(foundationData);
      
      console.log('✅ Foundation data import completed successfully!');
      return foundationData;
      
    } catch (error) {
      console.error('❌ Foundation data import failed:', error);
      throw error;
    }
  }

  private async extractFoundationData(): Promise<FoundationData> {
    console.log('📊 Extracting foundation data from Excel files...');
    
    const foundationData: FoundationData = {
      states: [],
      quotas: [],
      categories: [],
      medicalColleges: [],
      dentalColleges: [],
      dnbColleges: []
    };

    // Extract states
    foundationData.states = await this.extractStates();
    console.log(`✅ Extracted ${foundationData.states.length} states`);

    // Extract quotas
    foundationData.quotas = await this.extractQuotas();
    console.log(`✅ Extracted ${foundationData.quotas.length} quotas`);

    // Extract categories
    foundationData.categories = await this.extractCategories();
    console.log(`✅ Extracted ${foundationData.categories.length} categories`);

    // Extract medical colleges
    foundationData.medicalColleges = await this.extractMedicalColleges();
    console.log(`✅ Extracted ${foundationData.medicalColleges.length} medical colleges`);

    // Extract dental colleges
    foundationData.dentalColleges = await this.extractDentalColleges();
    console.log(`✅ Extracted ${foundationData.dentalColleges.length} dental colleges`);

    // Extract DNB colleges
    foundationData.dnbColleges = await this.extractDnbColleges();
    console.log(`✅ Extracted ${foundationData.dnbColleges.length} DNB colleges`);

    return foundationData;
  }

  private async extractStates(): Promise<string[]> {
    try {
      const filePath = path.join(this.foundationPath, 'STATES OF INDIA.xlsx');
      console.log(`📁 Reading states from: ${filePath}`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return [];
      }
      
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      console.log(`📊 Extracted ${data.length} states from ${filePath}`);
      return data.map((row: any) => row['STATES OF INDIA'].trim());
    } catch (error) {
      console.error('❌ Error extracting states:', error);
      return [];
    }
  }

  private async extractQuotas(): Promise<string[]> {
    try {
      const filePath = path.join(this.foundationPath, 'QUOTA.xlsx');
      console.log(`📁 Reading quotas from: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return [];
      }
      
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      console.log(`📊 Extracted ${data.length} quotas from ${filePath}`);
      return data.map((row: any) => row['QUOTA'].trim());
    } catch (error) {
      console.error('❌ Error extracting quotas:', error);
      return [];
    }
  }

  private async extractCategories(): Promise<string[]> {
    try {
      const filePath = path.join(this.foundationPath, 'CATEGORY.xlsx');
      console.log(`📁 Reading categories from: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return [];
      }
      
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      console.log(`📊 Extracted ${data.length} categories from ${filePath}`);
      return data.map((row: any) => row['CATEGORY'].trim());
    } catch (error) {
      console.error('❌ Error extracting categories:', error);
      return [];
    }
  }

  private async extractMedicalColleges(): Promise<string[]> {
    try {
      const filePath = path.join(this.foundationPath, 'medical.xlsx');
      console.log(`📁 Reading medical colleges from: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return [];
      }
      
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      console.log(`📊 Extracted ${data.length} medical colleges from ${filePath}`);
      return data.map((row: any) => row['medical colleges'].trim());
    } catch (error) {
      console.error('❌ Error extracting medical colleges:', error);
      return [];
    }
  }

  private async extractDentalColleges(): Promise<string[]> {
    try {
      const filePath = path.join(this.foundationPath, 'dental.xlsx');
      console.log(`📁 Reading dental colleges from: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return [];
      }
      
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      console.log(`📊 Extracted ${data.length} dental colleges from ${filePath}`);
      return data.map((row: any) => row['dental colleges'].trim());
    } catch (error) {
      console.error('❌ Error extracting dental colleges:', error);
      return [];
    }
  }

  private async extractDnbColleges(): Promise<string[]> {
    try {
      const filePath = path.join(this.foundationPath, 'dnb.xlsx');
      console.log(`📁 Reading DNB colleges from: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return [];
      }
      
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      console.log(`📊 Extracted ${data.length} DNB colleges from ${filePath}`);
      return data.map((row: any) => row['dnb colleges'].trim());
    } catch (error) {
      console.error('❌ Error extracting DNB colleges:', error);
      return [];
    }
  }

  private async convertToParquet(foundationData: FoundationData): Promise<void> {
    console.log('📊 Converting foundation data to JSON format...');
    
    try {
      // Create foundation colleges data
      const foundationColleges: FoundationCollege[] = [];
      
      // Process medical colleges
      foundationData.medicalColleges.forEach((collegeName, index) => {
        const { state, address, city } = this.extractStateAndAddress(collegeName);
        foundationColleges.push({
          id: `med_${index + 1}`,
          name: collegeName,
          type: 'MEDICAL',
          state,
          address,
          city,
          isActive: true,
          sourceFile: 'medical.xlsx',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });
      
      // Process dental colleges
      foundationData.dentalColleges.forEach((collegeName, index) => {
        const { state, address, city } = this.extractStateAndAddress(collegeName);
        foundationColleges.push({
          id: `dent_${index + 1}`,
          name: collegeName,
          type: 'DENTAL',
          state,
          address,
          city,
          isActive: true,
          sourceFile: 'dental.xlsx',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });
      
      // Process DNB colleges
      foundationData.dnbColleges.forEach((collegeName, index) => {
        const { state, address, city } = this.extractStateAndAddress(collegeName);
        foundationColleges.push({
          id: `dnb_${index + 1}`,
          name: collegeName,
          type: 'DNB',
          state,
          address,
          city,
          isActive: true,
          sourceFile: 'dnb.xlsx',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });
      
      // Create JSON files
      await this.createJsonFile('foundation_colleges.json', foundationColleges);
      await this.createJsonFile('foundation_states.json', foundationData.states.map((name, index) => ({ id: index + 1, name, isActive: true })));
      await this.createJsonFile('foundation_quotas.json', foundationData.quotas.map((name, index) => ({ id: index + 1, name, isActive: true })));
      await this.createJsonFile('foundation_categories.json', foundationData.categories.map((name, index) => ({ id: index + 1, name, isActive: true })));
      
      console.log('✅ Successfully converted foundation data to JSON files');
      
    } catch (error) {
      console.error('❌ JSON conversion failed:', error);
      throw error;
    }
  }

  private async createJsonFile(fileName: string, data: any[]): Promise<void> {
    const jsonPath = path.join(this.dataDir, fileName);
    
    // Write JSON file
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Created ${jsonPath} with ${data.length} records`);
  }

  private extractStateAndAddress(collegeName: string): { state: string | null; address: string | null; city: string | null } {
    // Enhanced state extraction
    const statePatterns = [
      'DELHI', 'MUMBAI', 'BANGALORE', 'CHENNAI', 'KOLKATA', 'HYDERABAD',
      'PUNE', 'AHMEDABAD', 'JAIPUR', 'LUCKNOW', 'KANPUR', 'NAGPUR',
      'INDORE', 'BHOPAL', 'COIMBATORE', 'KOCHI', 'THIRUVANANTHAPURAM',
      'MYSORE', 'MANGALORE', 'HUBLI', 'BELGAUM', 'GULBARGA', 'BIJAPUR',
      'KARNATAKA', 'TAMIL NADU', 'MAHARASHTRA', 'GUJARAT', 'RAJASTHAN',
      'UTTAR PRADESH', 'WEST BENGAL', 'ANDHRA PRADESH', 'TELANGANA',
      'KERALA', 'ODISHA', 'JHARKHAND', 'CHHATTISGARH', 'MADHYA PRADESH',
      'HARYANA', 'PUNJAB', 'HIMACHAL PRADESH', 'UTTARAKHAND', 'JAMMU AND KASHMIR',
      'ASSAM', 'MANIPUR', 'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'TRIPURA',
      'ARUNACHAL PRADESH', 'SIKKIM', 'GOA', 'ANDAMAN AND NICOBAR ISLANDS',
      'LAKSHADWEEP', 'DADRA AND NAGAR HAVELI', 'DAMAN AND DIU', 'PUDUCHERRY'
    ];
    
    let state: string | null = null;
    let address: string | null = null;
    let city: string | null = null;
    
    // Look for state patterns
    for (const pattern of statePatterns) {
      if (collegeName.toUpperCase().includes(pattern)) {
        state = pattern;
        break;
      }
    }
    
    // Extract address and city (everything after the first comma)
    const commaIndex = collegeName.indexOf(',');
    if (commaIndex > 0) {
      const addressPart = collegeName.substring(commaIndex + 1).trim();
      address = addressPart;
      
      // Try to extract city (first part of address)
      const cityMatch = addressPart.split(',')[0];
      if (cityMatch && cityMatch.length > 2) {
        city = cityMatch.trim();
      }
    }
    
    return { state, address, city };
  }

  async getFoundationDataSummary(): Promise<any> {
    try {
      const foundationData = await this.extractFoundationData();
      
      return {
        states: foundationData.states.length,
        quotas: foundationData.quotas.length,
        categories: foundationData.categories.length,
        medicalColleges: foundationData.medicalColleges.length,
        dentalColleges: foundationData.dentalColleges.length,
        dnbColleges: foundationData.dnbColleges.length,
        totalColleges: foundationData.medicalColleges.length + foundationData.dentalColleges.length + foundationData.dnbColleges.length
      };
    } catch (error) {
      console.error('❌ Failed to get foundation data summary:', error);
      return {
        states: 0,
        quotas: 0,
        categories: 0,
        medicalColleges: 0,
        dentalColleges: 0,
        dnbColleges: 0,
        totalColleges: 0
      };
    }
  }

  async testFoundationDataAccess(): Promise<boolean> {
    try {
      console.log('🧪 Testing foundation data access...');
      console.log(`📁 Foundation path: ${this.foundationPath}`);
      
      // Test file access
      const files = [
        'STATES OF INDIA.xlsx',
        'QUOTA.xlsx',
        'CATEGORY.xlsx',
        'medical.xlsx',
        'dental.xlsx',
        'dnb.xlsx'
      ];
      
      for (const file of files) {
        const filePath = path.join(this.foundationPath, file);
        console.log(`🔍 Checking: ${filePath}`);
        if (!fs.existsSync(filePath)) {
          console.error(`❌ File not found: ${filePath}`);
          return false;
        }
        console.log(`✅ Found: ${file}`);
      }
      
      // Test data extraction
      const summary = await this.getFoundationDataSummary();
      console.log('📊 Foundation data summary:', summary);
      
      return true;
    } catch (error) {
      console.error('❌ Foundation data access test failed:', error);
      return false;
    }
  }
}

export default FoundationImporterDuckDB;
