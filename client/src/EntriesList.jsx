import React, { memo } from 'react';

const EntriesList = memo(({ loading, entries, groupedEntries, config }) => {
    if (loading) return <p className="text-center text-gray-500">Loading entries...</p>;
    if (entries.length === 0) return <p className="text-center text-gray-500">No entries found.</p>;

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
                                key={index}
                                className={`rounded-lg p-5 shadow-sm border transition-all ${config.theme === 'light' ? 'bg-white border-gray-200 hover:border-gray-300' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex gap-2">
                                        {entry.tags.map((tag, i) => (
                                            <span
                                                key={i}
                                                className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded-full border border-purple-500/20"
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                    <span className="text-xs text-gray-500 font-mono">#{entry.index}</span>
                                </div>
                                <p className={`whitespace-pre-wrap leading-relaxed text-sm ${config.theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                                    {entry.content}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
});

export default EntriesList;
