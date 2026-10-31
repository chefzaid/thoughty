import type { CSSProperties } from 'react';
import { resolveDiaryColor, withAlpha } from '../../utils/diaryColors';
export { getVisibilityButtonClass } from '../../utils/entryVisibility';
import type { Entry } from '../../types';
import { tintedTextClass } from '../../utils/tintedText';

export const extractDate = (date: string): string =>
    date.includes('T') ? (date.split('T')[0] ?? date) : date;

export function getEditFormatButtonClass(editFormat: 'plain' | 'markdown', theme?: 'light' | 'dark'): string {
    if (editFormat === 'markdown') {
        return `border-indigo-500 bg-indigo-500/10 ${tintedTextClass('indigo', theme)}`;
    }

    return theme === 'light'
        ? 'border-gray-300 bg-gray-50 text-gray-500'
        : 'border-gray-600 bg-gray-800 text-gray-400';
}

export function getBulkModeButtonClass(isDark: boolean): string {
    return isDark
        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300';
}

export function getSelectedRingClass(isDark: boolean): string {
    return isDark ? 'ring-2 ring-blue-500/50' : 'ring-2 ring-blue-400/50';
}

export function getEntryDiaryBadgeStyle(entry: Entry, isDark: boolean): CSSProperties {
    const diaryColor = resolveDiaryColor({
        color: entry.diary_color,
        id: entry.diary_id,
        name: entry.diary_name,
    });

    // The diary's color tints the border and background; the text stays neutral so it keeps its contrast, as tag badges do
    return {
        color: isDark ? '#F9FAFB' : '#111827',
        borderColor: withAlpha(diaryColor, isDark ? 0.5 : 0.25),
        backgroundColor: withAlpha(diaryColor, isDark ? 0.18 : 0.12),
    };
}

export function getEntryCardStyle(entry: Entry): CSSProperties | undefined {
    if (!entry.diary_name && !entry.diary_id) {
        return undefined;
    }

    const diaryColor = resolveDiaryColor({
        color: entry.diary_color,
        id: entry.diary_id,
        name: entry.diary_name,
    });

    return {
        borderLeftWidth: '5px',
        borderLeftStyle: 'solid',
        borderLeftColor: diaryColor,
    };
}

export function getEntryDragHighlightClass(
    isDark: boolean,
    isDraggedEntry: boolean,
    isDropTarget: boolean,
): string {
    if (isDraggedEntry) {
        return isDark
            ? ' border-indigo-400 bg-gray-800/95 ring-2 ring-indigo-400/55 shadow-2xl shadow-indigo-950/35 scale-[1.01]'
            : ' border-blue-500 bg-blue-50 ring-2 ring-blue-400/55 shadow-xl shadow-blue-200/70 scale-[1.01]';
    }

    if (isDropTarget) {
        return isDark
            ? ' border-indigo-400 bg-indigo-500/10 ring-2 ring-indigo-400/45 shadow-lg shadow-indigo-950/20'
            : ' border-blue-500 bg-blue-50 ring-2 ring-blue-300/70 shadow-lg shadow-blue-100';
    }

    return '';
}
export interface EntryDisplayGroup {
    key: string;
    label: string;
    /** The day the group stands for, or null when its entries cannot be reordered within it. */
    date: string | null;
    entries: Entry[];
}

/**
 * Groups entries in the order they came, starting a new group whenever the day changes, so best
 * search matches stay first. The groups are not reorderable, because each holds only the matching
 * entries of its day.
 */
export function groupRankedEntries(entries: readonly Entry[]): EntryDisplayGroup[] {
    const groups: EntryDisplayGroup[] = [];
    for (const entry of entries) {
        const date = extractDate(entry.date);
        const current = groups.at(-1);
        if (current?.label === date) {
            current.entries.push(entry);
            continue;
        }
        groups.push({ key: `ranked-${groups.length}-${date}`, label: date, date: null, entries: [entry] });
    }
    return groups;
}

/** Whether the entries come from more than one diary, so each card names its diary. */
export function spansSeveralDiaries(entries: readonly Entry[]): boolean {
    const diaryKeys = new Set<string>();
    for (const entry of entries) {
        if (entry.diary_id !== undefined && entry.diary_id !== null) {
            diaryKeys.add(`id:${entry.diary_id}`);
        } else if (entry.diary_name) {
            diaryKeys.add(`name:${entry.diary_name}`);
        }
    }
    return diaryKeys.size > 1;
}
