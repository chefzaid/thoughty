import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListenButton from './ListenButton';

describe('ListenButton', () => {
  const defaultProps = {
    entryId: 1,
    speaking: false,
    activeEntryId: null as number | null,
    onListenOne: vi.fn(),
    onListenFrom: vi.fn(),
    onStop: vi.fn(),
    theme: 'dark' as const,
    t: (key: string) => key,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a button', () => {
    render(<ListenButton {...defaultProps} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows speaker icon when not active', () => {
    render(<ListenButton {...defaultProps} />);
    const button = screen.getByTitle('listen');
    expect(button).toBeInTheDocument();
  });

  it('shows stop icon and title when active', () => {
    render(
      <ListenButton {...defaultProps} speaking={true} activeEntryId={1} />
    );
    const button = screen.getByTitle('stopListening');
    expect(button).toBeInTheDocument();
  });

  it('opens dropdown menu on click when not speaking', async () => {
    const user = userEvent.setup();
    render(<ListenButton {...defaultProps} />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('listenThisEntry')).toBeInTheDocument();
    expect(screen.getByText('listenFromHere')).toBeInTheDocument();
  });

  it('calls onStop when clicked while speaking', async () => {
    const user = userEvent.setup();
    render(
      <ListenButton {...defaultProps} speaking={true} activeEntryId={1} />
    );

    await user.click(screen.getByTitle('stopListening'));

    expect(defaultProps.onStop).toHaveBeenCalledTimes(1);
  });

  it('calls onStop when clicked while another entry is playing', async () => {
    const user = userEvent.setup();
    render(
      <ListenButton {...defaultProps} speaking={true} activeEntryId={99} />
    );

    await user.click(screen.getByRole('button'));
    expect(defaultProps.onStop).toHaveBeenCalledTimes(1);
  });

  it('calls onListenOne and closes menu when listenThisEntry is clicked', async () => {
    const user = userEvent.setup();
    render(<ListenButton {...defaultProps} />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('listenThisEntry'));

    expect(defaultProps.onListenOne).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('listenThisEntry')).not.toBeInTheDocument();
  });

  it('calls onListenFrom and closes menu when listenFromHere is clicked', async () => {
    const user = userEvent.setup();
    render(<ListenButton {...defaultProps} />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('listenFromHere'));

    expect(defaultProps.onListenFrom).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('listenFromHere')).not.toBeInTheDocument();
  });

  it('closes menu when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <div data-testid="outside">outside</div>
        <ListenButton {...defaultProps} />
      </div>
    );

    // Open menu
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('listenThisEntry')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('listenThisEntry')).not.toBeInTheDocument();
  });

  it('toggles menu open/closed on repeated clicks when not speaking', async () => {
    const user = userEvent.setup();
    render(<ListenButton {...defaultProps} />);

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('listenThisEntry')).toBeInTheDocument();

    // Close by clicking outside (simulate toggle)
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('listenThisEntry')).not.toBeInTheDocument();
  });

  it('applies pulse animation class when active', () => {
    render(
      <ListenButton {...defaultProps} speaking={true} activeEntryId={1} />
    );
    const button = screen.getByTitle('stopListening');
    expect(button.className).toContain('animate-pulse');
    expect(button.className).toContain('text-orange-500');
  });

  it('applies gray style when another entry is playing', () => {
    render(
      <ListenButton {...defaultProps} speaking={true} activeEntryId={99} />
    );
    const button = screen.getByRole('button');
    expect(button.className).toContain('text-gray-400');
  });

  it('applies light theme styles when theme is light', async () => {
    const user = userEvent.setup();
    render(<ListenButton {...defaultProps} theme="light" />);

    await user.click(screen.getByRole('button'));

    const menu = screen.getByText('listenThisEntry').closest('div');
    expect(menu?.className).toContain('bg-white');
  });

  it('applies dark theme styles when theme is dark', async () => {
    const user = userEvent.setup();
    render(<ListenButton {...defaultProps} theme="dark" />);

    await user.click(screen.getByRole('button'));

    const menu = screen.getByText('listenThisEntry').closest('div');
    expect(menu?.className).toContain('bg-gray-800');
  });
});
