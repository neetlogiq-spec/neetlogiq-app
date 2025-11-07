#!/usr/bin/env node
/**
 * Pre-generate Filtered Cutoffs - BEST Option
 * Creates pre-filtered JSON files at build time
 */

const fs = require('fs');
const path = require('path');

// Generate filtered files for common queries
function generateFilteredCutoffs(data, outputDir) {
  const commonFilters = [
    { college: 'AIIMS', data: data.filter(r => r.college_name.includes('AIIMS')) },
    { category: 'GENERAL', data: data.filter(r => r.category === 'GENERAL') },
    { rank: 'low', data: data.filter(r => r.closing_rank < 10000) },
    { year: 2024, data: data.filter(r => r.year === 2024) }
  ];

  commonFilters.forEach(filter => {
    const filename = Object.entries(filter)[0].join('_') + '.json';
    fs.writeFileSync(
      path.join(outputDir, filename),
      JSON.stringify(filter[1])
    );
  });
}
