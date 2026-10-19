export interface MockAppImportState {
  /** Entry ID for each imported `source:sourceId`. */
  refs: Record<string, number>;
  entryPayloads: unknown[];
  uploads: Array<{ entryId: number; name: string; type: string }>;
}

export function createMockAppImportState(): MockAppImportState {
  return { refs: {}, entryPayloads: [], uploads: [] };
}
