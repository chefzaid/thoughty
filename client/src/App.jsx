import React, { useState, useEffect } from 'react';
import "react-datepicker/dist/react-datepicker.css";
import SettingsModal from './components/SettingsModal/SettingsModal';
import EntriesList from './components/EntriesList/EntriesList';
import ConfirmModal from './components/ConfirmModal/ConfirmModal';
import NavMenu from './components/NavMenu/NavMenu';
import Stats from './components/Stats/Stats';
import ImportExport from './components/ImportExport/ImportExport';
import Footer from './components/Footer/Footer';
import EntryForm from './components/EntryForm/EntryForm';
import FilterControls from './components/FilterControls/FilterControls';
import Pagination from './components/Pagination/Pagination';
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
  const [filterVisibility, setFilterVisibility] = useState('all');

  // Form error state
  const [formError, setFormError] = useState('');

  // Edit mode state
  const [editingEntry, setEditingEntry] = useState(null);
  const [editText, setEditText] = useState('');
  const [editTags, setEditTags] = useState([]);
  const [editDate, setEditDate] = useState(null);
  const [editVisibility, setEditVisibility] = useState('private');

  // New entry visibility
  const [visibility, setVisibility] = useState(null);

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [inputPage, setInputPage] = useState('1');

  // Navigation State
  const [currentView, setCurrentView] = useState('journal');
  const [availableYears, setAvailableYears] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [navYear, setNavYear] = useState('');
  const [navMonth, setNavMonth] = useState('');
  const [targetEntryId, setTargetEntryId] = useState(null);
  const [activeTargetId, setActiveTargetId] = useState(null); // ID of the entry currently being viewed from a reference
  const [sourceEntry, setSourceEntry] = useState(null); // Track {id, date, index} where user came from

  useEffect(() => { setInputPage(page.toString()); }, [page]);
  useEffect(() => { fetchConfig(); }, []);
  useEffect(() => { fetchEntries(); }, [page, search, filterTags, filterDateObj, filterVisibility, config.entriesPerPage]);
  useEffect(() => {
    if (config.defaultVisibility && visibility === null) {
      setVisibility(config.defaultVisibility);
    }
  }, [config.defaultVisibility]);
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
      fetchEntries();
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
      const visibility = filterVisibility !== 'all' ? filterVisibility : '';
      const params = new URLSearchParams({ page, limit, search, tags: filterTags.join(','), date: filterDate, visibility });

      const response = await fetch(`/api/entries?${params}`);
      const data = await response.json();
      setEntries(data.entries);
      setTotalPages(data.totalPages);
      setAllTags(data.allTags || []);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!newEntryText.trim()) { setFormError('Please enter some text'); return; }
    if (!tags || tags.length === 0) { setFormError('Please add at least one tag'); return; }

    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newEntryText, tags, date: dateStr, visibility }),
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

  const handleDelete = (entryId) => { setEntryToDelete(entryId); setDeleteModalOpen(true); };

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
        body: JSON.stringify({ text: editText, tags: editTags, date: dateStr, visibility: editVisibility })
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
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, visibility: newVisibility } : e));

    try {
      const res = await fetch(`/api/entries/${entry.id}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility })
      });
      if (!res.ok) {
        setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, visibility: entry.visibility } : e));
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, visibility: entry.visibility } : e));
    }
  };

  const handleNavigateToFirst = async (year, month) => {
    try {
      const limit = parseInt(config.entriesPerPage) || 10;
      const params = new URLSearchParams({ year, limit });
      if (month) params.append('month', month);

      const res = await fetch(`/api/entries/first?${params}`);
      const data = await res.json();

      if (data.found) {
        setPage(data.page);
        if (data.entryId) {
          setTargetEntryId(data.entryId);
        }
      }

      // Update available years/months for future navigation
      if (data.years) setAvailableYears(data.years);
      if (data.months) setAvailableMonths(data.months);
    } catch (error) {
      console.error('Error navigating to first entry:', error);
    }
  };

  // Navigate to a specific entry by date and optional index (for cross-references)
  // sourceEntryInfo is passed directly from the entry where the link was clicked
  const handleNavigateToEntry = async (date, index = 1, sourceEntryInfo = null) => {
    try {
      const limit = parseInt(config.entriesPerPage) || 10;
      const params = new URLSearchParams({ date, index, limit });

      // Save source entry info so user can return
      if (sourceEntryInfo) {
        setSourceEntry({
          id: sourceEntryInfo.id,
          date: sourceEntryInfo.date,
          index: sourceEntryInfo.index
        });
      }

      const res = await fetch(`/api/entries/by-date?${params}`);
      const data = await res.json();

      if (data.found) {
        setPage(data.page);
        setTargetEntryId(data.entryId);
        setActiveTargetId(data.entryId);
      } else {
        alert(t('entryNotFound'));
        setSourceEntry(null);
      }
    } catch (error) {
      console.error('Error navigating to entry:', error);
      alert(t('entryNotFound'));
    }
  };

  // Handle going back to source entry
  const handleBackToSource = async () => {
    if (!sourceEntry) return;

    try {
      const limit = parseInt(config.entriesPerPage) || 10;
      const params = new URLSearchParams({
        id: sourceEntry.id,
        limit
      });

      const res = await fetch(`/api/entries/by-date?${params}`);
      const data = await res.json();

      if (data.found) {
        setPage(data.page);
        setTargetEntryId(data.entryId);
      }
    } catch (error) {
      console.error('Error returning to source:', error);
    }

    setSourceEntry(null);
    setActiveTargetId(null);
  };

  // Scroll to and highlight target entry when entries load
  useEffect(() => {
    if (targetEntryId && !loading && entries.length > 0) {
      const entryElement = document.getElementById(`entry-${targetEntryId}`);
      if (entryElement) {
        entryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        entryElement.classList.add('highlight-entry');
        setTimeout(() => {
          entryElement.classList.remove('highlight-entry');
        }, 2000);
        setTargetEntryId(null);
      }
    }
  }, [targetEntryId, loading, entries]);

  // Fetch available years/months on mount
  useEffect(() => {
    const fetchYearsMonths = async () => {
      try {
        const res = await fetch('/api/entries/first');
        const data = await res.json();
        if (data.years) setAvailableYears(data.years);
        if (data.months) setAvailableMonths(data.months);
      } catch (error) {
        console.error('Error fetching years/months:', error);
      }
    };
    fetchYearsMonths();
  }, []);

  // Group entries by date for display
  const groupedEntries = entries.reduce((acc, entry) => {
    let dateStr = entry.date;
    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(entry);
    return acc;
  }, {});

  Object.keys(groupedEntries).forEach(date => {
    groupedEntries[date].sort((a, b) => a.index - b.index);
  });

  return (
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
        ) : currentView === 'importExport' ? (
          <ImportExport theme={config.theme} t={t} />
        ) : (
          <>
            <EntryForm
              newEntryText={newEntryText}
              setNewEntryText={setNewEntryText}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              tags={tags}
              setTags={setTags}
              visibility={visibility}
              setVisibility={setVisibility}
              allTags={allTags}
              formError={formError}
              onSubmit={handleSubmit}
              theme={config.theme}
              t={t}
            />

            <FilterControls
              search={search}
              setSearch={setSearch}
              filterTags={filterTags}
              setFilterTags={setFilterTags}
              filterDateObj={filterDateObj}
              setFilterDateObj={setFilterDateObj}
              filterVisibility={filterVisibility}
              setFilterVisibility={setFilterVisibility}
              allTags={allTags}
              availableYears={availableYears}
              availableMonths={availableMonths}
              onNavigateToFirst={handleNavigateToFirst}
              setPage={setPage}
              theme={config.theme}
              t={t}
            />

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
              onNavigateToEntry={handleNavigateToEntry}
              sourceEntry={sourceEntry}
              activeTargetId={activeTargetId}
              onBackToSource={handleBackToSource}
              t={t}
            />

            <Pagination
              page={page}
              totalPages={totalPages}
              setPage={setPage}
              inputPage={inputPage}
              setInputPage={setInputPage}
              theme={config.theme}
              t={t}
            />

            {availableYears.length > 0 && (
              <div className="flex justify-center items-center gap-3 mt-4">
                <span className={`text-sm ${config.theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>{t('goToFirst')}:</span>
                <select
                  value={navYear}
                  onChange={(e) => { setNavYear(e.target.value); setNavMonth(''); }}
                  className={`border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${config.theme === 'light'
                    ? 'bg-gray-50 border-gray-300 text-gray-900'
                    : 'bg-gray-900 border-gray-700 text-gray-100'
                    }`}
                >
                  <option value="">{t('year')}</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                {navYear && availableMonths.filter(m => m.startsWith(navYear)).length > 0 && (
                  <select
                    value={navMonth}
                    onChange={(e) => setNavMonth(e.target.value)}
                    className={`border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${config.theme === 'light'
                      ? 'bg-gray-50 border-gray-300 text-gray-900'
                      : 'bg-gray-900 border-gray-700 text-gray-100'
                      }`}
                  >
                    <option value="">{t('month')}</option>
                    {availableMonths.filter(m => m.startsWith(navYear)).map(m => {
                      const monthNum = parseInt(m.split('-')[1]);
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      return <option key={m} value={m}>{monthNames[monthNum - 1]}</option>;
                    })}
                  </select>
                )}
                <button
                  onClick={() => navYear && handleNavigateToFirst(parseInt(navYear), navMonth ? parseInt(navMonth.split('-')[1]) : null)}
                  disabled={!navYear}
                  className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/50 rounded transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('go')}
                </button>
              </div>
            )}

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
    </div>
  );
}

export default App;
