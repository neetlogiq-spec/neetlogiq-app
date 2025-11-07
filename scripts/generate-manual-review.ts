import ManualReviewManager from '../src/lib/data/manual-review-manager';

async function main() {
  console.log('🔍 Manual Review Data Generation Script');
  console.log('======================================');

  try {
    // Initialize manual review manager
    const manager = new ManualReviewManager();
    await manager.initialize();

    // Generate review data
    console.log('\n📋 Step 1: Generating college review data...');
    const colleges = await manager.generateCollegeReviewData();

    console.log('\n📋 Step 2: Generating course review data...');
    const courses = await manager.generateCourseReviewData();

    // Get summary
    console.log('\n📊 Step 3: Getting review summary...');
    const summary = await manager.getReviewSummary();

    // Display results
    console.log('\n📈 Manual Review Summary:');
    console.log('==========================');
    console.log(`🏫 Total Unmatched Colleges: ${summary.totalUnmatchedColleges.toLocaleString()}`);
    console.log(`📚 Total Unmatched Courses: ${summary.totalUnmatchedCourses.toLocaleString()}`);
    console.log(`⏳ Pending Reviews: ${summary.pendingReviews.toLocaleString()}`);
    console.log(`✅ Completed Reviews: ${summary.completedReviews.toLocaleString()}`);
    console.log(`📊 Review Progress: ${summary.reviewProgress.toFixed(1)}%`);

    // Show sample unmatched colleges
    if (colleges.length > 0) {
      console.log('\n🏫 Sample Unmatched Colleges:');
      colleges.slice(0, 5).forEach((college, index) => {
        console.log(`   ${index + 1}. ${college.stagingName}`);
        console.log(`      Confidence: ${(college.matchConfidence * 100).toFixed(1)}%`);
        console.log(`      Method: ${college.matchMethod}`);
        console.log(`      Suggested Matches: ${college.suggestedMatches.length}`);
        if (college.suggestedMatches.length > 0) {
          console.log(`      Top Match: ${college.suggestedMatches[0].name} (${(college.suggestedMatches[0].confidence * 100).toFixed(1)}%)`);
        }
        console.log('');
      });
    }

    // Show sample unmatched courses
    if (courses.length > 0) {
      console.log('\n📚 Sample Unmatched Courses:');
      courses.slice(0, 5).forEach((course, index) => {
        console.log(`   ${index + 1}. ${course.stagingName}`);
        console.log(`      Confidence: ${(course.matchConfidence * 100).toFixed(1)}%`);
        console.log(`      Method: ${course.matchMethod}`);
        console.log(`      Suggested Matches: ${course.suggestedMatches.length}`);
        if (course.suggestedMatches.length > 0) {
          console.log(`      Top Match: ${course.suggestedMatches[0].name} (${(course.suggestedMatches[0].confidence * 100).toFixed(1)}%)`);
        }
        console.log('');
      });
    }

    console.log('\n🎯 Next Steps:');
    console.log('   1. Review the generated files in data/staging/');
    console.log('   2. Use the manual review API to get detailed data');
    console.log('   3. Manually match unmatched colleges and courses');
    console.log('   4. Update the staging database with manual matches');
    console.log('   5. Re-run the staging workflow to complete the process');

    console.log('\n📁 Generated Files:');
    console.log('   - data/staging/manual_review_colleges.json');
    console.log('   - data/staging/manual_review_courses.json');

    await manager.close();

  } catch (error: any) {
    console.error('❌ Manual review data generation failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('❌ An unexpected error occurred:', error);
  process.exit(1);
});
