import Database from 'better-sqlite3';
import path from 'path';

export interface College {
  id: string;
  name: string;
  state: string;
  city?: string;
  college_type?: string;
  management_type?: string;
  university_affiliation?: string;
  website?: string;
  address?: string;
  established_year?: number;
  recognition?: string;
  affiliation?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Course {
  id: string;
  name: string;
  code?: string;
  stream?: string;
  branch?: string;
  degree_type?: string;
  duration?: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CounsellingRecord {
  id: number;
  allIndiaRank: number;
  quota: string;
  collegeName: string;
  collegeId?: string;
  courseName: string;
  courseId?: string;
  category: string;
  round: string;
  year: number;
  state: string;
  address?: string;
  matchScore?: number;
  isMatched: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export class SQLiteService {
  private masterDb: Database.Database;
  private seatDb: Database.Database;

  constructor() {
    try {
    const masterDbPath = path.join(process.cwd(), 'data', 'sqlite', 'master_data.db');
    const seatDbPath = path.join(process.cwd(), 'data', 'sqlite', 'seat_data.db');
      
      console.log('Connecting to databases:', { masterDbPath, seatDbPath });
    
    this.masterDb = new Database(masterDbPath);
    this.seatDb = new Database(seatDbPath);
    
    this.masterDb.pragma('journal_mode = WAL');
    this.seatDb.pragma('journal_mode = WAL');
      
      console.log('Database connections established successfully');
    } catch (error) {
      console.error('Failed to initialize SQLite databases:', error);
      throw error;
    }
  }

  async getColleges(filters: {
    query?: string;
    state?: string;
    city?: string;
    type?: string;
    management?: string;
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}): Promise<{ data: College[]; total: number }> {
    try {
    const {
      query = '',
      state = '',
        city = '',
      type = '',
        management = '',
      limit = 20,
      offset = 0,
      sort_by = 'name',
      sort_order = 'asc'
    } = filters;

      console.log('getColleges called with filters:', filters);

    const whereConditions = [];
    const params: (string | number)[] = [];

    if (query) {
      whereConditions.push('(name LIKE ? OR state LIKE ?)');
      params.push(`%${query}%`, `%${query}%`);
    }

    if (state) {
      whereConditions.push('state LIKE ?');
      params.push(`%${state}%`);
    }

    if (city) {
      whereConditions.push('address LIKE ?');
      params.push(`%${city}%`);
    }

    if (type) {
      whereConditions.push('college_type LIKE ?');
      params.push(`%${type}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as total FROM (
        SELECT id, name, state, address, college_type FROM medical_colleges
        UNION ALL
        SELECT id, name, state, address, college_type FROM dental_colleges
        UNION ALL
        SELECT id, name, state, address, college_type FROM dnb_colleges
      ) as all_colleges ${whereClause}
    `;
    const countResult = this.masterDb.prepare(countQuery).get(...params) as { total: number };

    const dataQuery = `
      SELECT 
        id,
        name,
        state,
        address as city,
        college_type as type,
        college_type,
        'Unknown' as management_type,
        '' as university_affiliation,
        '' as website,
        '' as phone,
        '' as email,
        address,
        '' as description,
        '' as image_url,
        NULL as rating,
        NULL as total_seats,
        NULL as cutoff_rank,
        NULL as fees,
        NULL as placement_percentage,
        NULL as nirf_ranking,
        0 as is_government,
        0 as is_private,
        0 as is_trust,
        '' as affiliation,
        'MCI' as recognition,
        '' as university_affiliation as university_affiliation_2,
        '' as university,
        college_type,
        NULL as district,
        NULL as pincode,
        'ACTIVE' as status,
        datetime('now') as created_at,
        datetime('now') as updated_at
      FROM (
        SELECT id, name, state, address, college_type FROM medical_colleges
        UNION ALL
        SELECT id, name, state, address, college_type FROM dental_colleges
        UNION ALL
        SELECT id, name, state, address, college_type FROM dnb_colleges
      ) as all_colleges
      ${whereClause}
      ORDER BY ${sort_by} ${sort_order.toUpperCase()}
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const rows = this.masterDb.prepare(dataQuery).all(...dataParams) as any[];

    // Convert to proper College interface
    const enrichedRows = rows.map(college => ({
      ...college,
      is_government: Boolean(college.is_government),
      is_private: Boolean(college.is_private),
      is_trust: Boolean(college.is_trust),
      stream: college.type || 'Medical',
      management_type: college.management_type || 'Unknown',
      university_affiliation: college.university_affiliation || ''
    }));

    return {
      data: enrichedRows,
      total: countResult.total
    };
    } catch (error) {
      console.error('Error in getColleges:', error);
      throw error;
    }
  }

  async getCollegeById(id: string): Promise<College | null> {
    const query = `
      SELECT 
        id,
        name,
        state,
        address as city,
        college_type as type,
        college_type,
        'Unknown' as management_type,
        '' as university_affiliation,
        '' as website,
        '' as phone,
        '' as email,
        address,
        '' as description,
        '' as image_url,
        NULL as rating,
        NULL as total_seats,
        NULL as cutoff_rank,
        NULL as fees,
        NULL as placement_percentage,
        NULL as nirf_ranking,
        0 as is_government,
        0 as is_private,
        0 as is_trust,
        '' as affiliation,
        'MCI' as recognition,
        '' as university_affiliation,
        '' as university,
        college_type,
        NULL as district,
        NULL as pincode,
        'ACTIVE' as status,
        NULL as course_count,
        datetime('now') as created_at,
        datetime('now') as updated_at
      FROM (
        SELECT id, name, state, address, college_type FROM medical_colleges WHERE id = ?
        UNION ALL
        SELECT id, name, state, address, college_type FROM dental_colleges WHERE id = ?
        UNION ALL
        SELECT id, name, state, address, college_type FROM dnb_colleges WHERE id = ?
      ) as all_colleges
      LIMIT 1
    `;

    const row = this.masterDb.prepare(query).get(id, id, id) as any;
    if (!row) return null;

    // Convert boolean fields
    return {
      ...row,
      is_government: Boolean(row.is_government),
      is_private: Boolean(row.is_private),
      is_trust: Boolean(row.is_trust),
      stream: row.type || 'Medical',
      management_type: row.management_type || 'Unknown'
    };
  }

  async getCourses(filters: {
    query?: string;
    stream?: string;
    branch?: string;
    degree_type?: string;
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}): Promise<{ data: Course[]; total: number }> {
    const {
      query = '',
      stream = '',
      degree_type = '',
      limit = 20,
      offset = 0,
      sort_by = 'name',
      sort_order = 'asc'
    } = filters;

    const whereConditions = [];
    const params: (string | number)[] = [];

    if (query) {
      whereConditions.push('name LIKE ?');
      params.push(`%${query}%`);
    }

    if (stream) {
      whereConditions.push('name LIKE ?');
      params.push(`%${stream}%`);
    }

    if (degree_type) {
      whereConditions.push('name LIKE ?');
      params.push(`%${degree_type}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM courses ${whereClause}`;
    const countResult = this.masterDb.prepare(countQuery).get(...params) as { total: number };

    // First get courses from master database
    const coursesQuery = `
      SELECT 
        id,
        name as course_name,
        name,
        id as code,
        CASE 
          WHEN name LIKE '%MBBS%' THEN 'Medical'
          WHEN name LIKE '%BDS%' THEN 'Dental'
          WHEN name LIKE '%DNB%' THEN 'DNB'
          ELSE 'Medical'
        END as stream,
        CASE 
          WHEN name LIKE '%MBBS%' THEN 'MBBS'
          WHEN name LIKE '%BDS%' THEN 'BDS'
          WHEN name LIKE '%MD%' THEN 'MD'
          WHEN name LIKE '%MS%' THEN 'MS'
          WHEN name LIKE '%DNB%' THEN 'DNB'
          ELSE 'Other'
        END as degree_type,
        CASE 
          WHEN name LIKE '%MBBS%' THEN 5.5
          WHEN name LIKE '%BDS%' THEN 5
          WHEN name LIKE '%MD%' THEN 3
          WHEN name LIKE '%MS%' THEN 3
          WHEN name LIKE '%DNB%' THEN 3
          ELSE 3
        END as duration,
        name as description,
        datetime('now') as created_at,
        datetime('now') as updated_at
      FROM courses 
      ${whereClause}
      ORDER BY ${sort_by} ${sort_order.toUpperCase()}
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const rows = this.masterDb.prepare(coursesQuery).all(...dataParams) as Course[];

    // Now get college and seat data for each course using the same ID-based approach as colleges
    const enrichedRows = await Promise.all(rows.map(async (course) => {
      // Get data from seat_data using master_course_id
      const linkedDataQuery = `
        SELECT COUNT(DISTINCT master_college_id) as total_colleges, COALESCE(SUM(seats), 0) as total_seats
        FROM seat_data 
        WHERE master_course_id = ? AND is_linked = 1
      `;
      
      const linkedData = this.seatDb.prepare(linkedDataQuery).get(course.id) as { total_colleges: number; total_seats: number } | undefined;
      
      // If no data in seat_data, try to get from seat_data using course name matching
      let collegeData = linkedData;
      if (!linkedData || linkedData.total_colleges === 0) {
        const fallbackQuery = `
          SELECT COUNT(DISTINCT college_name) as total_colleges, COALESCE(SUM(seats), 0) as total_seats
          FROM seat_data 
          WHERE LOWER(course_name) = LOWER(?) AND course_name IS NOT NULL AND course_name != ''
        `;
        
        const fallbackData = this.seatDb.prepare(fallbackQuery).get(course.name) as { total_colleges: number; total_seats: number } | undefined;
        collegeData = fallbackData;
      }
      
      return {
        ...course,
        total_colleges: collegeData?.total_colleges || 0,
        total_seats: collegeData?.total_seats || 0
      };
    }));

    return {
      data: enrichedRows,
      total: countResult.total
    };
  }

  async getCourseColleges(courseId: string): Promise<College[]> {
    // First try to get colleges from seat_data using master_course_id
    const linkedQuery = `
      SELECT DISTINCT
        m.id,
        m.name,
        m.state,
        m.address as city,
        m.college_type as type,
        'Unknown' as management_type,
        '' as university_affiliation,
        '' as website,
        m.address,
        NULL as established_year,
        'MCI' as recognition,
        '' as affiliation,
        'ACTIVE' as status,
        datetime('now') as created_at,
        datetime('now') as updated_at
      FROM (
        SELECT id, name, state, address, college_type FROM medical_colleges
        UNION ALL
        SELECT id, name, state, address, college_type FROM dental_colleges
        UNION ALL
        SELECT id, name, state, address, college_type FROM dnb_colleges
      ) m
      INNER JOIN seat_data sdl ON m.id = sdl.master_college_id
      WHERE sdl.master_course_id = ? AND sdl.is_linked = 1
      ORDER BY m.name
    `;
    
    let colleges = this.masterDb.prepare(linkedQuery).all(courseId) as College[];
    
    // If no colleges found in seat_data, try fallback to seat_data
    if (colleges.length === 0) {
      // Get course name first
      const courseQuery = `SELECT name FROM courses WHERE id = ?`;
      const course = this.masterDb.prepare(courseQuery).get(courseId) as { name: string } | undefined;
      
      if (course) {
        const fallbackQuery = `
          SELECT DISTINCT
            m.id,
            m.name,
            m.state,
            m.address as city,
            m.college_type as type,
            'Unknown' as management_type,
            '' as university_affiliation,
            '' as website,
            m.address,
            NULL as established_year,
            'MCI' as recognition,
            '' as affiliation,
            'ACTIVE' as status,
            datetime('now') as created_at,
            datetime('now') as updated_at
          FROM (
            SELECT id, name, state, address, college_type FROM medical_colleges
            UNION ALL
            SELECT id, name, state, address, college_type FROM dental_colleges
            UNION ALL
            SELECT id, name, state, address, college_type FROM dnb_colleges
          ) m
          INNER JOIN seat_data sd ON LOWER(m.name) = LOWER(sd.college_name)
          WHERE LOWER(sd.course_name) = LOWER(?) AND sd.course_name IS NOT NULL AND sd.course_name != ''
          ORDER BY m.name
        `;
        
        colleges = this.masterDb.prepare(fallbackQuery).all(course.name) as College[];
      }
    }
    
    return colleges;
  }

  async getCourseById(id: string): Promise<Course | null> {
    const query = `
      SELECT 
        id,
        name,
        id as code,
        CASE 
          WHEN name LIKE '%MBBS%' THEN 'Medical'
          WHEN name LIKE '%BDS%' THEN 'Dental'
          WHEN name LIKE '%DNB%' THEN 'DNB'
          ELSE 'Medical'
        END as stream,
        CASE 
          WHEN name LIKE '%MBBS%' THEN 'MBBS'
          WHEN name LIKE '%BDS%' THEN 'BDS'
          WHEN name LIKE '%MD%' THEN 'MD'
          WHEN name LIKE '%MS%' THEN 'MS'
          WHEN name LIKE '%DNB%' THEN 'DNB'
          ELSE 'Other'
        END as degree_type,
        CASE 
          WHEN name LIKE '%MBBS%' THEN 5.5
          WHEN name LIKE '%BDS%' THEN 5
          WHEN name LIKE '%MD%' THEN 3
          WHEN name LIKE '%MS%' THEN 3
          WHEN name LIKE '%DNB%' THEN 3
          ELSE 3
        END as duration,
        name as description,
        datetime('now') as created_at,
        datetime('now') as updated_at
      FROM courses 
      WHERE id = ?
    `;

    const row = this.masterDb.prepare(query).get(id) as Course | undefined;
    return row || null;
  }

  async getCounsellingData(filters: {
    query?: string;
    year?: number;
    category?: string;
    quota?: string;
    college_id?: string;
    course_id?: string;
    session?: string;
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}): Promise<{ data: CounsellingRecord[]; total: number }> {
    console.log('Counselling data filters:', filters);
    return {
      data: [],
      total: 0
    };
  }

  async getCollegeCourseCount(collegeId: string): Promise<number> {
    // Simple approach: get course count from seat_data using master_college_id
    const courseCountQuery = `
      SELECT COUNT(DISTINCT course_name) as count 
      FROM seat_data 
      WHERE master_college_id = ? 
      AND course_name IS NOT NULL 
      AND course_name != ''
    `;
    
    const result = this.seatDb.prepare(courseCountQuery).get(collegeId) as { count: number } | undefined;
    return result?.count || 0;
  }

  async getCollegeCourses(collegeId: string): Promise<Course[]> {
    const coursesQuery = `
      SELECT DISTINCT 
        course_name as name,
        course_name as id,
        CASE 
          WHEN course_name LIKE '%MBBS%' THEN 'Medical'
          WHEN course_name LIKE '%BDS%' THEN 'Dental'
          WHEN course_name LIKE '%MD%' THEN 'Medical'
          WHEN course_name LIKE '%MS%' THEN 'Medical'
          WHEN course_name LIKE '%DNB%' THEN 'DNB'
          WHEN course_name LIKE '%DIPLOMA%' THEN 'Diploma'
          ELSE 'Medical'
        END as stream,
        course_name as code,
        CASE 
          WHEN course_name LIKE '%MBBS%' THEN 'MBBS'
          WHEN course_name LIKE '%BDS%' THEN 'BDS'
          WHEN course_name LIKE '%MD%' THEN 'MD'
          WHEN course_name LIKE '%MS%' THEN 'MS'
          WHEN course_name LIKE '%DNB%' THEN 'DNB'
          WHEN course_name LIKE '%DIPLOMA%' THEN 'DIPLOMA'
          ELSE 'OTHER'
        END as degree_type,
        CASE 
          WHEN course_name LIKE '%MBBS%' THEN 5.5
          WHEN course_name LIKE '%BDS%' THEN 5
          WHEN course_name LIKE '%MD%' THEN 3
          WHEN course_name LIKE '%MS%' THEN 3
          WHEN course_name LIKE '%DNB%' THEN 3
          WHEN course_name LIKE '%DIPLOMA%' THEN 2
          ELSE 3
        END as duration,
        course_name as description,
        COUNT(*) as total_seats,
        datetime('now') as created_at,
        datetime('now') as updated_at
      FROM seat_data 
      WHERE master_college_id = ?
      AND course_name IS NOT NULL 
      AND course_name != ''
      GROUP BY course_name
      ORDER BY course_name
    `;
    
    const courses = this.seatDb.prepare(coursesQuery).all(collegeId) as Course[];
    return courses;
  }

  async getStats(): Promise<{
    totalColleges: number;
    totalCourses: number;
    totalCounsellingRecords: number;
    statesCount: number;
    typesCount: number;
  }> {
    const collegeCountQuery = `
      SELECT COUNT(*) as count FROM (
        SELECT id FROM medical_colleges
        UNION ALL
        SELECT id FROM dental_colleges
        UNION ALL
        SELECT id FROM dnb_colleges
      ) as all_colleges
    `;
    const collegeCount = this.masterDb.prepare(collegeCountQuery).get() as { count: number };
    const courseCount = this.masterDb.prepare('SELECT COUNT(*) as count FROM courses').get() as { count: number };
    
    const statesCountQuery = `
      SELECT COUNT(DISTINCT state) as count FROM (
        SELECT state FROM medical_colleges
        UNION
        SELECT state FROM dental_colleges
        UNION
        SELECT state FROM dnb_colleges
      ) as all_states
    `;
    const statesCount = this.masterDb.prepare(statesCountQuery).get() as { count: number };
    
    const typesCountQuery = `
      SELECT COUNT(DISTINCT college_type) as count FROM (
        SELECT college_type FROM medical_colleges
        UNION
        SELECT college_type FROM dental_colleges
        UNION
        SELECT college_type FROM dnb_colleges
      ) as all_types
    `;
    const typesCount = this.masterDb.prepare(typesCountQuery).get() as { count: number };

    return {
      totalColleges: collegeCount.count,
      totalCourses: courseCount.count,
      totalCounsellingRecords: 0,
      statesCount: statesCount.count,
      typesCount: typesCount.count
    };
  }

  close() {
    this.masterDb.close();
    this.seatDb.close();
  }
}

let sqliteService: SQLiteService | null = null;

export function getSQLiteService(): SQLiteService {
  if (!sqliteService) {
    sqliteService = new SQLiteService();
  }
  return sqliteService;
}

