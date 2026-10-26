import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import AiChatModal from './AiChatModal';
import type { Entry } from '../../types';

const entry: Entry = {
  id: 7,
  content: 'A walk by the river.',
  date: '2025-02-01',
  tags: [],
  visibility: 'private',
  is_favorite: false,
  format: 'plain',
  attachments: [],
  diary_name: 'Default',
};

const labels: Record<string, string> = {
  aiChat: 'AI Chat',
  aiChatPlaceholder: 'Ask something about this entry...',
  aiChatMessageLabel: 'Message to the AI',
  aiChatSend: 'Send message',
  closeDialog: 'Close dialog',
  exportChatHistory: 'Export Chat',
};
const t = (key: string) => labels[key] ?? key;

function ChatHarness({ onLoadHistory }: Readonly<{ onLoadHistory: () => Promise<[]> }>) {
  const [chatEntry, setChatEntry] = useState<Entry | null>(null);
  return (
    <>
      <button type="button" onClick={() => setChatEntry(entry)}>Discuss</button>
      <button type="button">Behind</button>
      {chatEntry && (
        <AiChatModal
          entry={chatEntry}
          isOpen
          onClose={() => setChatEntry(null)}
          onSend={vi.fn().mockResolvedValue('Reply')}
          onLoadHistory={onLoadHistory}
          t={t}
        />
      )}
    </>
  );
}

describe('AiChatModal keyboard', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  const openChat = async () => {
    const user = userEvent.setup();
    render(<ChatHarness onLoadHistory={vi.fn().mockResolvedValue([])} />);
    const opener = screen.getByRole('button', { name: 'Discuss' });
    await user.click(opener);
    const input = screen.getByRole('textbox', { name: 'Message to the AI' });
    await waitFor(() => expect(input).toBeEnabled());
    return { user, opener, input };
  };

  it('is a modal dialog named by its title', async () => {
    await openChat();

    const dialog = screen.getByRole('dialog', { name: 'AI Chat' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('starts in the message field and keeps Tab inside the dialog', async () => {
    const { user, input } = await openChat();
    const close = screen.getByRole('button', { name: 'Close dialog' });
    expect(input).toHaveFocus();

    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(input).toHaveFocus();

    await user.type(input, 'Why?');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Send message' })).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
  });

  it('closes on Escape from the message field and returns focus to the opener', async () => {
    const { user, opener } = await openChat();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('brings focus back to the message field once the history has loaded', async () => {
    let finishLoading: (messages: []) => void = () => undefined;
    const user = userEvent.setup();
    render(<ChatHarness onLoadHistory={() => new Promise<[]>((resolve) => { finishLoading = resolve; })} />);
    await user.click(screen.getByRole('button', { name: 'Discuss' }));
    const input = screen.getByRole('textbox', { name: 'Message to the AI' });
    expect(input).toBeDisabled();
    // A disabled field loses focus in the browser
    screen.getByRole('button', { name: 'Behind' }).focus();

    finishLoading([]);

    await waitFor(() => expect(input).toHaveFocus());
  });
});
