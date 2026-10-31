import { describe, expect, it } from 'vitest';
import { entryStartingPoint, hasComposerDraft } from './entryStartingPoint';

describe('entryStartingPoint', () => {
    it('copies the text with fresh tasks and alt text, the tags and the format', () => {
        const tags = ['plans'];
        const draft = entryStartingPoint({
            content: '# Week\n- [x] Gym ![Map](attachment:4)\n- [ ] Read',
            tags,
            format: 'markdown',
        });
        expect(draft).toEqual({ text: '# Week\n- [ ] Gym Map\n- [ ] Read', tags: ['plans'], format: 'markdown' });
        expect(draft?.tags).not.toBe(tags);
    });

    it('treats an entry without a format as plain text', () => {
        expect(entryStartingPoint({ content: 'Pack \\[socks\\] ![A \\] b](attachment:2)', tags: [] }))
            .toEqual({ text: 'Pack \\[socks\\] A ] b', tags: [], format: 'plain' });
    });

    it('gives nothing for a sealed time capsule', () => {
        expect(entryStartingPoint({ content: '', tags: [], format: 'plain', sealed_until: '2030-01-01T00:00:00Z' })).toBeNull();
    });
});

describe('hasComposerDraft', () => {
    it('is false for an empty form and true for anything starting over would replace', () => {
        const empty = { newEntryText: '  ', title: ' ', timeOfDay: '', mood: null, feelings: [], tags: [], timeCapsule: null };
        expect(hasComposerDraft(empty)).toBe(false);
        expect(hasComposerDraft({ newEntryText: '', tags: [] })).toBe(false);
        expect(hasComposerDraft({ ...empty, newEntryText: 'Hi' })).toBe(true);
        expect(hasComposerDraft({ ...empty, title: 'Plan' })).toBe(true);
        expect(hasComposerDraft({ ...empty, timeOfDay: '08:00' })).toBe(true);
        expect(hasComposerDraft({ ...empty, mood: 3 })).toBe(true);
        expect(hasComposerDraft({ ...empty, feelings: ['calm'] })).toBe(true);
        expect(hasComposerDraft({ ...empty, tags: ['x'] })).toBe(true);
        expect(hasComposerDraft({ ...empty, timeCapsule: { opensOn: '2030-01-01' } })).toBe(true);
    });
});
