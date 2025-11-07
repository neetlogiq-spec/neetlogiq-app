#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';

const UNMATCHED_COLLEGES_PATH = path.join(process.cwd(), 'data', 'COMPLETE_UNMATCHED_COLLEGES.json');
const FOUNDATION_COLLEGES_PATH = path.join(process.cwd(), 'data', 'updated-foundation-colleges.json');

interface UnmatchedCollege {
    college: string;
    state: string;
    full_name: string;
    record_count: number;
}

interface FoundationCollege {
    name: string;
    state: string;
    address: string;
    previous_name?: string;
}

class DiagnosticTracer {
    private foundationColleges: FoundationCollege[] = [];
    private fuse!: Fuse<FoundationCollege>;
    private stateNormalizations: Record<string, string> = {
        'DELHI (NCT)': 'NEW DELHI',
        'DELHI': 'NEW DELHI',
        'JAMMU & KASHMIR': 'JAMMU AND KASHMIR',
        // Add more state normalizations as needed
    };

    private typoCorrections: Record<string, string> = {
        'VARDHAMAN': 'VARDHMAN',
        'JAWAHAR LAL': 'JAWAHARLAL',
        'PGIMER': 'POST GRADUATE INSTITUTE OF MEDICAL EDUCATION AND RESEARCH',
        'ESIC': 'EMPLOYEES STATE INSURANCE CORPORATION',
        // Add more typo corrections as needed
    };

    constructor() {
        this.loadFoundationData();
        this.initializeFuzzySearch();
    }

    private loadFoundationData(): void {
        console.log('📚 Loading foundation data...');
        this.foundationColleges = JSON.parse(fs.readFileSync(FOUNDATION_COLLEGES_PATH, 'utf-8'));
        console.log(`✅ Loaded ${this.foundationColleges.length} foundation colleges.`);
    }

    private initializeFuzzySearch(): void {
        console.log('🔍 Initializing fuzzy search...');
        this.fuse = new Fuse(this.foundationColleges, {
            keys: ['name', 'previous_name'],
            includeScore: true,
            threshold: 0.4,
            minMatchCharLength: 3
        });
    }

    private normalizeState(state: string): string {
        return this.stateNormalizations[state] || state;
    }

    private extractCollegeName(fullName: string): string {
        // Extract name before first comma as per your specification
        return fullName.split(',')[0].trim();
    }

    private applyTypoCorrections(name: string): string {
        let correctedName = name;
        for (const [typo, correction] of Object.entries(this.typoCorrections)) {
            if (name.includes(typo)) {
                correctedName = name.replace(typo, correction);
                console.log(`    📝 Typo correction: "${typo}" → "${correction}"`);
            }
        }
        return correctedName;
    }

    private async runHierarchicalMatch(college: UnmatchedCollege): Promise<FoundationCollege | null> {
        console.log('\n🎯 YOUR Hierarchical Algorithm Analysis:');
        console.log('----------------------------------------');

        // Step 1: Data Correction
        console.log('\n  1️⃣ Step 1: Data Correction');
        const normalizedState = this.normalizeState(college.state);
        console.log(`    🔄 State normalization: "${college.state}" → "${normalizedState}"`);

        // Step 2: State Filter
        console.log('\n  2️⃣ Step 2: State Filter');
        const stateColleges = this.foundationColleges.filter(c => c.state === normalizedState);
        console.log(`    📊 Found ${stateColleges.length} colleges in ${normalizedState}`);

        if (stateColleges.length === 0) {
            console.log(`    ❌ No colleges found in state "${normalizedState}"`);
            return null;
        }

        // Step 3: Name Match
        console.log('\n  3️⃣ Step 3: Name Match');
        const extractedName = this.extractCollegeName(college.full_name);
        console.log(`    🔍 Extracted name: "${extractedName}"`);

        const exactMatch = stateColleges.find(c => 
            c.name === extractedName || c.previous_name === extractedName
        );

        if (exactMatch) {
            console.log(`    ✅ Found exact match: "${exactMatch.name}"`);
            return exactMatch;
        }

        // Step 4: Location Disambiguation
        console.log('\n  4️⃣ Step 4: Location Disambiguation');
        const sameNameColleges = stateColleges.filter(c => 
            c.name.includes(extractedName) || (c.previous_name && c.previous_name.includes(extractedName))
        );

        if (sameNameColleges.length > 0) {
            console.log(`    📍 Found ${sameNameColleges.length} colleges with similar names:`);
            sameNameColleges.forEach(c => console.log(`       - ${c.name} (${c.address})`));
        } else {
            console.log('    ❌ No colleges with similar names found');
        }

        // Step 5: Fuzzy Fallback
        console.log('\n  5️⃣ Step 5: Fuzzy Fallback');
        const fuzzyResults = this.fuse.search(extractedName)
            .filter(r => r.item.state === normalizedState)
            .slice(0, 3);

        if (fuzzyResults.length > 0) {
            console.log('    📊 Top fuzzy matches:');
            fuzzyResults.forEach((r, i) => {
                console.log(`       ${i + 1}. "${r.item.name}" (score: ${r.score?.toFixed(4)})`);
            });
        } else {
            console.log('    ❌ No fuzzy matches found');
        }

        // Step 6: Confidence Scoring
        console.log('\n  6️⃣ Step 6: Confidence Scoring');
        if (fuzzyResults.length > 0 && fuzzyResults[0].score !== undefined && fuzzyResults[0].score < 0.2) {
            console.log(`    ✅ High confidence match found: "${fuzzyResults[0].item.name}"`);
            return fuzzyResults[0].item;
        }

        console.log('    ❌ No high-confidence matches found');
        return null;
    }

    private async runEnhancedFallbacks(college: UnmatchedCollege): Promise<void> {
        console.log('\n🔧 Enhanced Fallback Analysis:');
        console.log('-----------------------------');

        // Try typo correction
        console.log('\n  1️⃣ Typo Tolerance:');
        const correctedName = this.applyTypoCorrections(college.college);
        if (correctedName !== college.college) {
            const fuzzyResults = this.fuse.search(correctedName)
                .filter(r => r.item.state === this.normalizeState(college.state))
                .slice(0, 3);

            if (fuzzyResults.length > 0) {
                console.log('    📊 Matches after typo correction:');
                fuzzyResults.forEach((r, i) => {
                    console.log(`       ${i + 1}. "${r.item.name}" (score: ${r.score?.toFixed(4)})`);
                });
            }
        }

        // Try abbreviation expansion
        console.log('\n  2️⃣ Abbreviation Check:');
        if (college.college.match(/[A-Z]{2,}/)) {
            console.log(`    🔍 Found potential abbreviation: "${college.college}"`);
            // Add specific abbreviation handling logic here
        }

        // Try Fuse.js with relaxed threshold
        console.log('\n  3️⃣ Relaxed Fuzzy Search:');
        const relaxedFuse = new Fuse(this.foundationColleges, {
            keys: ['name', 'previous_name'],
            includeScore: true,
            threshold: 0.6  // More lenient threshold
        });

        const relaxedResults = relaxedFuse.search(college.college)
            .filter(r => r.item.state === this.normalizeState(college.state))
            .slice(0, 3);

        if (relaxedResults.length > 0) {
            console.log('    📊 Matches with relaxed threshold:');
            relaxedResults.forEach((r, i) => {
                console.log(`       ${i + 1}. "${r.item.name}" (score: ${r.score?.toFixed(4)})`);
            });
        }
    }

    public async runDiagnostics(): Promise<void> {
        console.clear();
        console.log('🔬 COLLEGE MATCHING DIAGNOSTIC TRACER');
        console.log('=====================================');

        const unmatchedColleges: UnmatchedCollege[] = JSON.parse(fs.readFileSync(UNMATCHED_COLLEGES_PATH, 'utf-8'));
        const topUnmatched = unmatchedColleges
            .sort((a, b) => b.record_count - a.record_count)
            .slice(0, 5);

        for (const college of topUnmatched) {
            console.log(`\n\n📌 ANALYZING: ${college.college}`);
            console.log(`   State: ${college.state}`);
            console.log(`   Full Name: ${college.full_name}`);
            console.log(`   Records Affected: ${college.record_count}`);
            console.log('   ' + '='.repeat(50));

            // Run your hierarchical algorithm
            const hierarchicalMatch = await this.runHierarchicalMatch(college);
            
            // If no match found, try enhanced fallbacks
            if (!hierarchicalMatch) {
                await this.runEnhancedFallbacks(college);
            }
        }
    }
}

if (require.main === module) {
    const tracer = new DiagnosticTracer();
    tracer.runDiagnostics().catch(console.error);
}