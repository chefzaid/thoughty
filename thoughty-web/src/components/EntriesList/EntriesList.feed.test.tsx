import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import EntriesList from './EntriesList';
import { createEntriesListProps, mockEntries } from './EntriesList.test-utils';

describe('EntriesList as a feed', () => {
    it('lists each entry as an article with its place among every entry that matches', () => {
        render(<EntriesList {...createEntriesListProps({ total: 340, offset: 40 })} />);

        const feed = screen.getByRole('feed', { name: 'journalFeedLabel' });
        expect(feed).toHaveAttribute('aria-busy', 'false');
        expect(feed).toHaveAccessibleDescription('journalFeedHint');
        const articles = within(feed).getAllByRole('article');
        expect(articles).toHaveLength(mockEntries.length);
        expect(articles.map((article) => article.getAttribute('aria-posinset'))).toEqual(['41', '42', '43']);
        expect(articles.every((article) => article.getAttribute('aria-setsize') === '340')).toBe(true);
        // Each day's heading opens its first entry's article, so the feed holds articles only
        expect(within(articles[0]!).getByRole('heading', { level: 2 })).toBeInTheDocument();
        expect(articles[0]).toHaveAttribute('tabindex', '-1');
    });

    it('is busy while more entries load or the list is read again', () => {
        const { rerender } = render(<EntriesList {...createEntriesListProps({ loadingMore: true })} />);
        expect(screen.getByRole('feed')).toHaveAttribute('aria-busy', 'true');

        rerender(<EntriesList {...createEntriesListProps({ loading: true })} />);
        expect(screen.getByRole('feed')).toHaveAttribute('aria-busy', 'true');
    });

    it('selects the loaded entries, saying how many of how many match while more match than are loaded', () => {
        const onSelectAll = vi.fn();
        const onClearSelection = vi.fn();
        const { rerender } = render(<EntriesList {...createEntriesListProps({
            total: 50, bulkMode: true, selectedIds: new Set(), onSelectAll, onClearSelection, onBulkAction: vi.fn(), onToggleBulkMode: vi.fn(),
        })} />);

        fireEvent.click(screen.getByRole('checkbox', { name: 'selectAllLoaded_other' }));
        expect(onSelectAll).toHaveBeenCalledWith(mockEntries.map((entry) => entry.id));

        rerender(<EntriesList {...createEntriesListProps({
            total: 3, bulkMode: true, selectedIds: new Set(mockEntries.map((entry) => entry.id)), onSelectAll, onClearSelection,
            onBulkAction: vi.fn(), onToggleBulkMode: vi.fn(),
        })} />);
        const all = screen.getByRole('checkbox', { name: 'Select all' });
        expect(all).toBeChecked();
        fireEvent.click(all);
        expect(onClearSelection).toHaveBeenCalled();
    });

    it('names the checkbox that selects each entry', () => {
        const onToggleSelect = vi.fn();
        render(<EntriesList {...createEntriesListProps({
            bulkMode: true, selectedIds: new Set([mockEntries[0]!.id]), onToggleSelect, onSelectAll: vi.fn(),
            onClearSelection: vi.fn(), onBulkAction: vi.fn(), onToggleBulkMode: vi.fn(),
        })} />);

        const boxes = screen.getAllByRole('checkbox', { name: 'bulkSelectEntry' });
        expect(boxes).toHaveLength(mockEntries.length);
        expect(boxes[0]).toBeChecked();
        fireEvent.click(boxes[1]!);
        expect(onToggleSelect).toHaveBeenCalledWith(mockEntries[1]!.id);
    });

    it('shows what is given for each day under its heading, with every day listed, but not for pinned entries or best matches', () => {
        const renderDayEvents = vi.fn((date: string) => <p>Events of {date}</p>);
        const pinned = { ...mockEntries[2]!, is_pinned: true };
        const { rerender } = render(<EntriesList {...createEntriesListProps({
            renderDayEvents,
            entries: [pinned, mockEntries[0]!, mockEntries[1]!],
            groupedEntries: { '2024-01-15': [mockEntries[0]!, mockEntries[1]!], '2024-01-14': [pinned] },
        })} />);

        const articles = screen.getAllByRole('article');
        expect(within(articles[1]!).getByText('Events of 2024-01-15')).toBeInTheDocument();
        expect(within(articles[0]!).queryByText(/Events of/)).not.toBeInTheDocument();
        expect(screen.getAllByText(/Events of/)).toHaveLength(1);
        expect(renderDayEvents).toHaveBeenCalledWith('2024-01-15', ['2024-01-15']);

        renderDayEvents.mockClear();
        rerender(<EntriesList {...createEntriesListProps({ renderDayEvents, rankedOrder: true })} />);
        expect(renderDayEvents).not.toHaveBeenCalled();
    });
});
