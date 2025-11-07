// Data types for Edge-Native + AI Architecture

export interface CutoffRecord {
  id: string;
  college_id: string;
  college_name: string;
  college_type: string;
  stream: string;
  state_id: string;
  state_name: string;
  course_id: string;
  course_name: string;
  year: number;
  level: string;
  counselling_body: string;
  round: number;
  quota_id: string;
  quota_name: string;
  category_id: string;
  category_name: string;
  opening_rank: number;
  closing_rank: number;
  total_seats: number;
  ranks: number[];
  embedding?: Float32Array;
  prediction_score?: number;
  trend_direction?: 'up' | 'down' | 'stable';
  recommendation_rank?: number;
}

export interface MasterData {
  states: StateRecord[];
  categories: CategoryRecord[];
  quotas: QuotaRecord[];
  courses: CourseRecord[];
  colleges: CollegeRecord[];
}

export interface StateRecord {
  id: string;
  name: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
}

export interface QuotaRecord {
  id: string;
  name: string;
}

export interface CourseRecord {
  id: string;
  name: string;
  code: string;
  stream: string;
  branch: string;
  degree_type: string;
  duration_years?: number;
  syllabus?: string;
  career_prospects?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CollegeRecord {
  id: string;
  name: string;
  state: string;
  city: string;
  type: string;
  management: string;
  university_affiliation?: string;
  website?: string;
  address?: string;
  established_year?: number;
  recognition?: string;
  affiliation?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CutoffFilters {
  college_id?: string;
  course_id?: string;
  category_id?: string;
  state_id?: string;
  year?: number;
  round?: number;
  min_rank?: number;
  max_rank?: number;
  quota_id?: string;
  counselling_body?: string;
  level?: string;
  stream?: string;
}

export interface SearchResult {
  record: CutoffRecord;
  similarity: number;
  score: number;
}

export interface TrendData {
  direction: 'up' | 'down' | 'stable';
  change: number;
  confidence: number;
}

export interface PredictionData {
  score: number;
  confidence: number;
  factors: string[];
}
