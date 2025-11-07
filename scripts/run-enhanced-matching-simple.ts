#!/usr/bin/env tsx

import { EnhancedHierarchicalMatcher } from '../src/lib/data/enhanced-hierarchical-matcher';
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

async function runEnhancedMatching() {
    console.clear();
    console.log('🚀 RUNNING ENHANCED MATCHING ON ALL COLLEGES');
    console.log('==========================================');

    const matcher = new EnhancedHierarchicalMatcher();
    const results: MatchResult[] = [];

    // Load unmatched colleges
    const unmatchedPath = path.join(process.cwd(), 'data', 'COMPLETE_UNMATCHED_COLLEGES.json');
    const unmatchedColleges: UnmatchedCollege[] = JSON.parse(fs.readFileSync(unmatchedPath, 'utf-8'));

    console.log(`\n📊 Processing all ${unmatchedColleges.length} unmatched colleges...\n`);

    let hierarchicalMatches = 0;
    let enhancedMatches = 0;
    let stillUnmatched = 0;
    let processedCount = 0;

    for (const college of unmatchedColleges) {
        processedCount++;
        process.stdout.write(`\r💫 Processing: ${processedCount}/${unmatchedColleges.length} - "${college.college.slice(0, 30).padEnd(30)}..."`);

        // Try hierarchical matcher first
        const result = await matcher.match(college.college, college.state);

        if (result.college) {
            if (result.algorithmUsed === 'HIERARCHICAL') {
                hierarchicalMatches++;
            } else {
                enhancedMatches++;
            }

            results.push({
                unmatched: college,
                matched_name: result.college.name,
                algorithm_used: result.algorithmUsed,
                confidence: result.confidence
            });
        } else {
            stillUnmatched++;
            results.push({
                unmatched: college,
                matched_name: null,
                algorithm_used: 'NONE',
                confidence: 0
            });
        }

        // Save progress every 100 colleges
        if (processedCount % 100 === 0) {
            const progressPath = path.join(process.cwd(), 'data', 'matching_progress.json');
            fs.writeFileSync(progressPath, JSON.stringify(results, null, 2));
        }
    }

    // Clear the progress line
    process.stdout.write('\r' + ' '.repeat(80) + '\r');

    // Save final results
    const resultsPath = path.join(process.cwd(), 'data', 'FULL_MATCHING_RESULTS.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

    // Generate summary report
    const totalMatched = hierarchicalMatches + enhancedMatches;
    const matchRate = (totalMatched / unmatchedColleges.length) * 100;

    console.log('\n\n📊 FINAL RESULTS');
    console.log('================');
    console.log(`Total Colleges Processed: ${unmatchedColleges.length}`);
    console.log(`Total Matched: ${totalMatched} (${matchRate.toFixed(1)}%)`);
    console.log(`  - YOUR Algorithm: ${hierarchicalMatches} (${(hierarchicalMatches/unmatchedColleges.length*100).toFixed(1)}%)`);
    console.log(`  - Enhanced Fallback: ${enhancedMatches} (${(enhancedMatches/unmatchedColleges.length*100).toFixed(1)}%)`);
    console.log(`Still Unmatched: ${stillUnmatched} (${(stillUnmatched/unmatchedColleges.length*100).toFixed(1)}%)`);

    // Generate markdown report
    const report = `# 📊 College Matching Results

## Summary

Total colleges processed: ${unmatchedColleges.length}
- ✅ Matched: ${totalMatched}
- ❌ Unmatched: ${stillUnmatched}

## Algorithm Performance

| Algorithm | Matches | Percentage |
|-----------|---------|------------|
| YOUR Hierarchical | ${hierarchicalMatches} | ${(hierarchicalMatches/unmatchedColleges.length*100).toFixed(1)}% |
| Enhanced Fallback | ${enhancedMatches} | ${(enhancedMatches/unmatchedColleges.length*100).toFixed(1)}% |
| Unmatched | ${stillUnmatched} | ${(stillUnmatched/unmatchedColleges.length*100).toFixed(1)}% |

## High Impact Matches

### Top 20 Matches by Record Count

${results
    .filter(r => r.matched_name !== null)
    .sort((a, b) => b.unmatched.record_count - a.unmatched.record_count)
    .slice(0, 20)
    .map((r, i) => `${i + 1}. "${r.unmatched.college}" → "${r.matched_name}"\n   - Records: ${r.unmatched.record_count}\n   - Algorithm: ${r.algorithm_used}\n   - Confidence: ${(r.confidence * 100).toFixed(1)}%`)
    .join('\n\n')}

## Remaining Unmatched Colleges

### Top 20 Unmatched by Record Count

${results
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

    const reportPath = path.join(process.cwd(), 'data', 'ENHANCED_MATCHING_REPORT.md');
    fs.writeFileSync(reportPath, report);
    console.log(`\n📝 Detailed report saved to: ${path.basename(reportPath)}`);
}

if (require.main === module) {
    runEnhancedMatching().catch(console.error);
}
