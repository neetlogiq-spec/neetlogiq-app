import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

export interface FoundationData {
  states: string[];
  quotas: string[];
  categories: string[];
  medicalColleges: string[];
  dentalColleges: string[];
  dnbColleges: string[];
}

export class FoundationImporter {
  private foundationPath = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION';

  async importAllFoundationData(): Promise<void> {
    console.log('🚀 Starting foundation data import...');
    
    try {
      // Import in order: states, quotas, categories, then colleges
      await this.importStates();
      await this.importQuotas();
      await this.importCategories();
      await this.importMedicalColleges();
      await this.importDentalColleges();
      await this.importDnbColleges();
      
      console.log('✅ Foundation data import completed successfully!');
    } catch (error) {
      console.error('❌ Foundation data import failed:', error);
      throw error;
    }
  }

  private async importStates(): Promise<void> {
    console.log('📊 Importing states...');
    
    const filePath = path.join(this.foundationPath, 'STATES OF INDIA.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const states = data.map((row: any) => ({
      name: row['STATES OF INDIA'].trim(),
      isActive: true,
    }));

    // Clear existing states
    await prisma.state.deleteMany();
    
    // Import new states
    await prisma.state.createMany({
      data: states,
    });

    console.log(`✅ Imported ${states.length} states`);
  }

  private async importQuotas(): Promise<void> {
    console.log('📊 Importing quotas...');
    
    const filePath = path.join(this.foundationPath, 'QUOTA.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const quotas = data.map((row: any) => {
      const quotaName = row['QUOTA'].trim();
      let type: 'ALL_INDIA' | 'STATE' | 'UNIVERSITY' | 'DNB' = 'STATE';
      
      if (quotaName.includes('ALL INDIA')) type = 'ALL_INDIA';
      else if (quotaName.includes('DNB')) type = 'DNB';
      else if (quotaName.includes('UNIVERSITY')) type = 'UNIVERSITY';
      
      return {
        name: quotaName,
        type,
        isActive: true,
      };
    });

    // Clear existing quotas
    await prisma.quota.deleteMany();
    
    // Import new quotas
    await prisma.quota.createMany({
      data: quotas,
    });

    console.log(`✅ Imported ${quotas.length} quotas`);
  }

  private async importCategories(): Promise<void> {
    console.log('📊 Importing categories...');
    
    const filePath = path.join(this.foundationPath, 'CATEGORY.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const categories = data.map((row: any) => {
      const categoryName = row['CATEGORY'].trim();
      let type: 'GENERAL' | 'RESERVED' | 'PWD' = 'GENERAL';
      
      if (categoryName.includes('PWD')) type = 'PWD';
      else if (categoryName.includes('OBC') || categoryName.includes('SC') || categoryName.includes('ST') || categoryName.includes('EWS')) type = 'RESERVED';
      
      return {
        name: categoryName,
        type,
        isActive: true,
      };
    });

    // Clear existing categories
    await prisma.category.deleteMany();
    
    // Import new categories
    await prisma.category.createMany({
      data: categories,
    });

    console.log(`✅ Imported ${categories.length} categories`);
  }

  private async importMedicalColleges(): Promise<void> {
    console.log('📊 Importing medical colleges...');
    
    const filePath = path.join(this.foundationPath, 'medical.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const colleges = data.map((row: any) => {
      const collegeName = row['medical colleges'].trim();
      const { state, address } = this.extractStateAndAddress(collegeName);
      
      return {
        name: collegeName,
        type: 'MEDICAL' as const,
        state,
        address,
        isActive: true,
        sourceFile: 'medical.xlsx',
      };
    });

    // Clear existing medical colleges
    await prisma.foundationCollege.deleteMany({
      where: { type: 'MEDICAL' }
    });
    
    // Import new medical colleges
    await prisma.foundationCollege.createMany({
      data: colleges,
    });

    console.log(`✅ Imported ${colleges.length} medical colleges`);
  }

  private async importDentalColleges(): Promise<void> {
    console.log('📊 Importing dental colleges...');
    
    const filePath = path.join(this.foundationPath, 'dental.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const colleges = data.map((row: any) => {
      const collegeName = row['dental colleges'].trim();
      const { state, address } = this.extractStateAndAddress(collegeName);
      
      return {
        name: collegeName,
        type: 'DENTAL' as const,
        state,
        address,
        isActive: true,
        sourceFile: 'dental.xlsx',
      };
    });

    // Clear existing dental colleges
    await prisma.foundationCollege.deleteMany({
      where: { type: 'DENTAL' }
    });
    
    // Import new dental colleges
    await prisma.foundationCollege.createMany({
      data: colleges,
    });

    console.log(`✅ Imported ${colleges.length} dental colleges`);
  }

  private async importDnbColleges(): Promise<void> {
    console.log('📊 Importing DNB colleges...');
    
    const filePath = path.join(this.foundationPath, 'dnb.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const colleges = data.map((row: any) => {
      const collegeName = row['dnb colleges'].trim();
      const { state, address } = this.extractStateAndAddress(collegeName);
      
      return {
        name: collegeName,
        type: 'DNB' as const,
        state,
        address,
        isActive: true,
        sourceFile: 'dnb.xlsx',
      };
    });

    // Clear existing DNB colleges
    await prisma.foundationCollege.deleteMany({
      where: { type: 'DNB' }
    });
    
    // Import new DNB colleges
    await prisma.foundationCollege.createMany({
      data: colleges,
    });

    console.log(`✅ Imported ${colleges.length} DNB colleges`);
  }

  private extractStateAndAddress(collegeName: string): { state: string | null; address: string | null } {
    // Try to extract state and address from college name
    // This is a basic implementation - you might want to enhance this
    
    const statePatterns = [
      'DELHI', 'MUMBAI', 'BANGALORE', 'CHENNAI', 'KOLKATA', 'HYDERABAD',
      'PUNE', 'AHMEDABAD', 'JAIPUR', 'LUCKNOW', 'KANPUR', 'NAGPUR',
      'INDORE', 'BHOPAL', 'COIMBATORE', 'KOCHI', 'THIRUVANANTHAPURAM',
      'MYSORE', 'MANGALORE', 'HUBLI', 'BELGAUM', 'GULBARGA', 'BIJAPUR'
    ];
    
    let state: string | null = null;
    let address: string | null = null;
    
    // Look for state patterns
    for (const pattern of statePatterns) {
      if (collegeName.toUpperCase().includes(pattern)) {
        state = pattern;
        break;
      }
    }
    
    // Extract address (everything after the first comma)
    const commaIndex = collegeName.indexOf(',');
    if (commaIndex > 0) {
      address = collegeName.substring(commaIndex + 1).trim();
    }
    
    return { state, address };
  }

  async getFoundationDataSummary(): Promise<any> {
    const states = await prisma.state.count();
    const quotas = await prisma.quota.count();
    const categories = await prisma.category.count();
    const medicalColleges = await prisma.foundationCollege.count({ where: { type: 'MEDICAL' } });
    const dentalColleges = await prisma.foundationCollege.count({ where: { type: 'DENTAL' } });
    const dnbColleges = await prisma.foundationCollege.count({ where: { type: 'DNB' } });
    
    return {
      states,
      quotas,
      categories,
      medicalColleges,
      dentalColleges,
      dnbColleges,
      totalColleges: medicalColleges + dentalColleges + dnbColleges
    };
  }
}

export default FoundationImporter;
