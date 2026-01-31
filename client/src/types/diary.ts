// Diary-related types

export interface Diary {
  id: number;
  name: string;
  icon: string;
  visibility: 'public' | 'private';
  description?: string;
  is_default?: boolean;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DiaryFormData {
  name: string;
  icon: string;
  description?: string;
  visibility?: 'public' | 'private';
}
