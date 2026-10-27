import type {
  MockCloudFile,
  MockCloudProvider,
  MockCloudProviderStatus,
  MockCloudSchedule,
  MockFeatureRequest,
} from "./mockApp.shared";

/** The fixtures every mock app starts with unless a spec passes its own. */
export const DEFAULT_DIARIES = [
  {
    id: 1,
    name: "Work",
    icon: "💼",
    is_default: true,
    visibility: "private" as const,
    color: "#3B82F6",
  },
  {
    id: 2,
    name: "Personal",
    icon: "🏠",
    is_default: false,
    visibility: "private" as const,
    color: "#A855F7",
  },
];

export const DEFAULT_CLOUD_STATUS: Record<MockCloudProvider, MockCloudProviderStatus> =
  {
    google_drive: { connected: true, connectedAt: "2026-04-18T10:00:00.000Z" },
    onedrive: { connected: false },
    dropbox: { connected: false },
  };

export const DEFAULT_CLOUD_SCHEDULES: Partial<
  Record<MockCloudProvider, MockCloudSchedule>
> = {
  google_drive: {
    enabled: true,
    frequency: "daily",
    format: "json",
    includeVisibility: true,
    lastSyncAt: "2026-04-18T10:00:00.000Z",
    nextSyncAt: "2026-04-19T10:00:00.000Z",
  },
};

export const DEFAULT_CLOUD_FILES: MockCloudFile[] = [
  {
    id: "cloud-file-1",
    provider: "google_drive",
    name: "thoughty-cloud.json",
    size: 512,
    modifiedAt: "2026-04-18T10:00:00.000Z",
    content: JSON.stringify({
      entries: [
        {
          date: "2024-04-22",
          content: "Cloud restored entry",
          tags: ["cloud"],
          visibility: "private",
        },
      ],
    }),
  },
];

export const DEFAULT_FEATURE_REQUESTS: MockFeatureRequest[] = [
  {
    id: 1,
    title: "Offline writing mode",
    details: "Write and review journal entries without a network connection.",
    status: "planned",
    votes: 42,
    createdAt: "2026-07-20T12:00:00.000Z",
  },
  {
    id: 2,
    title: "Mood calendar",
    details: "Show recurring mood patterns across weeks and months.",
    status: "open",
    votes: 12,
    createdAt: "2026-07-22T12:00:00.000Z",
  },
];
