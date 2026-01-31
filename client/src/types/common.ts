// Common utility types

export type TranslationFunction = (key: string, params?: Record<string, string | number>) => string;

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: Record<string, string>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}
