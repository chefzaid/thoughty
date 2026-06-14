import type { ComponentProps } from 'react';
import { vi } from 'vitest';
import type { Entry, EntryRevision, GroupedEntries, SourceEntryInfo } from '../../types';
import EntriesList from './EntriesList';
import EntryViewMode from './EntryViewMode';

export const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const mockEntries: [Entry, Entry, Entry] = [
    { id: 1, date: '2024-01-15', index: 1, content: 'First entry', tags: ['work', 'important'], visibility: 'private', diary_id: 1, diary_name: 'Work', diary_icon: '💼', diary_color: '#2A9D8F' },
    { id: 2, date: '2024-01-15', index: 2, content: 'Second entry', tags: ['personal'], visibility: 'public', diary_id: 2, diary_name: 'Personal', diary_icon: '📓', diary_color: '#E76F51' },
    { id: 3, date: '2024-01-14', index: 1, content: 'Third entry', tags: ['ideas'], visibility: 'private', diary_id: 1, diary_name: 'Work', diary_icon: '💼', diary_color: '#2A9D8F' },
];

export const mockGroupedEntries: GroupedEntries = {
    '2024-01-15': [mockEntries[0], mockEntries[1]],
    '2024-01-14': [mockEntries[2]],
};

export const mockSourceEntry: SourceEntryInfo = {
    id: 99,
    date: '2024-01-10',
    index: 2,
};

export const mockRevisions: EntryRevision[] = [
    {
        id: 21,
        entryId: 1,
        content: 'Older revision',
        tags: ['work'],
        date: '2024-01-14',
        format: 'plain',
        visibility: 'private',
        createdAt: '2024-01-14T12:00:00.000Z',
    },
];

export const TEST_ENTRY_PERMALINK_BASE_URL = 'https://thoughty.test';

export const getTestEntryPermalink = (entryId: number): string =>
    `${TEST_ENTRY_PERMALINK_BASE_URL}/?entry=${entryId}`;

const translations: Record<string, string> = {
    loadingEntries: 'Loading entries...',
    noEntriesFound: 'No entries found.',
    edit: 'Edit',
    entryWordCount: '{count} words',
    entryReadingTimeMinutes: '{minutes} min read',
    entryReadingTimeLessThanMinute: '<1 min read',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    public: 'Public',
    private: 'Private',
    publicTooltip: 'Public - visible to everyone',
    privateTooltip: 'Private - only you can see',
    entryPermalink: 'Open entry permalink',
    shareEntry: 'Share entry',
    entryLinkCopied: 'Entry link copied',
    moreActions: 'More actions',
    listen: 'Listen',
    stopListening: 'Stop listening',
    listenThisEntry: 'Read this entry',
    listenFromHere: 'Read from here onwards',
    dragToReorder: 'Drag to reorder',
    dropToReorder: 'Release to move here',
    archived: 'Archived',
    archive: 'Archive',
    unarchive: 'Unarchive',
    backToSource: 'Back to source',
    backlinks: 'Backlinks',
    backlinksCount: '{count} links',
    loadingBacklinks: 'Loading backlinks...',
    noBacklinks: 'No backlinks yet',
    history: 'History',
    noRevisions: 'No revisions',
    revision: 'Revision',
    viewHistory: 'View history',
    discussEntry: 'Discuss entry',
    rephraseEntry: 'Rephrase entry',
    rephrasingEntry: 'Rephrasing entry...',
    rephraseGrammarOnly: 'Grammar/form only',
    rephraseStyleLight: 'Slight style improvements',
    rephraseCompleteRewrite: 'Complete rewrite',
    favorite: 'Favorite',
    unfavorite: 'Unfavorite',
    pinEntry: 'Pin entry',
    unpinEntry: 'Unpin entry',
    pinned: 'Pinned',
    pinnedEntries: 'Pinned entries',
    markdownEnabled: 'Markdown enabled',
    markdownDisabled: 'Markdown disabled',
    selectAll: 'Select all',
    bulkModeEnter: 'Enter bulk mode',
    bulkModeExit: 'Exit bulk mode',
    bulkDelete: 'Delete selected',
    bulkMakePublic: 'Make public',
    bulkMakePrivate: 'Make private',
    bulkArchive: 'Archive selected',
    bulkUnarchive: 'Unarchive selected',
    bulkAddTags: 'Add tags',
    bulkMove: 'Move',
    bulkClearSelection: 'Clear selection',
    selectTags: 'Select tags',
    apply: 'Apply',
};

export const t = (key: string, params?: Record<string, string | number>): string => {
    if (key === 'filterTagsPlaceholder') {
        return 'Filter by tags...';
    }
    if (key === 'bulkSelected') {
        return `Selected: ${params?.count ?? 0}`;
    }
    let value = translations[key] || key;
    for (const [param, replacement] of Object.entries(params ?? {})) {
        value = value.replace(`{${param}}`, String(replacement));
    }
    return value;
};

export function createEntriesListProps(
    overrides: Partial<ComponentProps<typeof EntriesList>> = {},
): ComponentProps<typeof EntriesList> {
    return {
        loading: false,
        entries: mockEntries,
        groupedEntries: mockGroupedEntries,
        config: { theme: 'dark' },
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onToggleVisibility: vi.fn(),
        onToggleFavorite: vi.fn(),
        onToggleArchived: vi.fn(),
        onTogglePinned: vi.fn(),
        editingEntry: null,
        editText: '',
        setEditText: vi.fn(),
        editTags: [],
        setEditTags: vi.fn(),
        editDate: null,
        setEditDate: vi.fn(),
        editVisibility: 'private',
        setEditVisibility: vi.fn(),
        editFormat: 'plain',
        setEditFormat: vi.fn(),
        allTags: ['work', 'personal', 'ideas', 'important'],
        onSaveEdit: vi.fn(),
        onCancelEdit: vi.fn(),
        onNavigateToEntry: vi.fn(),
        onShareEntry: vi.fn().mockResolvedValue(true),
        getEntryPermalink: getTestEntryPermalink,
        sourceEntry: null,
        targetEntryId: null,
        activeTargetId: null,
        onBackToSource: vi.fn(),
        t,
        ...overrides,
    };
}

export function createEntryViewModeProps(
    overrides: Partial<ComponentProps<typeof EntryViewMode>> = {},
): ComponentProps<typeof EntryViewMode> {
    return {
        entry: mockEntries[0],
        config: { theme: 'dark' },
        speaking: false,
        activeEntryId: null,
        activeTargetId: null,
        sourceEntry: null,
        flatEntries: mockEntries.map(({ id, content, date }) => ({ id, content, date })),
        speakEntry: vi.fn(),
        speakFromEntry: vi.fn(),
        stop: vi.fn(),
        onToggleVisibility: vi.fn(),
        onToggleFavorite: vi.fn(),
        onToggleArchived: vi.fn(),
        onTogglePinned: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onNavigateToEntry: vi.fn(),
        onShareEntry: vi.fn().mockResolvedValue(true),
        getEntryPermalink: getTestEntryPermalink,
        onBackToSource: vi.fn(),
        onFetchHistory: undefined,
        onFetchBacklinks: undefined,
        onDeleteRevision: undefined,
        onDiscuss: undefined,
        onRephrase: undefined,
        searchTerm: undefined,
        showDiaryLabel: true,
        tagMetadata: {},
        t,
        ...overrides,
    };
}
