import * as XLSX from 'xlsx';

interface CollegeData {
    state: string;
    name: string;
    address: string;
    type: 'MEDICAL' | 'DENTAL' | 'DNB';
}

export class PivotTableReader {
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
     * Read the pivot table data from Sheet 2
     */
    public readPivotData(): CollegeData[] {
        if (!this.workbook) {
            throw new Error('No workbook loaded. Call loadFile() first.');
        }

        // Get Sheet 2 (pivot table)
        const sheetName = this.workbook.SheetNames[1]; // Sheet 2
        const worksheet = this.workbook.Sheets[sheetName];

        // Convert to JSON while preserving empty cells
        const rawData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: null,
            blankrows: true
        }) as (string | null)[][];

        const colleges: CollegeData[] = [];
        let currentState: string | null = null;
        let currentCollege: string | null = null;
        let currentAddress: string | null = null;

        // Process each row
        for (const row of rawData) {
            if (!row || row.length === 0) continue;
            
            // Skip the Grand Total row
            if (row[0] === 'Grand Total') break;

            // Clean and normalize the cell value
            const cellValue = this.normalizeCell(row[0]);
            if (!cellValue) continue;

            // Determine the row type and update current context
            if (this.isStateRow(row)) {
                currentState = cellValue;
                currentCollege = null;
                currentAddress = null;
            } else if (this.isCollegeRow(row)) {
                currentCollege = cellValue;
            } else if (this.isAddressRow(row) && currentState && currentCollege) {
                currentAddress = cellValue;
                
                // Add complete college entry
                colleges.push({
                    state: currentState,
                    name: currentCollege,
                    address: currentAddress,
                    type: this.type
                });
            }
        }

        return colleges;
    }

    /**
     * Normalize cell content
     */
    private normalizeCell(value: string | null): string | null {
        if (!value) return null;
        
        // Convert to string and trim
        const cleaned = value.toString().trim();
        if (!cleaned) return null;

        // Remove multiple spaces and convert to uppercase
        return cleaned.replace(/\\s+/g, ' ').toUpperCase();
    }

    /**
     * Check if row represents a state entry
     */
    private isStateRow(row: (string | null)[]): boolean {
        const cell = this.normalizeCell(row[0]);
        if (!cell) return false;

        // States typically don't have special characters and are shorter
        return cell.length < 50 && !/[^A-Z\\s&]/.test(cell);
    }

    /**
     * Check if row represents a college entry
     */
    private isCollegeRow(row: (string | null)[]): boolean {
        const cell = this.normalizeCell(row[0]);
        if (!cell) return false;

        // Colleges typically have longer names and may include special characters
        return cell.length > 5 && !/^(Grand Total|Total)$/i.test(cell);
    }

    /**
     * Check if row represents an address entry
     */
    private isAddressRow(row: (string | null)[]): boolean {
        const cell = this.normalizeCell(row[0]);
        if (!cell) return false;

        // Addresses typically contain numbers, special characters, or specific words
        return /[0-9]|ROAD|STREET|DISTRICT|PIN|[,\\-\\/]/.test(cell);
    }
}