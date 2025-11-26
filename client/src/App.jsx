import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import Profile from './Profile';
import SettingsModal from './SettingsModal';

function App() {
  const [entries, setEntries] = useState([]);
  const [newEntryText, setNewEntryText] = useState('');
  const [tags, setTags] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState([]);

  // Config & Settings
  const [config, setConfig] = useState({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchConfig();
    fetchEntries();
  }, [page, search, filterTag, filterDate]);

  // Apply theme
  useEffect(() => {
    if (config.theme === 'light') {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    } else {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    }
  }, [config.theme]);

  const fetchConfig = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/config');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const updateConfig = async (newConfig) => {
    try {
      await fetch('http://localhost:3001/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      setConfig(newConfig);
      fetchEntries(); // Re-fetch as file path might have changed
    } catch (error) {
      console.error('Error updating config:', error);
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: 10, // Updated to 10 per page
        search,
        tag: filterTag,
        date: filterDate
      });

      const response = await fetch(`http://localhost:3001/api/entries?${params}`);
      const data = await response.json();
      setEntries(data.entries);
      setTotalPages(data.totalPages);
      setAllTags(data.allTags || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching entries:', error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newEntryText.trim()) return;

    const tagList = tags.split(',').map(t => t.trim()).filter(t => t);

    // Format date as yyyy.mm.dd
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}.${mm}.${dd}`;

    try {
      await fetch('http://localhost:3001/api/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: newEntryText,
          tags: tagList,
          date: dateStr
        }),
      });
      setNewEntryText('');
      setTags('');
      setPage(1);
      fetchEntries();
    } catch (error) {
      console.error('Error saving entry:', error);
    }
  };

  // Group entries by date for display
  const groupedEntries = entries.reduce((acc, entry) => {
    if (!acc[entry.date]) {
      acc[entry.date] = [];
    }
    acc[entry.date].push(entry);
    return acc;
  }, {});

  return (
    <div className={`min-h-screen p-8 font-sans transition-colors duration-300 ${config.theme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-gray-900 text-gray-100'}`}>
      <div className="max-w-4xl mx-auto">
        <Profile
          name={config.profileName || 'User'}
          photo={config.profilePhoto || 'https://ui-avatars.com/api/?name=User'}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          config={config}
          onUpdateConfig={updateConfig}
        />

        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            My Journal
          </h1>
        </header>

        {/* New Entry Form */}
        <div className={`rounded-xl p-6 shadow-lg border mb-8 backdrop-blur-sm bg-opacity-50 ${config.theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <textarea
                className={`w-full border rounded-lg p-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
                rows="3"
                placeholder="What's on your mind?"
                value={newEntryText}
                onChange={(e) => setNewEntryText(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="w-40">
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => setSelectedDate(date)}
                  className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
                  dateFormat="yyyy.MM.dd"
                />
              </div>
              <div className="flex-1 relative">
                <input
                  type="text"
                  className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
                  placeholder="Tags (comma separated)"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  list="tag-suggestions"
                />
                <datalist id="tag-suggestions">
                  {allTags.map(tag => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
              </div>
              <button
                type="submit"
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-2 rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-md"
              >
                Save
              </button>
            </div>
          </form>
        </div>

        {/* Search & Filter Controls */}
        <div className={`flex flex-wrap gap-4 mb-8 p-4 rounded-lg border ${config.theme === 'light' ? 'bg-white/50 border-gray-200' : 'bg-gray-800/50 border-gray-700/50'}`}>
          <input
            type="text"
            placeholder="Search content..."
            className={`flex-1 border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <input
            type="text"
            placeholder="Filter by tag..."
            className={`w-40 border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
            value={filterTag}
            onChange={(e) => { setFilterTag(e.target.value); setPage(1); }}
          />
          <input
            type="text"
            placeholder="YYYY.MM.DD"
            className={`w-32 border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
            value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
          />
        </div>

        {/* Entries List */}
        <div className="space-y-8">
          {loading ? (
            <p className="text-center text-gray-500">Loading entries...</p>
          ) : entries.length === 0 ? (
            <p className="text-center text-gray-500">No entries found.</p>
          ) : (
            Object.keys(groupedEntries).map((date) => (
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
            ))
          )}
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className={`px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${config.theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700' : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300'}`}
          >
            Previous
          </button>
          <span className="text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={`px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${config.theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700' : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300'}`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
