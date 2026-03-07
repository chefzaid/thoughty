import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NavMenu from './NavMenu';

describe('NavMenu', () => {
  const mockT = (key: string) => key;
  const mockOnViewChange = vi.fn();
  const mockOnLogout = vi.fn();

  const defaultProps = {
    currentView: 'journal',
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

  it('renders brand logo and name', () => {
    render(<NavMenu {...defaultProps} />);
    expect(screen.getByAltText('Thoughty')).toBeInTheDocument();
    expect(screen.getByText('Thoughty')).toBeInTheDocument();
  });

  it('renders journal navigation item', () => {
    render(<NavMenu {...defaultProps} />);
    expect(screen.getByText('journal')).toBeInTheDocument();
  });

  it('renders stats navigation item', () => {
    render(<NavMenu {...defaultProps} />);
    expect(screen.getByText('stats')).toBeInTheDocument();
  });

  it('renders import/export navigation item', () => {
    render(<NavMenu {...defaultProps} />);
    expect(screen.getByText('importExport')).toBeInTheDocument();
  });

  it('highlights active navigation item', () => {
    render(<NavMenu {...defaultProps} currentView="journal" />);
    const journalButton = screen.getByText('journal').closest('button');
    expect(journalButton).toHaveClass('active');
  });

  it('does not highlight inactive navigation items', () => {
    render(<NavMenu {...defaultProps} currentView="journal" />);
    const statsButton = screen.getByText('stats').closest('button');
    expect(statsButton).not.toHaveClass('active');
  });

  it('calls onViewChange when journal is clicked', () => {
    render(<NavMenu {...defaultProps} currentView="stats" />);
    const journalButton = screen.getByText('journal');
    fireEvent.click(journalButton);
    expect(mockOnViewChange).toHaveBeenCalledWith('journal');
  });

  it('calls onViewChange when stats is clicked', () => {
    render(<NavMenu {...defaultProps} />);
    const statsButton = screen.getByText('stats');
    fireEvent.click(statsButton);
    expect(mockOnViewChange).toHaveBeenCalledWith('stats');
  });

  it('calls onViewChange when importExport is clicked', () => {
    render(<NavMenu {...defaultProps} />);
    const importExportButton = screen.getByText('importExport');
    fireEvent.click(importExportButton);
    expect(mockOnViewChange).toHaveBeenCalledWith('importExport');
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
  });

  it('calls onViewChange with profile when profile button is clicked', () => {
    render(<NavMenu {...defaultProps} />);
    const profileButton = screen.getByText('T').closest('button');
    fireEvent.click(profileButton!);
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
