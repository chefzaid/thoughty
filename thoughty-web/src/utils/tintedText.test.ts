import { describe, expect, it } from 'vitest';
import { tintedTextClass } from './tintedText';

describe('tintedTextClass', () => {
    it('uses a lighter shade in the dark theme and a darker one in the light theme', () => {
        expect(tintedTextClass('red')).toBe('text-red-300');
        expect(tintedTextClass('red', 'dark')).toBe('text-red-300');
        expect(tintedTextClass('red', 'light')).toBe('text-red-700');
        expect(tintedTextClass('amber', 'light')).toBe('text-amber-800');
        expect(tintedTextClass('emerald', 'dark')).toBe('text-emerald-400');
    });
});
