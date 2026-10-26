import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getTranslation } from '../utils/translations';
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
  entryToast: { visible: false, showCount: 0, show: vi.fn(), hide: vi.fn() },
  notice: { visible: false, showCount: 0, show: vi.fn(), hide: vi.fn() },
  noticeText: '',
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

  it('focuses the main landmark when the authenticated view changes', () => {
    const { rerender } = render(
      <AuthenticatedAppLayout {...defaultProps}>
        <div>Journal content</div>
      </AuthenticatedAppLayout>,
    );

    const main = screen.getByRole('main');
    expect(main).not.toHaveFocus();

    rerender(
      <AuthenticatedAppLayout {...defaultProps} currentView="tags">
        <div>Tag content</div>
      </AuthenticatedAppLayout>,
    );

    expect(main).toHaveFocus();
  });

  it.each([
    ['en', 1, 'Move 1 entry to the recycle bin? You can restore it from there for 30 days.'],
    ['en', 2, 'Move 2 entries to the recycle bin? You can restore them from there for 30 days.'],
    ['fr', 1, "Placer 1 entrée dans la corbeille ? Vous pourrez l'y restaurer pendant 30 jours."],
    ['fr', 2, 'Placer 2 entrées dans la corbeille ? Vous pourrez les y restaurer pendant 30 jours.'],
  ] as const)('asks before moving the selected entries to the recycle bin in %s (%i)', (language, count, expected) => {
    render(
      <AuthenticatedAppLayout
        {...defaultProps}
        config={{ theme: 'dark', language }}
        t={(key, params) => getTranslation(language, key, params)}
        bulkModalOpen
        selectedCount={count}
      >
        <div>Journal content</div>
      </AuthenticatedAppLayout>,
    );

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('announces the notice of an entry action and hides it after a while', () => {
    vi.useFakeTimers();
    const hide = vi.fn();
    render(
      <AuthenticatedAppLayout
        {...defaultProps}
        notice={{ visible: true, showCount: 1, show: vi.fn(), hide }}
        noticeText="Impossible de supprimer l’entrée."
      >
        <div>Journal content</div>
      </AuthenticatedAppLayout>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de supprimer l’entrée.');
    vi.advanceTimersByTime(6000);
    expect(hide).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('shows no notice until an entry action reports one', () => {
    render(
      <AuthenticatedAppLayout {...defaultProps}>
        <div>Journal content</div>
      </AuthenticatedAppLayout>,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
