import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShareLink, ShareLinksService } from '../../services/api';
import { getTranslation, type Language } from '../../utils/translations';
import ShareLinkDialog from './ShareLinkDialog';

const TOKEN = 'q3Jm0bX9vN2kR7sT1uW4yZ6aC8eG0iK2mO4qS6uW8yA';
const link = (overrides: Partial<ShareLink> = {}): ShareLink => ({
  id: 7, kind: 'entry', targetId: 12, label: null, showMood: false, showTags: false, maxViews: null, viewCount: 0,
  lastViewedAt: null, expiresAt: '2026-11-04T09:00:00.000Z', createdAt: '2026-10-28T09:00:00.000Z', ...overrides,
});

function makeService(links: ShareLink[] = []) {
  return {
    list: vi.fn().mockResolvedValue({ data: { links, limit: 100, activeCount: links.length }, error: null }),
    create: vi.fn().mockResolvedValue({ data: { ...link({ id: 8, label: 'For Mum' }), token: TOKEN }, error: null }),
    revoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  } satisfies ShareLinksService;
}

function renderDialog(service: ShareLinksService, options: { kind?: 'entry' | 'bookVersion'; language?: Language; onClose?: () => void } = {}) {
  const language = options.language ?? 'en';
  return render(
    <ShareLinkDialog
      isOpen
      target={{ kind: options.kind ?? 'entry', id: 12 }}
      subject="A walk by the sea"
      isDark={false}
      language={language}
      service={service}
      onClose={options.onClose ?? vi.fn()}
      t={(key, params) => getTranslation(language, key, params)}
    />,
  );
}

describe('ShareLinkDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('makes a link with the chosen expiry and options, and shows its address once to copy', async () => {
    const user = userEvent.setup();
    const service = makeService();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    renderDialog(service);

    expect(screen.getByRole('dialog', { name: 'Share privately' })).toHaveAccessibleDescription(/Anyone with the link can read this entry/);
    await waitFor(() => expect(screen.getByLabelText('Link expires')).toHaveFocus());
    expect(await screen.findByText('No active links.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Link expires'), 'day');
    await user.type(screen.getByLabelText('View limit (optional)'), '3');
    await user.type(screen.getByLabelText('Note for yourself (optional)'), ' For Mum ');
    await user.click(screen.getByLabelText('Show the tags'));
    await user.click(screen.getByRole('button', { name: 'Create link' }));

    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'entry', targetId: 12, label: 'For Mum', maxViews: 3, showMood: false, showTags: true, expiresAt: expect.any(String),
    }));
    const expiresIn = Date.parse(service.create.mock.calls[0]![0].expiresAt) - Date.now();
    expect(Math.round(expiresIn / 3_600_000)).toBe(24);
    expect(screen.getByText('Copy the link now: it is shown only this once.')).toBeInTheDocument();
    expect(screen.getByLabelText('Private link')).toHaveValue(`${globalThis.location.origin}/s/${TOKEN}`);
    expect(screen.getByRole('button', { name: 'Copy link' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(`${globalThis.location.origin}/s/${TOKEN}`);
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument();
    expect(service.list).toHaveBeenCalledTimes(2);
  });

  it('ends a custom expiry with the picked day, refusing a day outside the year ahead', async () => {
    const user = userEvent.setup();
    const service = makeService();
    renderDialog(service, { kind: 'bookVersion' });

    expect(screen.queryByLabelText('Show the mood')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Link expires'), 'custom');
    const date = screen.getByLabelText('Last day of the link');
    await user.clear(date);
    await user.type(date, '2001-01-01');
    expect(screen.getByRole('button', { name: 'Create link' })).toBeDisabled();
    await user.clear(date);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const day = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`;
    await user.type(date, day);
    await user.type(screen.getByLabelText('View limit (optional)'), '0');
    expect(screen.getByRole('button', { name: 'Create link' })).toBeDisabled();
    await user.clear(screen.getByLabelText('View limit (optional)'));
    await user.click(screen.getByRole('button', { name: 'Create link' }));

    const sent = service.create.mock.calls[0]![0];
    expect(sent).toEqual({ kind: 'bookVersion', targetId: 12, expiresAt: new Date(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate(), 23, 59).toISOString(), label: null, maxViews: null });
  });

  it('lists the active links with their views and revokes one, in French', async () => {
    const user = userEvent.setup();
    const service = makeService([link({ label: 'Pour maman', maxViews: 5, viewCount: 2 }), link({ id: 9, viewCount: 1 })]);
    renderDialog(service, { language: 'fr' });

    expect(await screen.findByText('Pour maman')).toBeInTheDocument();
    expect(screen.getByText(/2 vues sur 5/)).toBeInTheDocument();
    expect(screen.getByText(/1 vue$/)).toBeInTheDocument();
    expect(screen.getByText('Vous avez 2 liens actifs sur 100 au total.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Révoquer Pour maman' }));

    expect(service.revoke).toHaveBeenCalledWith(7);
    expect(await screen.findByText('Lien révoqué. Il ne fonctionne plus.')).toBeInTheDocument();

    service.revoke.mockResolvedValueOnce({ data: null, error: 'shareLinkRevokeFailed' });
    await user.click(screen.getByRole('button', { name: 'Révoquer Pour maman' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de révoquer le lien.');
  });

  it('says what failed, with the API’s reason when it gives one, and closes with Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const service = makeService();
    service.list.mockResolvedValueOnce({ data: null, error: 'shareLinksLoadFailed' });
    service.create.mockResolvedValueOnce({ data: null, error: 'apiError_SHARE_LINK_LIMIT_REACHED' });
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    renderDialog(service, { onClose });

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the links.');
    await user.click(screen.getByRole('button', { name: 'Create link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('You have reached the limit of active share links. Revoke one first.');

    await user.click(screen.getByRole('button', { name: 'Create link' }));
    await user.click(await screen.findByRole('button', { name: 'Copy link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not copy.');

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
