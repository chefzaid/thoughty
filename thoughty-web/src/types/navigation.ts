// Navigation and view types

export type ViewType = 'journal' | 'profile' | 'diaries' | 'stats' | 'importExport';

export interface NavigationState {
  currentView: ViewType;
  year?: string;
  month?: string;
}

export interface ProfileStats {
  totalEntries: number;
  uniqueTags: number;
  firstEntryYear: number;
}
