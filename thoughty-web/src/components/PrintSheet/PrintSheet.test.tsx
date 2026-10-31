import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entry } from '../../types';
import type { Person } from '../../services/api/peopleService';
import { getTranslation } from '../../utils/translations';
import { MentionPeopleContext } from '../People/PeopleContext';
import PrintSheet from './PrintSheet';
import { printableEntries } from './printableEntries';
import { printedPictureFiles } from './usePrintPictures';

const authFetch = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ authFetch }) }));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

const harbour = { id: 7, original_filename: 'harbour.png', stored_filename: 'stored-harbour', mimetype: 'image/png', size: 60 };
const pier = { id: 8, original_filename: 'pier.jpg', stored_filename: 'stored-pier', mimetype: 'image/jpeg', size: 60 };
const clip = { id: 9, original_filename: 'boats.webm', stored_filename: 'stored-boats', mimetype: 'video/webm', size: 900, poster_filename: 'poster-boats.jpg' };
const plainClip = { id: 10, original_filename: 'waves.webm', stored_filename: 'stored-waves', mimetype: 'video/webm', size: 900, poster_filename: null };
const song = { id: 11, original_filename: 'gulls.mp3', stored_filename: 'stored-gulls', mimetype: 'audio/mpeg', size: 400 };

const harbourDay: Entry = {
    id: 1,
    date: '2026-10-20',
    index: 1,
    title: 'Harbour day',
    time_of_day: '08:30',
    mood: 4,
    feelings: ['calm'],
    content: 'Walked with @Marie to [[2026-10-19]].\n\n- [x] Coffee\n- [ ] Call grandma\n\n![The old pier](attachment:7)',
    format: 'markdown',
    tags: ['sea', 'walks'],
    visibility: 'private',
    attachments: [harbour, pier, clip, plainClip, song],
};

const evening: Entry = { id: 2, date: '2026-10-20', index: 2, content: 'Quiet evening\nwith tea', format: 'plain', tags: [], visibility: 'private' };
const capsule: Entry = { id: 3, date: '2026-10-20', index: 3, content: '', tags: [], visibility: 'private', sealed_until: '2030-01-01T00:00:00.000Z' };

const marie = { id: 5, name: 'Marie', handles: ['marie'] } as unknown as Person;

function renderSheet(entries: Entry[], options = { mood: true, tags: true }, onReady = vi.fn()) {
    const result = render(
        <MentionPeopleContext.Provider value={{ people: [marie], byHandle: new Map([['marie', marie]]) }}>
            <PrintSheet entries={entries} options={options} language="en" fontFamily="serif" t={t} onReady={onReady} />
        </MentionPeopleContext.Provider>,
    );
    return { ...result, onReady };
}

const sheet = () => document.querySelector<HTMLElement>('.print-sheet')!;

describe('PrintSheet', () => {
    let urlCount = 0;

    beforeEach(() => {
        urlCount = 0;
        authFetch.mockReset();
        authFetch.mockImplementation(async (url: string) => (url.endsWith('stored-pier')
            ? { ok: false }
            : { ok: true, blob: async () => new Blob([url]) }));
        vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:picture-${++urlCount}`);
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('lays out the day, time, title, text, task boxes, pictures and files, beside the app', async () => {
        const { onReady, unmount } = renderSheet([harbourDay, evening, capsule]);
        expect(document.documentElement).toHaveClass('print-sheet-active');
        expect(sheet().parentElement).toBe(document.body);
        expect(sheet()).toHaveAttribute('lang', 'en');
        expect(sheet().style.fontFamily).toContain('Georgia');

        await waitFor(() => expect(within(sheet()).getByRole('heading', { level: 1 })).toHaveTextContent('October 20, 2026'));
        const view = within(sheet());
        expect(view.getByRole('heading', { level: 2, name: 'Harbour day' })).toBeInTheDocument();
        expect(view.getByText('8:30 AM')).toHaveAttribute('dateTime', '08:30');
        // Mentions and entry links are plain text on paper
        await waitFor(() => expect(sheet().querySelector('[data-markdown]')).not.toBeNull());
        expect(view.queryByRole('link')).not.toBeInTheDocument();
        expect(view.queryByRole('button')).not.toBeInTheDocument();
        expect(sheet()).toHaveTextContent('Walked with @Marie to');
        expect(view.getByText('[[2026-10-19]]')).toHaveClass('entry-reference-link');
        // Task list items are boxes that cannot change
        expect(view.getByRole('checkbox', { name: 'Coffee' })).toBeChecked();
        expect(view.getByRole('checkbox', { name: 'Call grandma' })).toBeDisabled();
        // The placed picture shows in the text from its loaded copy, loaded at once
        expect(view.getByRole('img', { name: 'The old pier' })).toHaveAttribute('loading', 'eager');
        expect(view.getByRole('img', { name: 'The old pier' }).getAttribute('src')).toMatch(/^blob:picture-/);
        // Not again below it; a picture that failed to load, the audio and a video without a frame are named
        expect(view.queryByRole('img', { name: 'harbour.png' })).not.toBeInTheDocument();
        expect(view.getByText('Attached: pier.jpg')).toBeInTheDocument();
        expect(view.getByText('Attached: gulls.mp3')).toBeInTheDocument();
        expect(view.getByText('Attached: waves.webm')).toBeInTheDocument();
        expect(view.getByText('Video: boats.webm')).toBeInTheDocument();
        expect(view.getByText('Mood: Good · calm')).toBeInTheDocument();
        expect(view.getByText('Tags: #sea #walks')).toBeInTheDocument();
        // A plain entry keeps its line breaks; the sealed capsule is left out
        expect(view.getByText(/Quiet evening/)).toHaveTextContent('Quiet evening with tea');
        expect(sheet().querySelectorAll('.print-entry')).toHaveLength(2);
        expect(authFetch).toHaveBeenCalledWith('/api/attachments/file/stored-harbour');
        expect(authFetch).toHaveBeenCalledWith('/api/attachments/file/poster-boats.jpg');

        // Printed only once every picture is there
        expect(onReady).not.toHaveBeenCalled();
        for (const image of sheet().querySelectorAll('img')) {
            // jsdom loads no pictures; a browser has them complete by their load event
            Object.defineProperty(image, 'complete', { value: true });
            fireEvent.load(image);
        }
        await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));

        unmount();
        expect(document.documentElement).not.toHaveClass('print-sheet-active');
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:picture-1');
    });

    it('leaves out the mood and tags when they are not asked for, and prints at once without pictures', async () => {
        const { onReady } = renderSheet([evening, { ...harbourDay, attachments: [], content: 'Just words' }], { mood: false, tags: false });

        await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
        expect(sheet()).not.toHaveTextContent('Mood');
        expect(sheet()).not.toHaveTextContent('#sea');
        expect(authFetch).not.toHaveBeenCalled();
    });

    it('starts a new section for each day', async () => {
        renderSheet([evening, { ...evening, id: 4, date: '2026-10-21' }]);

        await waitFor(() => expect(within(sheet()).getAllByRole('heading', { level: 1 })).toHaveLength(2));
        expect(within(sheet()).getAllByRole('heading', { level: 1 }).map((heading) => heading.textContent)).toEqual(['October 20, 2026', 'October 21, 2026']);
    });

    it('frees a picture that arrives after the print view has gone', async () => {
        let release: (value: unknown) => void = () => undefined;
        authFetch.mockImplementation(() => new Promise((resolve) => {
            release = resolve;
        }));
        const { unmount } = renderSheet([{ ...evening, attachments: [harbour] }]);
        await waitFor(() => expect(authFetch).toHaveBeenCalled());

        unmount();
        release({ ok: true, blob: async () => new Blob(['late']) });
        await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:picture-1'));
    });

    it('skips a picture whose request fails outright', async () => {
        authFetch.mockRejectedValue(new Error('offline'));
        const { onReady } = renderSheet([{ ...evening, attachments: [harbour] }]);

        await waitFor(() => expect(onReady).toHaveBeenCalled());
        expect(within(sheet()).getByText('Attached: harbour.png')).toBeInTheDocument();
    });
});

describe('print helpers', () => {
    it('never prints a sealed capsule', () => {
        expect(printableEntries([harbourDay, capsule, evening]).map((entry) => entry.id)).toEqual([1, 2]);
    });

    it('fetches each picture and video frame once', () => {
        expect(printedPictureFiles([harbourDay, { ...evening, attachments: [harbour] }]))
            .toEqual(['stored-harbour', 'stored-pier', 'poster-boats.jpg']);
    });
});
