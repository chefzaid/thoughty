import React, { useState, useEffect, FormEvent } from 'react';
import "react-datepicker/dist/react-datepicker.css";
import ProfilePage from './components/ProfilePage/ProfilePage';
import EntriesList from './components/EntriesList/EntriesList';
import ConfirmModal from './components/ConfirmModal/ConfirmModal';
import NavMenu from './components/NavMenu/NavMenu';
import Stats from './components/Stats/Stats';
import ImportExport from './components/ImportExport/ImportExport';
import Footer from './components/Footer/Footer';
import EntryForm from './components/EntryForm/EntryForm';
import FilterControls from './components/FilterControls/FilterControls';
import Pagination from './components/Pagination/Pagination';
import DiaryTabs from './components/DiaryTabs/DiaryTabs';
import DiaryManager from './components/DiaryManager/DiaryManager';
import ThoughtOfTheDay from './components/ThoughtOfTheDay/ThoughtOfTheDay';
import AuthPage from './components/AuthPage/AuthPage';
import { useAuth } from './contexts/AuthContext';
import { getTranslation, TranslationKey } from './utils/translations';

// Types
interface Entry {
  id: number;
  content: string;
  tags: string[];
  date: string;
  visibility: 'public' | 'private';
  diary_id?: number | null;
  index?: number;
}

interface Diary {
  id: number;
  name: string;
  icon: string;
  visibility: 'public' | 'private';
  is_default?: boolean;
}

interface Config {
  entriesPerPage?: string | number;
  language?: string;
  theme?: 'light' | 'dark';
  name?: string;
  bio?: string;
  email?: string;
  birthday?: string;
  avatarUrl?: string;
  defaultVisibility?: 'public' | 'private';
}

interface ProfileStats {
  totalEntries: number;
  uniqueTags: number;
  firstEntryYear: number;
}

interface SourceEntryInfo {
  id: number;
  date: string;
  index: number;
}

interface GroupedEntries {
  [date: string]: Entry[];
}

type ViewType = 'journal' | 'profile' | 'diaries' | 'stats' | 'importExport';

function App(): React.ReactElement {
  const { isAuthenticated, loading: authLoading, user, logout, getAccessToken, authFetch } = useAuth();
  
  const [entries, setEntries] = useState<Entry[]>([]);
  const [newEntryText, setNewEntryText] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState<boolean>(true);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [entryDates, setEntryDates] = useState<string[]>([]);

  // Config & Settings
  const [config, setConfig] = useState<Config>({});

  // Search & Filter State
  const [search, setSearch] = useState<string>('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterDateObj, setFilterDateObj] = useState<Date | null>(null);
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'public' | 'private'>('all');

  // Form error state
  const [formError, setFormError] = useState<string>('');

  // Edit mode state
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('private');

  // New entry visibility
  const [visibility, setVisibility] = useState<'public' | 'private' | null>(null);

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);

  // Highlights modal state
  const [highlightsModalOpen, setHighlightsModalOpen] = useState<boolean>(false);

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [inputPage, setInputPage] = useState<string>('1');

  // Navigation State
  const [currentView, setCurrentView] = useState<ViewType>('journal');
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [navYear, setNavYear] = useState<string>('');
  const [navMonth, setNavMonth] = useState<string>('');
  const [targetEntryId, setTargetEntryId] = useState<number | null>(null);
  const [activeTargetId, setActiveTargetId] = useState<number | null>(null);
  const [sourceEntry, setSourceEntry] = useState<SourceEntryInfo | null>(null);

  // Diary State
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [currentDiaryId, setCurrentDiaryId] = useState<number | null>(null);

  // Profile stats for profile page
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);

  // Safe JSON parsing helper
  const safeJsonParse = async (response: Response): Promise<unknown> => {
    try {
      if (typeof response.json === 'function') {
        return await response.json();
      }
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };

  // Helper function for authenticated API calls
  const authFetchHelper = async (url: string, options: RequestInit = {}): Promise<Response> => {
    if (typeof authFetch === 'function') {
      const maybeResponse = await authFetch(url, options);
      if (maybeResponse && typeof maybeResponse.ok === 'boolean') {
        return maybeResponse;
      }
    }

    const token = typeof getAccessToken === 'function' ? getAccessToken() : null;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
  };

  useEffect(() => { setInputPage(page.toString()); }, [page]);
  useEffect(() => { 
    if (isAuthenticated) {
      fetchConfig(); 
      fetchEntryDates(); 
      fetchDiaries(); 
      fetchProfileStats(); 
    }
  }, [isAuthenticated]);
  useEffect(() => { 
    if (isAuthenticated) {
      fetchEntries(); 
    }
  }, [page, search, filterTags, filterDateObj, filterVisibility, config.entriesPerPage, currentDiaryId, isAuthenticated]);
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

  const fetchConfig = async (): Promise<void> => {
    try {
      const response = await authFetchHelper('/api/config');
      const data = await safeJsonParse(response) as Config | null;
      if (response.ok && data) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const fetchEntryDates = async (): Promise<void> => {
    try {
      const response = await authFetchHelper('/api/entries/dates');
      const data = await safeJsonParse(response) as { dates?: string[] } | null;
      if (response.ok && data) {
        setEntryDates(data.dates || []);
      }
    } catch (error) {
      console.error('Error fetching entry dates:', error);
    }
  };

  const fetchProfileStats = async (): Promise<void> => {
    try {
      const response = await authFetchHelper('/api/stats');
      const data = await safeJsonParse(response) as { 
        totalThoughts?: number; 
        thoughtsPerYear?: Record<string, number>;
        thoughtsPerTag?: Record<string, number>;
      } | null;
      if (response.ok && data) {
        const years = Object.keys(data.thoughtsPerYear || {});
        const firstYear = years.length > 0 ? Math.min(...years.map(Number)) : new Date().getFullYear();
        setProfileStats({
          totalEntries: data.totalThoughts || 0,
          uniqueTags: Object.keys(data.thoughtsPerTag || {}).length,
          firstEntryYear: firstYear
        });
      }
    } catch (error) {
      console.error('Error fetching profile stats:', error);
    }
  };

  const updateConfig = async (newConfig: Config): Promise<void> => {
    try {
      await authFetchHelper('/api/config', {
        method: 'POST',
        body: JSON.stringify(newConfig)
      });
      setConfig(newConfig);
      fetchEntries();
    } catch (error) {
      console.error('Error updating config:', error);
    }
  };

  // Diary API functions
  const fetchDiaries = async (): Promise<void> => {
    try {
      const response = await authFetchHelper('/api/diaries');
      const data = await safeJsonParse(response) as Diary[] | null;
      if (response.ok && Array.isArray(data)) {
        setDiaries(data);
        if (!currentDiaryId && data.length > 0) {
          const defaultDiary = data.find(d => d.is_default);
          if (defaultDiary) setCurrentDiaryId(defaultDiary.id);
        }
      }
    } catch (error) {
      console.error('Error fetching diaries:', error);
    }
  };

  const handleCreateDiary = async (diaryData: Partial<Diary>): Promise<void> => {
    const response = await authFetchHelper('/api/diaries', {
      method: 'POST',
      body: JSON.stringify(diaryData)
    });
    if (!response.ok) {
      const error = await safeJsonParse(response) as { error?: string } | null;
      throw new Error(error?.error || 'Failed to create diary');
    }
    await fetchDiaries();
  };

  const handleUpdateDiary = async (id: number, diaryData: Partial<Diary>): Promise<void> => {
    const response = await authFetchHelper(`/api/diaries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(diaryData)
    });
    if (!response.ok) {
      const error = await safeJsonParse(response) as { error?: string } | null;
      throw new Error(error?.error || 'Failed to update diary');
    }
    await fetchDiaries();
  };

  const handleDeleteDiary = async (id: number): Promise<void> => {
    const response = await authFetchHelper(`/api/diaries/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await safeJsonParse(response) as { error?: string } | null;
      throw new Error(error?.error || 'Failed to delete diary');
    }
    if (currentDiaryId === id) {
      const defaultDiary = diaries.find(d => d.is_default);
      setCurrentDiaryId(defaultDiary?.id || null);
    }
    await fetchDiaries();
    fetchEntries();
  };

  const handleSetDefaultDiary = async (id: number): Promise<void> => {
    const response = await authFetchHelper(`/api/diaries/${id}/default`, { method: 'PATCH' });
    if (!response.ok) {
      const error = await safeJsonParse(response) as { error?: string } | null;
      throw new Error(error?.error || 'Failed to set default diary');
    }
    await fetchDiaries();
  };

  const t = (key: string, params: Record<string, string | number> = {}): string => 
    getTranslation(config.language || 'en', key as TranslationKey, params);

  const fetchEntries = async (): Promise<void> => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const filterDate = filterDateObj ?
        `${filterDateObj.getFullYear()}-${String(filterDateObj.getMonth() + 1).padStart(2, '0')}-${String(filterDateObj.getDate()).padStart(2, '0')}` : '';
      const limit = typeof config.entriesPerPage === 'number' ? config.entriesPerPage : Number.parseInt(config.entriesPerPage || '10', 10) || 10;
      const visibilityFilter = filterVisibility === 'all' ? '' : filterVisibility;
      const params = new URLSearchParams({ 
        page: page.toString(), 
        limit: limit.toString(), 
        search, 
        tags: filterTags.join(','), 
        date: filterDate, 
        visibility: visibilityFilter 
      });
      if (currentDiaryId) {
        params.append('diaryId', currentDiaryId.toString());
      }

      const response = await authFetchHelper(`/api/entries?${params}`);
      const data = await safeJsonParse(response) as { 
        entries?: Entry[]; 
        totalPages?: number; 
        allTags?: string[] 
      } | null;
      if (response.ok && data) {
        setEntries(data.entries || []);
        setTotalPages(data.totalPages || 1);
        setAllTags(data.allTags || []);
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setFormError('');

    if (!newEntryText.trim()) { setFormError('Please enter some text'); return; }
    if (!tags || tags.length === 0) { setFormError('Please add at least one tag'); return; }

    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    try {
      const res = await authFetchHelper('/api/entries', {
        method: 'POST',
        body: JSON.stringify({ text: newEntryText, tags, date: dateStr, visibility, diaryId: currentDiaryId }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setNewEntryText('');
      setTags([]);
      setVisibility(config.defaultVisibility || 'private');
      setPage(1);
      fetchEntries();
      fetchEntryDates();
    } catch (error) {
      console.error('Error saving entry:', error);
      setFormError('Failed to save entry. Please try again.');
    }
  };

  const handleDelete = (entryId: number): void => { 
    setEntryToDelete(entryId); 
    setDeleteModalOpen(true); 
  };

  const confirmDelete = async (): Promise<void> => {
    if (!entryToDelete) return;
    try {
      const res = await authFetchHelper(`/api/entries/${entryToDelete}`, { method: 'DELETE' });
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

  const handleEdit = (entry: Entry): void => {
    setEditingEntry(entry);
    setEditText(entry.content);
    setEditTags(entry.tags || []);
    setEditVisibility(entry.visibility || 'private');
    let dateStr = entry.date;
    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0] ?? dateStr;
    const parts = dateStr.split('-').map(Number);
    const year = parts[0] ?? new Date().getFullYear();
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    setEditDate(new Date(year, month - 1, day));
  };

  const handleCancelEdit = (): void => {
    setEditingEntry(null);
    setEditText('');
    setEditTags([]);
    setEditDate(null);
    setEditVisibility('private');
  };

  const handleSaveEdit = async (): Promise<void> => {
    if (!editText.trim() || editTags.length === 0) {
      alert('Text and at least one tag are required');
      return;
    }
    if (!editDate || !editingEntry) return;
    
    const dateStr = `${editDate.getFullYear()}-${String(editDate.getMonth() + 1).padStart(2, '0')}-${String(editDate.getDate()).padStart(2, '0')}`;
    try {
      const res = await authFetchHelper(`/api/entries/${editingEntry.id}`, {
        method: 'PUT',
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

  const handleToggleVisibility = async (entry: Entry): Promise<void> => {
    const newVisibility = entry.visibility === 'public' ? 'private' : 'public';
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, visibility: newVisibility } : e));

    try {
      const res = await authFetchHelper(`/api/entries/${entry.id}/visibility`, {
        method: 'PATCH',
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

  const handleNavigateToFirst = async (year: number, month: number | null): Promise<void> => {
    try {
      const limit = typeof config.entriesPerPage === 'number' ? config.entriesPerPage : Number.parseInt(config.entriesPerPage || '10', 10) || 10;
      const params = new URLSearchParams({ year: year.toString(), limit: limit.toString() });
      if (month) params.append('month', month.toString());

      const res = await authFetchHelper(`/api/entries/first?${params}`);
      const data = await res.json() as { 
        found?: boolean; 
        page?: number; 
        entryId?: number;
        years?: number[];
        months?: string[];
      };

      if (data.found) {
        setPage(data.page || 1);
        if (data.entryId) {
          setTargetEntryId(data.entryId);
        }
      }

      if (data.years) setAvailableYears(data.years);
      if (data.months) setAvailableMonths(data.months);
    } catch (error) {
      console.error('Error navigating to first entry:', error);
    }
  };

  const handleNavigateToEntry = async (
    date: string, 
    index: number = 1, 
    sourceEntryInfo: SourceEntryInfo | null = null
  ): Promise<void> => {
    try {
      const limit = typeof config.entriesPerPage === 'number' ? config.entriesPerPage : Number.parseInt(config.entriesPerPage || '10', 10) || 10;
      const params = new URLSearchParams({ 
        date, 
        index: index.toString(), 
        limit: limit.toString() 
      });

      if (sourceEntryInfo) {
        setSourceEntry({
          id: sourceEntryInfo.id,
          date: sourceEntryInfo.date,
          index: sourceEntryInfo.index
        });
      }

      const res = await authFetchHelper(`/api/entries/by-date?${params}`);
      const data = await res.json() as { found?: boolean; page?: number; entryId?: number };

      if (data.found) {
        setPage(data.page || 1);
        setTargetEntryId(data.entryId || null);
        setActiveTargetId(data.entryId || null);
      } else {
        alert(t('entryNotFound'));
        setSourceEntry(null);
      }
    } catch (error) {
      console.error('Error navigating to entry:', error);
      alert(t('entryNotFound'));
    }
  };

  const handleBackToSource = async (): Promise<void> => {
    if (!sourceEntry) return;

    try {
      const limit = typeof config.entriesPerPage === 'number' ? config.entriesPerPage : Number.parseInt(config.entriesPerPage || '10', 10) || 10;
      const params = new URLSearchParams({
        id: sourceEntry.id.toString(),
        limit: limit.toString()
      });

      const res = await authFetchHelper(`/api/entries/by-date?${params}`);
      const data = await res.json() as { found?: boolean; page?: number; entryId?: number };

      if (data.found) {
        setPage(data.page || 1);
        setTargetEntryId(data.entryId || null);
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
    if (!isAuthenticated) return;
    const fetchYearsMonths = async (): Promise<void> => {
      try {
        const res = await authFetchHelper('/api/entries/first');
        const data = await res.json() as { years?: number[]; months?: string[] };
        if (data.years) setAvailableYears(data.years);
        if (data.months) setAvailableMonths(data.months);
      } catch (error) {
        console.error('Error fetching years/months:', error);
      }
    };
    fetchYearsMonths();
  }, [isAuthenticated]);

  // Group entries by date for display
  const groupedEntries: GroupedEntries = entries.reduce((acc: GroupedEntries, entry) => {
    let dateStr = entry.date;
    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0] ?? dateStr;
    acc[dateStr] ??= [];
    acc[dateStr]?.push(entry);
    return acc;
  }, {});

  Object.keys(groupedEntries).forEach(date => {
    groupedEntries[date]?.sort((a, b) => (a.index || 0) - (b.index || 0));
  });

  // Render the current view content based on currentView state
  const renderViewContent = (): React.ReactElement => {
    switch (currentView) {
      case 'profile':
        return (
          <ProfilePage
            config={config}
            onUpdateConfig={(newConfig: Config) => updateConfig(newConfig)}
            onBack={() => setCurrentView('journal')}
            t={t}
            stats={profileStats ?? undefined}
          />
        );
      case 'diaries':
        return (
          <DiaryManager
            diaries={diaries}
            onCreateDiary={handleCreateDiary}
            onUpdateDiary={handleUpdateDiary}
            onDeleteDiary={handleDeleteDiary}
            onSetDefault={handleSetDefaultDiary}
            onBack={() => setCurrentView('journal')}
            theme={config.theme}
            t={t}
          />
        );
      case 'stats':
        return (
          <>
            <DiaryTabs
              diaries={diaries}
              currentDiaryId={currentDiaryId}
              onDiaryChange={(id: number | null) => { setCurrentDiaryId(id); }}
              onManageDiaries={() => setCurrentView('diaries')}
              theme={config.theme}
              t={t}
            />
            <Stats theme={config.theme} t={t} diaryId={currentDiaryId} />
          </>
        );
      case 'importExport':
        return (
          <>
            <DiaryTabs
              diaries={diaries}
              currentDiaryId={currentDiaryId}
              onDiaryChange={(id: number | null) => { setCurrentDiaryId(id); }}
              onManageDiaries={() => setCurrentView('diaries')}
              theme={config.theme}
              t={t}
            />
            <ImportExport
              theme={config.theme}
              t={t}
              diaryId={currentDiaryId}
              diaryName={diaries.find(d => d.id === currentDiaryId)?.name || t('allDiaries')}
            />
          </>
        );
      default: // 'journal' view
        return (
          <>
            <DiaryTabs
              diaries={diaries}
              currentDiaryId={currentDiaryId}
              onDiaryChange={(id: number | null) => { setCurrentDiaryId(id); setPage(1); }}
              onManageDiaries={() => setCurrentView('diaries')}
              theme={config.theme}
              t={t}
            />

            <ThoughtOfTheDay
              isOpen={highlightsModalOpen}
              onClose={() => setHighlightsModalOpen(false)}
              theme={config.theme}
              t={t}
              diaryId={currentDiaryId}
              onNavigateToEntry={handleNavigateToEntry}
            />

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
              entryDates={entryDates}
              setPage={setPage}
              theme={config.theme}
              t={t}
              onOpenHighlights={() => setHighlightsModalOpen(true)}
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
                {navYear && availableMonths.some(m => m.startsWith(navYear)) && (
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
                      const monthNum = Number.parseInt(m.split('-')[1] ?? '1', 10);
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      return <option key={m} value={m}>{monthNames[monthNum - 1]}</option>;
                    })}
                  </select>
                )}
                <button
                  onClick={() => navYear && handleNavigateToFirst(Number.parseInt(navYear, 10), navMonth ? Number.parseInt(navMonth.split('-')[1] ?? '1', 10) : null)}
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
                {t('backToTop')}
              </button>
            </div>
          </>
        );
    }
  };

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Show auth page if not authenticated
  if (!isAuthenticated) {
    return (
      <AuthPage
        t={t}
        theme={config.theme || 'dark'}
        onAuthSuccess={() => {
          fetchConfig();
          fetchDiaries();
          fetchEntryDates();
          fetchProfileStats();
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen p-4 md:p-6 lg:p-8 font-sans transition-colors duration-300 ${config.theme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-gray-900 text-gray-100'}`}>
      <div className="max-w-7xl mx-auto">
        <NavMenu
          currentView={currentView}
          onViewChange={(view: string) => setCurrentView(view as ViewType)}
          theme={config.theme ?? 'dark'}
          name={config.name || user?.username || 'User'}
          avatarUrl={config.avatarUrl || user?.avatarUrl}
          t={t}
          onLogout={logout}
        />

        <ConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => { setDeleteModalOpen(false); setEntryToDelete(null); }}
          onConfirm={confirmDelete}
          title={t('deleteEntryTitle')}
          message={t('deleteEntryMessage')}
          theme={config.theme}
        />

        {renderViewContent()}

        <Footer t={t} theme={config.theme ?? 'dark'} />
      </div>
    </div>
  );
}

export default App;
