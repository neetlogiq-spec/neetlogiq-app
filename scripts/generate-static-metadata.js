/**
 * Generate Static Metadata
 *
 * This script analyzes Parquet files and generates static JSON files
 * that the frontend can use without querying the database.
 *
 * Generated files:
 * - public/data/metadata/available-years.json
 * - public/data/metadata/available-rounds.json
 * - public/data/metadata/filter-options.json
 * - public/data/metadata/colleges-index.json
 * - public/data/metadata/courses-index.json
 * - public/data/metadata/states-index.json
 *
 * This makes the frontend 100% data-driven with zero hardcoding.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Paths
const DB_PATH = path.join(__dirname, '../data/sqlite/counselling_data_partitioned.db');
const OUTPUT_DIR = path.join(__dirname, '../public/data/metadata');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generateMetadata() {
  console.log('🔧 Starting metadata generation...');

  const db = new Database(DB_PATH, { readonly: true });

  try {
    // 1. Generate available years
    console.log('📅 Generating available years...');
    const years = db.prepare(`
      SELECT DISTINCT year
      FROM cutoffs
      ORDER BY year DESC
    `).all();

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'available-years.json'),
      JSON.stringify({
        years: years.map(row => row.year),
        latest: years[0]?.year,
        oldest: years[years.length - 1]?.year,
        count: years.length,
        generated: new Date().toISOString()
      }, null, 2)
    );

    // 2. Generate available rounds per year
    console.log('🔄 Generating available rounds...');
    const roundsData = {};

    for (const { year } of years) {
      const rounds = db.prepare(`
        SELECT DISTINCT round
        FROM cutoffs
        WHERE year = ?
        ORDER BY round
      `).all(year);

      roundsData[year] = rounds.map(row => row.round);
    }

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'available-rounds.json'),
      JSON.stringify({
        rounds: roundsData,
        generated: new Date().toISOString()
      }, null, 2)
    );

    // 3. Generate filter options (categories, quotas, etc.)
    console.log('🎛️ Generating filter options...');

    const categories = db.prepare(`
      SELECT DISTINCT category_id
      FROM cutoffs
      ORDER BY category_id
    `).all();

    const quotas = db.prepare(`
      SELECT DISTINCT quota_id
      FROM cutoffs
      ORDER BY quota_id
    `).all();

    const streams = db.prepare(`
      SELECT DISTINCT stream
      FROM cutoffs
      ORDER BY stream
    `).all();

    const counsellingBodies = db.prepare(`
      SELECT DISTINCT counselling_body
      FROM cutoffs
      ORDER BY counselling_body
    `).all();

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'filter-options.json'),
      JSON.stringify({
        categories: categories.map(row => row.category_id),
        quotas: quotas.map(row => row.quota_id),
        streams: streams.map(row => row.stream),
        counsellingBodies: counsellingBodies.map(row => row.counselling_body),
        generated: new Date().toISOString()
      }, null, 2)
    );

    // 4. Generate colleges index (for autocomplete)
    console.log('🏥 Generating colleges index...');

    const colleges = db.prepare(`
      SELECT
        college_id,
        college_name,
        college_type,
        stream,
        state_id,
        state_name,
        city
      FROM colleges
      ORDER BY college_name
    `).all();

    // Create full index
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'colleges-index.json'),
      JSON.stringify({
        colleges: colleges,
        count: colleges.length,
        generated: new Date().toISOString()
      }, null, 2)
    );

    // Create stream-specific indexes
    const collegesByStream = {};
    for (const college of colleges) {
      if (!collegesByStream[college.stream]) {
        collegesByStream[college.stream] = [];
      }
      collegesByStream[college.stream].push(college);
    }

    for (const [stream, streamColleges] of Object.entries(collegesByStream)) {
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `colleges-${stream}.json`),
        JSON.stringify({
          stream,
          colleges: streamColleges,
          count: streamColleges.length,
          generated: new Date().toISOString()
        }, null, 2)
      );
    }

    // 5. Generate courses index
    console.log('📚 Generating courses index...');

    const courses = db.prepare(`
      SELECT
        course_id,
        course_name,
        course_code,
        level,
        stream,
        duration_years,
        degree_type
      FROM courses
      ORDER BY course_name
    `).all();

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'courses-index.json'),
      JSON.stringify({
        courses: courses,
        count: courses.length,
        generated: new Date().toISOString()
      }, null, 2)
    );

    // Create stream-specific course indexes
    const coursesByStream = {};
    for (const course of courses) {
      if (!coursesByStream[course.stream]) {
        coursesByStream[course.stream] = [];
      }
      coursesByStream[course.stream].push(course);
    }

    for (const [stream, streamCourses] of Object.entries(coursesByStream)) {
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `courses-${stream}.json`),
        JSON.stringify({
          stream,
          courses: streamCourses,
          count: streamCourses.length,
          generated: new Date().toISOString()
        }, null, 2)
      );
    }

    // 6. Generate states index
    console.log('🗺️ Generating states index...');

    const states = db.prepare(`
      SELECT
        state_id,
        state_name,
        state_code,
        zone
      FROM states
      ORDER BY state_name
    `).all();

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'states-index.json'),
      JSON.stringify({
        states: states,
        count: states.length,
        generated: new Date().toISOString()
      }, null, 2)
    );

    // 7. Generate statistics
    console.log('📊 Generating statistics...');

    const stats = {
      colleges: {
        total: colleges.length,
        byStream: Object.entries(collegesByStream).map(([stream, colleges]) => ({
          stream,
          count: colleges.length
        })),
        byState: db.prepare(`
          SELECT state_name, COUNT(*) as count
          FROM colleges
          GROUP BY state_name
          ORDER BY count DESC
        `).all()
      },
      courses: {
        total: courses.length,
        byStream: Object.entries(coursesByStream).map(([stream, courses]) => ({
          stream,
          count: courses.length
        })),
        byLevel: db.prepare(`
          SELECT level, COUNT(*) as count
          FROM courses
          GROUP BY level
          ORDER BY count DESC
        `).all()
      },
      cutoffs: {
        totalRecords: db.prepare(`SELECT COUNT(*) as count FROM cutoffs`).get().count,
        byYear: db.prepare(`
          SELECT year, COUNT(*) as count
          FROM cutoffs
          GROUP BY year
          ORDER BY year DESC
        `).all(),
        byStream: db.prepare(`
          SELECT stream, COUNT(*) as count
          FROM cutoffs
          GROUP BY stream
          ORDER BY count DESC
        `).all()
      },
      generated: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'statistics.json'),
      JSON.stringify(stats, null, 2)
    );

    // 8. Generate search index (lightweight for client-side search)
    console.log('🔍 Generating search index...');

    const searchIndex = colleges.map(college => ({
      id: college.college_id,
      name: college.college_name,
      type: college.college_type,
      stream: college.stream,
      state: college.state_name,
      city: college.city,
      // Create search tokens for better matching
      tokens: [
        college.college_name.toLowerCase(),
        college.college_id.toLowerCase(),
        college.city?.toLowerCase() || '',
        college.state_name.toLowerCase()
      ].join(' ')
    }));

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'search-index.json'),
      JSON.stringify({
        index: searchIndex,
        count: searchIndex.length,
        generated: new Date().toISOString()
      }, null, 2)
    );

    console.log('✅ Metadata generation complete!');
    console.log(`📁 Generated ${fs.readdirSync(OUTPUT_DIR).length} files in ${OUTPUT_DIR}`);

    // Print summary
    console.log('\n📊 Summary:');
    console.log(`   - Years: ${years.length}`);
    console.log(`   - Colleges: ${colleges.length}`);
    console.log(`   - Courses: ${courses.length}`);
    console.log(`   - States: ${states.length}`);
    console.log(`   - Total cutoff records: ${stats.cutoffs.totalRecords.toLocaleString()}`);

  } catch (error) {
    console.error('❌ Error generating metadata:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run if called directly
if (require.main === module) {
  generateMetadata().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { generateMetadata };
