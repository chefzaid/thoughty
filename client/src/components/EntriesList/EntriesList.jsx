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
    editingEntry,
    editText,
    setEditText,
    editTags,
    setEditTags,
    editDate,
    setEditDate,
    allTags,
    onSaveEdit,
    onCancelEdit
}) => {
    if (loading) return <p className="text-center text-gray-500">Loading entries...</p>;
    if (entries.length === 0) return <p className="text-center text-gray-500">No entries found.</p>;

    const isEditing = (entry) => editingEntry && editingEntry.id === entry.id;

    return (
        <div className="space-y-8">
            {Object.keys(groupedEntries).map((date) => (
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
                                                    placeholder="Tags"
                                                    theme={config.theme}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={onSaveEdit}
                                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={onCancelEdit}
                                                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Cancel
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
                                                        className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded-full border border-purple-500/20"
                                                    >
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500 font-mono">#{entry.index}</span>
                                                <button
                                                    onClick={() => onEdit(entry)}
                                                    className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
                                                    title="Edit"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => onDelete(entry.id)}
                                                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                                                    title="Delete"
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
