import React, { useState, useEffect, Profiler } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import Profile from './Profile';
import SettingsModal from './SettingsModal';
import TagPicker from './TagPicker';
import EntriesList from './EntriesList';

function App() {
  const [entries, setEntries] = useState([]);
  const [newEntryText, setNewEntryText] = useState('');
  const [tags, setTags] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState([]);

  // Config & Settings
  const [config, setConfig] = useState({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [filterTags, setFilterTags] = useState([]);
  const [filterDate, setFilterDate] = useState('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchConfig();
    fetchEntries();
  }, [page, search, filterTags, filterDate]);

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
      const response = await fetch('/api/config');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const updateConfig = async (newConfig) => {
    try {
      await fetch('/api/config', {
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
        tags: filterTags.join(','),
        date: filterDate
      });

      const response = await fetch(`/api/entries?${params}`);
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

    const tagList = tags;

    // Format date as yyyy.mm.dd
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    try {
      const res = await fetch('/api/entries', {
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
      if (!res.ok) throw new Error('Failed to save');
      setNewEntryText('');
      setTags([]);
      setPage(1);
      fetchEntries();
    } catch (error) {
      console.error('Error saving entry:', error);
      alert('Failed to save entry. Check console for details.');
    }
  };

  // Group entries by date for display
  const groupedEntries = entries.reduce((acc, entry) => {
    // Normalize date to YYYY-MM-DD
    let dateStr = entry.date;
    if (dateStr.includes('T')) {
      dateStr = dateStr.split('T')[0];
    }

    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(entry);
    return acc;
  }, {});

  const onRenderCallback = (
    id, // the "id" prop of the Profiler tree that has just committed
    phase, // either "mount" (if the tree just mounted) or "update" (if it re-rendered)
    actualDuration, // time spent rendering the committed update
    baseDuration, // estimated time to render the entire subtree without memoization
    startTime, // when React began rendering this update
    commitTime, // when React committed this update
    interactions // the Set of interactions belonging to this update
  ) => {
    if (actualDuration > 10) {
      console.log(`[Profiler] ${id} (${phase}) took ${actualDuration}ms`);
    }
  };

  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <div className={`min-h-screen p-8 font-sans transition-colors duration-300 ${config.theme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-gray-900 text-gray-100'}`}>
        <div className="max-w-4xl mx-auto">
          <Profile
            name={config.profileName || 'User'}
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
                    dateFormat="yyyy-MM-dd"
                  />
                </div>
                <div className="flex-1 relative">
                  <TagPicker
                    availableTags={allTags}
                    selectedTags={tags}
                    onChange={setTags}
                    placeholder="Tags"
                  />
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
            <div className="w-64">
              <TagPicker
                availableTags={allTags}
                selectedTags={filterTags}
                onChange={(newTags) => {
                  setFilterTags(newTags);
                  setPage(1);
                }}
                placeholder="Filter by tags..."
                singleSelect={false}
                allowNew={false}
              />
            </div>
            <input
              type="text"
              placeholder="YYYY-MM-DD"
              className={`w-32 border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
            />
            <button
              onClick={() => {
                setSearch('');
                setFilterTags([]);
                setFilterDate('');
                setPage(1);
              }}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded transition-all text-sm font-medium"
              title="Reset Filters"
            >
              Reset Filters
            </button>
          </div>

          <EntriesList
            loading={loading}
            entries={entries}
            groupedEntries={groupedEntries}
            config={config}
          />

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
      </div >
    </Profiler>
  );
}

export default App;
