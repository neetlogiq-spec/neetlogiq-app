#!/usr/bin/env node

/**
 * Stream-Based Static Data Generator
 *
 * Generates optimized JSON files chunked by:
 * - Stream (UG, PG_MEDICAL, PG_DENTAL)
 * - Year (2024, 2023, 2022, etc.)
 * - Popular filter combinations
 *
 * This allows:
 * - UG users only download UG data (~400 KB vs 1.5 MB)
 * - Progressive loading (2024 first, then older years)
 * - Instant results for popular filters
 *
 * Output structure:
 * public/data/
 *   ├── colleges-UG.json (MEDICAL + DENTAL)
 *   ├── colleges-PG_MEDICAL.json (MEDICAL + DNB)
 *   ├── colleges-PG_DENTAL.json (DENTAL only)
 *   ├── cutoffs-UG-2024.json (recent first!)
 *   ├── cutoffs-UG-2023.json
 *   ├── cutoffs-PG_MEDICAL-2024.json
 *   ├── cutoffs-PG_DENTAL-2024.json
 *   └── metadata.json
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Configuration
const DATA_DIR = path.join(__dirname, '../public/data');
const SOURCE_DATA = {
  colleges: path.join(__dirname, '../data/source/colleges.json'),
  courses: path.join(__dirname, '../data/source/courses.json'),
  cutoffs: path.join(__dirname, '../data/source/cutoffs.json'),
};

// Stream filtering rules (from StreamContext)
const STREAM_RULES = {
  UG: {
    collegeStreams: ['MEDICAL', 'DENTAL'],
    courseStreams: ['MEDICAL', 'DENTAL'],
    cutoffLevel: 'UG',
  },
  PG_MEDICAL: {
    collegeStreams: ['MEDICAL', 'DNB'],
    courseStreams: ['MEDICAL', 'DNB'],
    cutoffLevel: 'PG',
  },
  PG_DENTAL: {
    collegeStreams: ['DENTAL'],
    courseStreams: ['DENTAL'],
    cutoffLevel: 'PG',
  },
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log('🚀 Stream-Based Static Data Generator');
console.log('=====================================\n');

/**
 * Load source data
 */
function loadSourceData() {
  console.log('📖 Loading source data...');

  const data = {};

  for (const [key, filepath] of Object.entries(SOURCE_DATA)) {
    if (fs.existsSync(filepath)) {
      data[key] = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      console.log(`   ✓ Loaded ${data[key].length.toLocaleString()} ${key}`);
    } else {
      console.warn(`   ⚠ ${key} not found at ${filepath}, using empty array`);
      data[key] = [];
    }
  }

  console.log('');
  return data;
}

/**
 * Optimize JSON structure (shorter keys)
 */
function optimizeStructure(data, type) {
  if (type === 'colleges') {
    return data.map(c => ({
      i: c.id,
      n: c.name,
      c: c.city,
      s: c.state,
      st: c.stream,
      mt: c.management_type,
      y: c.established_year,
      w: c.website,
    }));
  }

  if (type === 'courses') {
    return data.map(c => ({
      i: c.id,
      n: c.name,
      st: c.stream,
      b: c.branch,
      d: c.duration_years,
    }));
  }

  if (type === 'cutoffs') {
    return data.map(c => ({
      i: c.id,
      ci: c.college_id,
      cn: c.college_name,
      co: c.course,
      y: c.year,
      r: c.round,
      cat: c.category,
      q: c.quota,
      or: c.opening_rank,
      cr: c.closing_rank,
      st: c.stream,
      l: c.level, // UG or PG
    }));
  }

  return data;
}

/**
 * Generate stream-specific college data
 */
function generateCollegesByStream(colleges) {
  console.log('🏥 Generating stream-specific college data...');

  const stats = {};

  for (const [stream, rules] of Object.entries(STREAM_RULES)) {
    const filtered = colleges.filter(c =>
      rules.collegeStreams.includes(c.stream || c.st)
    );

    const optimized = optimizeStructure(filtered, 'colleges');
    const filename = `colleges-${stream}.json`;
    const filepath = path.join(DATA_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(optimized));

    const size = fs.statSync(filepath).size;
    const gzipped = zlib.gzipSync(JSON.stringify(optimized)).length;

    stats[stream] = {
      count: filtered.length,
      size: (size / 1024).toFixed(1) + ' KB',
      gzipped: (gzipped / 1024).toFixed(1) + ' KB',
    };

    console.log(`   ✓ ${stream}: ${filtered.length} colleges → ${filename}`);
    console.log(`     Size: ${stats[stream].size} (${stats[stream].gzipped} gzipped)`);
  }

  console.log('');
  return stats;
}

/**
 * Generate stream-specific course data
 */
function generateCoursesByStream(courses) {
  console.log('📚 Generating stream-specific course data...');

  const stats = {};

  for (const [stream, rules] of Object.entries(STREAM_RULES)) {
    const filtered = courses.filter(c =>
      rules.courseStreams.includes(c.stream || c.st)
    );

    const optimized = optimizeStructure(filtered, 'courses');
    const filename = `courses-${stream}.json`;
    const filepath = path.join(DATA_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(optimized));

    const size = fs.statSync(filepath).size;
    const gzipped = zlib.gzipSync(JSON.stringify(optimized)).length;

    stats[stream] = {
      count: filtered.length,
      size: (size / 1024).toFixed(1) + ' KB',
      gzipped: (gzipped / 1024).toFixed(1) + ' KB',
    };

    console.log(`   ✓ ${stream}: ${filtered.length} courses → ${filename}`);
    console.log(`     Size: ${stats[stream].size} (${stats[stream].gzipped} gzipped)`);
  }

  console.log('');
  return stats;
}

/**
 * Generate cutoffs by stream and year (progressive loading)
 */
function generateCutoffsByStreamAndYear(cutoffs) {
  console.log('🎯 Generating cutoffs by stream and year...');
  console.log('   (Recent years first for progressive loading)\n');

  const stats = {};

  // Get unique years and sort (newest first)
  const years = [...new Set(cutoffs.map(c => c.year || c.y))]
    .sort((a, b) => b - a);

  console.log(`   Found years: ${years.join(', ')}\n`);

  for (const [stream, rules] of Object.entries(STREAM_RULES)) {
    stats[stream] = {};

    for (const year of years) {
      const filtered = cutoffs.filter(c => {
        const level = c.level || c.l;
        const cutoffYear = c.year || c.y;

        // Match level (UG or PG)
        if (rules.cutoffLevel === 'UG' && level !== 'UG') return false;
        if (rules.cutoffLevel === 'PG' && level !== 'PG') return false;

        // Match year
        if (cutoffYear !== year) return false;

        return true;
      });

      if (filtered.length === 0) continue;

      const optimized = optimizeStructure(filtered, 'cutoffs');
      const filename = `cutoffs-${stream}-${year}.json`;
      const filepath = path.join(DATA_DIR, filename);

      fs.writeFileSync(filepath, JSON.stringify(optimized));

      const size = fs.statSync(filepath).size;
      const gzipped = zlib.gzipSync(JSON.stringify(optimized)).length;

      stats[stream][year] = {
        count: filtered.length,
        size: (size / 1024).toFixed(1) + ' KB',
        gzipped: (gzipped / 1024).toFixed(1) + ' KB',
      };

      console.log(`   ✓ ${stream} ${year}: ${filtered.length} cutoffs → ${filename}`);
      console.log(`     Size: ${stats[stream][year].size} (${stats[stream][year].gzipped} gzipped)`);
    }

    console.log('');
  }

  return { stats, years };
}

/**
 * Generate pre-filtered static pages for popular combinations
 */
function generatePopularFilters(cutoffs) {
  console.log('⚡ Generating pre-filtered pages for popular combinations...');

  const popularFilters = [
    { stream: 'UG', category: 'General', quota: 'All India', maxRank: 5000 },
    { stream: 'UG', category: 'General', quota: 'All India', maxRank: 10000 },
    { stream: 'UG', category: 'OBC', quota: 'All India', maxRank: 10000 },
    { stream: 'PG_MEDICAL', category: 'General', quota: 'All India', maxRank: 5000 },
    { stream: 'PG_DENTAL', category: 'General', quota: 'All India', maxRank: 2000 },
  ];

  const stats = [];

  for (const filter of popularFilters) {
    const filtered = cutoffs.filter(c => {
      const level = c.level || c.l;
      const category = c.category || c.cat;
      const quota = c.quota || c.q;
      const closingRank = c.closing_rank || c.cr;

      // Match level
      const rules = STREAM_RULES[filter.stream];
      if (rules.cutoffLevel === 'UG' && level !== 'UG') return false;
      if (rules.cutoffLevel === 'PG' && level !== 'PG') return false;

      // Match filters
      if (category !== filter.category) return false;
      if (quota !== filter.quota) return false;
      if (closingRank > filter.maxRank) return false;

      return true;
    });

    const optimized = optimizeStructure(filtered, 'cutoffs');
    const filename = `cutoffs-${filter.stream}-${filter.category}-${filter.quota.replace(' ', '_')}-${filter.maxRank}.json`;
    const filepath = path.join(DATA_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(optimized));

    const size = fs.statSync(filepath).size;
    const gzipped = zlib.gzipSync(JSON.stringify(optimized)).length;

    stats.push({
      filter,
      count: filtered.length,
      size: (size / 1024).toFixed(1) + ' KB',
      gzipped: (gzipped / 1024).toFixed(1) + ' KB',
      filename,
    });

    console.log(`   ✓ ${filter.stream} ${filter.category} ${filter.quota} ≤${filter.maxRank}`);
    console.log(`     ${filtered.length} results → ${filename}`);
    console.log(`     Size: ${(gzipped / 1024).toFixed(1)} KB gzipped`);
  }

  console.log('');
  return stats;
}

/**
 * Generate metadata file
 */
function generateMetadata(collegeStats, courseStats, cutoffStats, years, popularStats) {
  console.log('📋 Generating metadata...');

  const metadata = {
    generated: new Date().toISOString(),
    version: '1.0.0',
    streams: ['UG', 'PG_MEDICAL', 'PG_DENTAL'],
    years,
    colleges: collegeStats,
    courses: courseStats,
    cutoffs: cutoffStats,
    popularFilters: popularStats,
    loadingStrategy: {
      colleges: 'Load once based on stream',
      courses: 'Load once based on stream',
      cutoffs: 'Progressive: Latest year first, then older years on-demand',
    },
    estimatedSizes: {
      UG: {
        initial: '300-400 KB (colleges + courses + cutoffs 2024)',
        full: '600-800 KB (all years)',
      },
      PG_MEDICAL: {
        initial: '200-300 KB',
        full: '400-600 KB',
      },
      PG_DENTAL: {
        initial: '150-200 KB',
        full: '300-400 KB',
      },
    },
  };

  const filepath = path.join(DATA_DIR, 'metadata.json');
  fs.writeFileSync(filepath, JSON.stringify(metadata, null, 2));

  console.log('   ✓ metadata.json');
  console.log('');

  return metadata;
}

/**
 * Generate summary report
 */
function generateSummary(metadata) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Generation Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  console.log('Stream-Specific Data:');
  for (const stream of metadata.streams) {
    const colleges = metadata.colleges[stream];
    const courses = metadata.courses[stream];

    console.log(`\n  ${stream}:`);
    console.log(`    Colleges: ${colleges.count} (${colleges.gzipped} gzipped)`);
    console.log(`    Courses: ${courses.count} (${courses.gzipped} gzipped)`);

    const years = Object.keys(metadata.cutoffs.stats[stream] || {});
    if (years.length > 0) {
      console.log(`    Cutoffs: ${years.length} years (${years.join(', ')})`);

      let totalCutoffs = 0;
      let totalSize = 0;

      for (const year of years) {
        const yearStats = metadata.cutoffs.stats[stream][year];
        totalCutoffs += yearStats.count;
        totalSize += parseFloat(yearStats.gzipped);
      }

      console.log(`      Total: ${totalCutoffs} entries (${totalSize.toFixed(1)} KB gzipped)`);
    }
  }

  console.log('\n');
  console.log('Pre-Filtered Pages:');
  console.log(`  Generated ${metadata.popularFilters.length} popular filter combinations`);
  console.log(`  These pages load instantly (no client-side filtering needed)`);

  console.log('\n');
  console.log('Loading Performance:');
  console.log('  Initial Load (2024 only):');
  console.log(`    UG: ${metadata.estimatedSizes.UG.initial}`);
  console.log(`    PG_MEDICAL: ${metadata.estimatedSizes.PG_MEDICAL.initial}`);
  console.log(`    PG_DENTAL: ${metadata.estimatedSizes.PG_DENTAL.initial}`);

  console.log('\n');
  console.log('  Full Load (all years):');
  console.log(`    UG: ${metadata.estimatedSizes.UG.full}`);
  console.log(`    PG_MEDICAL: ${metadata.estimatedSizes.PG_MEDICAL.full}`);
  console.log(`    PG_DENTAL: ${metadata.estimatedSizes.PG_DENTAL.full}`);

  console.log('\n');
  console.log('Benefits:');
  console.log('  ✅ 3-5x smaller initial download (stream filtering)');
  console.log('  ✅ Progressive loading (recent years first)');
  console.log('  ✅ Instant results for popular filters');
  console.log('  ✅ Client-side filtering for custom queries');
  console.log('  ✅ Offline capable after first load');

  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Static data generation complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Upload to R2: node scripts/upload-to-r2.js');
  console.log('  2. Build Next.js: npm run build');
  console.log('  3. Deploy: wrangler pages deploy out');
  console.log('');
}

/**
 * Main execution
 */
async function main() {
  try {
    // Load source data
    const { colleges, courses, cutoffs } = loadSourceData();

    // Generate stream-specific data
    const collegeStats = generateCollegesByStream(colleges);
    const courseStats = generateCoursesByStream(courses);
    const { stats: cutoffStats, years } = generateCutoffsByStreamAndYear(cutoffs);

    // Generate pre-filtered pages
    const popularStats = generatePopularFilters(cutoffs);

    // Generate metadata
    const metadata = generateMetadata(
      collegeStats,
      courseStats,
      cutoffStats,
      years,
      popularStats
    );

    // Show summary
    generateSummary(metadata);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
