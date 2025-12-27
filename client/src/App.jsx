import React, { useState, useEffect, Profiler } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import SettingsModal from './components/SettingsModal/SettingsModal';
import TagPicker from './components/TagPicker/TagPicker';
import EntriesList from './components/EntriesList/EntriesList';
import ConfirmModal from './components/ConfirmModal/ConfirmModal';
import NavMenu from './components/NavMenu/NavMenu';

import Stats from './components/Stats/Stats';
import Footer from './components/Footer/Footer';
import { getTranslation } from './utils/translations';

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
  const [editVisibility, setEditVisibility] = useState('private');

  // New entry visibility (will be set from config)
  const [visibility, setVisibility] = useState(null);

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [inputPage, setInputPage] = useState('1');

  useEffect(() => {
    setInputPage(page.toString());
  }, [page]);

  // Navigation State
  const [currentView, setCurrentView] = useState('journal');

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [page, search, filterTags, filterDateObj, config.entriesPerPage]);

  // Set default visibility from config when it loads
  useEffect(() => {
    if (config.defaultVisibility && visibility === null) {
      setVisibility(config.defaultVisibility);
    }
  }, [config.defaultVisibility]);

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

  const t = (key, params = {}) => getTranslation(config.language || 'en', key, params);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const filterDate = filterDateObj ?
        `${filterDateObj.getFullYear()}-${String(filterDateObj.getMonth() + 1).padStart(2, '0')}-${String(filterDateObj.getDate()).padStart(2, '0')}` : '';
      const limit = parseInt(config.entriesPerPage) || 10;
      const params = new URLSearchParams({
        page,
        limit,
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
          date: dateStr,
          visibility: visibility
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setNewEntryText('');
      setTags([]);
      setVisibility(config.defaultVisibility || 'private');
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
    setEditVisibility(entry.visibility || 'private');
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
    setEditVisibility('private');
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
          date: dateStr,
          visibility: editVisibility
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

  const handleToggleVisibility = async (entry) => {
    const newVisibility = entry.visibility === 'public' ? 'private' : 'public';

    // Optimistically update the local state immediately
    setEntries(prevEntries =>
      prevEntries.map(e =>
        e.id === entry.id ? { ...e, visibility: newVisibility } : e
      )
    );

    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: entry.content,
          tags: entry.tags,
          date: entry.date.includes('T') ? entry.date.split('T')[0] : entry.date,
          visibility: newVisibility
        })
      });
      if (!res.ok) {
        // Revert on error
        setEntries(prevEntries =>
          prevEntries.map(e =>
            e.id === entry.id ? { ...e, visibility: entry.visibility } : e
          )
        );
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
      // Revert on error
      setEntries(prevEntries =>
        prevEntries.map(e =>
          e.id === entry.id ? { ...e, visibility: entry.visibility } : e
        )
      );
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

  // Sort entries within each date group by index
  Object.keys(groupedEntries).forEach(date => {
    groupedEntries[date].sort((a, b) => a.index - b.index);
  });

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
      <div className={`min-h-screen p-4 md:p-6 lg:p-8 font-sans transition-colors duration-300 ${config.theme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-gray-900 text-gray-100'}`}>
        <div className="max-w-7xl mx-auto">
          <NavMenu
            currentView={currentView}
            onViewChange={setCurrentView}
            theme={config.theme}
            name={config.name || 'User'}
            onOpenSettings={() => setIsSettingsOpen(true)}
            t={t}
          />

          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            config={config}
            onUpdateConfig={updateConfig}
            t={t}
          />

          <ConfirmModal
            isOpen={deleteModalOpen}
            onClose={() => { setDeleteModalOpen(false); setEntryToDelete(null); }}
            onConfirm={confirmDelete}
            title={t('deleteEntryTitle')}
            message={t('deleteEntryMessage')}
            theme={config.theme}
            t={t}
          />

          {currentView === 'stats' ? (
            <Stats theme={config.theme} t={t} />
          ) : (
            <>
              <div className={`relative z-40 rounded-xl p-6 shadow-lg border mb-8 backdrop-blur-sm bg-opacity-50 overflow-visible ${config.theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
                <form onSubmit={handleSubmit} className="space-y-4 overflow-visible">
                  <div>
                    <textarea
                      className={`w-full border rounded-lg p-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
                      rows="3"
                      placeholder={t('whatsOnYourMind')}
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
                        placeholder={t('filterTagsPlaceholder').replace('Filter by ', '')}
                        theme={config.theme}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setVisibility(v => v === 'private' ? 'public' : 'private')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${visibility === 'public'
                        ? 'border-green-500 bg-green-500/10 text-green-500'
                        : config.theme === 'light'
                          ? 'border-gray-300 bg-gray-50 text-gray-500'
                          : 'border-gray-600 bg-gray-800 text-gray-400'
                        }`}
                      title={visibility === 'public' ? t('publicTooltip') : t('privateTooltip')}
                    >
                      {visibility === 'public' ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                      <span className="text-sm font-medium">{visibility === 'public' ? t('public') : t('private')}</span>
                    </button>
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-2 rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-md"
                    >
                      {t('save')}
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
                  placeholder={t('searchPlaceholder')}
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
                    placeholder={t('filterTagsPlaceholder')}
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
                    placeholderText={t('filterDatePlaceholder')}
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
                  title={t('resetFilters')}
                >
                  {t('resetFilters')}
                </button>
              </div>

              <EntriesList
                loading={loading}
                entries={entries}
                groupedEntries={groupedEntries}
                config={config}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleVisibility={handleToggleVisibility}
                editingEntry={editingEntry}
                editText={editText}
                setEditText={setEditText}
                editTags={editTags}
                setEditTags={setEditTags}
                editDate={editDate}
                setEditDate={setEditDate}
                editVisibility={editVisibility}
                setEditVisibility={setEditVisibility}
                allTags={allTags}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                t={t}
              />

              {/* Pagination Controls */}
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className={`p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 ${config.theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600' : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-400'}`}
                  title={t('first')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 ${config.theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600' : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-400'}`}
                  title={t('previous')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">{t('page', { defaultValue: 'Page' })}</span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={inputPage}
                    onChange={(e) => setInputPage(e.target.value)}
                    onBlur={() => {
                      let val = parseInt(inputPage);
                      if (isNaN(val) || val < 1) val = 1;
                      if (val > totalPages) val = totalPages;
                      setPage(val);
                      setInputPage(val.toString());
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.target.blur();
                      }
                    }}
                    className={`w-16 border rounded px-2 py-1 text-center text-sm focus:ring-1 focus:ring-blue-500 outline-none ${config.theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'}`}
                  />
                  <span className="text-gray-400 text-sm">{t('ofTotal', { total: totalPages, defaultValue: `of ${totalPages}` })}</span>
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={`p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 ${config.theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600' : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-400'}`}
                  title={t('next')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className={`p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 ${config.theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600' : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-400'}`}
                  title={t('last')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Back to Top */}
              <div className="flex justify-center mt-6 mb-8">
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="text-sm text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1 group"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform group-hover:-translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  {t('backToTop', { defaultValue: 'Back to top' })}
                </button>
              </div>
            </>
          )}

          <Footer t={t} theme={config.theme} />
        </div>
      </div >
    </Profiler>
  );
}

export default App;
