import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SharedContent } from '../../services/api';
import SharedLinkPage from './SharedLinkPage';
import { readerLanguage } from './sharedPageDocument';

const TOKEN = 'q3Jm0bX9vN2kR7sT1uW4yZ6aC8eG0iK2mO4qS6uW8yA';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const entryContent = (entry: Partial<NonNullable<SharedContent['entry']>> = {}): SharedContent => ({
  kind: 'entry',
  expiresAt: '2026-11-04T09:00:00.000Z',
  bookVersion: null,
  entry: {
    date: '2026-10-27', timeOfDay: '08:30', title: 'A walk by the sea', format: 'markdown',
    content: 'We met @marie at the lighthouse, as on [[2026-10-20]].\n\n![The shell](attachment:31)\n\n[A map](https://example.com/map)',
    mood: null, feelings: [], tags: [],
    attachments: [
      { id: 31, name: 'shell.jpg', mimetype: 'image/jpeg', size: 400, hasPoster: false },
      { id: 32, name: 'waves.mp4', mimetype: 'video/mp4', size: 9000, hasPoster: true },
      { id: 33, name: 'song.m4a', mimetype: 'audio/mp4', size: 900, hasPoster: false },
      { id: 34, name: 'notes.pdf', mimetype: 'application/pdf', size: 2048, hasPoster: false },
    ],
    ...entry,
  },
});

describe('SharedLinkPage', () => {
  afterEach(() => {
    document.head.querySelectorAll('meta[name="robots"], meta[name="referrer"]').forEach((meta) => meta.remove());
  });

  it('shows the shared entry only: its text, its own files from the link, people and references as text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(entryContent()));
    render(<SharedLinkPage token={TOKEN} language="en" theme="dark" fetchImpl={fetchImpl} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'A walk by the sea' })).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(`/api/shared/${TOKEN}`, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    expect(screen.getByText('October 27, 2026 · 8:30 AM')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'The shell' })).toHaveAttribute('src', `/api/shared/${TOKEN}/attachments/31`);
    // The placed picture is not listed again; the other files are, from the link
    expect(screen.queryByRole('img', { name: 'shell.jpg' })).not.toBeInTheDocument();
    const files = screen.getByRole('region', { name: 'Files' });
    expect(files.querySelector('video')).toHaveAttribute('poster', `/api/shared/${TOKEN}/attachments/32/poster`);
    expect(files.querySelector('video source')).toHaveAttribute('src', `/api/shared/${TOKEN}/attachments/32`);
    expect(files.querySelector('audio')).toHaveAttribute('src', `/api/shared/${TOKEN}/attachments/33`);
    expect(within(files).getByRole('link', { name: 'Download notes.pdf (2.0 KB)' })).toHaveAttribute('href', `/api/shared/${TOKEN}/attachments/34`);
    expect(screen.getByText(/@marie/).closest('a')).toBeNull();
    expect(screen.getByText('[[2026-10-20]]').tagName).toBe('SPAN');
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
    expect(screen.getByText(/This link works until/)).toBeInTheDocument();

    await waitFor(() => expect(document.title).toBe('A walk by the sea · Thoughty'));
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive');
    expect(document.head.querySelector('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
    expect(document.body).toHaveClass('dark-mode');
  });

  it('shows the mood and tags the writer chose, and a plain text entry with its line breaks, in French', async () => {
    const content = entryContent({ title: null, format: 'plain', content: 'Ligne un\nLigne deux', mood: 4, feelings: ['calm'], tags: ['famille'], attachments: [] });
    render(<SharedLinkPage token={TOKEN} language="fr" theme="light" fetchImpl={vi.fn().mockResolvedValue(json(content))} />);

    expect(await screen.findByRole('heading', { level: 1, name: '27 octobre 2026' })).toBeInTheDocument();
    expect(screen.getByText(/^Bonne · /)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Tags' })).toHaveTextContent('#famille');
    expect(screen.getByText(/Ligne un/).closest('div')).toHaveClass('whitespace-pre-wrap');
    expect(document.body).toHaveClass('light-mode');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('offers a shared book as a download of its file', async () => {
    const content: SharedContent = {
      kind: 'bookVersion', expiresAt: '2026-11-04T09:00:00.000Z', entry: null,
      bookVersion: { title: 'Summer', author: 'Zaid', format: 'pdf', filename: 'summer.pdf', size: 2 * 1024 * 1024 },
    };
    const user = userEvent.setup();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json(content))
      .mockResolvedValueOnce(new Response('%PDF-', { status: 200, headers: { 'Content-Type': 'application/pdf' } }))
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ code: 'SHARE_LINK_NOT_FOUND' }, 404));
    const createObjectURL = vi.fn(() => 'blob:book');
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<SharedLinkPage token={TOKEN} language="en" theme="dark" fetchImpl={fetchImpl} />);

    expect(await screen.findByRole('heading', { name: 'Summer' })).toBeInTheDocument();
    expect(screen.getByText('By Zaid')).toBeInTheDocument();
    expect(screen.getByText('PDF · 2.0 MB')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Download the book' }));
    expect(fetchImpl).toHaveBeenLastCalledWith(`/api/shared/${TOKEN}/file`, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Download the book' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Check your connection and try again.');
    await user.click(screen.getByRole('button', { name: 'Download the book' }));
    expect(await screen.findByRole('heading', { name: 'This link is not available' })).toBeInTheDocument();
    click.mockRestore();
  });

  it('says a link is not available the same way whatever the reason, and lets a failed load try again', async () => {
    const user = userEvent.setup();
    const unavailable = render(<SharedLinkPage token={TOKEN} language="en" theme="dark" fetchImpl={vi.fn().mockResolvedValue(json({ code: 'SHARE_LINK_NOT_FOUND' }, 404))} />);
    expect(await screen.findByRole('heading', { name: 'This link is not available' })).toBeInTheDocument();
    unavailable.unmount();

    const fetchImpl = vi.fn().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json(entryContent()));
    render(<SharedLinkPage token={TOKEN} language="en" theme="dark" fetchImpl={fetchImpl} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('This page could not be loaded');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'A walk by the sea' })).toBeInTheDocument();
  });

  it('reads the reader’s language from the browser', () => {
    expect(readerLanguage(['fr-FR', 'en'])).toBe('fr');
    expect(readerLanguage(['de-DE', 'en-GB'])).toBe('en');
    expect(readerLanguage(['de-DE'])).toBe('en');
  });
});
