import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Entry } from '../../types';
import { getTranslation } from '../../utils/translations';
import AiChatModal from './AiChatModal';

const t = (key: string) => getTranslation('en', key);

const entry = (fields: Partial<Entry> = {}): Entry => ({
  id: 1,
  content: 'A quiet walk by the river.',
  date: '2025-01-15',
  tags: ['walks'],
  visibility: 'private',
  is_favorite: false,
  format: 'plain',
  attachments: [],
  diary_name: 'Default',
  ...fields,
});

const support = () => screen.queryByRole('region', { name: "You don't have to face this alone" });

async function openChat(props: Partial<Parameters<typeof AiChatModal>[0]> = {}) {
  const onClose = vi.fn();
  const view = render(
    <AiChatModal
      entry={entry()}
      isOpen
      onClose={onClose}
      onSend={vi.fn().mockResolvedValue('I hear you.')}
      onLoadHistory={vi.fn().mockResolvedValue([])}
      t={t}
      {...props}
    />,
  );
  const input = screen.getByRole('textbox', { name: t('aiChatMessageLabel') });
  await waitFor(() => expect(input).not.toBeDisabled());
  return { ...view, input, onClose };
}

describe('AiChatModal support resources', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('shows no support card for an ordinary entry and chat', async () => {
    const { input } = await openChat();
    await userEvent.type(input, 'What stands out?{Enter}');
    await screen.findByText('I hear you.');
    expect(support()).not.toBeInTheDocument();
  });

  it('shows the support card once the writer says something that signals a crisis, and closes it', async () => {
    const { input, onClose } = await openChat();
    await userEvent.type(input, 'Honestly I want to die{Enter}');

    expect(await screen.findByRole('heading', { level: 4, name: "You don't have to face this alone" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '3114' })).toHaveAttribute('href', 'tel:3114');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(support()).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows it for an entry whose title or text signals a crisis, and never for the AI reply alone', async () => {
    const { unmount } = await openChat({ entry: entry({ title: 'Thinking about suicide' }) });
    expect(support()).toBeInTheDocument();
    unmount();

    await openChat({
      onLoadHistory: vi.fn().mockResolvedValue([
        { role: 'user', content: 'A long week.' },
        { role: 'assistant', content: 'If you ever think about suicide, reach out.' },
      ]),
    });
    await screen.findByText('A long week.');
    expect(support()).not.toBeInTheDocument();
  });

  it('brings the card back when the chat opens on another entry', async () => {
    const view = await openChat({ entry: entry({ content: 'Je veux mourir.' }) });
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(support()).not.toBeInTheDocument();

    view.rerender(
      <AiChatModal
        entry={entry({ id: 2, content: 'Je veux mourir.' })}
        isOpen
        onClose={view.onClose}
        onSend={vi.fn()}
        onLoadHistory={vi.fn().mockResolvedValue([])}
        t={t}
      />,
    );
    await waitFor(() => expect(support()).toBeInTheDocument());
  });
});
