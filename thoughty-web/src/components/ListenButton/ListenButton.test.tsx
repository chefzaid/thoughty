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
  it('exposes its name, menu and pressed state to assistive technology', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ListenButton {...defaultProps} label="Listen to Ada" />);

    const trigger = screen.getByRole('button', { name: 'Listen to Ada' });
    expect(trigger).toHaveAttribute('aria-pressed', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Listen to Ada' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'listenThisEntry' })).toHaveFocus();

    rerender(<ListenButton {...defaultProps} label="Listen to Ada" speaking activeEntryId={1} />);
    const stopButton = screen.getByRole('button', { name: 'stopListening' });
    expect(stopButton).toHaveAttribute('aria-pressed', 'true');
    expect(stopButton).not.toHaveAttribute('aria-haspopup');
  });

  it('moves through the menu with the arrow keys and closes it with Escape', async () => {
    const user = userEvent.setup();
    render(<ListenButton {...defaultProps} />);

    await user.click(screen.getByRole('button'));
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'listenFromHere' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'listenThisEntry' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'listenFromHere' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveFocus();
  });

  it('closes the menu when focus moves out of it', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ListenButton {...defaultProps} />
        <button type="button">next</button>
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'listen' }));
    await user.tab();
    await user.tab();

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the menu from the keyboard and starts reading with Enter', async () => {
    const user = userEvent.setup();
    render(<ListenButton {...defaultProps} />);

    screen.getByRole('button').focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(defaultProps.onListenFrom).toHaveBeenCalledTimes(1);
  });

  it('lines the menu up with the start edge when asked', async () => {
    const user = userEvent.setup();
    render(<ListenButton {...defaultProps} menuAlign="start" />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('menu').className).toContain('left-0');
  });
});
