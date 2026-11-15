import { describe, expect, it } from 'vitest';

import { EMPTY_DRAFT_FIELDS, EMPTY_DRAFT_KEY, draftKey, isEmptyDraft, planComposerDraft } from './composerDraftPlan';

const fields = (text: string) => ({ ...EMPTY_DRAFT_FIELDS, text });
const server = (text: string, revision: number) => ({ ...fields(text), revision, updatedAt: '2026-11-15T09:30:00.000Z' });

describe('planComposerDraft', () => {
  it('brings this device’s copy back while the API cannot be reached', () => {
    expect(planComposerDraft({ fields: fields('Mine'), baseRevision: 2, synced: false }, undefined, true)).toEqual({
      apply: fields('Mine'), baseRevision: 2, syncedKey: EMPTY_DRAFT_KEY, offer: null, clearLocal: false,
    });
    expect(planComposerDraft({ fields: fields('Mine'), baseRevision: 2, synced: true }, undefined, false)).toEqual({
      apply: null, baseRevision: 2, syncedKey: draftKey(fields('Mine')), offer: null, clearLocal: false,
    });
    expect(planComposerDraft(null, undefined, true)).toEqual({
      apply: null, baseRevision: null, syncedKey: EMPTY_DRAFT_KEY, offer: null, clearLocal: false,
    });
  });

  it('restores text this device never sent, and asks when the server moved on meanwhile', () => {
    const unsent = { fields: fields('Unsent'), baseRevision: 2, synced: false };

    expect(planComposerDraft(unsent, server('Saved', 2), true)).toMatchObject({ apply: fields('Unsent'), baseRevision: 2, offer: null });
    expect(planComposerDraft(unsent, server('Newer', 3), true)).toMatchObject({
      apply: fields('Unsent'), offer: { kind: 'conflict', draft: server('Newer', 3) },
    });
    expect(planComposerDraft(unsent, null, true)).toMatchObject({ offer: { kind: 'gone', draft: null } });
    expect(planComposerDraft({ ...unsent, baseRevision: null }, null, true)).toMatchObject({ offer: null, syncedKey: EMPTY_DRAFT_KEY });
  });

  it('drops a copy the server no longer has, and brings back silently the draft this device saved last', () => {
    expect(planComposerDraft({ fields: fields('Sent'), baseRevision: 2, synced: true }, null, true)).toMatchObject({ clearLocal: true, apply: null });
    expect(planComposerDraft(null, null, true)).toMatchObject({ clearLocal: false, offer: null });
    expect(planComposerDraft({ fields: fields('Sent'), baseRevision: 2, synced: true }, server('Sent', 2), true)).toEqual({
      apply: fields('Sent'), baseRevision: 2, syncedKey: draftKey(fields('Sent')), offer: null, clearLocal: false,
    });
  });

  it('offers a draft another device saved, as a choice when the composer already holds text', () => {
    expect(planComposerDraft(null, server('Phone', 4), true)).toMatchObject({ apply: null, offer: { kind: 'restore' } });
    expect(planComposerDraft({ fields: fields('Old'), baseRevision: 2, synced: true }, server('Phone', 4), true))
      .toMatchObject({ offer: { kind: 'restore' }, baseRevision: 2 });
    expect(planComposerDraft(null, server('Phone', 4), false)).toMatchObject({ offer: { kind: 'conflict' } });
  });
});

describe('isEmptyDraft', () => {
  it('holds a draft with text or a title, not with only tags or a mood', () => {
    expect(isEmptyDraft({ ...EMPTY_DRAFT_FIELDS, text: '  ', tags: ['walks'], mood: 3 })).toBe(true);
    expect(isEmptyDraft({ ...EMPTY_DRAFT_FIELDS, title: 'Walk' })).toBe(false);
    expect(isEmptyDraft(fields('Hello'))).toBe(false);
  });
});
