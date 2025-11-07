import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface SearchResult {
  type: 'college' | 'course' | 'counselling';
  id: string;
  name: string;
  description?: string;
  metadata: Record<string, any>;
}

interface SearchParams {
  query: string;
  types?: string[];
  page?: number;
  limit?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('query') || '';
    const types = searchParams.get('types')?.split(',') || ['college', 'course', 'counselling'];
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query.trim()) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const searchTerm = query.toLowerCase();
    const results: SearchResult[] = [];

    // Search colleges
    if (types.includes('college')) {
      const collegesPath = path.join(process.cwd(), 'data', 'colleges_master.json');
      if (fs.existsSync(collegesPath)) {
        const collegesData = JSON.parse(fs.readFileSync(collegesPath, 'utf8'));
        const colleges = collegesData.colleges || [];
        
        const collegeResults = colleges
          .filter((college: any) => 
            college.name.toLowerCase().includes(searchTerm) ||
            college.city.toLowerCase().includes(searchTerm) ||
            college.state.toLowerCase().includes(searchTerm) ||
            (college.university_affiliation && college.university_affiliation.toLowerCase().includes(searchTerm))
          )
          .slice(0, 10)
          .map((college: any) => ({
            type: 'college' as const,
            id: college.id,
            name: college.name,
            description: `${college.city}, ${college.state} • ${college.type}`,
            metadata: {
              state: college.state,
              city: college.city,
              type: college.type,
              management: college.management
            }
          }));
        
        results.push(...collegeResults);
      }
    }

    // Search courses
    if (types.includes('course')) {
      const coursesPath = path.join(process.cwd(), 'data', 'courses_master.json');
      if (fs.existsSync(coursesPath)) {
        const coursesData = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));
        const courses = coursesData.courses || [];
        
        const courseResults = courses
          .filter((course: any) => 
            course.name.toLowerCase().includes(searchTerm) ||
            course.code.toLowerCase().includes(searchTerm) ||
            course.stream.toLowerCase().includes(searchTerm) ||
            course.branch.toLowerCase().includes(searchTerm)
          )
          .slice(0, 10)
          .map((course: any) => ({
            type: 'course' as const,
            id: course.id,
            name: course.name,
            description: `${course.stream} • ${course.branch} • ${course.degree_type}`,
            metadata: {
              code: course.code,
              stream: course.stream,
              branch: course.branch,
              degree_type: course.degree_type,
              duration_years: course.duration_years
            }
          }));
        
        results.push(...courseResults);
      }
    }

    // Search counselling records
    if (types.includes('counselling')) {
      const counsellingFiles = [
        'kea2024_counselling_processed_20250927_124353.json',
        'kea2023_counselling_processed_20250927_124448.json',
        'aiq2024_counselling_processed_20250927_124438.json',
        'aiq2023_counselling_processed_20250927_124415.json'
      ];

      for (const file of counsellingFiles) {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (Array.isArray(data)) {
              const counsellingResults = data
                .filter((record: any) => 
                  (record.college_name && record.college_name.toLowerCase().includes(searchTerm)) ||
                  (record.course_name && record.course_name.toLowerCase().includes(searchTerm)) ||
                  (record.state && record.state.toLowerCase().includes(searchTerm))
                )
                .slice(0, 5)
                .map((record: any) => ({
                  type: 'counselling' as const,
                  id: record.id,
                  name: `${record.college_name} - ${record.course_name}`,
                  description: `Rank ${record.all_india_rank} • ${record.state} • ${record.counselling_session}`,
                  metadata: {
                    all_india_rank: record.all_india_rank,
                    college_name: record.college_name,
                    course_name: record.course_name,
                    state: record.state,
                    category: record.category,
                    quota: record.quota,
                    round: record.round,
                    year: record.year,
                    counselling_session: record.counselling_session
                  }
                }));
              
              results.push(...counsellingResults);
            }
          } catch (error) {
            console.warn(`Error loading ${file}:`, error);
          }
        }
      }
    }

    // Sort results by relevance (exact matches first, then partial matches)
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase().includes(searchTerm);
      const bExact = b.name.toLowerCase().includes(searchTerm);
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      return a.name.localeCompare(b.name);
    });

    // Apply pagination
    const total = results.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedResults = results.slice(startIndex, endIndex);

    return NextResponse.json({
      data: paginatedResults,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: endIndex < total,
        has_prev: page > 1
      },
      query: {
        search_term: query,
        types: types,
        total_results: total
      }
    });

  } catch (error) {
    console.error('Error performing search:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
