import React from 'react';
import DatePicker from 'react-datepicker';
import TagPicker from '../TagPicker/TagPicker';

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
    setPage,
    theme,
    t
}) {
    const inputClass = `flex-1 border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${theme === 'light'
        ? 'bg-gray-50 border-gray-300 text-gray-900'
        : 'bg-gray-900 border-gray-700 text-gray-100'
        }`;

    const containerClass = `flex flex-wrap gap-4 mb-8 p-4 rounded-lg border overflow-visible ${theme === 'light'
        ? 'bg-white/50 border-gray-200'
        : 'bg-gray-800/50 border-gray-700/50'
        }`;

    const handleReset = () => {
        setSearch('');
        setFilterTags([]);
        setFilterDateObj(null);
        setFilterVisibility('all');
        setPage(1);
    };

    const cycleVisibility = () => {
        const order = ['all', 'public', 'private'];
        const currentIndex = order.indexOf(filterVisibility);
        const nextIndex = (currentIndex + 1) % order.length;
        setFilterVisibility(order[nextIndex]);
        setPage(1);
    };

    const getVisibilityButtonStyle = () => {
        if (filterVisibility === 'public') {
            return 'bg-green-500/10 border-green-500/50 text-green-500 hover:bg-green-500/20';
        } else if (filterVisibility === 'private') {
            return 'bg-gray-500/10 border-gray-500/50 text-gray-500 hover:bg-gray-500/20';
        }
        return theme === 'light'
            ? 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
            : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800';
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
                    onChange={(date) => { setFilterDateObj(date); setPage(1); }}
                    className={`w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${theme === 'light'
                        ? 'bg-gray-50 border-gray-300 text-gray-900'
                        : 'bg-gray-900 border-gray-700 text-gray-100'
                        }`}
                    dateFormat="yyyy-MM-dd"
                    placeholderText={t('filterDatePlaceholder')}
                    isClearable
                />
            </div>
            <button
                onClick={cycleVisibility}
                className={`flex items-center gap-2 px-3 py-2 rounded border transition-all text-sm font-medium ${getVisibilityButtonStyle()}`}
                title={t('filterVisibility')}
            >
                {filterVisibility === 'public' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ) : filterVisibility === 'private' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                )}
                <span>{t(filterVisibility === 'all' ? 'allEntries' : filterVisibility)}</span>
            </button>
            <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded transition-all text-sm font-medium"
                title={t('resetFilters')}
            >
                {t('resetFilters')}
            </button>
        </div>
    );
}

export default FilterControls;
