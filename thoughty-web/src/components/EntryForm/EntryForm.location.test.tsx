import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EntryForm from './EntryForm';
import { getTranslation } from '../../utils/translations';
import { NO_LOCATION } from '../../utils/entryLocation';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

const defaultProps = {
    newEntryText: '',
    setNewEntryText: vi.fn(),
    selectedDate: new Date('2024-01-15'),
    setSelectedDate: vi.fn(),
    tags: [] as string[],
    setTags: vi.fn(),
    visibility: 'private' as const,
    setVisibility: vi.fn(),
    format: 'plain' as const,
    setFormat: vi.fn(),
    allTags: [],
    formError: '',
    onSubmit: vi.fn((event: { preventDefault: () => void }) => event.preventDefault()),
    theme: 'light' as const,
    t,
};

describe('EntryForm place', () => {
    it('shows no place field unless the composer is given one', () => {
        render(<EntryForm {...defaultProps} />);

        expect(screen.queryByLabelText('Place')).not.toBeInTheDocument();
    });

    it('takes the place the writer types', () => {
        const setLocation = vi.fn();
        render(<EntryForm {...defaultProps} location={NO_LOCATION} setLocation={setLocation} language="en" />);

        fireEvent.change(screen.getByLabelText('Place'), { target: { value: 'Lake Annecy' } });

        expect(screen.getByPlaceholderText('Where are you? (optional)')).toBeInTheDocument();
        expect(setLocation).toHaveBeenCalledWith(expect.any(Function));
        const update = setLocation.mock.calls[0]?.[0] as (current: typeof NO_LOCATION) => typeof NO_LOCATION;
        expect(update(NO_LOCATION)).toEqual({ name: 'Lake Annecy', latitude: null, longitude: null });
    });
});
