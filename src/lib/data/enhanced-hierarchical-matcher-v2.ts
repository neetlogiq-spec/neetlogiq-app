import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';

interface FoundationCollege {
    name: string;
    state: string;
    address: string;
    previous_name?: string;
}

interface MatchResult {
    college: FoundationCollege | null;
    algorithmUsed: 'HIERARCHICAL' | 'ENHANCED' | 'NONE';
    confidence: number;
}

export class EnhancedHierarchicalMatcher {
    private foundationColleges: FoundationCollege[] = [];
    private fuse: Fuse<FoundationCollege>;
    
    // Comprehensive state normalizations
    private readonly stateNormalizations: Record<string, string> = {
        'DELHI (NCT)': 'NEW DELHI',
        'DELHI': 'NEW DELHI',
        'NCT OF DELHI': 'NEW DELHI',
        'JAMMU & KASHMIR': 'JAMMU AND KASHMIR',
        'J&K': 'JAMMU AND KASHMIR',
        'AP': 'ANDHRA PRADESH',
        'UP': 'UTTAR PRADESH',
        'MP': 'MADHYA PRADESH',
        'UK': 'UTTARAKHAND',
        'UTTARANCHAL': 'UTTARAKHAND',
        'ORISSA': 'ODISHA',
        'PONDICHERRY': 'PUDUCHERRY',
        'MAHARASTRA': 'MAHARASHTRA',
        'CHATTISGARH': 'CHHATTISGARH',
        'JHARKAND': 'JHARKHAND'
    };

    // Comprehensive abbreviation mappings
    private readonly abbreviationMappings: Record<string, string> = {
        'AIIMS': 'ALL INDIA INSTITUTE OF MEDICAL SCIENCES',
        'PGIMER': 'POST GRADUATE INSTITUTE OF MEDICAL EDUCATION AND RESEARCH',
        'ESIC': 'EMPLOYEES STATE INSURANCE CORPORATION',
        'ESI': 'EMPLOYEES STATE INSURANCE',
        'GMC': 'GOVERNMENT MEDICAL COLLEGE',
        'GMCH': 'GOVERNMENT MEDICAL COLLEGE AND HOSPITAL',
        'VMMC': 'VARDHMAN MAHAVIR MEDICAL COLLEGE',
        'MAMC': 'MAULANA AZAD MEDICAL COLLEGE',
        'LHMC': 'LADY HARDINGE MEDICAL COLLEGE',
        'UCMS': 'UNIVERSITY COLLEGE OF MEDICAL SCIENCES',
        'JIPMER': 'JAWAHARLAL INSTITUTE OF POSTGRADUATE MEDICAL EDUCATION AND RESEARCH',
        'KGMU': 'KING GEORGE MEDICAL UNIVERSITY',
        'SGPGI': 'SANJAY GANDHI POSTGRADUATE INSTITUTE OF MEDICAL SCIENCES',
        'IPGMER': 'INSTITUTE OF POST GRADUATE MEDICAL EDUCATION AND RESEARCH',
        'SSKM': 'SETH SUKHLAL KARNANI MEMORIAL',
        'SMS': 'SAWAI MAN SINGH',
        'SNMC': 'SAROJINI NAIDU MEDICAL COLLEGE',
        'GSVM': 'GANESH SHANKAR VIDYARTHI MEMORIAL',
        'LLRM': 'LALA LAJPAT RAI MEMORIAL',
        'RIMS': 'RAJENDRA INSTITUTE OF MEDICAL SCIENCES',
        'PMCH': 'PATNA MEDICAL COLLEGE AND HOSPITAL',
        'DMCH': 'DARBHANGA MEDICAL COLLEGE AND HOSPITAL',
        'NMCH': 'NALANDA MEDICAL COLLEGE AND HOSPITAL',
        'VMMC': 'VARDHMAN MAHAVIR MEDICAL COLLEGE',
        'LNJP': 'LOK NAYAK JAI PRAKASH',
        'RML': 'RAM MANOHAR LOHIA',
        'BJMC': 'B J MEDICAL COLLEGE',
        'KGMC': 'KING GEORGE MEDICAL COLLEGE'
    };

    // Common typos and variations
    private readonly typoCorrections: Record<string, string> = {
        'VARDHAMAN': 'VARDHMAN',
        'VARDMAN': 'VARDHMAN',
        'JAWAHAR LAL': 'JAWAHARLAL',
        'JAWAHAR LAAL': 'JAWAHARLAL',
        'JAWAHARLAAL': 'JAWAHARLAL',
        'RAJENDRA PRASAD': 'RAJENDRA PRASAD',
        'RAJINDRA': 'RAJENDRA',
        'RAJINDER': 'RAJENDRA',
        'GOVIND': 'GOBIND',
        'GOVINDH': 'GOBIND',
        'INSTITUTE': 'INSTITUTE',
        'INSTITUE': 'INSTITUTE',
        'INSITUTE': 'INSTITUTE',
        'COLLAGE': 'COLLEGE',
        'COLEGE': 'COLLEGE',
        'HOSPITOL': 'HOSPITAL',
        'HOSPTIAL': 'HOSPITAL',
        'MEDICLE': 'MEDICAL',
        'MEDICAAL': 'MEDICAL',
        'MADICAL': 'MEDICAL'
    };

    constructor() {
        this.loadFoundationData();
        this.initializeFuzzySearch();
    }

    private loadFoundationData(): void {
        const dataPath = path.join(process.cwd(), 'data', 'updated-foundation-colleges.json');
        this.foundationColleges = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    }

    private initializeFuzzySearch(): void {
        this.fuse = new Fuse(this.foundationColleges, {
            keys: ['name', 'previous_name'],
            includeScore: true,
            threshold: 0.4,
            minMatchCharLength: 3,
            ignoreLocation: true
        });
    }

    private normalizeState(state: string): string {
        return this.stateNormalizations[state] || state;
    }

    private expandAbbreviations(name: string): string {
        let expandedName = name;
        for (const [abbr, full] of Object.entries(this.abbreviationMappings)) {
            // Match abbreviation as a whole word
            const regex = new RegExp(`\\b${abbr}\\b`, 'g');
            if (regex.test(name)) {
                expandedName = name.replace(regex, full);
            }
        }
        return expandedName;
    }

    private correctTypos(name: string): string {
        let correctedName = name;
        for (const [typo, correction] of Object.entries(this.typoCorrections)) {
            const regex = new RegExp(typo, 'gi');
            correctedName = correctedName.replace(regex, correction);
        }
        return correctedName;
    }

    private extractCollegeName(fullName: string): string {
        // Extract name before first comma
        const parts = fullName.split(',');
        const name = parts[0].trim();

        // Handle cases with parentheses
        const parenMatch = name.match(/^(.+?)\s*\(([^)]+)\)$/);
        if (parenMatch) {
            const currentName = parenMatch[1].trim();
            const prevName = parenMatch[2].trim();
            // Return both names for matching
            return `${currentName}|${prevName}`;
        }

        return name;
    }

    public async match(collegeName: string, state: string): Promise<MatchResult> {
        // PHASE 1: Pre-processing
        const normalizedState = this.normalizeState(state);
        const correctedName = this.correctTypos(collegeName);
        const expandedName = this.expandAbbreviations(correctedName);
        
        // Try YOUR algorithm with each variant
        const variants = [
            expandedName,
            correctedName,
            collegeName
        ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates

        for (const variant of variants) {
            const result = await this.runHierarchicalAlgorithm(variant, normalizedState);
            if (result.college) {
                return result;
            }
        }

        // If YOUR algorithm fails, try enhanced matching
        return this.runEnhancedMatching(expandedName, normalizedState);
    }

    private async runHierarchicalAlgorithm(collegeName: string, state: string): Promise<MatchResult> {
        // Step 1: State Filter
        const stateColleges = this.foundationColleges.filter(c => c.state === state);
        if (stateColleges.length === 0) {
            return { college: null, algorithmUsed: 'HIERARCHICAL', confidence: 0 };
        }

        // Step 2: Extract Names (handle both current and previous names)
        const extractedNames = this.extractCollegeName(collegeName).split('|');
        
        // Step 3: Try exact matches
        for (const name of extractedNames) {
            const exactMatch = stateColleges.find(c => 
                c.name === name || c.previous_name === name
            );
            if (exactMatch) {
                return { college: exactMatch, algorithmUsed: 'HIERARCHICAL', confidence: 1 };
            }
        }

        // Step 4: Try partial matches
        for (const name of extractedNames) {
            const partialMatches = stateColleges.filter(c => 
                c.name.includes(name) || (c.previous_name && c.previous_name.includes(name))
            );
            if (partialMatches.length === 1) {
                return { college: partialMatches[0], algorithmUsed: 'HIERARCHICAL', confidence: 0.9 };
            }
        }

        // Step 5: Try fuzzy matching within state
        const stateSpecificFuse = new Fuse(stateColleges, {
            keys: ['name', 'previous_name'],
            includeScore: true,
            threshold: 0.3
        });

        const fuzzyResults = stateSpecificFuse.search(collegeName);
        if (fuzzyResults.length > 0 && fuzzyResults[0].score !== undefined && fuzzyResults[0].score < 0.2) {
            return { 
                college: fuzzyResults[0].item,
                algorithmUsed: 'HIERARCHICAL',
                confidence: 1 - (fuzzyResults[0].score || 0)
            };
        }

        return { college: null, algorithmUsed: 'HIERARCHICAL', confidence: 0 };
    }

    private async runEnhancedMatching(collegeName: string, state: string): Promise<MatchResult> {
        // Try with more relaxed fuzzy search
        const relaxedFuse = new Fuse(this.foundationColleges, {
            keys: ['name', 'previous_name'],
            includeScore: true,
            threshold: 0.6,
            ignoreLocation: true
        });

        const relaxedResults = relaxedFuse.search(collegeName)
            .filter(r => r.item.state === state)
            .slice(0, 1);

        if (relaxedResults.length > 0 && relaxedResults[0].score !== undefined && relaxedResults[0].score < 0.4) {
            return {
                college: relaxedResults[0].item,
                algorithmUsed: 'ENHANCED',
                confidence: 1 - (relaxedResults[0].score || 0)
            };
        }

        return { college: null, algorithmUsed: 'NONE', confidence: 0 };
    }
}
