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
  favorite: false,
  format: 'text',
  attachments: [],
  diary: { id: 1, name: 'Default' },
};

const t = (key: string) => {
  const translations: Record<string, string> = {
    aiChat: 'AI Chat',
    aiThinking: 'Thinking...',
    aiChatPlaceholder: 'Ask something about this entry...',
    aiChatError: 'Unable to get a response.',
    discussEntry: 'Discuss with AI',
  };
  return translations[key] ?? key;
};

describe('AiChatModal', () => {
  const defaultProps = {
    entry: mockEntry,
    isOpen: true,
    onClose: vi.fn(),
    onSend: vi.fn().mockResolvedValue('Great observation!'),
    theme: 'dark' as const,
    t,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('does not render when isOpen is false', () => {
      render(<AiChatModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('AI Chat')).not.toBeInTheDocument();
    });

    it('renders when isOpen is true', () => {
      render(<AiChatModal {...defaultProps} />);
      expect(screen.getByText('AI Chat')).toBeInTheDocument();
    });

    it('displays entry date and tags', () => {
      render(<AiChatModal {...defaultProps} />);
      expect(screen.getByText('2025-01-15')).toBeInTheDocument();
      expect(screen.getByText('#happy #outdoors')).toBeInTheDocument();
    });

    it('displays entry content preview', () => {
      render(<AiChatModal {...defaultProps} />);
      expect(screen.getByText(mockEntry.content)).toBeInTheDocument();
    });

    it('truncates long entry content', () => {
      const longEntry = { ...mockEntry, content: 'A'.repeat(300) };
      render(<AiChatModal {...defaultProps} entry={longEntry} />);
      expect(screen.getByText('A'.repeat(200) + '...')).toBeInTheDocument();
    });

    it('shows placeholder text when no messages', () => {
      render(<AiChatModal {...defaultProps} />);
      expect(screen.getByText('Ask something about this entry...')).toBeInTheDocument();
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
      
      const input = screen.getByPlaceholderText('Ask something about this entry...');
      await user.type(input, 'What does this entry tell me?{enter}');
      
      expect(defaultProps.onSend).toHaveBeenCalledWith(
        mockEntry.content,
        [{ role: 'user', content: 'What does this entry tell me?' }]
      );
    });

    it('does not send empty messages', async () => {
      const user = userEvent.setup();
      render(<AiChatModal {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Ask something about this entry...');
      await user.click(input);
      await user.keyboard('{enter}');
      
      expect(defaultProps.onSend).not.toHaveBeenCalled();
    });

    it('displays user and AI messages after sending', async () => {
      const user = userEvent.setup();
      render(<AiChatModal {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Ask something about this entry...');
      await user.type(input, 'Hello{enter}');
      
      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Great observation!')).toBeInTheDocument();
      });
    });

    it('shows error message when AI returns null', async () => {
      const user = userEvent.setup();
      const failSend = vi.fn().mockResolvedValue(null);
      render(<AiChatModal {...defaultProps} onSend={failSend} />);
      
      const input = screen.getByPlaceholderText('Ask something about this entry...');
      await user.type(input, 'Hello{enter}');
      
      await waitFor(() => {
        expect(screen.getByText('Unable to get a response.')).toBeInTheDocument();
      });
    });

    it('clears input after sending', async () => {
      const user = userEvent.setup();
      render(<AiChatModal {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Ask something about this entry...') as HTMLTextAreaElement;
      await user.type(input, 'Hello{enter}');
      
      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('allows multi-line input with Shift+Enter', async () => {
      const user = userEvent.setup();
      render(<AiChatModal {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Ask something about this entry...') as HTMLTextAreaElement;
      await user.type(input, 'Line 1{shift>}{enter}{/shift}Line 2');
      
      expect(defaultProps.onSend).not.toHaveBeenCalled();
      expect(input.value).toContain('Line 1');
      expect(input.value).toContain('Line 2');
    });
  });

  describe('Theme', () => {
    it('applies dark theme styles', () => {
      render(<AiChatModal {...defaultProps} theme="dark" />);
      const modal = screen.getByText('AI Chat').closest('div[class*="rounded-xl"]');
      expect(modal).toHaveClass('bg-gray-800');
    });

    it('applies light theme styles', () => {
      render(<AiChatModal {...defaultProps} theme="light" />);
      const modal = screen.getByText('AI Chat').closest('div[class*="rounded-xl"]');
      expect(modal).toHaveClass('bg-white');
    });
  });
});
