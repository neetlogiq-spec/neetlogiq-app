// Core types for NeetLogIQ

export interface College {
  id: string;
  name: string;
  city: string;
  state: string;
  type: string;
  stream: string;
  management_type: string;
  established_year?: number;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  description?: string;
  image_url?: string;
  rating?: number;
  total_seats?: number;
  cutoff_rank?: number;
  fees?: number;
  placement_percentage?: number;
  nirf_ranking?: number;
  is_government: boolean;
  is_private: boolean;
  is_trust: boolean;
  affiliation?: string;
  recognition?: string;
  university_affiliation?: string;
  university?: string;
  college_type?: string;
  district?: string;
  pincode?: string;
  status?: string;
  course_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  name: string;
  stream: string;
  branch: string;
  duration: string;
  duration_years?: number;
  degree_type: string;
  total_seats: number;
  cutoff_rank?: number;
  fees?: number;
  eligibility: string;
  description?: string;
  college_id: string;
  college_name: string;
  syllabus?: string;
  career_prospects?: string;
  created_at: string;
  updated_at: string;
}

export interface Cutoff {
  id: string;
  college_id: string;
  college_name: string;
  course_id: string;
  course_name: string;
  year: number;
  category: string;
  opening_rank: number;
  closing_rank: number;
  round: number;
  state: string;
  quota?: string;
  seat_type?: string;
  created_at: string;
  updated_at: string;
}

export interface SearchFilters {
  stream?: string;
  branch?: string;
  management_type?: string;
  state?: string;
  city?: string;
  min_fees?: number;
  max_fees?: number;
  min_cutoff?: number;
  max_cutoff?: number;
  is_government?: boolean;
  is_private?: boolean;
  is_trust?: boolean;
  year?: number;
  category?: string;
  round?: string;
  degree_type?: string;
}

export interface SearchParams {
  query?: string;
  page?: number;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  filters?: SearchFilters;
}

export interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: PaginationInfo;
  message?: string;
  error?: string;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  givenName?: string;
  familyName?: string;
  name?: string;
  imageUrl?: string;
  selectedStream?: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL' | null;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  signOutUser?: () => Promise<void>;
  isAuthenticated?: boolean;
  // Enhanced auth features
  isAdmin?: boolean;
  authToken?: string | null;
  getToken?: () => Promise<string | null>;
  // Stream selection
  showStreamSelection?: boolean;
  saveStreamSelection?: (stream: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL') => Promise<void>;
  // Supabase-specific (optional, for backward compatibility)
  supabaseUser?: any;
  session?: any;
  updateUserProfile?: (updates: any) => Promise<void>;
  getSubscriptionInfo?: () => Promise<{ tier: string; endDate: string | null }>;
}

export interface SearchResult {
  colleges: College[];
  courses: Course[];
  cutoffs: Cutoff[];
  total_results: number;
  search_time: number;
  suggestions?: string[];
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface FilterOptions {
  streams: FilterOption[];
  branches: FilterOption[];
  management_types: FilterOption[];
  states: FilterOption[];
  cities: FilterOption[];
  degree_types: FilterOption[];
}
