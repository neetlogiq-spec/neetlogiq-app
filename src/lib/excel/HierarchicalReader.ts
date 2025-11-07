interface CollegeData {
    state: string;
    name: string;
    address: string;
    type: 'MEDICAL' | 'DENTAL' | 'DNB';
}

import * as XLSX from 'xlsx';

export class HierarchicalReader {
    private workbook: XLSX.WorkBook | null = null;
    private type: CollegeData['type'];

    constructor(type: CollegeData['type']) {
        this.type = type;
    }

    /**
     * Load an Excel file
     */
    public loadFile(filePath: string): void {
        this.workbook = XLSX.readFile(filePath);
    }

    /**
     * Read the hierarchical pivot data from Sheet 2
     */
    public readHierarchicalData(): CollegeData[] {
        if (!this.workbook) {
            throw new Error('No workbook loaded. Call loadFile() first.');
        }

        // Get Sheet2 (hierarchical pivot table)
        const worksheet = this.workbook.Sheets['Sheet2'];
        if (!worksheet) {
            throw new Error('Sheet2 not found in workbook');
        }

        // Convert to JSON while preserving structure
        const rawData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '',
            blankrows: false
        }) as (string | null)[][];

        const colleges: CollegeData[] = [];
        let currentState: string | null = null;
        let pendingCollege: string | null = null;

        // Process each row
        for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || !row[0]) continue;
            
            const cellValue = this.normalizeCell(row[0]);
            if (!cellValue || cellValue === 'GRAND TOTAL') continue;

            // Skip category header (MEDICAL/DENTAL/DNB)
            if (cellValue === this.type) continue;

            // Determine row type and process accordingly
            if (this.isState(cellValue)) {
                // New state found
                currentState = cellValue;
                pendingCollege = null;
            } else if (this.isCollege(cellValue)) {
                // College found - save for next address
                if (currentState) {
                    pendingCollege = cellValue;
                }
            } else if (this.isAddress(cellValue)) {
                // Address found - complete college entry if we have pending college
                if (currentState && pendingCollege) {
                    colleges.push({
                        state: currentState,
                        name: pendingCollege,
                        address: cellValue,
                        type: this.type
                    });
                    pendingCollege = null; // Reset pending college
                }
            }
        }

        return colleges;
    }

    /**
     * Normalize cell content
     */
    private normalizeCell(value: string | null): string | null {
        if (!value) return null;
        
        const cleaned = value.toString().trim();
        if (!cleaned) return null;

        // Remove multiple spaces and convert to uppercase
        return cleaned.replace(/\\s+/g, ' ').toUpperCase();
    }

    /**
     * Check if cell value represents a state
     */
    private isState(text: string): boolean {
        const states = [
            'ANDAMAN', 'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR',
            'CHANDIGARH', 'CHHATTISGARH', 'DADRA', 'DAMAN', 'DELHI', 'GOA',
            'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JAMMU', 'JHARKHAND',
            'KARNATAKA', 'KERALA', 'LADAKH', 'LAKSHADWEEP', 'MADHYA PRADESH',
            'MAHARASHTRA', 'MANIPUR', 'MEGHALAYA', 'MIZORAM', 'NAGALAND',
            'ORISSA', 'ODISHA', 'PUDUCHERRY', 'PUNJAB', 'RAJASTHAN', 'SIKKIM',
            'TAMIL NADU', 'TELANGANA', 'TRIPURA', 'UTTAR PRADESH', 'UTTARAKHAND',
            'WEST BENGAL', 'CHATTISGARH'
        ];
        
        return states.some(state => text.includes(state));
    }

    /**
     * Check if cell value represents a college/institute
     */
    private isCollege(text: string): boolean {
        // Colleges contain these keywords and are longer than typical addresses
        return (text.includes('COLLEGE') || 
                text.includes('INSTITUTE') || 
                text.includes('UNIVERSITY') || 
                text.includes('HOSPITAL')) &&
               text.length > 15; // Colleges typically have longer names
    }

    /**
     * Check if cell value represents an address
     */
    private isAddress(text: string): boolean {
        // Addresses have numbers, location indicators, or are short place names
        const hasLocationIndicators = /[0-9]|ROAD|STREET|DISTRICT|PIN|NAGAR|PET|COLONY|[,\\-]/.test(text);
        const isShortPlaceName = text.length < 30 && 
                                !/COLLEGE|INSTITUTE|UNIVERSITY|HOSPITAL|MEDICAL|DENTAL/.test(text);
        
        return hasLocationIndicators || isShortPlaceName;
    }
}