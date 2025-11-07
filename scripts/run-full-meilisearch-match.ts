#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { MeiliSearch } from 'meilisearch';

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

interface MatchResult {
    unmatched: UnmatchedCollege;
    matched_to: FoundationCollege | null;
    algorithm_used: string;
    confidence: number;
}

class MeilisearchMatcher {
    private meili: MeiliSearch;
    private foundationColleges: FoundationCollege[] = [];
    private results: MatchResult[] = [];
    
    // Core mappings from your original algorithm
    private readonly stateMap: Record<string, string> = {
        'DELHI (NCT)': 'NEW DELHI',
        'DELHI': 'NEW DELHI',
        'JAMMU & KASHMIR': 'JAMMU AND KASHMIR'
    };

    // Direct college mappings
    private readonly collegeMappings: Record<string, string> = {
        'SETH GORDHANDAS SUNDERDAS MEDICAL COLLEGE': 'SETH GS MEDICAL COLLEGE',
        'SETH G.S. MEDICAL COLLEGE': 'SETH GS MEDICAL COLLEGE',
        'SETH G S MEDICAL COLLEGE': 'SETH GS MEDICAL COLLEGE',
        'SETH G. S. MEDICAL COLLEGE': 'SETH GS MEDICAL COLLEGE',
        'SETH GS MEDICAL COLLEGE': 'SETH GS MEDICAL COLLEGE',
        'GSMC': 'SETH GS MEDICAL COLLEGE'
    };

    constructor() {
        this.meili = new MeiliSearch({
            host: 'http://localhost:7700'
        });
        this.loadFoundationData();
    }

    private async setupMeilisearch(): Promise<void> {
        console.log('🔧 Setting up Meilisearch...');
        
        try {
            // Delete existing index if it exists
            try {
                await this.meili.deleteIndex('colleges');
                console.log('   🗑️  Deleted existing index');
                // Wait a bit for deletion to complete
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                // Ignore if index doesn't exist
            }

            // Create colleges index
            await this.meili.createIndex('colleges', {
                primaryKey: 'id'
            });
            console.log('   ✅ Created index');

            // Wait a bit for index creation
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get the index
            const index = this.meili.index('colleges');

            // Add documents with enhanced searchable content
            const documents = this.foundationColleges.map((college, idx) => {
                // Generate variations of the college name
                const variations = this.generateNameVariations(college.name);
                
                return {
                    id: idx.toString(),
                    name: college.name,
                    state: college.state,
                    address: college.address,
                    previous_name: college.previous_name || '',
                    searchable_content: [
                        college.name,
                        college.previous_name || '',
                        college.address,
                        ...variations
                    ].join(' ')
                };
            });

            await index.addDocuments(documents);
            console.log(`   📝 Added ${documents.length} colleges`);

            // Wait for documents to be indexed
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Update settings
            const settings = {
                searchableAttributes: [
                    'name',
                    'previous_name',
                    'searchable_content'
                ],
                filterableAttributes: ['state'],
                sortableAttributes: ['name'],
                rankingRules: [
                    'words',
                    'typo',
                    'proximity',
                    'attribute',
                    'sort',
                    'exactness'
                ],
                stopWords: ['and', 'the', 'of', 'in', 'for'],
                distinctAttribute: 'name',
                typoTolerance: {
                    enabled: true,
                    minWordSizeForTypos: {
                        oneTypo: 3,
                        twoTypos: 6
                    }
                }
            };

            await index.updateSettings(settings);
            console.log('   ⚙️  Updated settings');

            // Wait for settings to be applied
            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log('✅ Meilisearch setup complete');

        } catch (error) {
            console.error('❌ Meilisearch setup failed:', error);
            throw error;
        }
    }

    private generateNameVariations(name: string): string[] {
        const variations = new Set<string>([name]);

        // Add direct mappings
        if (this.collegeMappings[name]) {
            variations.add(this.collegeMappings[name]);
        }

        // Generate variations by replacing parts
        const parts = name.split(' ');
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            // Handle "SETH GS" variations
            if (part === 'SETH' && i < parts.length - 1) {
                const nextPart = parts[i + 1];
                if (nextPart === 'GS' || nextPart === 'G.S.' || nextPart === 'G.S' || nextPart === 'G S') {
                    variations.add('SETH GORDHANDAS SUNDERDAS');
                    variations.add('SETH G.S.');
                    variations.add('SETH G S');
                    variations.add('SETH GS');
                    variations.add('GSMC');
                }
            }

            // Handle "GORDHANDAS SUNDERDAS" variations
            if (part === 'GORDHANDAS' && i < parts.length - 1 && parts[i + 1] === 'SUNDERDAS') {
                variations.add('GS');
                variations.add('G.S.');
                variations.add('G S');
                variations.add('GSMC');
            }

            // Handle "G.S." variations
            if (part === 'G.S.' || part === 'GS' || part === 'G.S' || part === 'G S') {
                variations.add('GORDHANDAS SUNDERDAS');
                variations.add('GS');
                variations.add('G.S.');
                variations.add('G S');
                variations.add('GSMC');
            }
        }

        return [...variations];
    }

    private loadFoundationData(): void {
        const dataPath = path.join(process.cwd(), 'data', 'updated-foundation-colleges.json');
        this.foundationColleges = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        console.log(`✅ Loaded ${this.foundationColleges.length} foundation colleges`);
    }

    private normalizeState(state: string): string {
        return this.stateMap[state] || state;
    }

    private extractCollegeName(fullName: string): string {
        // Extract name before first comma as per your specification
        return fullName.split(',')[0].trim();
    }

    private async matchCollege(college: UnmatchedCollege): Promise<MatchResult> {
        const normalizedState = this.normalizeState(college.state);
        const cleanName = this.extractCollegeName(college.full_name);
        
        // Check direct mappings first
        if (this.collegeMappings[cleanName]) {
            const mappedName = this.collegeMappings[cleanName];
            const directMatch = this.foundationColleges.find(c => 
                c.name === mappedName && c.state === normalizedState
            );
            if (directMatch) {
                return {
                    unmatched: college,
                    matched_to: directMatch,
                    algorithm_used: 'DIRECT_MAPPING',
                    confidence: 1.0
                };
            }
        }

        try {
            const index = this.meili.index('colleges');
            
            // Search with state filter and high typo tolerance
            const searchResults = await index.search(cleanName, {
                filter: `state = "${normalizedState}"`,
                limit: 5,
                matchingStrategy: 'all',
                attributesToRetrieve: ['name', 'state', 'previous_name'],
                attributesToHighlight: ['name'],
                showMatchesPosition: true
            });

            if (searchResults.hits.length > 0) {
                const bestMatch = searchResults.hits[0];
                const foundationCollege = this.foundationColleges.find(c => 
                    c.name === bestMatch.name && c.state === bestMatch.state
                );

                if (foundationCollege) {
                    return {
                        unmatched: college,
                        matched_to: foundationCollege,
                        algorithm_used: bestMatch._matchesPosition ? 'EXACT_MATCH' : 'FUZZY_MATCH',
                        confidence: bestMatch._matchesPosition ? 1.0 : 0.8
                    };
                }
            }

            return {
                unmatched: college,
                matched_to: null,
                algorithm_used: 'NO_MATCH',
                confidence: 0
            };

        } catch (error) {
            console.error(`   ❌ Search failed for "${cleanName}":`, error);
            return {
                unmatched: college,
                matched_to: null,
                algorithm_used: 'ERROR',
                confidence: 0
            };
        }
    }

    public async runFullMatch(): Promise<void> {
        console.clear();
        console.log('🚀 RUNNING FULL MEILISEARCH MATCH');
        console.log('================================');

        // Setup Meilisearch
        await this.setupMeilisearch();

        // Load unmatched colleges
        const unmatchedPath = path.join(process.cwd(), 'data', 'COMPLETE_UNMATCHED_COLLEGES.json');
        const unmatchedColleges: UnmatchedCollege[] = JSON.parse(fs.readFileSync(unmatchedPath, 'utf-8'));

        console.log(`\n📊 Processing all ${unmatchedColleges.length} unmatched colleges...\n`);

        let matched = 0;
        let unmatched = 0;
        let processedCount = 0;
        let totalRecords = 0;
        let matchedRecords = 0;

        for (const college of unmatchedColleges) {
            processedCount++;
            totalRecords += college.record_count;

            process.stdout.write(`\r💫 Processing: ${processedCount}/${unmatchedColleges.length} colleges...`);
            
            const result = await this.matchCollege(college);
            this.results.push(result);
            
            if (result.matched_to) {
                matched++;
                matchedRecords += college.record_count;
            } else {
                unmatched++;
            }

            // Save progress every 100 colleges
            if (processedCount % 100 === 0) {
                this.saveProgress();
            }
        }

        // Clear progress line
        process.stdout.write('\r' + ' '.repeat(80) + '\r');

        // Save final results
        this.saveProgress();

        // Generate summary report
        const matchRate = (matched / unmatchedColleges.length) * 100;
        const recordMatchRate = (matchedRecords / totalRecords) * 100;

        console.log('\n📊 FINAL RESULTS');
        console.log('================');
        console.log(`Total Colleges: ${unmatchedColleges.length}`);
        console.log(`Total Records: ${totalRecords}`);
        console.log(`\nMatched Colleges: ${matched} (${matchRate.toFixed(1)}%)`);
        console.log(`Matched Records: ${matchedRecords} (${recordMatchRate.toFixed(1)}%)`);
        console.log(`\nUnmatched Colleges: ${unmatched}`);
        console.log(`Unmatched Records: ${totalRecords - matchedRecords}`);

        // Generate algorithm breakdown
        const breakdown = this.results.reduce((acc, r) => {
            acc[r.algorithm_used] = (acc[r.algorithm_used] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log('\n📈 ALGORITHM BREAKDOWN');
        console.log('====================');
        Object.entries(breakdown).forEach(([algo, count]) => {
            const percent = (count / unmatchedColleges.length) * 100;
            console.log(`${algo}: ${count} (${percent.toFixed(1)}%)`);
        });

        // Generate detailed report
        await this.generateDetailedReport();
    }

    private saveProgress(): void {
        const resultsPath = path.join(process.cwd(), 'data', 'FULL_MATCHING_RESULTS.json');
        fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
    }

    private async generateDetailedReport(): Promise<void> {
        const reportPath = path.join(process.cwd(), 'data', 'FULL_MATCHING_REPORT.md');
        
        // Sort results by record count
        const sortedResults = [...this.results].sort((a, b) => 
            b.unmatched.record_count - a.unmatched.record_count
        );

        // Generate report content
        const report = `# 📊 Full Matching Results

## Summary

Total colleges processed: ${this.results.length}
- ✅ Matched: ${this.results.filter(r => r.matched_to !== null).length}
- ❌ Unmatched: ${this.results.filter(r => r.matched_to === null).length}

## Algorithm Performance

| Algorithm | Matches | Percentage |
|-----------|---------|------------|
${Object.entries(this.results.reduce((acc, r) => {
    acc[r.algorithm_used] = (acc[r.algorithm_used] || 0) + 1;
    return acc;
}, {} as Record<string, number>))
    .map(([algo, count]) => {
        const percent = (count / this.results.length) * 100;
        return `| ${algo} | ${count} | ${percent.toFixed(1)}% |`;
    })
    .join('\n')}

## High Impact Matches

### Top 20 Matches by Record Count

${sortedResults
    .filter(r => r.matched_to !== null)
    .slice(0, 20)
    .map((r, i) => `${i + 1}. "${r.unmatched.college}" → "${r.matched_to!.name}"\n   - Records: ${r.unmatched.record_count}\n   - Algorithm: ${r.algorithm_used}\n   - Confidence: ${(r.confidence * 100).toFixed(1)}%`)
    .join('\n\n')}

## Remaining Unmatched Colleges

### Top 20 Unmatched by Record Count

${sortedResults
    .filter(r => r.matched_to === null)
    .slice(0, 20)
    .map((r, i) => `${i + 1}. "${r.unmatched.college}" (${r.unmatched.state})\n   - Records Affected: ${r.unmatched.record_count}`)
    .join('\n\n')}

## Next Steps

1. Review high-impact matches for accuracy
2. Investigate remaining unmatched colleges
3. Consider adding more direct mappings for high-record unmatched colleges
4. Update state normalizations if needed

---
Generated: ${new Date().toISOString()}`;

        fs.writeFileSync(reportPath, report);
        console.log(`\n📝 Detailed report saved to: ${path.basename(reportPath)}`);
    }
}

if (require.main === module) {
    const matcher = new MeilisearchMatcher();
    matcher.runFullMatch().catch(console.error);
}
