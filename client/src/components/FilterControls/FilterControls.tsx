import React, { Dispatch, SetStateAction } from 'react';
import DatePicker from 'react-datepicker';
import TagPicker from '../TagPicker/TagPicker';

type VisibilityFilter = 'all' | 'public' | 'private';

interface FilterControlsProps {
    readonly search: string;
    readonly setSearch: Dispatch<SetStateAction<string>>;
    readonly filterTags: string[];
    readonly setFilterTags: Dispatch<SetStateAction<string[]>>;
    readonly filterDateObj: Date | null;
    readonly setFilterDateObj: Dispatch<SetStateAction<Date | null>>;
    readonly filterVisibility: VisibilityFilter;
    readonly setFilterVisibility: Dispatch<SetStateAction<VisibilityFilter>>;
    readonly allTags: string[];
    readonly entryDates: string[];
    readonly setPage: Dispatch<SetStateAction<number>>;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly onOpenHighlights: () => void;
}

function FilterControls({
    search,
    setSearch,
    filterTags,
    setFilterTags,
    filterDateObj,
    setFilterDateObj,
    filterVisibility,
    setFilterVisibility,
    allTags,
    entryDates,
    setPage,
    theme,
    t,
    onOpenHighlights
}: FilterControlsProps): React.ReactElement {
    const inputClass = `flex-1 border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${theme === 'light'
        ? 'bg-gray-50 border-gray-300 text-gray-900'
        : 'bg-gray-900 border-gray-700 text-gray-100'
        }`;

    const containerClass = `flex flex-wrap gap-4 mb-8 p-4 rounded-lg border overflow-visible ${theme === 'light'
        ? 'bg-white/50 border-gray-200'
        : 'bg-gray-800/50 border-gray-700/50'
        }`;

    const handleReset = (): void => {
        setSearch('');
        setFilterTags([]);
        setFilterDateObj(null);
        setFilterVisibility('all');
        setPage(1);
    };

    const cycleVisibility = (): void => {
        const order: VisibilityFilter[] = ['all', 'public', 'private'];
        const currentIndex = order.indexOf(filterVisibility);
        const nextIndex = (currentIndex + 1) % order.length;
        setFilterVisibility(order[nextIndex] ?? 'all');
        setPage(1);
    };

    const getVisibilityButtonStyle = (): string => {
        if (filterVisibility === 'public') {
            return 'bg-green-500/10 border-green-500/50 text-green-500 hover:bg-green-500/20';
        } else if (filterVisibility === 'private') {
            return 'bg-gray-500/10 border-gray-500/50 text-gray-500 hover:bg-gray-500/20';
        }
        return theme === 'light'
            ? 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
            : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800';
    };

    const getVisibilityIcon = (): React.ReactElement => {
        if (filterVisibility === 'public') {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
        } else if (filterVisibility === 'private') {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            );
        }
        return (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
        );
    };

    // Convert entryDates to a Set for O(1) lookup
    const entryDatesSet = new Set(entryDates || []);

    const getDayClassName = (date: Date): string => {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (entryDatesSet.has(dateStr)) {
            return 'has-entry';
        }
        return 'no-entry';
    };

    return (
        <div className={containerClass}>
            <input
                type="text"
                placeholder={t('searchPlaceholder')}
                className={inputClass}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            <div className="w-64 relative z-30">
                <TagPicker
                    availableTags={allTags}
                    selectedTags={filterTags}
                    onChange={(newTags) => { setFilterTags(newTags); setPage(1); }}
                    placeholder={t('filterTagsPlaceholder')}
                    singleSelect={false}
                    allowNew={false}
                    theme={theme}
                />
            </div>
            <div className="w-40">
                <DatePicker
                    selected={filterDateObj}
                    onChange={(date: Date | null) => { setFilterDateObj(date); setPage(1); }}
                    className={`w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${theme === 'light'
                        ? 'bg-gray-50 border-gray-300 text-gray-900'
                        : 'bg-gray-900 border-gray-700 text-gray-100'
                        }`}
                    dateFormat="yyyy-MM-dd"
                    placeholderText={t('filterDatePlaceholder')}
                    dayClassName={getDayClassName}
                    isClearable
                />
            </div>
            <button
                onClick={cycleVisibility}
                className={`flex items-center gap-2 px-3 py-2 rounded border transition-all text-sm font-medium ${getVisibilityButtonStyle()}`}
                title={t('filterVisibility')}
            >
                {getVisibilityIcon()}
                <span>{t(filterVisibility === 'all' ? 'allEntries' : filterVisibility)}</span>
            </button>
            <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded transition-all text-sm font-medium"
                title={t('resetFilters')}
            >
                {t('resetFilters')}
            </button>
            <button
                onClick={onOpenHighlights}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/50 rounded transition-all text-sm font-medium"
                title={t('seeHighlights')}
            >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
                </svg>
                {t('highlights')}
            </button>
        </div>
    );
}

export default FilterControls;
