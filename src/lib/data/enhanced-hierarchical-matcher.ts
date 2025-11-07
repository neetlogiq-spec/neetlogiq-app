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
    debug?: any;
}

export class EnhancedHierarchicalMatcher {
    private foundationColleges: FoundationCollege[] = [];
    private fuse: Fuse<FoundationCollege>;
    
    // Comprehensive typo corrections
    private readonly typoCorrections: Record<string, string> = {
        'VARDHAMAN': 'VARDHMAN',
        'JAWAHAR LAL': 'JAWAHARLAL',
        'PGIMER': 'POST GRADUATE INSTITUTE OF MEDICAL EDUCATION AND RESEARCH',
        'ESIC': 'EMPLOYEES STATE INSURANCE CORPORATION',
        'SMS': 'SAWAI MAN SINGH',
        'SNMC': 'SAROJINI NAIDU MEDICAL COLLEGE',
        'VMMC': 'VARDHMAN MAHAVIR MEDICAL COLLEGE',
        'MAMC': 'MAULANA AZAD MEDICAL COLLEGE',
        'AIIMS': 'ALL INDIA INSTITUTE OF MEDICAL SCIENCES',
        'GMC': 'GOVERNMENT MEDICAL COLLEGE'
    };

    // State normalizations
    private readonly stateNormalizations: Record<string, string> = {
        'DELHI (NCT)': 'NEW DELHI',
        'DELHI': 'NEW DELHI',
        'JAMMU & KASHMIR': 'JAMMU AND KASHMIR',
        'J&K': 'JAMMU AND KASHMIR',
        'AP': 'ANDHRA PRADESH',
        'UP': 'UTTAR PRADESH',
        'MP': 'MADHYA PRADESH'
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
            minMatchCharLength: 3
        });
    }

    public async match(collegeName: string, state: string): Promise<MatchResult> {
        // PHASE 1: Pre-processing (before your algorithm)
        const normalizedState = this.normalizeState(state);
        const correctedName = this.applyTypoCorrections(collegeName);
        const expandedName = this.expandAbbreviations(correctedName);
        
        // PHASE 2: Your Hierarchical Algorithm (with cleaned data)
        const hierarchicalMatch = await this.runHierarchicalAlgorithm(expandedName, normalizedState);
        if (hierarchicalMatch.college) {
            return {
                college: hierarchicalMatch.college,
                algorithmUsed: 'HIERARCHICAL',
                confidence: hierarchicalMatch.confidence
            };
        }

        // PHASE 3: Enhanced Fallbacks (only if your algorithm doesn't find a match)
        return this.runEnhancedFallbacks(expandedName, normalizedState);
    }

    private normalizeState(state: string): string {
        return this.stateNormalizations[state] || state;
    }

    private applyTypoCorrections(name: string): string {
        let correctedName = name;
        for (const [typo, correction] of Object.entries(this.typoCorrections)) {
            if (name.includes(typo)) {
                correctedName = name.replace(typo, correction);
            }
        }
        return correctedName;
    }

    private expandAbbreviations(name: string): string {
        // Add any specific abbreviation expansions here
        return name;
    }

    private extractCollegeName(fullName: string): string {
        return fullName.split(',')[0].trim();
    }

    private async runHierarchicalAlgorithm(collegeName: string, state: string): Promise<MatchResult> {
        // Step 1: State Filter
        const stateColleges = this.foundationColleges.filter(c => c.state === state);
        if (stateColleges.length === 0) {
            return { college: null, algorithmUsed: 'HIERARCHICAL', confidence: 0 };
        }

        // Step 2: Name Match
        const exactMatch = stateColleges.find(c => 
            c.name === collegeName || c.previous_name === collegeName
        );
        if (exactMatch) {
            return { college: exactMatch, algorithmUsed: 'HIERARCHICAL', confidence: 1 };
        }

        // Step 3: Location Disambiguation
        const sameNameColleges = stateColleges.filter(c => 
            c.name.includes(collegeName) || (c.previous_name && c.previous_name.includes(collegeName))
        );
        if (sameNameColleges.length === 1) {
            return { college: sameNameColleges[0], algorithmUsed: 'HIERARCHICAL', confidence: 0.9 };
        }

        // Step 4: Fuzzy Match within State
        const fuzzyResults = this.fuse.search(collegeName)
            .filter(r => r.item.state === state)
            .slice(0, 1);

        if (fuzzyResults.length > 0 && fuzzyResults[0].score !== undefined && fuzzyResults[0].score < 0.2) {
            return { 
                college: fuzzyResults[0].item, 
                algorithmUsed: 'HIERARCHICAL', 
                confidence: 1 - (fuzzyResults[0].score || 0)
            };
        }

        return { college: null, algorithmUsed: 'HIERARCHICAL', confidence: 0 };
    }

    private async runEnhancedFallbacks(collegeName: string, state: string): Promise<MatchResult> {
        // Try with a more relaxed fuzzy search
        const relaxedFuse = new Fuse(this.foundationColleges, {
            keys: ['name', 'previous_name'],
            includeScore: true,
            threshold: 0.6
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
