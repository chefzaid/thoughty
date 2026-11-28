import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation } from '../../utils/translations';
import DiscussWithSomeoneDialog from './DiscussWithSomeoneDialog';

const services = { open: vi.fn(), send: vi.fn(), fetchFollows: vi.fn() };

vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: () => services,
}));

const en = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const fr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
const writer = (id: number, username: string) => ({ id, username, avatarUrl: null, followedAt: '2026-11-01T08:00:00.000Z' });
const publicEntry = { id: 42, date: '2026-11-20', title: 'River walk', visibility: 'public' as const };

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderDialog(entry: Parameters<typeof DiscussWithSomeoneDialog>[0]['entry'] = publicEntry, { language = 'en' as 'en' | 'fr' } = {}) {
  const onClose = vi.fn();
  render(
    <MemoryRouter initialEntries={['/journal']}>
      <QueryClientProvider client={createTestQueryClient()}>
        <Routes>
          <Route
            path="*"
            element={(
              <>
                <DiscussWithSomeoneDialog entry={entry} isDark={false} language={language} onClose={onClose} t={language === 'fr' ? fr : en} />
                <LocationProbe />
              </>
            )}
          />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { onClose };
}

describe('DiscussWithSomeoneDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.fetchFollows.mockResolvedValue({
      data: { following: [writer(3, 'omar'), writer(2, 'maya')], followers: [writer(2, 'maya'), writer(3, 'omar'), writer(4, 'lena')] },
      error: null,
    });
    services.open.mockResolvedValue({ data: { id: 7 }, error: null });
    services.send.mockResolvedValue({ data: { id: 31 }, error: null });
  });

  it('says what can be shared, sends the entry with a message to a writer who follows back, and opens the conversation', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Discuss with someone' });
    expect(dialog).toHaveAccessibleDescription(/Only a public entry can be shared/);
    expect(within(dialog).getByText('November 20, 2026 · River walk')).toBeInTheDocument();
    const field = screen.getByLabelText('Your message');
    expect(field).toHaveFocus();
    const choices = await within(dialog).findAllByRole('radio');
    expect(choices.map((choice) => choice.closest('label')?.textContent)).toEqual(['maya', 'omar']);

    await user.click(screen.getByRole('button', { name: 'Send and open the conversation' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose who to write to.');
    await user.click(screen.getByRole('radio', { name: 'omar' }));
    await user.click(screen.getByRole('button', { name: 'Send and open the conversation' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Write a message to go with the entry.');

    await user.type(field, '  What do you think?  ');
    await user.click(screen.getByRole('button', { name: 'Send and open the conversation' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/messages?conversation=7'));
    expect(services.open).toHaveBeenCalledWith(3);
    expect(services.send).toHaveBeenCalledWith(7, 'What do you think?', 42);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the dialog open and says why when the message could not be sent', async () => {
    const user = userEvent.setup();
    services.send.mockResolvedValue({ data: null, error: 'apiError_MESSAGE_ENTRY_NOT_PUBLIC' });
    const { onClose } = renderDialog();

    await user.click(await screen.findByRole('radio', { name: 'maya' }));
    await user.type(screen.getByLabelText('Your message'), 'Look');
    await user.click(screen.getByRole('button', { name: 'Send and open the conversation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only a public entry can be shared in a message.');
    expect(onClose).not.toHaveBeenCalled();

    services.open.mockResolvedValue({ data: null, error: 'messagesOpenError' });
    await user.click(screen.getByRole('button', { name: 'Send and open the conversation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en('messagesOpenError'));
  });

  it('only explains how to share a private entry', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({ ...publicEntry, visibility: 'private' });

    expect(screen.getByRole('note')).toHaveTextContent('This entry is private. Make it public first');
    expect(screen.queryByLabelText('Your message')).not.toBeInTheDocument();
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();
    await user.click(close);
    expect(onClose).toHaveBeenCalled();
  });

  it('says when nobody follows back yet, and when the writers could not be read, in French too', async () => {
    services.fetchFollows.mockResolvedValueOnce({ data: { following: [writer(3, 'omar')], followers: [] }, error: null });
    renderDialog(publicEntry, { language: 'fr' });
    expect(await screen.findByText(/Dès que vous et une autre personne vous suivez/)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Discuter avec quelqu’un' })).toBeInTheDocument();
  });

  it('says when the writers could not be read', async () => {
    services.fetchFollows.mockResolvedValue({ data: null, error: 'feedLoadError' });
    renderDialog();
    expect(await screen.findByRole('alert')).toHaveTextContent(en('messagesLoadError'));
  });
});
