import fs from 'fs';
import path from 'path';
import { College, Course, Cutoff, SearchParams } from '@/types';

// Enhanced database service with DuckDB + Parquet integration
let collegesData: any[] = [];
let coursesData: any[] = [];
let cutoffsData: any[] = [];
let dbInitialized = false;

// Enhanced data loading with DuckDB + Parquet integration
const loadData = async () => {
  if (dbInitialized) return; // Already initialized
  
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const collegesPath = path.join(dataDir, 'colleges.parquet');
    const coursesPath = path.join(dataDir, 'courses.parquet');
    const cutoffsPath = path.join(dataDir, 'cutoffs.parquet');
    
    console.log('📊 Initializing DuckDB + Parquet integration...');
    
    // Check if Parquet files exist
    if (!fs.existsSync(collegesPath) || !fs.existsSync(coursesPath)) {
      console.warn('⚠️ Parquet files not found, using enhanced mock data');
      await loadEnhancedMockData();
      return;
    }

    // Try to use DuckDB for real Parquet reading
    try {
      await loadWithDuckDB(collegesPath, coursesPath, cutoffsPath);
    } catch (duckdbError) {
      console.warn('⚠️ DuckDB failed, falling back to enhanced mock data:', duckdbError);
      await loadEnhancedMockData();
    }
    
    dbInitialized = true;
    console.log('✅ Database initialized successfully');
    console.log(`   - Colleges: ${collegesData.length}`);
    console.log(`   - Courses: ${coursesData.length}`);
    console.log(`   - Cutoffs: ${cutoffsData.length}`);
    
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    await loadEnhancedMockData();
    dbInitialized = true;
  }
};

// Load data using DuckDB + Parquet
const loadWithDuckDB = async (collegesPath: string, coursesPath: string, cutoffsPath: string) => {
  try {
    // Import DuckDB dynamically
    const { AsyncDuckDB } = await import('@duckdb/duckdb-wasm');
    
    const db = new AsyncDuckDB();
    await db.instantiate();
    
    // Read Parquet files
    const collegesQuery = `SELECT * FROM '${collegesPath}'`;
    const coursesQuery = `SELECT * FROM '${coursesPath}'`;
    const cutoffsQuery = `SELECT * FROM '${cutoffsPath}'`;
    
    const [collegesResult, coursesResult, cutoffsResult] = await Promise.all([
      db.query(collegesQuery),
      db.query(coursesQuery),
      db.query(cutoffsQuery)
    ]);
    
    collegesData = collegesResult.map(mapCollegeRow);
    coursesData = coursesResult.map(mapCourseRow);
    cutoffsData = cutoffsResult.map(mapCutoffRow);
    
    await db.terminate();
    console.log('✅ Successfully loaded data from Parquet files using DuckDB');
    
  } catch (error) {
    console.error('❌ DuckDB loading failed:', error);
    throw error;
  }
};

// Enhanced mock data with more comprehensive dataset
const loadEnhancedMockData = async () => {
  console.log('📊 Loading enhanced mock data...');
  
    collegesData = [
      {
        id: 1,
        name: 'All India Institute of Medical Sciences, New Delhi',
        city: 'New Delhi',
        state: 'Delhi',
        stream: 'Medical',
        management_type: 'GOVERNMENT',
        establishment_year: 1956,
        university: 'AIIMS',
        website: 'https://www.aiims.edu',
        email: 'info@aiims.edu',
        phone: '+91-11-26588500',
        accreditation: 'MCI',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 2,
        name: 'Maulana Azad Medical College',
        city: 'New Delhi',
        state: 'Delhi',
        stream: 'Medical',
        management_type: 'GOVERNMENT',
        establishment_year: 1956,
        university: 'Delhi University',
        website: 'https://www.mamc.ac.in',
        email: 'info@mamc.ac.in',
        phone: '+91-11-23239271',
        accreditation: 'MCI',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 3,
        name: 'Lady Hardinge Medical College',
        city: 'New Delhi',
        state: 'Delhi',
        stream: 'Medical',
        management_type: 'GOVERNMENT',
        establishment_year: 1916,
        university: 'Delhi University',
        website: 'https://www.lhmc.ac.in',
        email: 'info@lhmc.ac.in',
        phone: '+91-11-23388444',
        accreditation: 'MCI',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    
    coursesData = [
      {
        id: 1,
        name: 'MBBS',
        stream: 'Medical',
        branch: 'UG',
        duration: 66,
        degree_type: 'MEDICAL',
        total_seats: 100,
        fees: 'Rs. 1,000 per year',
        college_id: 1,
        college_name: 'All India Institute of Medical Sciences, New Delhi',
        city: 'New Delhi',
        state: 'Delhi',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 2,
        name: 'BDS',
        stream: 'Dental',
        branch: 'UG',
        duration: 60,
        degree_type: 'DENTAL',
        total_seats: 50,
        fees: 'Rs. 1,000 per year',
        college_id: 2,
        college_name: 'Maulana Azad Medical College',
        city: 'New Delhi',
        state: 'Delhi',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    
    cutoffsData = [
      {
        id: 1,
        college_id: 1,
        college_name: 'All India Institute of Medical Sciences, New Delhi',
        course_id: 1,
        course_name: 'MBBS',
        year: 2024,
        category: 'General',
        opening_rank: 1,
        closing_rank: 50,
        round: 'r1',
        state: 'Delhi',
        authority: 'NEET',
        quota: 'GENERAL',
        opening_score: 720.0,
        closing_score: 680.0,
        seats_available: 100,
        seats_filled: 100,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    
  console.log('✅ Enhanced mock data loaded successfully');
};

// Mapping functions for database rows
const mapCollegeRow = (row: any): College => ({
  id: row.id?.toString() || '',
  name: row.name || '',
  city: row.city || '',
  state: row.state || '',
  stream: row.stream || '',
  management_type: row.management_type || 'PRIVATE',
  total_seats: row.total_seats || 0,
  cutoff_rank: row.cutoff_rank || 0,
  fees: row.fees || 0,
  rating: row.rating || 0,
  description: row.description || '',
  website: row.website || '',
  phone: row.phone || '',
  email: row.email || '',
  address: row.address || '',
  established_year: row.established_year || 0,
  affiliation: row.affiliation || '',
  recognition: row.recognition || ''
});

const mapCourseRow = (row: any): Course => ({
  id: row.id?.toString() || '',
  name: row.name || '',
  stream: row.stream || '',
  branch: row.branch || 'UG',
  duration: row.duration || '',
  degree_type: row.degree_type || '',
  total_seats: row.total_seats || 0,
  cutoff_rank: row.cutoff_rank || 0,
  fees: row.fees || 0,
  college_id: row.college_id?.toString() || '',
  college_name: row.college_name || '',
  description: row.description || '',
  eligibility: row.eligibility || '',
  syllabus: row.syllabus || '',
  career_prospects: row.career_prospects || ''
});

const mapCutoffRow = (row: any): Cutoff => ({
  id: row.id?.toString() || '',
  college_id: row.college_id?.toString() || '',
  college_name: row.college_name || '',
  course_id: row.course_id?.toString() || '',
  course_name: row.course_name || '',
  year: row.year || new Date().getFullYear(),
  category: row.category || 'General',
  opening_rank: row.opening_rank || 0,
  closing_rank: row.closing_rank || 0,
  round: row.round || 1,
  state: row.state || '',
  quota: row.quota || 'General',
  seat_type: row.seat_type || 'General'
});

export const getDatabase = async () => {
  await loadData();
  return { colleges: collegesData, courses: coursesData, cutoffs: cutoffsData };
};

export const getConnection = async () => {
  await loadData();
  return { colleges: collegesData, courses: coursesData, cutoffs: cutoffsData };
};

export const closeDatabase = async (): Promise<void> => {
    console.log('✅ Database connection closed');
};

// Database queries
export const getColleges = async (limit: number = 10, offset: number = 0) => {
  await loadData();
  return collegesData.slice(offset, offset + limit);
};

export const getCollegesCount = async (): Promise<number> => {
  await loadData();
  return collegesData.length;
};

// Enhanced search functions with filters
export const searchColleges = async (params: SearchParams) => {
  await loadData();
  const { query = '', filters = {}, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;
  
  let filtered = collegesData;
  
  // Apply text search
  if (query) {
    const searchTerm = query.toLowerCase();
    filtered = filtered.filter(college => 
      college.name.toLowerCase().includes(searchTerm) ||
      college.city.toLowerCase().includes(searchTerm) ||
      college.state.toLowerCase().includes(searchTerm) ||
      college.stream.toLowerCase().includes(searchTerm) ||
      college.management_type.toLowerCase().includes(searchTerm) ||
      college.description?.toLowerCase().includes(searchTerm)
    );
  }
  
  // Apply filters
  if (filters.stream) {
    filtered = filtered.filter(college => college.stream === filters.stream);
  }
  if (filters.state) {
    filtered = filtered.filter(college => college.state === filters.state);
  }
  if (filters.city) {
    filtered = filtered.filter(college => college.city === filters.city);
  }
  if (filters.management_type) {
    filtered = filtered.filter(college => college.management_type === filters.management_type);
  }
  
  return {
    data: filtered.slice(offset, offset + limit),
    total: filtered.length,
    page,
    limit,
    totalPages: Math.ceil(filtered.length / limit)
  };
};

export const getCourses = async (limit: number = 10, offset: number = 0) => {
  await loadData();
  return coursesData.slice(offset, offset + limit);
};

export const getCoursesCount = async (): Promise<number> => {
  await loadData();
  return coursesData.length;
};

export const searchCourses = async (params: SearchParams) => {
  await loadData();
  const { query = '', filters = {}, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;
  
  let filtered = coursesData;
  
  // Apply text search
  if (query) {
    const searchTerm = query.toLowerCase();
    filtered = filtered.filter(course => 
      course.name.toLowerCase().includes(searchTerm) ||
      course.stream.toLowerCase().includes(searchTerm) ||
      course.branch.toLowerCase().includes(searchTerm) ||
      course.degree_type.toLowerCase().includes(searchTerm) ||
      course.college_name.toLowerCase().includes(searchTerm) ||
      course.description?.toLowerCase().includes(searchTerm)
    );
  }
  
  // Apply filters
  if (filters.stream) {
    filtered = filtered.filter(course => course.stream === filters.stream);
  }
  if (filters.branch) {
    filtered = filtered.filter(course => course.branch === filters.branch);
  }
  if (filters.degree_type) {
    filtered = filtered.filter(course => course.degree_type === filters.degree_type);
  }
  
  return {
    data: filtered.slice(offset, offset + limit),
    total: filtered.length,
    page,
    limit,
    totalPages: Math.ceil(filtered.length / limit)
  };
};

export const getCutoffs = async (limit: number = 10, offset: number = 0) => {
  await loadData();
  return cutoffsData.slice(offset, offset + limit);
};

export const getCutoffsCount = async (): Promise<number> => {
  await loadData();
  return cutoffsData.length;
};

export const searchCutoffs = async (params: SearchParams) => {
  await loadData();
  const { query = '', filters = {}, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;
  
  let filtered = cutoffsData;
  
  // Apply text search
  if (query) {
    const searchTerm = query.toLowerCase();
    filtered = filtered.filter(cutoff => 
      cutoff.college_name.toLowerCase().includes(searchTerm) ||
      cutoff.course_name.toLowerCase().includes(searchTerm) ||
      cutoff.category.toLowerCase().includes(searchTerm) ||
      cutoff.state.toLowerCase().includes(searchTerm)
    );
  }
  
  // Apply filters
  if (filters.year) {
    filtered = filtered.filter(cutoff => cutoff.year === filters.year);
  }
  if (filters.category) {
    filtered = filtered.filter(cutoff => cutoff.category === filters.category);
  }
  if (filters.state) {
    filtered = filtered.filter(cutoff => cutoff.state === filters.state);
  }
  if (filters.round) {
    filtered = filtered.filter(cutoff => cutoff.round === filters.round);
  }
  
  return {
    data: filtered.slice(offset, offset + limit),
    total: filtered.length,
    page,
    limit,
    totalPages: Math.ceil(filtered.length / limit)
  };
};

export const getFilterOptions = async () => {
  await loadData();
  
  // Get streams
  const streams = collegesData.reduce((acc, college) => {
    const stream = college.stream;
    if (stream) {
      acc[stream] = (acc[stream] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  // Get management types
  const managementTypes = collegesData.reduce((acc, college) => {
    const type = college.management_type;
    if (type) {
      acc[type] = (acc[type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  // Get states
  const states = collegesData.reduce((acc, college) => {
    const state = college.state;
    if (state) {
      acc[state] = (acc[state] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  // Get cities
  const cities = collegesData.reduce((acc, college) => {
    const city = college.city;
    if (city) {
      acc[city] = (acc[city] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  // Get branches
  const branches = coursesData.reduce((acc, course) => {
    const branch = course.branch;
    if (branch) {
      acc[branch] = (acc[branch] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  // Get degree types
  const degreeTypes = coursesData.reduce((acc, course) => {
    const type = course.degree_type;
    if (type) {
      acc[type] = (acc[type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  return {
    streams: Object.entries(streams).map(([value, count]) => ({ value, label: value, count: count as number })),
    management_types: Object.entries(managementTypes).map(([value, count]) => ({ value, label: value, count: count as number })),
    states: Object.entries(states).map(([value, count]) => ({ value, label: value, count: count as number })),
    cities: Object.entries(cities).slice(0, 50).map(([value, count]) => ({ value, label: value, count: count as number })),
    branches: Object.entries(branches).map(([value, count]) => ({ value, label: value, count: count as number })),
    degree_types: Object.entries(degreeTypes).map(([value, count]) => ({ value, label: value, count: count as number }))
  };
};

// Database statistics
export const getDatabaseStats = async () => {
  const collegesCount = await getCollegesCount();
  const coursesCount = await getCoursesCount();
  const cutoffsCount = await getCutoffsCount();
  
  return {
    colleges: collegesCount,
    courses: coursesCount,
    cutoffs: cutoffsCount,
    total: collegesCount + coursesCount + cutoffsCount
  };
};