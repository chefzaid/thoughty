/** The cloud sync providers, their connection and schedule, and the files a mock provider holds. */
export type MockCloudProvider = "google_drive" | "onedrive" | "dropbox";

export interface MockCloudProviderStatus {
  connected: boolean;
  connectedAt?: string;
}

export interface MockCloudSchedule {
  enabled: boolean;
  frequency?: "every_6h" | "every_12h" | "daily" | "weekly";
  format?: "txt" | "json" | "md";
  diaryId?: number;
  includeVisibility?: boolean;
  /** The writer's time zone saved with the schedule, whose day names the files it syncs. */
  timeZone?: string;
  lastSyncAt?: string;
  lastSyncHash?: string;
  nextSyncAt?: string;
}

export interface MockCloudFile {
  id: string;
  provider: MockCloudProvider;
  name: string;
  size: number;
  modifiedAt: string;
  content?: string;
}
