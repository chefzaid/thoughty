import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EntryForm from './EntryForm';
import { getTranslation } from '../../utils/translations';

describe('EntryForm localized tag picker', () => {
    it.each([
        ['en', 'tags...'],
        ['fr', 'tags...'],
    ] as const)('shows the writing tag picker placeholder in %s, not the filter one', (language, placeholder) => {
        render(
            <EntryForm
                newEntryText=""
                setNewEntryText={vi.fn()}
                selectedDate={new Date('2024-01-15')}
                setSelectedDate={vi.fn()}
                tags={[]}
                setTags={vi.fn()}
                visibility="private"
                setVisibility={vi.fn()}
                format="plain"
                setFormat={vi.fn()}
                allTags={['work']}
                formError=""
                onSubmit={vi.fn((event) => event.preventDefault())}
                theme="dark"
                t={(key, params) => getTranslation(language, key, params)}
            />,
        );

        expect(screen.getByPlaceholderText(placeholder)).toBeInTheDocument();
        expect(screen.queryByPlaceholderText(/Filter by|Filtrer par/)).not.toBeInTheDocument();
    });
});
