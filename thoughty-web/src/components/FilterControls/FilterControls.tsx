import { type Dispatch, type SetStateAction } from 'react';
import TagPicker from '../TagPicker/TagPicker';
import TypedDatePicker from '../TypedDatePicker/TypedDatePicker';
import VisibilityIcon from '../VisibilityIcon/VisibilityIcon';
import type { ArchiveStatusFilter } from '../../types';
import type { TagMetadataMap } from '../../utils/tagMetadata';

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
    readonly filterFavorites: boolean;
    readonly setFilterFavorites: Dispatch<SetStateAction<boolean>>;
    readonly filterArchiveStatus: ArchiveStatusFilter;
    readonly setFilterArchiveStatus: Dispatch<SetStateAction<ArchiveStatusFilter>>;
    readonly allTags: string[];
    readonly tagMetadata?: TagMetadataMap;
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
    filterFavorites,
    setFilterFavorites,
    filterArchiveStatus,
    setFilterArchiveStatus,
    allTags,
    tagMetadata,
    setPage,
    theme,
    t,
    onOpenHighlights
}: FilterControlsProps) {
    const isLight = theme === 'light';
    const inputClass = `border rounded-lg px-3 h-10 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${theme === 'light'
        ? 'bg-gray-50 border-gray-300 text-gray-900'
        : 'bg-gray-900 border-gray-700 text-gray-100'
        }`;

    const containerClass = `flex flex-wrap items-center gap-3 mb-8 p-4 rounded-lg border overflow-visible ${theme === 'light'
        ? 'bg-white/50 border-gray-200'
        : 'bg-gray-800/50 border-gray-700/50'
        }`;

    const handleReset = (): void => {
        setSearch('');
        setFilterTags([]);
        setFilterDateObj(null);
        setFilterVisibility('all');
        setFilterFavorites(false);
        setFilterArchiveStatus('active');
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
        }
        if (filterVisibility === 'private') {
            return 'bg-gray-500/10 border-gray-500/50 text-gray-500 hover:bg-gray-500/20';
        }

        if (isLight) {
            return 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100';
        }

        return 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800';
    };

    const getFavoriteButtonClass = (): string => {
        if (filterFavorites) {
            return 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/20';
        }

        if (isLight) {
            return 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100';
        }

        return 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800';
    };

    const cycleArchiveStatus = (): void => {
        const order: ArchiveStatusFilter[] = ['active', 'archived', 'all'];
        const currentIndex = order.indexOf(filterArchiveStatus);
        const nextIndex = (currentIndex + 1) % order.length;
        setFilterArchiveStatus(order[nextIndex] ?? 'active');
        setPage(1);
    };

    const getArchiveButtonClass = (): string => {
        if (filterArchiveStatus === 'archived') {
            return 'bg-sky-500/10 border-sky-500/50 text-sky-500 hover:bg-sky-500/20';
        }
        if (filterArchiveStatus === 'active') {
            return 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/20';
        }

        if (isLight) {
            return 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100';
        }

        return 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800';
    };

    const getArchiveLabel = (): string => {
        if (filterArchiveStatus === 'active') {
            return t('activeEntries');
        }
        if (filterArchiveStatus === 'archived') {
            return t('archived');
        }
        return t('allEntries');
    };

    const getArchiveIcon = () => {
        if (filterArchiveStatus === 'archived') {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8l1 11h12l1-11M9 12h6" />
                </svg>
            );
        }

        return (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8l1 11h12l1-11M9 12h6m-3-3v6" />
            </svg>
        );
    };

    const getVisibilityIcon = () => {
        if (filterVisibility === 'public') {
            return <VisibilityIcon visibility="public" className="h-4 w-4" />;
        } else if (filterVisibility === 'private') {
            return <VisibilityIcon visibility="private" className="h-4 w-4" />;
        }
        return (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
        );
    };

    return (
        <div className={containerClass}>
            <input
                type="text"
                placeholder={t('searchPlaceholder')}
                className={`${inputClass} min-w-0 flex-1 basis-64`}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            <div className="relative z-30 min-w-[12rem] flex-1 basis-52">
                <TagPicker
                    availableTags={allTags}
                    selectedTags={filterTags}
                    tagMetadata={tagMetadata}
                    onChange={(newTags) => { setFilterTags(newTags); setPage(1); }}
                    placeholder={t('filterTagsPlaceholder')}
                    singleSelect={false}
                    allowNew={false}
                    theme={theme}
                />
            </div>
            <div className="flex min-w-0 shrink-0 items-center gap-[12px]">
                <div className="relative z-20 w-[9.5rem] sm:w-[10.5rem]">
                    <TypedDatePicker
                        selected={filterDateObj}
                        onChange={(date: Date | null) => { setFilterDateObj(date); setPage(1); }}
                        className={`w-full border rounded-lg px-3 h-10 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${theme === 'light'
                            ? 'bg-gray-50 border-gray-300 text-gray-900'
                            : 'bg-gray-900 border-gray-700 text-gray-100'
                            }`}
                        dateFormat="yyyy-MM-dd"
                        placeholderText={t('filterDatePlaceholder')}
                        popperPlacement="bottom-start"
                        portalId="datepicker-portal"
                        isClearable
                    />
                </div>
                <button
                    onClick={cycleVisibility}
                    className={`flex h-10 items-center gap-2 px-3 rounded-lg border transition-all text-sm font-medium ${getVisibilityButtonStyle()}`}
                    title="Visibility"
                    aria-label="Visibility"
                >
                    {getVisibilityIcon()}
                    <span>{t(filterVisibility === 'all' ? 'allEntries' : filterVisibility)}</span>
                </button>
            </div>
            <button
                onClick={cycleArchiveStatus}
                className={`flex h-10 shrink-0 items-center gap-2 px-3 rounded-lg border transition-all text-sm font-medium ${getArchiveButtonClass()}`}
                title={t('filterArchived')}
                aria-label={t('filterArchived')}
            >
                {getArchiveIcon()}
                <span>{getArchiveLabel()}</span>
            </button>
            <button
                onClick={() => { setFilterFavorites(!filterFavorites); setPage(1); }}
                className={`flex h-10 shrink-0 items-center gap-2 px-3 rounded-lg border transition-all text-sm font-medium ${getFavoriteButtonClass()}`}
                title={t('filterFavorites')}
            >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill={filterFavorites ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <span>{t('favorites')}</span>
            </button>
            <button
                onClick={handleReset}
                className="h-10 shrink-0 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-lg transition-all text-sm font-medium"
                title={t('resetFilters')}
            >
                {t('resetFilters')}
            </button>
            <button
                onClick={onOpenHighlights}
                className="flex h-10 shrink-0 items-center gap-2 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/50 rounded-lg transition-all text-sm font-medium"
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
