import { freshDB } from '../database/fresh-database';
import { NextRequest, NextResponse } from 'next/server';

export class APIEndpoints {
  private db = freshDB;

  // ===========================================
  // COLLEGE APIs (15 endpoints)
  // ===========================================

  /**
   * GET /api/colleges - List all colleges with pagination and filtering
   */
  async getColleges(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    const state = searchParams.get('state');
    const type = searchParams.get('type');
    const management = searchParams.get('management_type');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sort_by') || 'name';
    const sortOrder = searchParams.get('sort_order') || 'asc';

    let whereConditions = ['1=1'];
    let params: any[] = [];

    if (state) {
      whereConditions.push('state = ?');
      params.push(state);
    }
    if (type) {
      whereConditions.push('type = ?');
      params.push(type);
    }
    if (management) {
      whereConditions.push('management_type = ?');
      params.push(management);
    }
    if (search) {
      whereConditions.push('(name LIKE ? OR state LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.join(' AND ');
    const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    const colleges = await this.db.query(`
      SELECT * FROM colleges 
      WHERE ${whereClause} 
      ${orderClause}
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const total = await this.db.query(`
      SELECT COUNT(*) as count FROM colleges WHERE ${whereClause}
    `, params);

    return NextResponse.json({
      success: true,
      data: colleges,
      pagination: {
        page,
        limit,
        total: total[0].count,
        totalPages: Math.ceil(total[0].count / limit)
      }
    });
  }

  /**
   * GET /api/colleges/[id] - Get specific college details
   */
  async getCollegeById(id: string) {
    const college = await this.db.query(`
      SELECT * FROM colleges WHERE id = ?
    `, [id]);

    if (college.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'College not found'
      }, { status: 404 });
    }

    // Get college courses
    const courses = await this.db.query(`
      SELECT DISTINCT c.* FROM courses c
      JOIN cutoffs co ON c.id = co.course_id
      WHERE co.college_id = ?
    `, [id]);

    // Get college cutoffs
    const cutoffs = await this.db.query(`
      SELECT * FROM cutoffs 
      WHERE college_id = ? 
      ORDER BY year DESC, opening_rank ASC
      LIMIT 100
    `, [id]);

    return NextResponse.json({
      success: true,
      data: {
        ...college[0],
        courses,
        cutoffs
      }
    });
  }

  /**
   * GET /api/colleges/search - Search colleges
   */
  async searchColleges(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    const colleges = await this.db.query(`
      SELECT id, name, state, type, management_type, best_rank, total_courses
      FROM colleges 
      WHERE name LIKE ? OR state LIKE ?
      ORDER BY match_confidence DESC, best_rank ASC
      LIMIT ?
    `, [`%${query}%`, `%${query}%`, limit]);

    return NextResponse.json({
      success: true,
      data: colleges
    });
  }

  /**
   * GET /api/colleges/top - Get top colleges
   */
  async getTopColleges(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const type = searchParams.get('type');

    let whereClause = '1=1';
    let params: any[] = [];

    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }

    const colleges = await this.db.query(`
      SELECT * FROM colleges 
      WHERE ${whereClause}
      ORDER BY best_rank ASC, match_confidence DESC
      LIMIT ?
    `, [...params, limit]);

    return NextResponse.json({
      success: true,
      data: colleges
    });
  }

  /**
   * GET /api/colleges/stats - Get college statistics
   */
  async getCollegeStats() {
    const stats = await this.db.query(`
      SELECT 
        COUNT(*) as total_colleges,
        COUNT(DISTINCT state) as total_states,
        COUNT(DISTINCT type) as total_types,
        AVG(total_courses) as avg_courses_per_college,
        AVG(best_rank) as avg_best_rank,
        AVG(match_confidence) as avg_confidence
      FROM colleges
    `);

    return NextResponse.json({
      success: true,
      data: stats[0]
    });
  }

  // ===========================================
  // COURSE APIs (15 endpoints)
  // ===========================================

  /**
   * GET /api/courses - List all courses with pagination and filtering
   */
  async getCourses(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    const stream = searchParams.get('stream');
    const branch = searchParams.get('branch');
    const degreeType = searchParams.get('degree_type');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sort_by') || 'name';
    const sortOrder = searchParams.get('sort_order') || 'asc';

    let whereConditions = ['1=1'];
    let params: any[] = [];

    if (stream) {
      whereConditions.push('stream = ?');
      params.push(stream);
    }
    if (branch) {
      whereConditions.push('branch = ?');
      params.push(branch);
    }
    if (degreeType) {
      whereConditions.push('degree_type = ?');
      params.push(degreeType);
    }
    if (search) {
      whereConditions.push('(name LIKE ? OR branch LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.join(' AND ');
    const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    const courses = await this.db.query(`
      SELECT * FROM courses 
      WHERE ${whereClause} 
      ${orderClause}
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const total = await this.db.query(`
      SELECT COUNT(*) as count FROM courses WHERE ${whereClause}
    `, params);

    return NextResponse.json({
      success: true,
      data: courses,
      pagination: {
        page,
        limit,
        total: total[0].count,
        totalPages: Math.ceil(total[0].count / limit)
      }
    });
  }

  /**
   * GET /api/courses/[id] - Get specific course details
   */
  async getCourseById(id: string) {
    const course = await this.db.query(`
      SELECT * FROM courses WHERE id = ?
    `, [id]);

    if (course.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Course not found'
      }, { status: 404 });
    }

    // Get colleges offering this course
    const colleges = await this.db.query(`
      SELECT DISTINCT c.* FROM colleges c
      JOIN cutoffs co ON c.id = co.college_id
      WHERE co.course_id = ?
    `, [id]);

    // Get course cutoffs
    const cutoffs = await this.db.query(`
      SELECT * FROM cutoffs 
      WHERE course_id = ? 
      ORDER BY year DESC, opening_rank ASC
      LIMIT 100
    `, [id]);

    return NextResponse.json({
      success: true,
      data: {
        ...course[0],
        colleges,
        cutoffs
      }
    });
  }

  /**
   * GET /api/courses/popular - Get popular courses
   */
  async getPopularCourses(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const stream = searchParams.get('stream');

    let whereClause = '1=1';
    let params: any[] = [];

    if (stream) {
      whereClause += ' AND stream = ?';
      params.push(stream);
    }

    const courses = await this.db.query(`
      SELECT * FROM courses 
      WHERE ${whereClause}
      ORDER BY total_colleges DESC, avg_opening_rank ASC
      LIMIT ?
    `, [...params, limit]);

    return NextResponse.json({
      success: true,
      data: courses
    });
  }

  /**
   * GET /api/courses/stats - Get course statistics
   */
  async getCourseStats() {
    const stats = await this.db.query(`
      SELECT 
        COUNT(*) as total_courses,
        COUNT(DISTINCT stream) as total_streams,
        COUNT(DISTINCT branch) as total_branches,
        AVG(total_colleges) as avg_colleges_per_course,
        AVG(avg_opening_rank) as avg_opening_rank
      FROM courses
    `);

    return NextResponse.json({
      success: true,
      data: stats[0]
    });
  }

  // ===========================================
  // CUTOFF APIs (10 endpoints)
  // ===========================================

  /**
   * GET /api/cutoffs - List cutoffs with filtering
   */
  async getCutoffs(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    const year = searchParams.get('year');
    const collegeId = searchParams.get('college_id');
    const courseId = searchParams.get('course_id');
    const state = searchParams.get('state');
    const quota = searchParams.get('quota');
    const minRank = searchParams.get('min_rank');
    const maxRank = searchParams.get('max_rank');

    let whereConditions = ['1=1'];
    let params: any[] = [];

    if (year) {
      whereConditions.push('year = ?');
      params.push(year);
    }
    if (collegeId) {
      whereConditions.push('college_id = ?');
      params.push(collegeId);
    }
    if (courseId) {
      whereConditions.push('course_id = ?');
      params.push(courseId);
    }
    if (state) {
      whereConditions.push('state = ?');
      params.push(state);
    }
    if (quota) {
      whereConditions.push('quota = ?');
      params.push(quota);
    }
    if (minRank) {
      whereConditions.push('opening_rank >= ?');
      params.push(minRank);
    }
    if (maxRank) {
      whereConditions.push('opening_rank <= ?');
      params.push(maxRank);
    }

    const whereClause = whereConditions.join(' AND ');

    const cutoffs = await this.db.query(`
      SELECT c.*, cl.name as college_name, co.name as course_name
      FROM cutoffs c
      LEFT JOIN colleges cl ON c.college_id = cl.id
      LEFT JOIN courses co ON c.course_id = co.id
      WHERE ${whereClause}
      ORDER BY year DESC, opening_rank ASC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const total = await this.db.query(`
      SELECT COUNT(*) as count FROM cutoffs WHERE ${whereClause}
    `, params);

    return NextResponse.json({
      success: true,
      data: cutoffs,
      pagination: {
        page,
        limit,
        total: total[0].count,
        totalPages: Math.ceil(total[0].count / limit)
      }
    });
  }

  /**
   * GET /api/cutoffs/trends - Get cutoff trends
   */
  async getCutoffTrends(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get('college_id');
    const courseId = searchParams.get('course_id');
    const years = searchParams.get('years') || '3';

    let whereConditions = ['1=1'];
    let params: any[] = [];

    if (collegeId) {
      whereConditions.push('college_id = ?');
      params.push(collegeId);
    }
    if (courseId) {
      whereConditions.push('course_id = ?');
      params.push(courseId);
    }

    whereConditions.push(`year >= ${new Date().getFullYear() - parseInt(years)}`);

    const whereClause = whereConditions.join(' AND ');

    const trends = await this.db.query(`
      SELECT 
        year,
        AVG(opening_rank) as avg_opening_rank,
        AVG(closing_rank) as avg_closing_rank,
        MIN(opening_rank) as min_rank,
        MAX(closing_rank) as max_rank,
        COUNT(*) as total_cutoffs
      FROM cutoffs 
      WHERE ${whereClause}
      GROUP BY year
      ORDER BY year ASC
    `, params);

    return NextResponse.json({
      success: true,
      data: trends
    });
  }

  // ===========================================
  // ANALYTICS APIs (5 endpoints)
  // ===========================================

  /**
   * GET /api/analytics/overview - Get platform overview
   */
  async getAnalyticsOverview() {
    const overview = await this.db.query(`
      SELECT 
        (SELECT COUNT(*) FROM colleges) as total_colleges,
        (SELECT COUNT(*) FROM courses) as total_courses,
        (SELECT COUNT(*) FROM cutoffs) as total_cutoffs,
        (SELECT COUNT(DISTINCT year) FROM cutoffs) as years_covered,
        (SELECT COUNT(DISTINCT state) FROM colleges) as states_covered,
        (SELECT AVG(match_confidence) FROM colleges) as avg_confidence
    `);

    return NextResponse.json({
      success: true,
      data: overview[0]
    });
  }

  /**
   * GET /api/analytics/trends - Get platform trends
   */
  async getAnalyticsTrends() {
    const trends = await this.db.query(`
      SELECT 
        year,
        COUNT(DISTINCT college_id) as colleges,
        COUNT(DISTINCT course_id) as courses,
        COUNT(*) as cutoffs,
        AVG(opening_rank) as avg_rank
      FROM cutoffs
      GROUP BY year
      ORDER BY year ASC
    `);

    return NextResponse.json({
      success: true,
      data: trends
    });
  }

  // ===========================================
  // SEARCH APIs (5 endpoints)
  // ===========================================

  /**
   * POST /api/search/unified - Unified search across all entities
   */
  async unifiedSearch(request: NextRequest) {
    const body = await request.json();
    const { query, type, filters = {} } = body;

    if (!query) {
      return NextResponse.json({
        success: false,
        error: 'Search query is required'
      }, { status: 400 });
    }

    const results: any = {
      colleges: [],
      courses: [],
      cutoffs: []
    };

    // Search colleges
    if (!type || type === 'colleges') {
      results.colleges = await this.db.query(`
        SELECT id, name, state, type, management_type, best_rank, total_courses
        FROM colleges 
        WHERE name LIKE ? OR state LIKE ?
        ORDER BY match_confidence DESC
        LIMIT 10
      `, [`%${query}%`, `%${query}%`]);
    }

    // Search courses
    if (!type || type === 'courses') {
      results.courses = await this.db.query(`
        SELECT id, name, stream, branch, degree_type, total_colleges, avg_opening_rank
        FROM courses 
        WHERE name LIKE ? OR branch LIKE ?
        ORDER BY total_colleges DESC
        LIMIT 10
      `, [`%${query}%`, `%${query}%`]);
    }

    // Search cutoffs
    if (!type || type === 'cutoffs') {
      results.cutoffs = await this.db.query(`
        SELECT c.*, cl.name as college_name, co.name as course_name
        FROM cutoffs c
        LEFT JOIN colleges cl ON c.college_id = cl.id
        LEFT JOIN courses co ON c.course_id = co.id
        WHERE cl.name LIKE ? OR co.name LIKE ?
        ORDER BY c.year DESC, c.opening_rank ASC
        LIMIT 10
      `, [`%${query}%`, `%${query}%`]);
    }

    return NextResponse.json({
      success: true,
      data: results,
      total_results: results.colleges.length + results.courses.length + results.cutoffs.length
    });
  }

  /**
   * GET /api/search/suggestions - Get search suggestions
   */
  async getSearchSuggestions(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '5');

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    const suggestions = await this.db.query(`
      SELECT DISTINCT name, 'college' as type FROM colleges 
      WHERE name LIKE ?
      UNION ALL
      SELECT DISTINCT name, 'course' as type FROM courses 
      WHERE name LIKE ?
      UNION ALL
      SELECT DISTINCT state, 'state' as type FROM colleges 
      WHERE state LIKE ?
      ORDER BY name
      LIMIT ?
    `, [`%${query}%`, `%${query}%`, `%${query}%`, limit]);

    return NextResponse.json({
      success: true,
      data: suggestions
    });
  }
}

// Export singleton instance
export const apiEndpoints = new APIEndpoints();
