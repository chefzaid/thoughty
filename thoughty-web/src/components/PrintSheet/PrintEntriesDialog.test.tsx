import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entry } from '../../types';
import { getTranslation } from '../../utils/translations';
import PrintEntriesDialog from './PrintEntriesDialog';

const authFetch = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ authFetch }) }));

const tIn = (language: 'en' | 'fr') => (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);

const morning: Entry = { id: 1, date: '2026-10-20', index: 1, title: 'Harbour day', mood: 4, feelings: [], content: 'Boats at dawn', tags: ['sea'], visibility: 'private' };
const evening: Entry = { id: 2, date: '2026-10-20', index: 2, content: 'Tea', tags: [], visibility: 'private' };
const capsule: Entry = { id: 3, date: '2026-10-20', index: 3, content: '', tags: [], visibility: 'private', sealed_until: '2030-01-01T00:00:00.000Z' };

const config = { theme: 'dark' as const, language: 'en', fontFamily: 'system' as const };
const sheet = () => document.querySelector<HTMLElement>('.print-sheet');

describe('PrintEntriesDialog', () => {
    const print = vi.fn();

    beforeEach(() => {
        print.mockReset();
        vi.stubGlobal('print', print);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('asks what else to print, prints once the pages are ready and closes after printing', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<PrintEntriesDialog what="entry" entries={[morning]} config={config} onClose={onClose} t={tIn('en')} />);

        const dialog = screen.getByRole('dialog', { name: 'Print this entry' });
        expect(dialog).toHaveTextContent('October 20, 2026 · Harbour day');
        const printButton = within(dialog).getByRole('button', { name: 'Print' });
        expect(printButton).toHaveFocus();
        const group = within(dialog).getByRole('group', { name: 'Also print' });
        expect(within(group).getByRole('checkbox', { name: 'Mood and feelings' })).toBeChecked();
        await user.click(within(group).getByRole('checkbox', { name: 'Tags' }));
        expect(sheet()).toBeNull();

        await user.click(printButton);
        expect(within(dialog).getByRole('status')).toHaveTextContent('Preparing the pages…');
        expect(printButton).toHaveAttribute('aria-disabled', 'true');
        await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
        expect(sheet()).toHaveTextContent('Mood: Good');
        expect(sheet()).not.toHaveTextContent('#sea');

        act(() => {
            globalThis.dispatchEvent(new Event('afterprint'));
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('prints a day without its sealed capsules, and offers only what the entries hold', async () => {
        const user = userEvent.setup();
        render(<PrintEntriesDialog what="day" entries={[evening, capsule]} config={{ ...config, theme: 'light' }} onClose={vi.fn()} t={tIn('en')} />);

        const dialog = screen.getByRole('dialog', { name: 'Print this day' });
        expect(dialog).toHaveTextContent('October 20, 2026 · 1 entry');
        expect(within(dialog).queryByRole('group')).not.toBeInTheDocument();

        await user.click(within(dialog).getByRole('button', { name: 'Print' }));
        await waitFor(() => expect(print).toHaveBeenCalled());
        expect(sheet()!.querySelectorAll('.print-entry')).toHaveLength(1);
    });

    it('closes with Cancel or Escape, taking the print view with it', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const { rerender } = render(<PrintEntriesDialog what="day" entries={[morning, evening]} config={{ ...config, language: 'fr' }} onClose={onClose} t={tIn('fr')} />);

        const dialog = screen.getByRole('dialog', { name: 'Imprimer cette journée' });
        expect(dialog).toHaveTextContent('20 octobre 2026 · 2 entrées');
        expect(within(dialog).getByRole('checkbox', { name: 'Humeur et ressentis' })).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
        expect(onClose).toHaveBeenCalledTimes(1);

        await user.click(within(dialog).getByRole('button', { name: 'Imprimer' }));
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(2);

        rerender(<></>);
        expect(sheet()).toBeNull();
        expect(document.documentElement).not.toHaveClass('print-sheet-active');
    });

    it('shows nothing when every entry is sealed', () => {
        render(<PrintEntriesDialog what="day" entries={[capsule]} config={config} onClose={vi.fn()} t={tIn('en')} />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
