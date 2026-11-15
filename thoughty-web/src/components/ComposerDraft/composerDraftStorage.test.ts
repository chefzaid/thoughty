import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_DRAFT_FIELDS } from './composerDraftPlan';
import {
  forgetLocalComposerDrafts,
  readLocalComposerDraft,
  removeLocalComposerDraft,
  writeLocalComposerDraft,
} from './composerDraftStorage';

const draft = { fields: { ...EMPTY_DRAFT_FIELDS, text: 'Hello', tags: ['walks'], mood: 3 }, baseRevision: 2, synced: false };

describe('composerDraftStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps each writer’s draft on this device until it is removed', () => {
    writeLocalComposerDraft(7, draft);
    writeLocalComposerDraft(8, { ...draft, baseRevision: null, synced: true });

    expect(readLocalComposerDraft(7)).toEqual(draft);
    expect(readLocalComposerDraft(8)).toEqual({ ...draft, baseRevision: null, synced: true });
    removeLocalComposerDraft(7);
    expect(readLocalComposerDraft(7)).toBeNull();
  });

  it('forgets every draft on sign-out, and nothing else', () => {
    writeLocalComposerDraft(7, draft);
    writeLocalComposerDraft(8, draft);
    localStorage.setItem('thoughty.focusGoal', '500');

    forgetLocalComposerDrafts();

    expect(readLocalComposerDraft(7)).toBeNull();
    expect(readLocalComposerDraft(8)).toBeNull();
    expect(localStorage.getItem('thoughty.focusGoal')).toBe('500');
  });

  it.each([
    'not json',
    JSON.stringify({ fields: { text: 3 }, baseRevision: null, synced: false }),
    JSON.stringify({ ...draft, baseRevision: 1.5 }),
    JSON.stringify({ ...draft, synced: 'yes' }),
    JSON.stringify({ ...draft, fields: { ...draft.fields, format: 'html' } }),
    JSON.stringify({ ...draft, fields: { ...draft.fields, tags: [1] } }),
    JSON.stringify({ ...draft, fields: { ...draft.fields, mood: '3' } }),
    JSON.stringify({ ...draft, fields: { ...draft.fields, title: 3 } }),
    JSON.stringify(null),
  ])('reads a copy it cannot trust as none: %s', (stored) => {
    localStorage.setItem('thoughty.composerDraft.7', stored);

    expect(readLocalComposerDraft(7)).toBeNull();
  });

  it('carries on when storage is blocked or full', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => { throw new Error('blocked'); });

    expect(() => writeLocalComposerDraft(7, draft)).not.toThrow();
    expect(readLocalComposerDraft(7)).toBeNull();
    expect(() => removeLocalComposerDraft(7)).not.toThrow();
    expect(() => forgetLocalComposerDrafts()).not.toThrow();
  });
});
