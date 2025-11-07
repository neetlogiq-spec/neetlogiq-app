#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

const apiRoutes = [
  // Course APIs
  { path: 'courses/route.ts', content: `import { NextRequest } from 'next/server';
import { apiEndpoints } from '@/lib/api/api-endpoints';

export async function GET(request: NextRequest) {
  return await apiEndpoints.getCourses(request);
}` },
  
  { path: 'courses/[id]/route.ts', content: `import { NextRequest } from 'next/server';
import { apiEndpoints } from '@/lib/api/api-endpoints';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return await apiEndpoints.getCourseById(params.id);
}` },

  { path: 'courses/popular/route.ts', content: `import { NextRequest } from 'next/server';
import { apiEndpoints } from '@/lib/api/api-endpoints';

export async function GET(request: NextRequest) {
  return await apiEndpoints.getPopularCourses(request);
}` },

  { path: 'courses/stats/route.ts', content: `import { NextRequest } from 'next/server';
import { apiEndpoints } from '@/lib/api/api-endpoints';

export async function GET(request: NextRequest) {
  return await apiEndpoints.getCourseStats();
}` },

  // Cutoff APIs
  { path: 'cutoffs/route.ts', content: `import { NextRequest } from 'next/server';
import { apiEndpoints } from '@/lib/api/api-endpoints';

export async function GET(request: NextRequest) {
  return await apiEndpoints.getCutoffs(request);
}` },

  { path: 'cutoffs/trends/route.ts', content: `import { NextRequest } from 'next/server';
import { apiEndpoints } from '@/lib/api/api-endpoints';

export async function GET(request: NextRequest) {
  return await apiEndpoints.getCutoffTrends(request);
}` },

  // Analytics APIs
  { path: 'analytics/overview/route.ts', content: `import { NextRequest } from 'next/server';
import { apiEndpoints } from '@/lib/api/api-endpoints';

export async function GET(request: NextRequest) {
  return await apiEndpoints.getAnalyticsOverview();
}` },

  { path: 'analytics/trends/route.ts', content: `import { NextRequest } from 'next/server';
import { apiEndpoints } from '@/lib/api/api-endpoints';

export async function GET(request: NextRequest) {
  return await apiEndpoints.getAnalyticsTrends();
}` },

  // Search APIs
  { path: 'search/unified/route.ts', content: `import { NextRequest } from 'next/server';
import { apiEndpoints } from '@/lib/api/api-endpoints';

export async function POST(request: NextRequest) {
  return await apiEndpoints.unifiedSearch(request);
}` },

  { path: 'search/suggestions/route.ts', content: `import { NextRequest } from 'next/server';
import { apiEndpoints } from '@/lib/api/api-endpoints';

export async function GET(request: NextRequest) {
  return await apiEndpoints.getSearchSuggestions(request);
}` },

  // Health API
  { path: 'health/route.ts', content: `import { NextRequest, NextResponse } from 'next/server';
import { freshDB } from '@/lib/database/fresh-database';

export async function GET(request: NextRequest) {
  try {
    const stats = await freshDB.getStats();
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'operational',
      stats
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}` }
];

async function generateAPIRoutes() {
  console.log('🚀 Generating API routes...');
  
  const baseDir = path.join(process.cwd(), 'src', 'app', 'api', 'fresh');
  
  for (const route of apiRoutes) {
    const filePath = path.join(baseDir, route.path);
    const dirPath = path.dirname(filePath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(filePath, route.content);
    console.log(`  ✅ Created ${route.path}`);
  }
  
  console.log('✅ All API routes generated successfully!');
  console.log('🎯 Total routes created:', apiRoutes.length);
}

generateAPIRoutes();
