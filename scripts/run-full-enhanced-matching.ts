#!/usr/bin/env tsx

import { EnhancedHierarchicalMatcher } from '../src/lib/data/enhanced-hierarchical-matcher';
import { MeiliSearch, Index } from 'meilisearch';
import fs from 'fs';
import path from 'path';

interface UnmatchedCollege {
    college: string;
    state: string;
    full_name: string;
    record_count: number;
}

interface MatchResult {
    unmatched: UnmatchedCollege;
    matched_name: string | null;
    algorithm_used: string;
    confidence: number;
}

class FullEnhancedMatcher {
    private matcher: EnhancedHierarchicalMatcher;
    private meili: MeiliSearch;
    private results: MatchResult[] = [];

    constructor() {
        this.matcher = new EnhancedHierarchicalMatcher();
        this.meili = new MeiliSearch({
            host: 'http://localhost:7700'
        });
    }

    private async setupMeilisearch(): Promise<void> {
        console.log('🔧 Setting up Meilisearch...');
        
        // Create colleges index
        const createTask = await this.meili.createIndex('colleges', {
            primaryKey: 'id'
        });
        await this.meili.tasks.waitForTask(createTask.taskUid);

        // Get the index
        const collegesIndex: Index = this.meili.index('colleges');

        // Load foundation colleges
        const foundationPath = path.join(process.cwd(), 'data', 'updated-foundation-colleges.json');
        const colleges = JSON.parse(fs.readFileSync(foundationPath, 'utf-8'));

        // Add colleges to Meilisearch
        const addTask = await collegesIndex.addDocuments(colleges.map((college: any, index: number) => ({
            id: index.toString(),
            name: college.name,
            state: college.state,
            address: college.address,
            previous_name: college.previous_name || ''
        })));
        console.log('Added colleges to Meilisearch, task:', addTask.taskUid);

        // Wait for task to complete
        await this.meili.tasks.waitForTask(addTask.taskUid);

        // Configure search settings
        const settingsTask = await collegesIndex.updateSettings({
            searchableAttributes: [
                'name',
                'previous_name',
                'address'
            ],
            filterableAttributes: ['state'],
            typoTolerance: {
                enabled: true,
                minWordSizeForTypos: {
                    oneTypo: 4,
                    twoTypos: 8
                }
            }
        });

        console.log('✅ Meilisearch setup complete');
    }

    private async tryMeilisearch(college: string, state: string): Promise<any | null> {
        try {
            const collegesIndex: Index = this.meili.index('colleges');
            const searchResults = await collegesIndex.search(college, {
                filter: [`state = "${state}"`],
                limit: 1
            });

            if (searchResults.hits.length > 0) {
                return {
                    college: searchResults.hits[0],
                    confidence: searchResults.hits[0]._matchesPosition ? 0.8 : 0.6
                };
            }
        } catch (error) {
            console.error('Meilisearch error:', error);
        }
        return null;
    }

    public async runFullMatch(): Promise<void> {
        console.clear();
        console.log('🚀 RUNNING FULL ENHANCED MATCHING');
        console.log('================================');

        // Setup Meilisearch
        await this.setupMeilisearch();

        // Load unmatched colleges
        const unmatchedPath = path.join(process.cwd(), 'data', 'COMPLETE_UNMATCHED_COLLEGES.json');
        const unmatchedColleges: UnmatchedCollege[] = JSON.parse(fs.readFileSync(unmatchedPath, 'utf-8'));

        console.log(`\n📊 Processing all ${unmatchedColleges.length} unmatched colleges...\n`);

        let hierarchicalMatches = 0;
        let enhancedMatches = 0;
        let meiliMatches = 0;
        let stillUnmatched = 0;

        for (const college of unmatchedColleges) {
            process.stdout.write(`\r💫 Processing: ${college.college.slice(0, 40).padEnd(40)}...`);

            // Try hierarchical matcher first
            const result = await this.matcher.match(college.college, college.state);

            if (result.college) {
                if (result.algorithmUsed === 'HIERARCHICAL') {
                    hierarchicalMatches++;
                } else {
                    enhancedMatches++;
                }

                this.results.push({
                    unmatched: college,
                    matched_name: result.college.name,
                    algorithm_used: result.algorithmUsed,
                    confidence: result.confidence
                });
                continue;
            }

            // If no match, try Meilisearch
            const meiliResult = await this.tryMeilisearch(college.college, college.state);
            if (meiliResult) {
                meiliMatches++;
                this.results.push({
                    unmatched: college,
                    matched_name: meiliResult.college.name,
                    algorithm_used: 'MEILISEARCH',
                    confidence: meiliResult.confidence
                });
                continue;
            }

            // Still no match
            stillUnmatched++;
            this.results.push({
                unmatched: college,
                matched_name: null,
                algorithm_used: 'NONE',
                confidence: 0
            });
        }

        // Clear the progress line
        process.stdout.write('\r' + ' '.repeat(80) + '\r');

        // Save detailed results
        const resultsPath = path.join(process.cwd(), 'data', 'FULL_MATCHING_RESULTS.json');
        fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));

        // Generate summary report
        const totalMatched = hierarchicalMatches + enhancedMatches + meiliMatches;
        const matchRate = (totalMatched / unmatchedColleges.length) * 100;

        console.log('\n\n📊 FINAL RESULTS');
        console.log('================');
        console.log(`Total Colleges Processed: ${unmatchedColleges.length}`);
        console.log(`Total Matched: ${totalMatched} (${matchRate.toFixed(1)}%)`);
        console.log(`  - YOUR Algorithm: ${hierarchicalMatches} (${(hierarchicalMatches/unmatchedColleges.length*100).toFixed(1)}%)`);
        console.log(`  - Enhanced Fallback: ${enhancedMatches} (${(enhancedMatches/unmatchedColleges.length*100).toFixed(1)}%)`);
        console.log(`  - Meilisearch: ${meiliMatches} (${(meiliMatches/unmatchedColleges.length*100).toFixed(1)}%)`);
        console.log(`Still Unmatched: ${stillUnmatched} (${(stillUnmatched/unmatchedColleges.length*100).toFixed(1)}%)`);

        // Generate markdown report
        await this.generateMarkdownReport();
    }

    private async generateMarkdownReport(): Promise<void> {
        const reportPath = path.join(process.cwd(), 'data', 'FULL_MATCHING_REPORT.md');
        
        const report = `# 📊 College Matching Results

## Summary

Total colleges processed: ${this.results.length}
- ✅ Matched: ${this.results.filter(r => r.matched_name !== null).length}
- ❌ Unmatched: ${this.results.filter(r => r.matched_name === null).length}

## Algorithm Performance

| Algorithm | Matches | Percentage |
|-----------|---------|------------|
| YOUR Hierarchical | ${this.results.filter(r => r.algorithm_used === 'HIERARCHICAL').length} | ${(this.results.filter(r => r.algorithm_used === 'HIERARCHICAL').length / this.results.length * 100).toFixed(1)}% |
| Enhanced Fallback | ${this.results.filter(r => r.algorithm_used === 'ENHANCED').length} | ${(this.results.filter(r => r.algorithm_used === 'ENHANCED').length / this.results.length * 100).toFixed(1)}% |
| Meilisearch | ${this.results.filter(r => r.algorithm_used === 'MEILISEARCH').length} | ${(this.results.filter(r => r.algorithm_used === 'MEILISEARCH').length / this.results.length * 100).toFixed(1)}% |
| Unmatched | ${this.results.filter(r => r.algorithm_used === 'NONE').length} | ${(this.results.filter(r => r.algorithm_used === 'NONE').length / this.results.length * 100).toFixed(1)}% |

## High Impact Matches

### Top 20 Matches by Record Count

${this.results
    .filter(r => r.matched_name !== null)
    .sort((a, b) => b.unmatched.record_count - a.unmatched.record_count)
    .slice(0, 20)
    .map((r, i) => `${i + 1}. "${r.unmatched.college}" → "${r.matched_name}"\n   - Records: ${r.unmatched.record_count}\n   - Algorithm: ${r.algorithm_used}\n   - Confidence: ${(r.confidence * 100).toFixed(1)}%`)
    .join('\n\n')}

## Remaining Unmatched Colleges

### Top 20 Unmatched by Record Count

${this.results
    .filter(r => r.matched_name === null)
    .sort((a, b) => b.unmatched.record_count - a.unmatched.record_count)
    .slice(0, 20)
    .map((r, i) => `${i + 1}. "${r.unmatched.college}" (${r.unmatched.state})\n   - Records Affected: ${r.unmatched.record_count}`)
    .join('\n\n')}

## Next Steps

1. Review high-impact matches for accuracy
2. Investigate top unmatched colleges
3. Consider adding more typo corrections and abbreviations
4. Update state normalizations if needed

---
Generated: ${new Date().toISOString()}`;

        fs.writeFileSync(reportPath, report);
        console.log(`\n📝 Detailed report saved to: ${path.basename(reportPath)}`);
    }
}

if (require.main === module) {
    const matcher = new FullEnhancedMatcher();
    matcher.runFullMatch().catch(console.error);
}
