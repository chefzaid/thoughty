// Diary-related types

/** A writing goal: entries each Monday-to-Sunday week, or words each day. */
export type DiaryGoalType = 'entries_per_week' | 'words_per_day';

export interface Diary {
  id: number;
  name: string;
  icon: string;
  color?: string | null;
  visibility: 'public' | 'private';
  description?: string;
  is_default?: boolean;
  position?: number;
  goalType?: DiaryGoalType | null;
  goalTarget?: number | null;
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
  goalType?: DiaryGoalType | null;
  goalTarget?: number | null;
}
