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
        setPage(1);
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
