'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEdgeData } from '@/hooks/useEdgeData';

export type StreamType = 'UG' | 'PG_MEDICAL' | 'PG_DENTAL';

export interface StreamConfig {
  id: StreamType;
  name: string;
  description: string;
  collegeTypes: string[];
  courseTypes: string[];
  cutoffTypes: string[];
  excludeStreams?: string[];
  showColleges: string[]; // Courses that colleges must offer to be shown
  showCourses: string[];  // Course types to show in courses list
  cutoffFilter: string[]; // Course types to show in cutoffs
  progressionContext: string; // Context message for user
}

export const STREAM_CONFIGS: Record<StreamType, StreamConfig> = {
  UG: {
    id: 'UG',
    name: 'Undergraduate',
    description: 'MBBS, BDS and other undergraduate medical courses',
    collegeTypes: ['MEDICAL', 'DENTAL'],
    courseTypes: ['MBBS', 'BDS'],
    cutoffTypes: ['UG'],
    excludeStreams: [],
    showColleges: ['MBBS', 'BDS'], // Only show colleges offering MBBS or BDS
    showCourses: ['MBBS', 'BDS'],  // Only show MBBS and BDS courses
    cutoffFilter: ['MBBS', 'BDS'], // Only show UG cutoffs
    progressionContext: 'Explore your undergraduate medical and dental options'
  },
  PG_MEDICAL: {
    id: 'PG_MEDICAL',
    name: 'Postgraduate Medical',
    description: 'MD, MS, DM, MCh, DNB, DIPLOMA and other postgraduate medical courses (excludes dental)',
    collegeTypes: ['MEDICAL', 'DNB'],
    courseTypes: ['MD', 'MS', 'DM', 'MCH', 'DNB', 'DIPLOMA'],
    cutoffTypes: ['PG'],
    excludeStreams: ['DENTAL'],
    showColleges: ['MBBS', 'MD', 'MS', 'DM', 'MCH', 'DNB', 'DIPLOMA', 'DNB- DIPLOMA'], // Show UG medical + PG medical (exclude dental)
    showCourses: ['MBBS', 'MD', 'MS', 'DM', 'MCH', 'DNB', 'DIPLOMA', 'DNB- DIPLOMA'],   // Show UG medical + PG medical (exclude dental)
    cutoffFilter: ['MD', 'MS', 'DM', 'MCH', 'DNB', 'DIPLOMA', 'DNB- DIPLOMA'], // Only show PG medical cutoffs
    progressionContext: 'See both undergraduate and postgraduate medical options for your career path (dental courses excluded)'
  },
  PG_DENTAL: {
    id: 'PG_DENTAL',
    name: 'Postgraduate Dental',
    description: 'MDS, PG DIPLOMA and other postgraduate dental courses (excludes medical)',
    collegeTypes: ['DENTAL'],
    courseTypes: ['MDS'],
    cutoffTypes: ['PG'],
    excludeStreams: ['MEDICAL', 'DNB'],
    showColleges: ['BDS', 'MDS', 'PG DIPLOMA'], // Show UG dental + PG dental (exclude medical)
    showCourses: ['BDS', 'MDS', 'PG DIPLOMA'],   // Show UG dental + PG dental (exclude medical)
    cutoffFilter: ['MDS', 'PG DIPLOMA'], // Only show PG dental cutoffs
    progressionContext: 'See both undergraduate and postgraduate dental options for your career path (medical courses excluded)'
  }
};

export class StreamDataService {
  private currentStream: StreamType | null = null;
  private streamConfig: StreamConfig | null = null;

  constructor(stream: StreamType | null = null) {
    this.setStream(stream);
  }

  setStream(stream: StreamType | null) {
    this.currentStream = stream;
    this.streamConfig = stream ? STREAM_CONFIGS[stream] : null;
  }

  getCurrentStream(): StreamType | null {
    return this.currentStream;
  }

  getStreamConfig(): StreamConfig | null {
    return this.streamConfig;
  }

  // College filtering based on stream - show colleges that offer relevant courses
  filterColleges(colleges: any[]): any[] {
    if (!this.streamConfig) return colleges;

    return colleges.filter(college => {
      // Check if college offers any of the relevant courses
      const collegeCourses = college.courses || [];
      const hasRelevantCourse = collegeCourses.some((course: any) => {
        const courseName = course.name || course.course_name || '';
        return this.streamConfig!.showColleges.some(showCourse => 
          courseName.startsWith(showCourse)
        );
      });

      // Check if college has any excluded courses
      const hasExcludedCourse = collegeCourses.some((course: any) => {
        const courseName = course.name || course.course_name || '';
        const courseStream = this.getCourseStream(courseName);
        return this.streamConfig!.excludeStreams?.includes(courseStream);
      });

      // Include college if it has relevant courses and no excluded courses
      return hasRelevantCourse && !hasExcludedCourse;
    });
  }

  // Course filtering based on stream - show only relevant course types
  filterCourses(courses: any[]): any[] {
    if (!this.streamConfig) return courses;

    return courses.filter(course => {
      const courseName = course.name || course.course_name || '';
      
      // Check if course is in the show list
      const isRelevantCourse = this.streamConfig!.showCourses.some(showCourse => 
        courseName.startsWith(showCourse)
      );

      // Check if course is in the exclude list
      const courseStream = this.getCourseStream(courseName);
      const isExcludedCourse = this.streamConfig!.excludeStreams?.includes(courseStream);

      // Include course if it's relevant and not excluded
      return isRelevantCourse && !isExcludedCourse;
    });
  }

  // Cutoff filtering based on stream - show only relevant cutoff types
  filterCutoffs(cutoffs: any[]): any[] {
    if (!this.streamConfig) return cutoffs;

    return cutoffs.filter(cutoff => {
      const courseName = cutoff.course_name || cutoff.course || '';
      
      // Check if cutoff is in the filter list
      const isRelevantCutoff = this.streamConfig!.cutoffFilter.some(filterCourse => 
        courseName.startsWith(filterCourse)
      );

      // Check if cutoff is in the exclude list
      const courseStream = this.getCourseStream(courseName);
      const isExcludedCutoff = this.streamConfig!.excludeStreams?.includes(courseStream);

      // Include cutoff if it's relevant and not excluded
      return isRelevantCutoff && !isExcludedCutoff;
    });
  }

  // Get course type from course name
  private getCourseType(courseName: string): string {
    const name = courseName.toUpperCase();
    
    if (name.startsWith('MBBS')) return 'MBBS';
    if (name.startsWith('BDS')) return 'BDS';
    if (name.startsWith('MD')) return 'MD';
    if (name.startsWith('MS')) return 'MS';
    if (name.startsWith('DM')) return 'DM';
    if (name.startsWith('MCH')) return 'MCH';
    if (name.startsWith('DNB')) return 'DNB';
    if (name.startsWith('MDS')) return 'MDS';
    if (name.includes('DIPLOMA')) return 'DIPLOMA';
    
    return 'UNKNOWN';
  }

  // Get course level (UG/PG) for visual indicators
  getCourseLevel(courseName: string): 'UG' | 'PG' | 'UNKNOWN' {
    const name = courseName.toUpperCase();
    
    if (name.startsWith('MBBS') || name.startsWith('BDS')) return 'UG';
    if (name.startsWith('MD') || name.startsWith('MS') || 
        name.startsWith('DM') || name.startsWith('MCH') || 
        name.startsWith('DNB') || name.startsWith('MDS') ||
        name.startsWith('DIPLOMA') || name.startsWith('DNB- DIPLOMA') ||
        name.startsWith('PG DIPLOMA')) return 'PG';
    
    return 'UNKNOWN';
  }

  // Get course stream (Medical/Dental) for visual indicators and exclusions
  getCourseStream(courseName: string): 'MEDICAL' | 'DENTAL' | 'UNKNOWN' {
    const name = courseName.toUpperCase();
    
    // Dental courses: BDS, MDS, PG DIPLOMA
    if (name.startsWith('BDS') || name.startsWith('MDS') || 
        name.startsWith('PG DIPLOMA')) return 'DENTAL';
    
    // Medical courses: All others (MBBS, MD, MS, DM, MCH, DNB, DIPLOMA, DNB- DIPLOMA, etc.)
    if (name.startsWith('MBBS') || name.startsWith('MD') || 
        name.startsWith('MS') || name.startsWith('DM') || 
        name.startsWith('MCH') || name.startsWith('DNB') ||
        name.startsWith('DIPLOMA') || name.startsWith('DNB- DIPLOMA')) return 'MEDICAL';
    
    return 'UNKNOWN';
  }

  // Get progression context message
  getProgressionContext(): string {
    return this.streamConfig?.progressionContext || '';
  }

  // Get cutoff stream from cutoff data
  private getCutoffStream(cutoff: any): string {
    const courseName = cutoff.course_name || cutoff.course || '';
    const courseType = this.getCourseType(courseName);
    
    if (['MBBS', 'BDS'].includes(courseType)) return 'UG';
    if (['MD', 'MS', 'DM', 'MCH', 'DNB', 'DIPLOMA'].includes(courseType)) {
      if (courseType === 'MDS') return 'DENTAL';
      return 'MEDICAL';
    }
    
    return 'UNKNOWN';
  }

  // Get stream-specific API parameters
  getApiParams(baseParams: any = {}): any {
    if (!this.streamConfig) return baseParams;

    const streamParams = {
      ...baseParams,
      college_types: this.streamConfig.collegeTypes,
      course_types: this.streamConfig.courseTypes,
      exclude_streams: this.streamConfig.excludeStreams || []
    };

    return streamParams;
  }

  // Get stream-specific search suggestions
  getSearchSuggestions(suggestions: any[]): any[] {
    if (!this.streamConfig) return suggestions;

    return suggestions.filter(suggestion => {
      const suggestionType = suggestion.type || suggestion.college_type;
      return this.streamConfig!.collegeTypes.includes(suggestionType);
    });
  }

  // Get stream-specific statistics
  getStreamStatistics(data: any[]): any {
    if (!this.streamConfig) return {};

    const filteredData = this.filterColleges(data);
    
    return {
      totalColleges: filteredData.length,
      collegeTypes: this.streamConfig.collegeTypes,
      courseTypes: this.streamConfig.courseTypes,
      streamName: this.streamConfig.name,
      description: this.streamConfig.description
    };
  }
}

// Hook for using stream data service
export const useStreamDataService = () => {
  const { user } = useAuth();
  const { cutoffs, colleges, courses, loading, error } = useEdgeData();
  
  const currentStream = user?.selectedStream as StreamType | null;
  const streamService = new StreamDataService(currentStream);

  // Filter data based on current stream
  const filteredColleges = streamService.filterColleges(colleges || []);
  const filteredCourses = streamService.filterCourses(courses || []);
  const filteredCutoffs = streamService.filterCutoffs(cutoffs || []);

  return {
    currentStream,
    streamConfig: streamService.getStreamConfig(),
    streamService,
    
    // Filtered data
    colleges: filteredColleges,
    courses: filteredCourses,
    cutoffs: filteredCutoffs,
    
    // Original data
    allColleges: colleges || [],
    allCourses: courses || [],
    allCutoffs: cutoffs || [],
    
    // Loading and error states
    loading,
    error,
    
    // Stream-specific methods
    filterColleges: streamService.filterColleges.bind(streamService),
    filterCourses: streamService.filterCourses.bind(streamService),
    filterCutoffs: streamService.filterCutoffs.bind(streamService),
    getApiParams: streamService.getApiParams.bind(streamService),
    getSearchSuggestions: streamService.getSearchSuggestions.bind(streamService),
    getStreamStatistics: streamService.getStreamStatistics.bind(streamService),
    getCourseLevel: streamService.getCourseLevel.bind(streamService),
    getCourseStream: streamService.getCourseStream.bind(streamService),
    getProgressionContext: streamService.getProgressionContext.bind(streamService)
  };
};

export default StreamDataService;
