import type { CSSProperties } from 'react';
import { resolveDiaryColor, withAlpha } from '../../utils/diaryColors';
export { getVisibilityButtonClass } from '../../utils/entryVisibility';
import type { Entry } from '../../types';

export const extractDate = (date: string): string =>
    date.includes('T') ? (date.split('T')[0] ?? date) : date;

export function getEditFormatButtonClass(editFormat: 'plain' | 'markdown', theme?: 'light' | 'dark'): string {
    if (editFormat === 'markdown') {
        return 'border-indigo-500 bg-indigo-500/10 text-indigo-500';
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

    return {
        color: diaryColor,
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