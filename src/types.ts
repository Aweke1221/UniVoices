export type Role = "STUDENT" | "UNI_ADMIN" | "DEPT_ADMIN" | "MOE" | "SYSTEM_ADMIN";
export type Category = string;

export interface University {
  id: string;
  name: string;
  location: string;
  logo_url?: string;
}

export interface User {
  id: string;
  full_name: string;
  username?: string;
  phone?: string;
  student_id_number?: string;
  role: Role;
  university_id?: string;
  assigned_category?: Category;
  avatar_url?: string;
  bio?: string;
}

export interface Complaint {
  id: string;
  student_id: string;
  university_id: string;
  category: Category;
  description: string;
  upvotes_count: number;
  created_at: string;
  updated_at: string;
  university_name?: string;
  university_logo?: string;
  student_name?: string;
  student_avatar?: string;
  student_bio?: string;
  poster_role?: Role;
  has_upvoted?: boolean;
  comments_count?: number;
  likes_count: number;
  dislikes_count: number;
  user_reaction?: 'LIKE' | 'DISLIKE' | null;
  university_response?: string;
  evidence_url?: string;
  responded_at?: string;
  views_count?: number;
}

export interface Comment {
  id: string;
  complaint_id: string;
  user_id: string;
  user_name: string;
  user_role: Role;
  user_avatar?: string;
  text: string;
  is_official: boolean;
  likes_count: number;
  dislikes_count: number;
  user_reaction?: 'LIKE' | 'DISLIKE' | null;
  evidence_url?: string;
  created_at: string;
}

export interface AnalyticsData {
  byCategory: { category: Category; count: string }[];
  byUniversity: { 
    university_name: string; 
    total_complaints: string; 
  }[];
}
