import { describe, expect, it } from 'vitest';
import { buildSearchHighlightPattern, splitSearchHighlights } from './searchHighlight';

const marked = (text: string, pattern: RegExp | null) =>
    pattern ? splitSearchHighlights(text, pattern).filter((segment) => segment.marked).map((segment) => segment.text) : [];

describe('buildSearchHighlightPattern', () => {
    it('marks the server matches as whole words, phrases first, in any case', () => {
        const pattern = buildSearchHighlightPattern('"morning run" runn', ['morning run', 'running']);

        expect(marked('Morning run, then running at brunch. A morning walk.', pattern)).toEqual([
            'Morning run',
            'running',
        ]);
    });

    it('lets a phrase span line breaks and accented words keep their boundaries', () => {
        const pattern = buildSearchHighlightPattern('ete', ['été']);
        expect(marked('Un été, les étés', pattern)).toEqual(['été']);

        const phrase = buildSearchHighlightPattern('"quiet lake"', ['quiet lake']);
        expect(marked('a quiet\nlake', phrase)).toEqual(['quiet\nlake']);
    });

    it('marks nothing when the server found no words, as for a tag-only match', () => {
        expect(buildSearchHighlightPattern('family', [])).toBeNull();
    });

    it('falls back to the typed text anywhere when there are no server matches', () => {
        const pattern = buildSearchHighlightPattern(' $5.00 ', undefined);
        expect(marked('Paid $5.00 and $5.00x', pattern)).toEqual(['$5.00', '$5.00']);
    });

    it('marks nothing without a search', () => {
        expect(buildSearchHighlightPattern('  ', ['walk'])).toBeNull();
        expect(buildSearchHighlightPattern(undefined, undefined)).toBeNull();
    });
});

describe('splitSearchHighlights', () => {
    it('keeps the surrounding text in order', () => {
        const pattern = buildSearchHighlightPattern('walk', ['walk'])!;
        expect(splitSearchHighlights('a walk home', pattern)).toEqual([
            { text: 'a ', marked: false },
            { text: 'walk', marked: true },
            { text: ' home', marked: false },
        ]);
    });
});
