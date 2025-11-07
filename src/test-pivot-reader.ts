import { PivotTableReader } from './lib/excel/PivotTableReader';
import * as path from 'path';

const FOUNDATION_DIR = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION';

async function main() {
    try {
        // Test medical admissions file
        const medicalReader = new PivotTableReader('MEDICAL');
        medicalReader.loadFile(path.join(FOUNDATION_DIR, 'med ad.xlsx'));
        const medicalData = medicalReader.readPivotData();
        
        console.log('\nMedical Colleges Sample:');
        console.log(medicalData.slice(0, 3));
        console.log(`Total Medical Colleges: ${medicalData.length}`);

        // Test dental admissions file
        const dentalReader = new PivotTableReader('DENTAL');
        dentalReader.loadFile(path.join(FOUNDATION_DIR, 'dental ad.xlsx'));
        const dentalData = dentalReader.readPivotData();
        
        console.log('\nDental Colleges Sample:');
        console.log(dentalData.slice(0, 3));
        console.log(`Total Dental Colleges: ${dentalData.length}`);

        // Test DNB admissions file
        const dnbReader = new PivotTableReader('DNB');
        dnbReader.loadFile(path.join(FOUNDATION_DIR, 'dnb ad.xlsx'));
        const dnbData = dnbReader.readPivotData();
        
        console.log('\nDNB Colleges Sample:');
        console.log(dnbData.slice(0, 3));
        console.log(`Total DNB Colleges: ${dnbData.length}`);

        // Print states summary
        const states = new Set([
            ...medicalData.map(c => c.state),
            ...dentalData.map(c => c.state),
            ...dnbData.map(c => c.state)
        ]);
        
        console.log('\nUnique States:', Array.from(states).sort());
    } catch (error) {
        console.error('Error:', error);
    }
}

main();