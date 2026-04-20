// Diary-related types

export interface Diary {
  id: number;
  name: string;
  icon: string;
  color?: string | null;
  visibility: 'public' | 'private';
  description?: string;
  is_default?: boolean;
  position?: number;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DiaryFormData {
  name: string;
  icon: string;
  color?: string | null;
  description?: string;
  visibility?: 'public' | 'private';
}
