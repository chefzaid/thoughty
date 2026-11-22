import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EntryChatReply } from '../../services/api/entryChatService';
import { getTranslation } from '../../utils/translations';
import DiscussEntriesButton from './DiscussEntriesButton';

const chatService = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => chatService }));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const fr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);

const reply = (fields: Partial<EntryChatReply> = {}): EntryChatReply => ({
  reply: 'Spring opens it [1], then rain [2].',
  entries: [
    { ref: 1, id: 4, date: '2026-03-01', title: 'Spring' },
    { ref: 2, id: 9, date: '2026-03-08', title: null },
  ],
  cited: [2, 1],
  total: 2,
  ...fields,
});

function Harness({ onOpenEntry = vi.fn(), listEmpty = false }: { onOpenEntry?: (ids: readonly number[], id: number) => void; listEmpty?: boolean }) {
  const [scope, setScope] = useState('tags=walks');
  return (
    <>
      <button type="button" onClick={() => setScope('tags=sea')}>Other filters</button>
      <DiscussEntriesButton scope={scope} listEmpty={listEmpty} onOpenEntry={onOpenEntry} language="en" theme="dark" t={t} />
    </>
  );
}

const ask = (text: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Message to the AI' }), { target: { value: text } });
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message to the AI' }), { key: 'Enter' });
};

describe('DiscussEntriesButton', () => {
  afterEach(() => vi.clearAllMocks());

  it('discusses the entries of the filters within the dates chosen, and lists the entries each reply cites', async () => {
    chatService.send.mockResolvedValue({ data: reply(), error: null });
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Discuss' }));
    const dialog = screen.getByRole('dialog', { name: 'Discuss these entries' });
    expect(within(dialog).getByText(/the newest 50 at most/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message to the AI' })).toHaveFocus();
    fireEvent.change(within(dialog).getByLabelText('From'), { target: { value: '2026-01-01' } });
    fireEvent.change(within(dialog).getByLabelText('To'), { target: { value: '2026-06-30' } });
    ask('What comes back?');

    expect(await within(dialog).findByText('Spring opens it [1], then rain [2].')).toBeInTheDocument();
    expect(chatService.send).toHaveBeenCalledWith('tags=walks', { from: '2026-01-01', to: '2026-06-30' }, [{ role: 'user', content: 'What comes back?' }]);
    expect(within(dialog).getByText('Read 2 entries')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: /^\[\d\]/ }).map((button) => button.textContent))
      .toEqual(['[2] March 8, 2026', '[1] March 1, 2026 · Spring']);
    // The dates hold for the whole conversation
    expect(within(dialog).getByLabelText('From')).toBeDisabled();
    expect(within(dialog).getByText('Start a new conversation to change the dates.')).toBeInTheDocument();

    chatService.send.mockResolvedValue({ data: reply({ reply: 'Mostly rain.', cited: [], total: 120 }), error: null });
    ask('And then?');
    expect(await within(dialog).findByText('Mostly rain.')).toBeInTheDocument();
    expect(chatService.send).toHaveBeenLastCalledWith('tags=walks', { from: '2026-01-01', to: '2026-06-30' }, [
      { role: 'user', content: 'What comes back?' },
      { role: 'assistant', content: 'Spring opens it [1], then rain [2].' },
      { role: 'user', content: 'And then?' },
    ]);
    expect(within(dialog).getByText('Read 2 entries, the newest of 120')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'New conversation' }));
    expect(within(dialog).queryByText('Mostly rain.')).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('From')).toBeEnabled();
    expect(within(dialog).getByLabelText('From')).toHaveValue('');
  });

  it('opens a cited entry among those its reply read, and keeps the conversation for the filters it is about', async () => {
    chatService.send.mockResolvedValue({ data: reply(), error: null });
    const onOpenEntry = vi.fn();
    render(<Harness onOpenEntry={onOpenEntry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Discuss' }));
    ask('What comes back?');
    fireEvent.click(await screen.findByRole('button', { name: '[1] March 1, 2026 · Spring' }));

    expect(onOpenEntry).toHaveBeenCalledWith([4, 9], 4);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discuss' }));
    expect(screen.getByText('Spring opens it [1], then rain [2].')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    fireEvent.click(screen.getByRole('button', { name: 'Other filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discuss' }));
    expect(screen.queryByText('Spring opens it [1], then rain [2].')).not.toBeInTheDocument();
  });

  it('drops a reply that comes back after the filters changed', async () => {
    let answer: (value: unknown) => void = () => undefined;
    chatService.send.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Discuss' }));
    ask('What comes back?');
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Other filters' }));
    await act(async () => answer({ data: reply(), error: null }));

    expect(screen.queryByText('Spring opens it [1], then rain [2].')).not.toBeInTheDocument();
    expect(screen.queryByText('What comes back?')).not.toBeInTheDocument();
  });

  it('says why a request failed, keeps the message, and offers support when the words call for it', async () => {
    chatService.send.mockResolvedValue({ data: null, error: 'apiError_ENTRY_CHAT_NO_MATCH' });
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Discuss' }));
    ask('I want to die');

    expect(await screen.findByRole('alert')).toHaveTextContent('No entry matches these filters and dates, so there is nothing to discuss.');
    expect(screen.getByText('I want to die')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { level: 4 })).toBeInTheDocument());
  });

  it('stays dimmed with nothing to discuss, and is translated', () => {
    render(<DiscussEntriesButton scope="" listEmpty onOpenEntry={vi.fn()} language="fr" t={fr} />);

    const button = screen.getByRole('button', { name: 'Discuter' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Aucune entrée ne correspond à ces filtres : il n’y a rien à discuter.');
    fireEvent.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('writes the counts and dates in French', async () => {
    chatService.send.mockResolvedValue({ data: reply({ total: 80 }), error: null });
    render(<DiscussEntriesButton scope="" listEmpty={false} onOpenEntry={vi.fn()} language="fr" t={fr} />);

    fireEvent.click(screen.getByRole('button', { name: 'Discuter' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Message à l’IA' }), { target: { value: 'Et alors ?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le message' }));

    expect(await screen.findByText('2 entrées lues, les plus récentes sur 80')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '[1] 1 mars 2026 · Spring' })).toBeInTheDocument();
  });
});
