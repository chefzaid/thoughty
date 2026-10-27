import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getTranslation } from '../../utils/translations';
import { BulkActionBar } from './BulkActionBar';

vi.mock('../TagPicker/TagPicker', () => ({
    default: ({ onChange, placeholder, selectedTags }: { onChange: (tags: string[]) => void; placeholder: string; selectedTags: string[] }) => (
        <button type="button" data-testid="tag-picker" onClick={() => onChange(['alpha', 'beta'])}>
            {placeholder}:{selectedTags.join(',')}
        </button>
    ),
}));

describe('BulkActionBar', () => {
    const t = (key: string, params?: Record<string, string | number>) => params?.count ? `${key}:${params.count}` : key;

    it('hides the bulk action bar when nothing is selected', () => {
        const { container } = render(
            <BulkActionBar
                selectedCount={0}
                allTags={[]}
                tagMetadata={{}}
                diaries={[]}
                isDark={true}
                language="en"
                onBulkAction={vi.fn()}
                onClearSelection={vi.fn()}
                t={t}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('handles bulk action buttons, tag picker, move picker, and clear selection', () => {
        const onBulkAction = vi.fn();
        const onClearSelection = vi.fn();

        render(
            <BulkActionBar
                selectedCount={2}
                allTags={['alpha', 'beta']}
                tagMetadata={{}}
                diaries={[
                    { id: 1, name: 'Home', icon: 'H' },
                    { id: 2, name: 'Work', icon: 'W' },
                ] as never}
                isDark={false}
                language="en"
                onBulkAction={onBulkAction}
                onClearSelection={onClearSelection}
                t={t}
            />,
        );

        fireEvent.click(screen.getByText('bulkDelete'));
        fireEvent.click(screen.getByText('bulkMakePublic'));
        fireEvent.click(screen.getByText('bulkMakePrivate'));
        fireEvent.click(screen.getByText('bulkArchive'));
        fireEvent.click(screen.getByText('bulkUnarchive'));
        fireEvent.click(screen.getByText('bulkMakeBook'));

        fireEvent.click(screen.getByText('bulkRephrase'));
        fireEvent.click(screen.getByText('rephraseStyleLight'));

        fireEvent.click(screen.getByText('bulkAddTags'));
        fireEvent.click(screen.getByTestId('tag-picker'));
        fireEvent.click(screen.getByText('apply'));

        fireEvent.click(screen.getByText('bulkMove'));
        fireEvent.click(screen.getByText('W Work'));

        fireEvent.click(screen.getByText('bulkClearSelection'));

        expect(screen.getByText('bulkSelected_other:2')).toBeInTheDocument();
        expect(onBulkAction).toHaveBeenCalledWith('delete', undefined);
        expect(onBulkAction).toHaveBeenCalledWith('visibility', { visibility: 'public' });
        expect(onBulkAction).toHaveBeenCalledWith('visibility', { visibility: 'private' });
        expect(onBulkAction).toHaveBeenCalledWith('archive', { isArchived: true });
        expect(onBulkAction).toHaveBeenCalledWith('archive', { isArchived: false });
        expect(onBulkAction).toHaveBeenCalledWith('book', undefined);
        expect(onBulkAction).toHaveBeenCalledWith('rephrase', { mode: 'polish' });
        expect(onBulkAction).toHaveBeenCalledWith('tags', { tags: ['alpha', 'beta'] });
        expect(onBulkAction).toHaveBeenCalledWith('move', { diaryId: 2 });
        expect(onClearSelection).toHaveBeenCalledTimes(1);
    });

    it('resets the tag picker when cancelling tag selection', () => {
        render(
            <BulkActionBar
                selectedCount={1}
                allTags={['alpha', 'beta']}
                tagMetadata={{}}
                diaries={[{ id: 1, name: 'Solo', icon: 'S' }] as never}
                isDark={true}
                language="en"
                onBulkAction={vi.fn()}
                onClearSelection={vi.fn()}
                t={t}
            />,
        );

        fireEvent.click(screen.getByText('bulkAddTags'));
        fireEvent.click(screen.getByTestId('tag-picker'));
        fireEvent.click(screen.getByText('cancel'));
        fireEvent.click(screen.getByText('bulkAddTags'));

        expect(screen.getByText('selectTags:')).toBeInTheDocument();
    });

    it.each([
        ['en', 1, '1 selected'],
        ['en', 2, '2 selected'],
        ['fr', 1, '1 sélectionnée'],
        ['fr', 2, '2 sélectionnées'],
    ] as const)('counts the selection in %s (%i)', (language, count, expected) => {
        render(
            <BulkActionBar
                selectedCount={count}
                allTags={[]}
                tagMetadata={{}}
                diaries={[]}
                isDark={false}
                language={language}
                onBulkAction={vi.fn()}
                onClearSelection={vi.fn()}
                t={(key, params) => getTranslation(language, key, params)}
            />,
        );

        expect(screen.getByText(expected)).toBeInTheDocument();
    });
});
