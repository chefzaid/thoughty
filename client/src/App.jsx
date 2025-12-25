import React, { useState, useEffect, Profiler } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import Profile from './components/Profile/Profile';
import SettingsModal from './components/SettingsModal/SettingsModal';
import TagPicker from './components/TagPicker/TagPicker';
import EntriesList from './components/EntriesList/EntriesList';
import ConfirmModal from './components/ConfirmModal/ConfirmModal';

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
  const [filterDateObj, setFilterDateObj] = useState(null);

  // Form error state
  const [formError, setFormError] = useState('');

  // Edit mode state
  const [editingEntry, setEditingEntry] = useState(null);
  const [editText, setEditText] = useState('');
  const [editTags, setEditTags] = useState([]);
  const [editDate, setEditDate] = useState(null);

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchConfig();
    fetchEntries();
  }, [page, search, filterTags, filterDateObj]);

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
      const filterDate = filterDateObj ?
        `${filterDateObj.getFullYear()}-${String(filterDateObj.getMonth() + 1).padStart(2, '0')}-${String(filterDateObj.getDate()).padStart(2, '0')}` : '';
      const params = new URLSearchParams({
        page,
        limit: 10,
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
    setFormError('');

    if (!newEntryText.trim()) {
      setFormError('Please enter some text');
      return;
    }

    if (!tags || tags.length === 0) {
      setFormError('Please add at least one tag');
      return;
    }

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
      setFormError('Failed to save entry. Please try again.');
    }
  };

  const handleDelete = (entryId) => {
    setEntryToDelete(entryId);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;

    try {
      const res = await fetch(`/api/entries/${entryToDelete}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry.');
    } finally {
      setDeleteModalOpen(false);
      setEntryToDelete(null);
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setEditText(entry.content);
    setEditTags(entry.tags || []);
    // Parse the date
    let dateStr = entry.date;
    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);
    setEditDate(new Date(year, month - 1, day));
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setEditText('');
    setEditTags([]);
    setEditDate(null);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || editTags.length === 0) {
      alert('Text and at least one tag are required');
      return;
    }

    const dateStr = `${editDate.getFullYear()}-${String(editDate.getMonth() + 1).padStart(2, '0')}-${String(editDate.getDate()).padStart(2, '0')}`;

    try {
      const res = await fetch(`/api/entries/${editingEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: editText,
          tags: editTags,
          date: dateStr
        })
      });
      if (!res.ok) throw new Error('Failed to update');
      handleCancelEdit();
      fetchEntries();
    } catch (error) {
      console.error('Error updating entry:', error);
      alert('Failed to update entry.');
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

          <ConfirmModal
            isOpen={deleteModalOpen}
            onClose={() => { setDeleteModalOpen(false); setEntryToDelete(null); }}
            onConfirm={confirmDelete}
            title="Delete Entry"
            message="Are you sure you want to delete this entry? This action cannot be undone."
            theme={config.theme}
          />

          <header className="mb-8 text-center">
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              My Journal
            </h1>
          </header>

          {/* New Entry Form */}
          <div className={`relative z-40 rounded-xl p-6 shadow-lg border mb-8 backdrop-blur-sm bg-opacity-50 overflow-visible ${config.theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
            <form onSubmit={handleSubmit} className="space-y-4 overflow-visible">
              <div>
                <textarea
                  className={`w-full border rounded-lg p-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
                  rows="3"
                  placeholder="What's on your mind?"
                  value={newEntryText}
                  onChange={(e) => setNewEntryText(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="w-40 z-10">
                  <DatePicker
                    selected={selectedDate}
                    onChange={(date) => setSelectedDate(date)}
                    className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
                    dateFormat="yyyy-MM-dd"
                  />
                </div>
                <div className="flex-1 relative z-20">
                  <TagPicker
                    availableTags={allTags}
                    selectedTags={tags}
                    onChange={setTags}
                    placeholder="Tags"
                    theme={config.theme}
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
            {formError && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {formError}
              </div>
            )}
          </div>

          {/* Search & Filter Controls */}
          <div className={`flex flex-wrap gap-4 mb-8 p-4 rounded-lg border overflow-visible ${config.theme === 'light' ? 'bg-white/50 border-gray-200' : 'bg-gray-800/50 border-gray-700/50'}`}>
            <input
              type="text"
              placeholder="Search content..."
              className={`flex-1 border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            <div className="w-64 relative z-30">
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
                theme={config.theme}
              />
            </div>
            <div className="w-40">
              <DatePicker
                selected={filterDateObj}
                onChange={(date) => { setFilterDateObj(date); setPage(1); }}
                className={`w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
                dateFormat="yyyy-MM-dd"
                placeholderText="Filter by date"
                isClearable
              />
            </div>
            <button
              onClick={() => {
                setSearch('');
                setFilterTags([]);
                setFilterDateObj(null);
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
            onEdit={handleEdit}
            onDelete={handleDelete}
            editingEntry={editingEntry}
            editText={editText}
            setEditText={setEditText}
            editTags={editTags}
            setEditTags={setEditTags}
            editDate={editDate}
            setEditDate={setEditDate}
            allTags={allTags}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
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
