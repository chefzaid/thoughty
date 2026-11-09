import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NavMenu from './NavMenu';
import type { ViewType } from '../../types';

describe('NavMenu', () => {
  const mockT = (key: string) => key;
  const mockOnViewChange = vi.fn();
  const mockOnLogout = vi.fn();

  const defaultProps = {
    currentView: 'journal' as ViewType,
    onViewChange: mockOnViewChange,
    theme: 'dark' as const,
    name: 'Test User',
    avatarUrl: undefined,
    t: mockT,
    onLogout: mockOnLogout
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the brand logo and name as a button back to the journal', () => {
    render(<NavMenu {...defaultProps} currentView="stats" />);
    const brand = screen.getByRole('button', { name: 'navBrandHome' });
    expect(brand).toHaveTextContent('Thoughty');
    expect(brand.querySelector('img.brand-logo')).toHaveAttribute('alt', '');

    fireEvent.click(brand);
    expect(mockOnViewChange).toHaveBeenCalledWith('journal');
  });

  it('closes an open group when the brand takes you to the journal', () => {
    render(<NavMenu {...defaultProps} currentView="stats" />);
    fireEvent.click(screen.getByRole('button', { name: 'navGroupInsights' }));
    fireEvent.click(screen.getByRole('button', { name: 'navBrandHome' }));
    expect(screen.getByRole('button', { name: 'navGroupInsights' })).toHaveAttribute('aria-expanded', 'false');
  });

  const openGroup = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));

  it.each([
    ['navGroupJournaling', ['journal', 'memoir', 'openTasksNav']],
    ['navGroupSocial', ['feed', 'people']],
    ['navGroupInsights', ['stats', 'navYearInReview']],
    ['navGroupData', ['manageDiaries', 'tags', 'importExport', 'recycleBin']],
  ])('discloses the %s pages from a closed group button', (group, items) => {
    render(<NavMenu {...defaultProps} />);
    const button = screen.getByRole('button', { name: group });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(panel).not.toBeVisible();

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    for (const item of items) {
      expect(screen.getByRole('button', { name: item })).toBeVisible();
    }
    // In this order
    expect([...(panel?.querySelectorAll('button') ?? [])].map((option) => option.textContent)).toEqual(items);
  });

  it.each([
    ['navGroupJournaling', 'journal', 'journal'],
    ['navGroupJournaling', 'memoir', 'memoir'],
    ['navGroupJournaling', 'openTasksNav', 'tasks'],
    ['navGroupSocial', 'feed', 'feed'],
    ['navGroupSocial', 'people', 'people'],
    ['navGroupInsights', 'stats', 'stats'],
    ['navGroupInsights', 'navYearInReview', 'review'],
    ['navGroupData', 'manageDiaries', 'diaries'],
    ['navGroupData', 'tags', 'tags'],
    ['navGroupData', 'importExport', 'importExport'],
    ['navGroupData', 'recycleBin', 'recycleBin'],
  ])('opens %s › %s and closes the group', (group, item, view) => {
    render(<NavMenu {...defaultProps} currentView="profile" />);
    openGroup(group);
    fireEvent.click(screen.getByRole('button', { name: item }));

    expect(mockOnViewChange).toHaveBeenCalledWith(view);
    expect(screen.getByRole('button', { name: group })).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes one group when another opens, and toggles a group shut from its button', () => {
    render(<NavMenu {...defaultProps} />);
    openGroup('navGroupJournaling');
    openGroup('navGroupSocial');
    expect(screen.getByRole('button', { name: 'navGroupJournaling' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'navGroupSocial' })).toHaveAttribute('aria-expanded', 'true');

    openGroup('navGroupSocial');
    expect(screen.getByRole('button', { name: 'navGroupSocial' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape and gives focus back to the group button', () => {
    render(<NavMenu {...defaultProps} />);
    openGroup('navGroupInsights');
    screen.getByRole('button', { name: 'stats' }).focus();

    fireEvent.keyDown(document, { key: 'Escape' });

    const button = screen.getByRole('button', { name: 'navGroupInsights' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes on a press outside the group, but not inside it', () => {
    render(<NavMenu {...defaultProps} />);
    openGroup('navGroupData');
    fireEvent.mouseDown(screen.getByRole('button', { name: 'importExport' }));
    expect(screen.getByRole('button', { name: 'navGroupData' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.mouseDown(document.body);
    expect(screen.getByRole('button', { name: 'navGroupData' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'navGroupData' })).not.toHaveFocus();
  });

  it('closes when focus moves out of the group, not when it moves within', () => {
    render(<NavMenu {...defaultProps} />);
    openGroup('navGroupSocial');
    const button = screen.getByRole('button', { name: 'navGroupSocial' });
    fireEvent.blur(button, { relatedTarget: screen.getByRole('button', { name: 'feed' }) });
    expect(button).toHaveAttribute('aria-expanded', 'true');

    fireEvent.blur(screen.getByRole('button', { name: 'people' }), { relatedTarget: screen.getByTitle('logout') });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks the group holding the current view as active and its page as current', () => {
    render(<NavMenu {...defaultProps} currentView="review" />);
    expect(screen.getByRole('button', { name: 'navGroupInsights' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'navGroupJournaling' })).not.toHaveClass('active');

    openGroup('navGroupInsights');
    expect(screen.getByRole('button', { name: 'navYearInReview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'stats' })).not.toHaveAttribute('aria-current');
  });

  it('marks no group active on the profile', () => {
    render(<NavMenu {...defaultProps} currentView="profile" />);
    for (const group of ['navGroupJournaling', 'navGroupSocial', 'navGroupInsights', 'navGroupData']) {
      expect(screen.getByRole('button', { name: group })).not.toHaveClass('active');
    }
  });

  it('shows the whole profile name on hover when it is cut short', () => {
    render(<NavMenu {...defaultProps} name="Alexandrine Montgomery-Dupont" />);
    expect(screen.getByText('Alexandrine Montgomery-Dupont')).toHaveAttribute('title', 'Alexandrine Montgomery-Dupont');
  });

  it('offers the privacy blur beside the profile when given one', () => {
    const toggle = vi.fn();
    const { rerender } = render(<NavMenu {...defaultProps} />);
    expect(screen.queryByRole('button', { name: 'privacyBlur' })).not.toBeInTheDocument();

    rerender(<NavMenu {...defaultProps} privacyBlur={{ blurred: true, changed: true, toggle }} />);
    const button = screen.getByRole('button', { name: 'privacyBlur' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('privacyBlurOnAnnouncement');
    fireEvent.click(button);
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('displays user initial when no avatar', () => {
    render(<NavMenu {...defaultProps} name="Test User" avatarUrl={undefined} />);
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('displays avatar when avatarUrl is provided', () => {
    render(<NavMenu {...defaultProps} avatarUrl="https://example.com/avatar.jpg" />);
    const avatar = screen.getByAltText('Test User');
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('displays a verification badge for verified email accounts', () => {
    render(<NavMenu {...defaultProps} isEmailVerified />);
    expect(screen.getByLabelText('verifiedAccount')).toBeInTheDocument();
  });

  it('uses fallback initial when name not provided', () => {
    render(<NavMenu {...defaultProps} name={undefined} />);
    expect(screen.getByText('U')).toBeInTheDocument(); // 'user'.charAt(0).toUpperCase()
  });

  it('applies light theme', () => {
    render(<NavMenu {...defaultProps} theme="light" />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('light');
  });

  it('applies dark theme', () => {
    render(<NavMenu {...defaultProps} theme="dark" />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('dark');
  });

  it('highlights profile button when profile view is active', () => {
    render(<NavMenu {...defaultProps} currentView="profile" />);
    const profileButton = screen.getByText('T').closest('button');
    expect(profileButton).toHaveClass('active');
    expect(profileButton).toHaveAttribute('title', 'profile');
  });

  it('calls onViewChange with profile when profile button is clicked', () => {
    render(<NavMenu {...defaultProps} />);
    const profileButton = screen.getByText('T').closest('button');
    expect(profileButton).not.toBeNull();
    if (profileButton) {
      fireEvent.click(profileButton);
    }
    expect(mockOnViewChange).toHaveBeenCalledWith('profile');
  });

  it('renders logout button', () => {
    render(<NavMenu {...defaultProps} />);
    expect(screen.getByTitle('logout')).toBeInTheDocument();
  });

  it('calls onLogout when logout button is clicked', () => {
    render(<NavMenu {...defaultProps} />);
    const logoutButton = screen.getByTitle('logout');
    fireEvent.click(logoutButton);
    expect(mockOnLogout).toHaveBeenCalled();
  });
});
