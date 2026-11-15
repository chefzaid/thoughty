import { vi } from 'vitest';
import type { ComposerDraftSync } from './useComposerDraftSync';

/** A composer draft with nothing to offer and nothing to save, for specs of the screens around it. */
export const composerDraftSyncMock = (overrides: Partial<ComposerDraftSync> = {}): ComposerDraftSync => ({
  status: 'idle',
  offer: null,
  takeSavedDraft: vi.fn(),
  keepThisDraft: vi.fn(),
  discardSavedDraft: vi.fn(),
  clearThisDraft: vi.fn(),
  flush: vi.fn(),
  onPublished: vi.fn(),
  ...overrides,
});
