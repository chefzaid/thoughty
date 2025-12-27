import React, { memo } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import TagPicker from '../TagPicker/TagPicker';

const EntriesList = memo(({
    loading,
    entries,
    groupedEntries,
    config,
    onEdit,
    onDelete,
    onToggleVisibility,
    editingEntry,
    editText,
    setEditText,
    editTags,
    setEditTags,
    editDate,
    setEditDate,
    editVisibility,
    setEditVisibility,
    allTags,
    onSaveEdit,

    onCancelEdit,
    t
}) => {
    if (loading) return <p className="text-center text-gray-500">{t('loadingEntries', { defaultValue: 'Loading entries...' })}</p>;
    if (entries.length === 0) return <p className="text-center text-gray-500">{t('noEntriesFound')}</p>;

    const isEditing = (entry) => editingEntry && editingEntry.id === entry.id;

    // Sort dates in descending order for consistent display
    const sortedDates = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

    return (
        <div className="space-y-8">
            {sortedDates.map((date) => (
                <div key={date} className="space-y-4">
                    <h2 className={`text-xl font-bold border-b pb-2 ${config.theme === 'light' ? 'text-gray-800 border-gray-300' : 'text-gray-300 border-gray-700'}`}>
                        {date}
                    </h2>
                    <div className="space-y-4">
                        {groupedEntries[date].map((entry, index) => (
                            <div
                                key={entry.id || index}
                                className={`rounded-lg p-5 shadow-sm border transition-all ${config.theme === 'light' ? 'bg-white border-gray-200 hover:border-gray-300' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
                            >
                                {isEditing(entry) ? (
                                    // Edit Mode
                                    <div className="space-y-4">
                                        <textarea
                                            className={`w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
                                            rows="3"
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                        />
                                        <div className="flex flex-wrap gap-3">
                                            <div className="w-40">
                                                <DatePicker
                                                    selected={editDate}
                                                    onChange={(date) => setEditDate(date)}
                                                    className={`w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
                                                    dateFormat="yyyy-MM-dd"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <TagPicker
                                                    availableTags={allTags}
                                                    selectedTags={editTags}
                                                    onChange={setEditTags}
                                                    placeholder={t('filterTagsPlaceholder').replace('Filter by ', '')}
                                                    theme={config.theme}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setEditVisibility(v => v === 'private' ? 'public' : 'private')}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${editVisibility === 'public'
                                                    ? 'border-green-500 bg-green-500/10 text-green-500'
                                                    : config.theme === 'light'
                                                        ? 'border-gray-300 bg-gray-50 text-gray-500'
                                                        : 'border-gray-600 bg-gray-800 text-gray-400'
                                                    }`}
                                                title={editVisibility === 'public' ? t('public') : t('private')}
                                            >
                                                {editVisibility === 'public' ? (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={onSaveEdit}
                                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                {t('save')}
                                            </button>
                                            <button
                                                onClick={onCancelEdit}
                                                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                {t('cancel')}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // View Mode
                                    <>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex gap-2 flex-wrap">
                                                {entry.tags.map((tag, i) => (
                                                    <span
                                                        key={i}
                                                        className={`text-xs px-2 py-1 rounded-full border ${config.theme === 'light'
                                                            ? 'bg-purple-100 text-purple-700 border-purple-300'
                                                            : 'bg-purple-900/30 text-purple-300 border-purple-500/20'
                                                            }`}
                                                    >
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => onToggleVisibility(entry)}
                                                    className={`p-1 rounded transition-colors ${entry.visibility === 'public' ? 'text-green-500 hover:bg-green-500/10' : 'text-gray-500 hover:bg-gray-500/10'}`}
                                                    title={entry.visibility === 'public' ? t('publicTooltip') : t('privateTooltip')}
                                                >
                                                    {entry.visibility === 'public' ? (
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                        </svg>
                                                    )}
                                                </button>
                                                <span className="text-xs text-gray-500 font-mono">#{entry.index}</span>
                                                <button
                                                    onClick={() => onEdit(entry)}
                                                    className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
                                                    title={t('edit')}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => onDelete(entry.id)}
                                                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                                                    title={t('delete')}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        <p className={`whitespace-pre-wrap leading-relaxed text-sm ${config.theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                                            {entry.content}
                                        </p>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
});

export default EntriesList;
