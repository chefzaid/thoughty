import { describe, expect, it } from 'vitest';

import { moveHeatmapFocus } from './heatmapFocus';

const FIRST = '2024-01-01';
const LAST = '2024-12-31';
const move = (date: string, key: string, modifiers: { shiftKey?: boolean; ctrlKey?: boolean } = {}) => (
    moveHeatmapFocus(date, key, modifiers, FIRST, LAST)
);

describe('moveHeatmapFocus', () => {
    it.each([
        ['ArrowLeft', '2024-06-05'],
        ['ArrowRight', '2024-06-19'],
        ['ArrowUp', '2024-06-11'],
        ['ArrowDown', '2024-06-13'],
        ['Home', '2024-06-10'],
        ['End', '2024-06-16'],
        ['PageUp', '2024-05-12'],
        ['PageDown', '2024-07-12'],
    ])('moves across a week a column for %s', (key, expected) => {
        expect(move('2024-06-12', key)).toBe(expected);
    });

    it('moves by a year with Shift and to the map’s ends with Ctrl', () => {
        expect(move('2024-06-12', 'PageUp', { shiftKey: true })).toBe(FIRST);
        expect(move('2024-06-12', 'PageDown', { shiftKey: true })).toBe(LAST);
        expect(move('2024-06-12', 'Home', { ctrlKey: true })).toBe(FIRST);
        expect(move('2024-06-12', 'End', { ctrlKey: true })).toBe(LAST);
    });

    it('stays within the map and ignores other keys', () => {
        expect(move(FIRST, 'ArrowLeft')).toBe(FIRST);
        expect(move(LAST, 'ArrowDown')).toBe(LAST);
        expect(move('2024-06-12', 'a')).toBeNull();
        expect(move('2024-06-12', 'ArrowLeft', { ctrlKey: true })).toBeNull();
    });
});
