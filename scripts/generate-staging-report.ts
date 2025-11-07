import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

interface StagingCollege {
  staging_college_name: string;
  unified_college_id: string | null;
  unified_college_name: string | null;
  match_confidence: number | null;
  match_method: string | null;
  status: 'matched' | 'unmatched';
}

interface StagingCourse {
  staging_course_name: string;
  unified_course_id: string | null;
  unified_course_name: string | null;
  match_confidence: number | null;
  match_method: string | null;
  status: 'matched' | 'unmatched';
}

interface StagingCutoff {
  id: string;
  college_id: string;
  course_id: string;
  year: number;
  round: number;
  quota: string;
  category: string;
  opening_rank: number;
  closing_rank: number;
  total_records: number;
  source_file: string;
  status: 'mapped' | 'unmapped';
}

interface StagingStats {
  totalColleges: number;
  matchedColleges: number;
  unmatchedColleges: number;
  totalCourses: number;
  matchedCourses: number;
  unmatchedCourses: number;
  totalCutoffs: number;
  mappedCutoffs: number;
  unmappedCutoffs: number;
}

async function generateStagingReport() {
  try {
    console.log('📊 Generating comprehensive staging database report...');

    const stagingDbPath = path.join(process.cwd(), 'data', 'staging', 'staging.db');
    
    if (!fs.existsSync(stagingDbPath)) {
      throw new Error('Staging database not found');
    }

    const db = new Database(stagingDbPath);

    // Get statistics
    const totalCollegesResult = db.prepare('SELECT COUNT(DISTINCT college_institute) as count FROM staging_counselling_records').get() as { count: number };
    const totalColleges = totalCollegesResult?.count || 0;
    
    const matchedCollegesResult = db.prepare('SELECT COUNT(*) as count FROM staging_college_matches WHERE unified_college_id IS NOT NULL').get() as { count: number };
    const matchedColleges = matchedCollegesResult?.count || 0;
    const unmatchedColleges = totalColleges - matchedColleges;

    const totalCoursesResult = db.prepare('SELECT COUNT(DISTINCT course) as count FROM staging_counselling_records').get() as { count: number };
    const totalCourses = totalCoursesResult?.count || 0;
    
    const matchedCoursesResult = db.prepare('SELECT COUNT(*) as count FROM staging_course_matches WHERE unified_course_id IS NOT NULL').get() as { count: number };
    const matchedCourses = matchedCoursesResult?.count || 0;
    const unmatchedCourses = totalCourses - matchedCourses;

    const totalCutoffsResult = db.prepare('SELECT COUNT(*) as count FROM staging_processed_cutoffs').get() as { count: number };
    const totalCutoffs = totalCutoffsResult?.count || 0;
    
    const mappedCutoffsResult = db.prepare('SELECT COUNT(*) as count FROM staging_processed_cutoffs WHERE college_id != \'\' AND course_id != \'\'').get() as { count: number };
    const mappedCutoffs = mappedCutoffsResult?.count || 0;
    const unmappedCutoffs = totalCutoffs - mappedCutoffs;

    const stats: StagingStats = {
      totalColleges,
      matchedColleges,
      unmatchedColleges,
      totalCourses,
      matchedCourses,
      unmatchedCourses,
      totalCutoffs,
      mappedCutoffs,
      unmappedCutoffs
    };

    // Get all colleges with their matches
    const collegeMatches = db.prepare(`
      SELECT 
        cm.*,
        CASE 
          WHEN cm.unified_college_id IS NOT NULL THEN 'matched'
          ELSE 'unmatched'
        END as status
      FROM staging_college_matches cm
      ORDER BY cm.staging_college_name
    `).all();

    const unmatchedCollegesFromRecords = db.prepare(`
      SELECT DISTINCT college_institute as staging_college_name
      FROM staging_counselling_records 
      WHERE college_institute NOT IN (
        SELECT staging_college_name FROM staging_college_matches
      )
      ORDER BY college_institute
    `).all() as { staging_college_name: string }[];

    const allColleges: StagingCollege[] = [
      ...collegeMatches.map((match: any) => ({
        staging_college_name: match.staging_college_name,
        unified_college_id: match.unified_college_id,
        unified_college_name: match.unified_college_name,
        match_confidence: match.match_confidence,
        match_method: match.match_method,
        status: 'matched' as const
      })),
      ...unmatchedCollegesFromRecords.map(college => ({
        staging_college_name: college.staging_college_name,
        unified_college_id: null,
        unified_college_name: null,
        match_confidence: null,
        match_method: null,
        status: 'unmatched' as const
      }))
    ];

    // Get all courses with their matches
    const courseMatches = db.prepare(`
      SELECT 
        cm.*,
        CASE 
          WHEN cm.unified_course_id IS NOT NULL THEN 'matched'
          ELSE 'unmatched'
        END as status
      FROM staging_course_matches cm
      ORDER BY cm.staging_course_name
    `).all();

    const unmatchedCoursesFromRecords = db.prepare(`
      SELECT DISTINCT course as staging_course_name
      FROM staging_counselling_records 
      WHERE course NOT IN (
        SELECT staging_course_name FROM staging_course_matches
      )
      ORDER BY course
    `).all() as { staging_course_name: string }[];

    const allCourses: StagingCourse[] = [
      ...courseMatches.map((match: any) => ({
        staging_course_name: match.staging_course_name,
        unified_course_id: match.unified_course_id,
        unified_course_name: match.unified_course_name,
        match_confidence: match.match_confidence,
        match_method: match.match_method,
        status: 'matched' as const
      })),
      ...unmatchedCoursesFromRecords.map(course => ({
        staging_course_name: course.staging_course_name,
        unified_course_id: null,
        unified_course_name: null,
        match_confidence: null,
        match_method: null,
        status: 'unmatched' as const
      }))
    ];

    // Get cutoffs
    const cutoffs = db.prepare(`
      SELECT 
        c.*,
        CASE 
          WHEN c.college_id != '' AND c.course_id != '' THEN 'mapped'
          ELSE 'unmapped'
        END as status
      FROM staging_processed_cutoffs c
      ORDER BY c.year DESC, c.round DESC, c.opening_rank ASC
    `).all() as StagingCutoff[];

    db.close();

    // Generate markdown report
    const report = generateMarkdownReport(stats, allColleges, allCourses, cutoffs);

    // Save report
    const reportPath = path.join(process.cwd(), 'data', 'staging', 'staging-review-report.md');
    fs.writeFileSync(reportPath, report);

    console.log('✅ Staging report generated successfully!');
    console.log(`📄 Report saved to: ${reportPath}`);
    console.log('\n📊 Summary:');
    console.log(`   Colleges: ${stats.matchedColleges}/${stats.totalColleges} matched (${((stats.matchedColleges / stats.totalColleges) * 100).toFixed(1)}%)`);
    console.log(`   Courses: ${stats.matchedCourses}/${stats.totalCourses} matched (${((stats.matchedCourses / stats.totalCourses) * 100).toFixed(1)}%)`);
    console.log(`   Cutoffs: ${stats.mappedCutoffs}/${stats.totalCutoffs} mapped (${((stats.mappedCutoffs / stats.totalCutoffs) * 100).toFixed(1)}%)`);

  } catch (error: any) {
    console.error('❌ Failed to generate staging report:', error.message);
    process.exit(1);
  }
}

function generateMarkdownReport(
  stats: StagingStats,
  colleges: StagingCollege[],
  courses: StagingCourse[],
  cutoffs: StagingCutoff[]
): string {
  const timestamp = new Date().toISOString();
  const unmatchedColleges = colleges.filter(c => c.status === 'unmatched');
  const matchedColleges = colleges.filter(c => c.status === 'matched');
  const unmatchedCourses = courses.filter(c => c.status === 'unmatched');
  const matchedCourses = courses.filter(c => c.status === 'matched');

  return `# Staging Database Review Report

**Generated:** ${timestamp}  
**Status:** Ready for Review

## 📊 Executive Summary

| Metric | Total | Matched/Mapped | Unmatched/Unmapped | Success Rate |
|--------|-------|----------------|-------------------|--------------|
| **Colleges** | ${stats.totalColleges.toLocaleString()} | ${stats.matchedColleges.toLocaleString()} | ${stats.unmatchedColleges.toLocaleString()} | ${((stats.matchedColleges / stats.totalColleges) * 100).toFixed(1)}% |
| **Courses** | ${stats.totalCourses.toLocaleString()} | ${stats.matchedCourses.toLocaleString()} | ${stats.unmatchedCourses.toLocaleString()} | ${((stats.matchedCourses / stats.totalCourses) * 100).toFixed(1)}% |
| **Cutoffs** | ${stats.totalCutoffs.toLocaleString()} | ${stats.mappedCutoffs.toLocaleString()} | ${stats.unmappedCutoffs.toLocaleString()} | ${((stats.mappedCutoffs / stats.totalCutoffs) * 100).toFixed(1)}% |

## 🎯 Overall Assessment

- **College Mapping**: ${((stats.matchedColleges / stats.totalColleges) * 100).toFixed(1)}% complete
- **Course Mapping**: ${((stats.matchedCourses / stats.totalCourses) * 100).toFixed(1)}% complete  
- **Cutoff Mapping**: ${((stats.mappedCutoffs / stats.totalCutoffs) * 100).toFixed(1)}% complete
- **Overall Completeness**: ${(((stats.matchedColleges / stats.totalColleges) + (stats.matchedCourses / stats.totalCourses) + (stats.mappedCutoffs / stats.totalCutoffs)) / 3 * 100).toFixed(1)}%

## ❌ Unmatched Colleges (${unmatchedColleges.length})

${unmatchedColleges.length > 0 ? unmatchedColleges.map((college, index) => `${index + 1}. **${college.staging_college_name}**`).join('\n') : 'All colleges have been matched! ✅'}

## ❌ Unmatched Courses (${unmatchedCourses.length})

${unmatchedCourses.length > 0 ? unmatchedCourses.map((course, index) => `${index + 1}. **${course.staging_course_name}**`).join('\n') : 'All courses have been matched! ✅'}

## ✅ Matched Colleges (${matchedColleges.length})

| # | Staging College | Unified College | Method | Confidence |
|---|----------------|----------------|--------|------------|
${matchedColleges.map((college, index) => 
  `| ${index + 1} | ${college.staging_college_name} | ${college.unified_college_name} | ${college.match_method || 'N/A'} | ${college.match_confidence ? `${(college.match_confidence * 100).toFixed(1)}%` : 'N/A'} |`
).join('\n')}

## ✅ Matched Courses (${matchedCourses.length})

| # | Staging Course | Unified Course | Method | Confidence |
|---|---------------|---------------|--------|------------|
${matchedCourses.map((course, index) => 
  `| ${index + 1} | ${course.staging_course_name} | ${course.unified_course_name} | ${course.match_method || 'N/A'} | ${course.match_confidence ? `${(course.match_confidence * 100).toFixed(1)}%` : 'N/A'} |`
).join('\n')}

## 📈 Cutoff Data Sample (First 50)

| # | College | Course | Year | Round | Quota | Category | Opening Rank | Closing Rank | Records |
|---|---------|--------|------|-------|-------|----------|--------------|--------------|---------|
${cutoffs.slice(0, 50).map((cutoff, index) => 
  `| ${index + 1} | ${cutoff.college_id} | ${cutoff.course_id} | ${cutoff.year} | ${cutoff.round} | ${cutoff.quota} | ${cutoff.category} | ${cutoff.opening_rank.toLocaleString()} | ${cutoff.closing_rank.toLocaleString()} | ${cutoff.total_records} |`
).join('\n')}

${cutoffs.length > 50 ? `\n*Showing first 50 of ${cutoffs.length.toLocaleString()} total cutoffs*` : ''}

## 🔍 Detailed Analysis

### College Mapping Methods
${getMappingMethodStats(colleges)}

### Course Mapping Methods  
${getMappingMethodStats(courses)}

### Data Quality Issues
${getDataQualityIssues(colleges, courses, cutoffs)}

## 📋 Recommendations

${getRecommendations(stats, unmatchedColleges.length, unmatchedCourses.length)}

## 🚀 Next Steps

1. **Review unmatched colleges** - ${unmatchedColleges.length} colleges need manual review
2. **Review unmatched courses** - ${unmatchedCourses.length} courses need manual review  
3. **Validate mappings** - Check high-confidence matches for accuracy
4. **Final import** - Proceed with import to unified database after review

---

*This report was generated automatically by the NeetLogIQ staging workflow system.*
`;
}

function getMappingMethodStats(items: (StagingCollege | StagingCourse)[]): string {
  const methodStats = items.reduce((acc, item) => {
    const method = item.match_method || 'unmatched';
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(methodStats)
    .map(([method, count]) => `- **${method}**: ${count} items`)
    .join('\n');
}

function getDataQualityIssues(colleges: StagingCollege[], courses: StagingCourse[], cutoffs: StagingCutoff[]): string {
  const issues = [];

  // Check for low confidence matches
  const lowConfidenceColleges = colleges.filter(c => c.match_confidence && c.match_confidence < 0.8);
  if (lowConfidenceColleges.length > 0) {
    issues.push(`- **Low confidence college matches**: ${lowConfidenceColleges.length} colleges with <80% confidence`);
  }

  const lowConfidenceCourses = courses.filter(c => c.match_confidence && c.match_confidence < 0.8);
  if (lowConfidenceCourses.length > 0) {
    issues.push(`- **Low confidence course matches**: ${lowConfidenceCourses.length} courses with <80% confidence`);
  }

  // Check for unmapped cutoffs
  const unmappedCutoffs = cutoffs.filter(c => c.status === 'unmapped');
  if (unmappedCutoffs.length > 0) {
    issues.push(`- **Unmapped cutoffs**: ${unmappedCutoffs.length} cutoffs without college/course mappings`);
  }

  return issues.length > 0 ? issues.join('\n') : 'No significant data quality issues detected ✅';
}

function getRecommendations(stats: StagingStats, unmatchedColleges: number, unmatchedCourses: number): string {
  const recommendations = [];

  if (unmatchedColleges > 0) {
    recommendations.push(`- **Manual review required** for ${unmatchedColleges} unmatched colleges`);
  }

  if (unmatchedCourses > 0) {
    recommendations.push(`- **Manual review required** for ${unmatchedCourses} unmatched courses`);
  }

  const overallCompleteness = ((stats.matchedColleges / stats.totalColleges) + (stats.matchedCourses / stats.totalCourses) + (stats.mappedCutoffs / stats.totalCutoffs)) / 3;
  
  if (overallCompleteness >= 0.95) {
    recommendations.push('- **Ready for final import** - Overall completeness exceeds 95%');
  } else if (overallCompleteness >= 0.90) {
    recommendations.push('- **Consider proceeding** - Overall completeness is above 90%');
  } else {
    recommendations.push('- **Manual review recommended** - Overall completeness below 90%');
  }

  return recommendations.join('\n');
}

// Run the script
generateStagingReport().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});
