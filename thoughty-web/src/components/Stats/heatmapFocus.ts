import { moveCalendarFocus } from '../../utils/calendarMonth';

/**
 * The heatmap draws a week a column, so its arrows move across the calendar grid's: left and right
 * by a week, up and down by a day.
 */
const TRANSPOSED_KEYS: Readonly<Record<string, string>> = {
    ArrowLeft: 'ArrowUp',
    ArrowRight: 'ArrowDown',
    ArrowUp: 'ArrowLeft',
    ArrowDown: 'ArrowRight',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
};

/**
 * The day the heatmap's active cell moves to for a key: arrows by a week or a day, Home and End to the
 * week's Monday and Sunday (with Ctrl, the map's first and last day), Page Up and Page Down by a month
 * (with Shift, a year), kept between `first` and `last`. Null for any other key.
 */
export function moveHeatmapFocus(
    date: string,
    key: string,
    { shiftKey = false, ctrlKey = false }: { shiftKey?: boolean; ctrlKey?: boolean },
    first: string,
    last: string,
): string | null {
    if (ctrlKey && key === 'Home') return first;
    if (ctrlKey && key === 'End') return last;
    const calendarKey = TRANSPOSED_KEYS[key];
    if (!calendarKey || ctrlKey) return null;
    const next = moveCalendarFocus(date, calendarKey, shiftKey) ?? date;
    if (next < first) return first;
    if (next > last) return last;
    return next;
}
