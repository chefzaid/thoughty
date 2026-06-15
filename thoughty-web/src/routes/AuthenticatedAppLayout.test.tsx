import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AuthenticatedAppLayout from './AuthenticatedAppLayout';

const defaultProps = {
  config: { theme: 'dark' as const },
  currentView: 'journal' as const,
  userName: 'Test User',
  onViewChange: vi.fn(),
  onLogout: vi.fn(),
  t: (key: string) => key,
  deleteModalOpen: false,
  onCloseDeleteModal: vi.fn(),
  onConfirmDelete: vi.fn(),
  bulkModalOpen: false,
  onCloseBulkModal: vi.fn(),
  onConfirmBulkDelete: vi.fn(),
  selectedCount: 0,
  entryToastVisible: false,
  chatEntry: null,
  onCloseChat: vi.fn(),
  onLoadChatHistory: vi.fn().mockResolvedValue([]),
  onSendChat: vi.fn().mockResolvedValue(null),
};

describe('AuthenticatedAppLayout', () => {
  it('renders a skip link that targets the main content landmark', async () => {
    const user = userEvent.setup();
    render(
      <AuthenticatedAppLayout {...defaultProps}>
        <div>Journal content</div>
      </AuthenticatedAppLayout>,
    );

    const skipLink = screen.getByRole('link', { name: 'skipToContent' });
    const main = screen.getByRole('main');

    expect(skipLink).toHaveAttribute('href', '#main-content');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveAttribute('tabindex', '-1');

    await user.click(skipLink);
    expect(main).toHaveFocus();
  });

  it('keeps the app content inside the main landmark', () => {
    render(
      <AuthenticatedAppLayout {...defaultProps}>
        <button type="button">Child action</button>
      </AuthenticatedAppLayout>,
    );

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('button', { name: 'Child action' }));
  });
});
