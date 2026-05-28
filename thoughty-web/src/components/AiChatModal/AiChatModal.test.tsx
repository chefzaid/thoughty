import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiChatModal from './AiChatModal';
import type { Entry } from '../../types';

const mockEntry: Entry = {
  id: 1,
  content: 'Today I had a great day at the park with friends.',
  date: '2025-01-15',
  tags: ['happy', 'outdoors'],
  visibility: 'private',
  is_favorite: false,
  format: 'plain',
  attachments: [],
  diary_name: 'Default',
};

const t = (key: string) => {
  const translations: Record<string, string> = {
    aiChat: 'AI Chat',
    aiThinking: 'Thinking...',
    aiLoadingHistory: 'Loading chat history...',
    aiChatPlaceholder: 'Ask something about this entry...',
    aiChatError: 'Unable to get a response.',
    exportChatHistory: 'Export Chat',
    discussEntry: 'Discuss with AI',
  };
  return translations[key] ?? key;
};

const getReadyInput = async (): Promise<HTMLTextAreaElement> => {
  const input = await screen.findByPlaceholderText('Ask something about this entry...');
  if (!(input instanceof HTMLTextAreaElement)) {
    throw new TypeError('Expected AI chat input to be a textarea');
  }
  await waitFor(() => {
    expect(input).not.toBeDisabled();
  });
  return input;
};

const waitForHistoryLoad = async (): Promise<void> => {
  await getReadyInput();
};

describe('AiChatModal', () => {
  const defaultProps = {
    entry: mockEntry,
    isOpen: true,
    onClose: vi.fn(),
    onSend: vi.fn().mockResolvedValue('Great observation!'),
    onLoadHistory: vi.fn().mockResolvedValue([]),
    theme: 'dark' as const,
    t,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:chat-export');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  describe('Rendering', () => {
    it('does not render when isOpen is false', () => {
      render(<AiChatModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('AI Chat')).not.toBeInTheDocument();
    });

    it('renders when isOpen is true', async () => {
      render(<AiChatModal {...defaultProps} />);
      await waitForHistoryLoad();
      expect(screen.getByText('AI Chat')).toBeInTheDocument();
    });

    it('loads history when the modal opens', async () => {
      render(<AiChatModal {...defaultProps} />);

      await waitFor(() => {
        expect(defaultProps.onLoadHistory).toHaveBeenCalledWith(1);
      });
    });

    it('displays entry date and tags', async () => {
      render(<AiChatModal {...defaultProps} />);
      await waitForHistoryLoad();
      expect(screen.getByText('2025-01-15')).toBeInTheDocument();
      expect(screen.getByText('#happy #outdoors')).toBeInTheDocument();
    });

    it('displays entry content preview', async () => {
      render(<AiChatModal {...defaultProps} />);
      await waitForHistoryLoad();
      expect(screen.getByText(mockEntry.content)).toBeInTheDocument();
    });

    it('truncates long entry content', async () => {
      const longEntry = { ...mockEntry, content: 'A'.repeat(300) };
      render(<AiChatModal {...defaultProps} entry={longEntry} />);
      await waitForHistoryLoad();
      expect(screen.getByText('A'.repeat(200) + '...')).toBeInTheDocument();
    });

    it('shows placeholder text when no messages', async () => {
      render(<AiChatModal {...defaultProps} />);
      expect(await screen.findByText('Ask something about this entry...')).toBeInTheDocument();
    });

    it('disables chat export when there is no history', async () => {
      render(<AiChatModal {...defaultProps} />);
      await waitForHistoryLoad();
      expect(screen.getByRole('button', { name: 'Export Chat' })).toBeDisabled();
    });
  });

  describe('Interactions', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<AiChatModal {...defaultProps} />);
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);
      expect(defaultProps.onClose).toHaveBeenCalledOnce();
    });

    it('calls onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      render(<AiChatModal {...defaultProps} />);
      
      const backdrop = screen.getByLabelText('Close modal');
      await user.click(backdrop);
      expect(defaultProps.onClose).toHaveBeenCalledOnce();
    });

    it('sends a message when Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<AiChatModal {...defaultProps} />);
      
      const input = await getReadyInput();
      await user.type(input, 'What does this entry tell me?{enter}');
      
      expect(defaultProps.onSend).toHaveBeenCalledWith(
        mockEntry.id,
        mockEntry.content,
        [{ role: 'user', content: 'What does this entry tell me?' }]
      );
    });

    it('does not send empty messages', async () => {
      const user = userEvent.setup();
      render(<AiChatModal {...defaultProps} />);
      
      const input = await getReadyInput();
      await user.click(input);
      await user.keyboard('{enter}');
      
      expect(defaultProps.onSend).not.toHaveBeenCalled();
    });

    it('displays user and AI messages after sending', async () => {
      const user = userEvent.setup();
      render(<AiChatModal {...defaultProps} />);
      
      const input = await getReadyInput();
      await user.type(input, 'Hello{enter}');
      
      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Great observation!')).toBeInTheDocument();
      });
    });

    it('loads saved chat history on first open', async () => {
      const onLoadHistory = vi.fn().mockResolvedValue([
        { role: 'user', content: 'Saved question' },
        { role: 'assistant', content: 'Saved answer' },
      ]);

      render(<AiChatModal {...defaultProps} onLoadHistory={onLoadHistory} />);

      await waitFor(() => {
        expect(screen.getByText('Saved question')).toBeInTheDocument();
        expect(screen.getByText('Saved answer')).toBeInTheDocument();
      });
    });

    it('keeps chat history when reopened for the same entry', async () => {
      const onLoadHistory = vi
        .fn()
        .mockResolvedValueOnce([{ role: 'assistant', content: 'First load' }])
        .mockResolvedValueOnce([{ role: 'assistant', content: 'Reloaded history' }]);
      const { rerender } = render(<AiChatModal {...defaultProps} onLoadHistory={onLoadHistory} />);

      await waitFor(() => {
        expect(screen.getByText('First load')).toBeInTheDocument();
      });

      rerender(<AiChatModal {...defaultProps} onLoadHistory={onLoadHistory} isOpen={false} />);
      rerender(<AiChatModal {...defaultProps} onLoadHistory={onLoadHistory} isOpen />);

      await waitFor(() => {
        expect(screen.getByText('Reloaded history')).toBeInTheDocument();
      });
    });

    it('exports the current chat history as a text file', async () => {
      const user = userEvent.setup();
      const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      render(<AiChatModal {...defaultProps} onLoadHistory={vi.fn().mockResolvedValue([])} />);

      const input = await getReadyInput();
      await user.type(input, 'Export this{enter}');

      await waitFor(() => {
        expect(screen.getByText('Export this')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Export Chat' }));

      expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(anchorClick).toHaveBeenCalledOnce();
    });

    it('shows error message when AI returns null', async () => {
      const user = userEvent.setup();
      const failSend = vi.fn().mockResolvedValue(null);
      render(<AiChatModal {...defaultProps} onSend={failSend} />);
      
      const input = await getReadyInput();
      await user.type(input, 'Hello{enter}');
      
      await waitFor(() => {
        expect(screen.getByText('Unable to get a response.')).toBeInTheDocument();
      });
    });

    it('clears input after sending', async () => {
      const user = userEvent.setup();
      render(<AiChatModal {...defaultProps} />);
      
      const input = await getReadyInput();
      await user.type(input, 'Hello{enter}');
      
      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('allows multi-line input with Shift+Enter', async () => {
      const user = userEvent.setup();
      render(<AiChatModal {...defaultProps} />);
      
      const input = await getReadyInput();
      await user.type(input, 'Line 1{shift>}{enter}{/shift}Line 2');
      
      expect(defaultProps.onSend).not.toHaveBeenCalled();
      expect(input.value).toContain('Line 1');
      expect(input.value).toContain('Line 2');
    });
  });

  describe('Theme', () => {
    it('applies dark theme styles', async () => {
      render(<AiChatModal {...defaultProps} theme="dark" />);
      await waitForHistoryLoad();
      const modal = screen.getByText('AI Chat').closest('div[class*="rounded-xl"]');
      expect(modal).toHaveClass('bg-gray-800');
    });

    it('applies light theme styles', async () => {
      render(<AiChatModal {...defaultProps} theme="light" />);
      await waitForHistoryLoad();
      const modal = screen.getByText('AI Chat').closest('div[class*="rounded-xl"]');
      expect(modal).toHaveClass('bg-white');
    });
  });
});
