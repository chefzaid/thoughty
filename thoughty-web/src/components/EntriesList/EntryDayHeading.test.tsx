import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Config, Entry } from '../../types';
import { getTranslation } from '../../utils/translations';
import EntryDayHeading from './EntryDayHeading';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const config = { theme: 'light', language: 'en' } as Config;
const walk: Entry = { id: 1, date: '2026-10-20', index: 1, content: 'Walk', tags: [], visibility: 'private' };
const capsule: Entry = { ...walk, id: 2, index: 2, sealed_until: '2030-01-01T00:00:00.000Z' };

describe('EntryDayHeading', () => {
    it('offers to print the day, without its sealed capsules', async () => {
        const user = userEvent.setup();
        render(<EntryDayHeading label="2026-10-20" dayEntries={[walk, capsule]} config={config} t={t} />);

        expect(screen.getByRole('heading', { level: 2, name: '2026-10-20' })).toBeInTheDocument();
        const button = screen.getByRole('button', { name: 'Print this day, October 20, 2026' });
        expect(button).toHaveAttribute('title', 'Print this day');
        await user.click(button);

        const dialog = screen.getByRole('dialog', { name: 'Print this day' });
        expect(dialog).toHaveTextContent('1 entry');
        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(button).toHaveFocus();
    });

    it('has nothing to print for a group that is not a day, or a day of sealed capsules only', () => {
        const { rerender } = render(<EntryDayHeading label="Pinned" config={{ ...config, theme: 'dark' }} t={t} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();

        rerender(<EntryDayHeading label="2026-10-20" dayEntries={[capsule]} config={config} t={t} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
