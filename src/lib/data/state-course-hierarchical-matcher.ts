import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';

interface FoundationCollege {
    name: string;
    state: string;
    address: string;
    previous_name?: string;
    type?: 'MEDICAL' | 'DENTAL' | 'HOSPITAL' | 'INSTITUTE' | 'OTHER';
}

interface MatchResult {
    college: FoundationCollege | null;
    algorithmUsed: 'HIERARCHICAL' | 'ENHANCED' | 'NONE';
    confidence: number;
    searchSpaceReduction: string;
}

export class StateCourseHierarchicalMatcher {
    private foundationColleges: FoundationCollege[] = [];
    private collegesByStateAndType: Record<string, Record<string, FoundationCollege[]>> = {};
    
    // Core mappings from your original algorithm
    private readonly stateMap: Record<string, string> = {
        'DELHI (NCT)': 'NEW DELHI',
        'DELHI': 'NEW DELHI',
        'JAMMU & KASHMIR': 'JAMMU AND KASHMIR',
        'ORISSA': 'ODISHA',
        'PONDICHERRY': 'PUDUCHERRY',
        'UTTARANCHAL': 'UTTARAKHAND'
    };

    // Course type mappings
    private readonly courseTypeMap: Record<string, string> = {
        'MD IN': 'MEDICAL',
        'MS IN': 'MEDICAL',
        'DNB IN': 'MEDICAL', // DNB courses are medical postgraduate
        'MDS IN': 'DENTAL',
        'BDS': 'DENTAL',
        'MBBS': 'MEDICAL',
        'DIPLOMA IN': 'MEDICAL' // Most diplomas are medical
    };

    // College type detection patterns (order matters - most specific first)
    private readonly collegeTypePatterns = [
        { pattern: /DENTAL COLLEGE/i, type: 'DENTAL' as const },
        { pattern: /MEDICAL COLLEGE/i, type: 'MEDICAL' as const },
        { pattern: /INSTITUTE OF MEDICAL SCIENCES/i, type: 'MEDICAL' as const },
        { pattern: /INSTITUTE OF DENTAL/i, type: 'DENTAL' as const },
        { pattern: /HOSPITAL/i, type: 'HOSPITAL' as const },
        { pattern: /INSTITUTE/i, type: 'INSTITUTE' as const }
    ];

    // Common corrections and variations
    private readonly corrections: Record<string, string> = {
        'JAWAHAR LAL': 'JAWAHARLAL',
        'VARDHAMAN': 'VARDHMAN',
        'SETH GORDHANDAS SUNDERDAS MEDICAL COLLEGE': 'SETH GS MEDICAL COLLEGE',
        'M P SHAH': 'MP SHAH',
        'SBKS MEDICAL COLLEGE AND RESEARCH CENTRE': 'SBKS MEDICAL INSTITUTE AND RESEARCH CENTRE',
        'RAVINDRA NATH TAGORE MEDICAL COLLEGE': 'R N T MEDICAL COLLEGE',
        'R N T MEDICAL COLLEGE': 'RAVINDRA NATH TAGORE MEDICAL COLLEGE'
    };

    constructor() {
        this.loadFoundationData();
        this.classifyColleges();
        this.organizeByStateAndType();
    }

    private loadFoundationData(): void {
        const dataPath = path.join(process.cwd(), 'data', 'updated-foundation-colleges.json');
        this.foundationColleges = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    }

    private classifyColleges(): void {
        // Classify each college by type
        this.foundationColleges.forEach(college => {
            for (const { pattern, type } of this.collegeTypePatterns) {
                if (pattern.test(college.name)) {
                    college.type = type;
                    break;
                }
            }
            if (!college.type) {
                college.type = 'OTHER';
            }
        });
    }

    private organizeByStateAndType(): void {
        // Group colleges by state and type for efficient filtering
        this.collegesByStateAndType = {};
        
        this.foundationColleges.forEach(college => {
            if (!this.collegesByStateAndType[college.state]) {
                this.collegesByStateAndType[college.state] = {};
            }
            if (!this.collegesByStateAndType[college.state][college.type!]) {
                this.collegesByStateAndType[college.state][college.type!] = [];
            }
            this.collegesByStateAndType[college.state][college.type!].push(college);
        });
    }

    private getCourseType(course: string): string {
        for (const [pattern, type] of Object.entries(this.courseTypeMap)) {
            if (course.includes(pattern)) {
                return type;
            }
        }
        return 'MEDICAL'; // Default to medical if unclear
    }

    private normalizeState(state: string): string {
        return this.stateMap[state] || state;
    }

    private extractCollegeName(fullName: string): string {
        // Extract name before first comma as per your specification
        return fullName.split(',')[0].trim();
    }

    private applyCorrections(name: string): string {
        let correctedName = name;
        for (const [wrong, right] of Object.entries(this.corrections)) {
            if (name.includes(wrong)) {
                correctedName = name.replace(wrong, right);
            }
        }
        return correctedName;
    }

    public async match(collegeName: string, state: string, course: string): Promise<MatchResult> {
        // Step 1: YOUR Algorithm - State Filter FIRST
        const normalizedState = this.normalizeState(state);
        const stateColleges = this.collegesByStateAndType[normalizedState] || {};
        const totalStateColleges = Object.values(stateColleges).flat().length;
        
        if (totalStateColleges === 0) {
            return { 
                college: null, 
                algorithmUsed: 'HIERARCHICAL', 
                confidence: 0,
                searchSpaceReduction: `No colleges in ${normalizedState}`
            };
        }

        // Step 2: NEW - Course Type Filter
        const courseType = this.getCourseType(course);
        const typeColleges = stateColleges[courseType] || [];
        
        const searchSpaceReduction = `${this.foundationColleges.length} → ${totalStateColleges} → ${typeColleges.length} (${((1 - typeColleges.length/this.foundationColleges.length) * 100).toFixed(1)}% reduction)`;
        
        if (typeColleges.length === 0) {
            return { 
                college: null, 
                algorithmUsed: 'HIERARCHICAL', 
                confidence: 0,
                searchSpaceReduction
            };
        }

        // Step 3: YOUR Algorithm - Extract Clean Name
        const cleanName = this.extractCollegeName(collegeName);
        
        // Step 4: YOUR Algorithm - Try Exact Match within State + Type
        const exactMatch = typeColleges.find(c => 
            c.name === cleanName || 
            (c.previous_name && c.previous_name === cleanName)
        );
        
        if (exactMatch) {
            return { 
                college: exactMatch, 
                algorithmUsed: 'HIERARCHICAL', 
                confidence: 1.0,
                searchSpaceReduction
            };
        }

        // Step 5: YOUR Algorithm - Try with Corrections
        const correctedName = this.applyCorrections(cleanName);
        if (correctedName !== cleanName) {
            const correctedMatch = typeColleges.find(c => 
                c.name === correctedName || 
                (c.previous_name && c.previous_name === correctedName)
            );
            
            if (correctedMatch) {
                return { 
                    college: correctedMatch, 
                    algorithmUsed: 'HIERARCHICAL', 
                    confidence: 0.95,
                    searchSpaceReduction
                };
            }
        }

        // Step 6: YOUR Algorithm - Try Partial Match within State + Type
        const partialMatches = typeColleges.filter(c => 
            c.name.includes(cleanName) || 
            cleanName.includes(c.name) ||
            (c.previous_name && (c.previous_name.includes(cleanName) || cleanName.includes(c.previous_name)))
        );

        if (partialMatches.length === 1) {
            return { 
                college: partialMatches[0], 
                algorithmUsed: 'HIERARCHICAL', 
                confidence: 0.9,
                searchSpaceReduction
            };
        }

        // Step 7: YOUR Algorithm - Fuzzy Match within State + Type Only
        const fuse = new Fuse(typeColleges, {
            keys: ['name', 'previous_name'],
            includeScore: true,
            threshold: 0.3,
            minMatchCharLength: 5
        });

        const fuzzyResults = fuse.search(cleanName);
        if (fuzzyResults.length > 0 && fuzzyResults[0].score !== undefined && fuzzyResults[0].score < 0.2) {
            return { 
                college: fuzzyResults[0].item,
                algorithmUsed: 'HIERARCHICAL',
                confidence: 1 - (fuzzyResults[0].score || 0),
                searchSpaceReduction
            };
        }

        // Try fuzzy with corrected name
        if (correctedName !== cleanName) {
            const correctedFuzzyResults = fuse.search(correctedName);
            if (correctedFuzzyResults.length > 0 && correctedFuzzyResults[0].score !== undefined && correctedFuzzyResults[0].score < 0.2) {
                return { 
                    college: correctedFuzzyResults[0].item,
                    algorithmUsed: 'HIERARCHICAL',
                    confidence: 1 - (correctedFuzzyResults[0].score || 0),
                    searchSpaceReduction
                };
            }
        }

        return { 
            college: null, 
            algorithmUsed: 'NONE', 
            confidence: 0,
            searchSpaceReduction
        };
    }

    public getStats(): any {
        const stateStats = Object.entries(this.collegesByStateAndType).map(([state, types]) => ({
            state,
            total: Object.values(types).flat().length,
            medical: types.MEDICAL?.length || 0,
            dental: types.DENTAL?.length || 0,
            hospital: types.HOSPITAL?.length || 0,
            institute: types.INSTITUTE?.length || 0,
            other: types.OTHER?.length || 0
        }));

        return {
            totalColleges: this.foundationColleges.length,
            stateStats: stateStats.sort((a, b) => b.total - a.total)
        };
    }
}
