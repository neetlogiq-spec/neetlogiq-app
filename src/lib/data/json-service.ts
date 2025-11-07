import fs from 'fs';
import path from 'path';
import { College, Course } from '@/types';

interface CollegeData {
  [key: string]: {
    id: string;
    name: string;
    short_name: string;
    type: string;
    state: string;
    city: string;
    address: string;
    management: string;
    established: string | null;
    website: string;
    university: string;
  };
}

interface CourseData {
  [key: string]: {
    id: string;
    name: string;
    short_name: string;
    level: string;
    domain: string;
    duration_years: number;
    description: string;
  };
}

interface CollegeTrend {
  college_id: string;
  year: number;
  category: string;
  round: string;
  course_name: string;
  opening_rank: number;
  closing_rank: number;
  seats: number;
}

export class JSONDataService {
  private collegesData: CollegeData | null = null;
  private coursesData: CourseData | null = null;
  private dataPath: string;

  constructor() {
    this.dataPath = path.join(process.cwd(), 'public', 'data');
    this.loadData();
  }

  private loadData() {
    try {
      const collegesPath = path.join(this.dataPath, 'master', 'colleges.json');
      const coursesPath = path.join(this.dataPath, 'master', 'courses.json');
      
      if (fs.existsSync(collegesPath)) {
        const collegesJson = fs.readFileSync(collegesPath, 'utf-8');
        this.collegesData = JSON.parse(collegesJson);
      }
      
      if (fs.existsSync(coursesPath)) {
        const coursesJson = fs.readFileSync(coursesPath, 'utf-8');
        this.coursesData = JSON.parse(coursesJson);
      }
    } catch (error) {
      console.error('Error loading JSON data:', error);
    }
  }

  private inferManagementType(collegeName: string): string {
    const name = collegeName.toUpperCase();
    
    // Known private college patterns
    const privatePatterns = [
      'ACADEMY', 'INSTITUTE OF MEDICAL SCIENCES', 'MEDICAL EDUCATION',
      'RESEARCH INSTITUTE', 'ACADEMY OF MEDICAL', 'MEDICAL COLLEGE AND RESEARCH',
      'INSTITUTE OF MEDICAL EDUCATION', 'MEDICAL EDUCATION HOSPITAL',
      'MEDICAL SCIENCES AND RESEARCH', 'MEDICAL EDUCATION AND RESEARCH',
      'MEDICAL COLLEGE HOSPITAL', 'MEDICAL INSTITUTE',
      'ACADEMY OF HEALTH', 'INSTITUTE OF HEALTH SCIENCES',
      'MEDICAL TRUST', 'CHARITABLE', 'SOCIETY'
    ];
    
    // Known trust patterns
    const trustPatterns = [
      'TRUST', 'CHRISTIAN', 'ST.', 'ST MARY', 'ST JOSEPH', 'ST JOHN',
      'MOTHER', 'LADY', 'QUEEN', 'KASTURBA', 'MAHILA', 'WOMEN'
    ];
    
    // Known government patterns
    const governmentPatterns = [
      'GOVERNMENT', 'GOVT', 'MEDICAL COLLEGE', 'ALL INDIA INSTITUTE',
      'AIIMS', 'PGIMER', 'JIPMER', 'NIMHANS', 'SGPGI', 'MAMC',
      'KEM', 'GMC', 'JJM', 'SMS', 'KGMU', 'KGMC', 'IGMC',
      'MLN MEDICAL COLLEGE', 'MGM MEDICAL COLLEGE', 'GRANT MEDICAL COLLEGE'
    ];
    
    // Check for trust patterns first (more specific)
    for (const pattern of trustPatterns) {
      if (name.includes(pattern)) {
        return 'TRUST';
      }
    }
    
    // Check for private patterns
    for (const pattern of privatePatterns) {
      if (name.includes(pattern)) {
        return 'PRIVATE';
      }
    }
    
    // Check for government patterns
    for (const pattern of governmentPatterns) {
      if (name.includes(pattern)) {
        return 'GOVERNMENT';
      }
    }
    
    // Default to government if no pattern matches
    return 'GOVERNMENT';
  }

  private convertToCollege(collegeId: string, collegeData: any): College {
    const inferredManagement = this.inferManagementType(collegeData.name);
    const isGovernment = inferredManagement === 'GOVERNMENT';
    const isPrivate = inferredManagement === 'PRIVATE';
    const isTrust = inferredManagement === 'TRUST';
    
    return {
      id: collegeData.id,
      name: collegeData.name,
      city: collegeData.city || collegeData.address || 'Unknown',
      state: collegeData.state,
      type: collegeData.type,
      stream: collegeData.type.toLowerCase(),
      management_type: collegeData.management,
      established_year: collegeData.established ? parseInt(collegeData.established) : undefined,
      website: collegeData.website,
      phone: '',
      email: '',
      address: collegeData.address,
      description: '',
      image_url: '',
      rating: undefined,
      total_seats: undefined,
      cutoff_rank: undefined,
      fees: undefined,
      placement_percentage: undefined,
      nirf_ranking: undefined,
      is_government: isGovernment,
      is_private: isPrivate,
      is_trust: isTrust,
      affiliation: '',
      recognition: 'MCI',
      university_affiliation: collegeData.university,
      university: collegeData.university,
      college_type: collegeData.type,
      district: collegeData.city,
      pincode: '',
      status: 'ACTIVE',
      course_count: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
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
    if (!this.collegesData) {
      return { data: [], total: 0 };
    }

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

    let colleges = Object.entries(this.collegesData).map(([id, data]) => 
      this.convertToCollege(id, data)
    );

    // Apply filters
    if (query) {
      const queryLower = query.toLowerCase();
      colleges = colleges.filter(college => 
        college.name.toLowerCase().includes(queryLower) ||
        college.state.toLowerCase().includes(queryLower) ||
        college.city.toLowerCase().includes(queryLower)
      );
    }

    if (state) {
      colleges = colleges.filter(college => 
        college.state.toLowerCase().includes(state.toLowerCase())
      );
    }

    if (city) {
      colleges = colleges.filter(college => 
        college.city.toLowerCase().includes(city.toLowerCase())
      );
    }

    if (type) {
      colleges = colleges.filter(college => 
        college.type.toLowerCase().includes(type.toLowerCase())
      );
    }

    if (management) {
      colleges = colleges.filter(college => 
        college.management_type.toLowerCase().includes(management.toLowerCase())
      );
    }

    // Sort
    colleges.sort((a, b) => {
      const aValue = a[sort_by as keyof College] || '';
      const bValue = b[sort_by as keyof College] || '';
      
      if (sort_order === 'desc') {
        return bValue.toString().localeCompare(aValue.toString());
      }
      return aValue.toString().localeCompare(bValue.toString());
    });

    const total = colleges.length;
    const paginatedData = colleges.slice(offset, offset + limit);

    return { data: paginatedData, total };
  }

  async getCollegeById(id: string): Promise<College | null> {
    if (!this.collegesData || !this.collegesData[id]) {
      return null;
    }

    return this.convertToCollege(id, this.collegesData[id]);
  }

  async getCollegeCourses(collegeId: string): Promise<Course[]> {
    // Try to get course data from trends folder
    const trendsPath = path.join(this.dataPath, 'trends', 'college-trends', `${collegeId}.json`);
    
    if (fs.existsSync(trendsPath)) {
      try {
        const trendDataRaw = fs.readFileSync(trendsPath, 'utf-8');
        const trendData: any = JSON.parse(trendDataRaw);
        
        // Check if it's the new format with yearly_trends
        if (trendData.yearly_trends) {
          const uniqueCourses = new Map<string, Course>();
          
          // Get course names from courses.json to map course IDs
          const courseNames: { [key: string]: string } = {};
          if (this.coursesData) {
            Object.entries(this.coursesData).forEach(([id, course]) => {
              courseNames[id] = course.name;
            });
          }
          
          // Iterate through years and courses
          Object.values(trendData.yearly_trends).forEach((yearData: any) => {
            if (yearData.courses) {
              Object.entries(yearData.courses).forEach(([courseId, courseData]: [string, any]) => {
                const courseName = courseNames[courseId] || courseId;
                
                if (!uniqueCourses.has(courseName)) {
                  // Calculate total seats from categories
                  let totalSeats = 0;
                  let closingRank = 0;
                  
                  if (courseData.categories) {
                    Object.values(courseData.categories).forEach((category: any) => {
                      if (category.candidates) {
                        totalSeats += category.candidates;
                      }
                      if (category.closing && category.closing > closingRank) {
                        closingRank = category.closing;
                      }
                    });
                  }
                  
                  uniqueCourses.set(courseName, {
                    id: courseId,
                    name: courseName,
                    stream: courseName.includes('MBBS') ? 'Medical' : 
                           courseName.includes('BDS') ? 'Dental' : 
                           courseName.includes('MD') || courseName.includes('MS') ? 'Medical' : 'Medical',
                    branch: courseName,
                    duration: courseName.includes('MBBS') ? '5.5 years' : 
                             courseName.includes('BDS') ? '5 years' : 
                             courseName.includes('MD') || courseName.includes('MS') ? '3 years' : '3 years',
                    duration_years: courseName.includes('MBBS') ? 5.5 : 
                                   courseName.includes('BDS') ? 5 : 
                                   courseName.includes('MD') || courseName.includes('MS') ? 3 : 3,
                    degree_type: courseName.includes('MBBS') ? 'UG' : 
                                courseName.includes('BDS') ? 'UG' : 
                                courseName.includes('MD') || courseName.includes('MS') ? 'PG' : 'PG',
                    total_seats: totalSeats,
                    cutoff_rank: closingRank,
                    fees: undefined,
                    eligibility: '',
                    description: '',
                    college_id: collegeId,
                    college_name: trendData.college_name || '',
                    syllabus: '',
                    career_prospects: '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  });
                }
              });
            }
          });
          
          return Array.from(uniqueCourses.values());
        }
      } catch (error) {
        console.error('Error reading college trends:', error);
      }
    }

    // Return empty array if no trends data found
    return [];
  }

  async getCollegeCourseCount(collegeId: string): Promise<number> {
    const courses = await this.getCollegeCourses(collegeId);
    return courses.length;
  }

  async getStats(): Promise<{
    totalColleges: number;
    totalCourses: number;
    totalCounsellingRecords: number;
    statesCount: number;
    typesCount: number;
  }> {
    const totalColleges = this.collegesData ? Object.keys(this.collegesData).length : 0;
    const totalCourses = this.coursesData ? Object.keys(this.coursesData).length : 0;
    
    // Count unique states
    const states = new Set<string>();
    const types = new Set<string>();
    
    if (this.collegesData) {
      Object.values(this.collegesData).forEach(college => {
        states.add(college.state);
        types.add(college.type);
      });
    }
    
    return {
      totalColleges,
      totalCourses,
      totalCounsellingRecords: 0, // Not implemented for JSON yet
      statesCount: states.size,
      typesCount: types.size
    };
  }
}

// Singleton instance
let jsonDataService: JSONDataService | null = null;

export function getJSONDataService(): JSONDataService {
  if (!jsonDataService) {
    jsonDataService = new JSONDataService();
  }
  return jsonDataService;
}