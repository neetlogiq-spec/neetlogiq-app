import { NextRequest, NextResponse } from 'next/server';
import duckdb from 'duckdb';
import path from 'path';

// GET /api/health - Health check endpoint
export async function GET() {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0',
    services: {
      database: 'unknown',
      api: 'operational'
    },
    data: {}
  };
  
  let db: duckdb.Database | null = null;
  
  try {
    // Test database connection
    const dbPath = path.join(process.cwd(), 'counselling_data.duckdb');
    db = new duckdb.Database(dbPath);
    const conn = db.connect();
    
    // Test basic query
    const result = conn.all('SELECT COUNT(*) as total FROM counselling_data');
    const totalRecords = result[0]?.total || 0;
    
    // Get data statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT matchedCollegeName) as total_colleges,
        COUNT(DISTINCT course) as total_courses,
        COUNT(DISTINCT year) as years_covered,
        AVG(CAST(matchConfidence AS DOUBLE)) as avg_confidence
      FROM counselling_data
    `;
    
    const stats = conn.all(statsQuery)[0];
    conn.close();
    
    healthCheck.services.database = 'operational';
    healthCheck.data = {
      totalRecords: parseInt(stats?.total_records || 0),
      totalColleges: parseInt(stats?.total_colleges || 0),
      totalCourses: parseInt(stats?.total_courses || 0),
      yearsCovered: parseInt(stats?.years_covered || 0),
      avgConfidence: parseFloat((stats?.avg_confidence || 0).toFixed(3))
    };
    
    return NextResponse.json(healthCheck);
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    healthCheck.status = 'unhealthy';
    healthCheck.services.database = 'error';
    healthCheck.data = {
      error: error instanceof Error ? error.message : 'Database connection failed'
    };
    
    return NextResponse.json(healthCheck, { status: 503 });
  } finally {
    if (db) {
      try {
        db.close();
      } catch (e) {
        console.error('Error closing database:', e);
      }
    }
  }
}