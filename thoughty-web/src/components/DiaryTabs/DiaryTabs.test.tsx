import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DiaryTabs from './DiaryTabs';

describe('DiaryTabs', () => {
  const mockT = (key: string) => key;
  const mockOnDiaryChange = vi.fn();
  const mockOnManageDiaries = vi.fn();

  const mockDiaries = [
    { id: 1, name: 'Personal', icon: '📔', is_default: true },
    { id: 2, name: 'Work', icon: '💼', is_default: false },
    { id: 3, name: 'Travel', is_default: false }
  ];

  const defaultProps = {
    diaries: mockDiaries,
    currentDiaryId: null,
    onDiaryChange: mockOnDiaryChange,
    onManageDiaries: mockOnManageDiaries,
    theme: 'dark' as const,
    t: mockT
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders All Diaries button', () => {
    render(<DiaryTabs {...defaultProps} />);
    expect(screen.getByTitle('allDiaries')).toBeInTheDocument();
    expect(screen.getByText('allDiaries')).toBeInTheDocument();
  });

  it('renders all diary tabs', () => {
    render(<DiaryTabs {...defaultProps} />);
    expect(screen.getByTitle('Personal')).toBeInTheDocument();
    expect(screen.getByTitle('Work')).toBeInTheDocument();
    expect(screen.getByTitle('Travel')).toBeInTheDocument();
  });

  it('renders diary icons correctly', () => {
    render(<DiaryTabs {...defaultProps} />);
    expect(screen.getByText('📔')).toBeInTheDocument();
    expect(screen.getByText('💼')).toBeInTheDocument();
    // Default icon for diary without icon
    expect(screen.getByText('📓')).toBeInTheDocument();
  });

  it('renders default badge for default diary', () => {
    render(<DiaryTabs {...defaultProps} />);
    expect(screen.getByText('★')).toBeInTheDocument();
  });

  it('highlights All Diaries tab when currentDiaryId is null', () => {
    render(<DiaryTabs {...defaultProps} currentDiaryId={null} />);
    const allDiariesButton = screen.getByTitle('allDiaries');
    expect(allDiariesButton).toHaveClass('active');
  });

  it('highlights specific diary tab when selected', () => {
    render(<DiaryTabs {...defaultProps} currentDiaryId={2} />);
    const workButton = screen.getByTitle('Work');
    expect(workButton).toHaveClass('active');
  });

  it('calls onDiaryChange with null when All Diaries is clicked', () => {
    render(<DiaryTabs {...defaultProps} currentDiaryId={1} />);
    const allDiariesButton = screen.getByTitle('allDiaries');
    fireEvent.click(allDiariesButton);
    expect(mockOnDiaryChange).toHaveBeenCalledWith(null);
  });

  it('calls onDiaryChange with diary id when diary tab is clicked', () => {
    render(<DiaryTabs {...defaultProps} />);
    const workButton = screen.getByTitle('Work');
    fireEvent.click(workButton);
    expect(mockOnDiaryChange).toHaveBeenCalledWith(2);
  });

  it('calls onManageDiaries when manage button is clicked', () => {
    render(<DiaryTabs {...defaultProps} />);
    const manageButton = screen.getByTitle('manageDiaries');
    fireEvent.click(manageButton);
    expect(mockOnManageDiaries).toHaveBeenCalled();
  });

  it('renders with light theme', () => {
    render(<DiaryTabs {...defaultProps} theme="light" />);
    const tabsContainer = screen.getByTitle('allDiaries').closest('.diary-tabs');
    expect(tabsContainer).toHaveClass('light');
  });

  it('renders with dark theme', () => {
    render(<DiaryTabs {...defaultProps} theme="dark" />);
    const tabsContainer = screen.getByTitle('allDiaries').closest('.diary-tabs');
    expect(tabsContainer).toHaveClass('dark');
  });

  it('renders manage diaries button with plus icon', () => {
    render(<DiaryTabs {...defaultProps} />);
    const manageButton = screen.getByTitle('manageDiaries');
    expect(manageButton).toHaveClass('manage-btn');
    expect(manageButton.querySelector('svg')).toBeInTheDocument();
  });

  it('renders diary names', () => {
    render(<DiaryTabs {...defaultProps} />);
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Travel')).toBeInTheDocument();
  });

  it('marks default diary with default class', () => {
    render(<DiaryTabs {...defaultProps} />);
    const personalButton = screen.getByTitle('Personal');
    expect(personalButton).toHaveClass('default');
  });

  describe('Favorites tab', () => {
    const mockOnFilterFavorites = vi.fn();

    it('does not render Favorites tab when onFilterFavorites is not provided', () => {
      render(<DiaryTabs {...defaultProps} />);
      expect(screen.queryByTitle('favorites')).not.toBeInTheDocument();
    });

    it('renders Favorites tab when onFilterFavorites is provided', () => {
      render(<DiaryTabs {...defaultProps} onFilterFavorites={mockOnFilterFavorites} />);
      expect(screen.getByTitle('favorites')).toBeInTheDocument();
      expect(screen.getByText('⭐')).toBeInTheDocument();
    });

    it('highlights Favorites tab when filterFavorites is true', () => {
      render(<DiaryTabs {...defaultProps} filterFavorites={true} onFilterFavorites={mockOnFilterFavorites} />);
      const favoritesButton = screen.getByTitle('favorites');
      expect(favoritesButton).toHaveClass('active');
    });

    it('does not highlight All Diaries when Favorites is active', () => {
      render(<DiaryTabs {...defaultProps} currentDiaryId={null} filterFavorites={true} onFilterFavorites={mockOnFilterFavorites} />);
      const allDiariesButton = screen.getByTitle('allDiaries');
      expect(allDiariesButton).not.toHaveClass('active');
    });

    it('calls onFilterFavorites with true and onDiaryChange with null when Favorites tab is clicked', () => {
      render(<DiaryTabs {...defaultProps} currentDiaryId={1} onFilterFavorites={mockOnFilterFavorites} />);
      fireEvent.click(screen.getByTitle('favorites'));
      expect(mockOnFilterFavorites).toHaveBeenCalledWith(true);
      expect(mockOnDiaryChange).toHaveBeenCalledWith(null);
    });

    it('clears filterFavorites when All Diaries is clicked', () => {
      render(<DiaryTabs {...defaultProps} filterFavorites={true} onFilterFavorites={mockOnFilterFavorites} />);
      fireEvent.click(screen.getByTitle('allDiaries'));
      expect(mockOnFilterFavorites).toHaveBeenCalledWith(false);
      expect(mockOnDiaryChange).toHaveBeenCalledWith(null);
    });

    it('clears filterFavorites when a diary tab is clicked', () => {
      render(<DiaryTabs {...defaultProps} filterFavorites={true} onFilterFavorites={mockOnFilterFavorites} />);
      fireEvent.click(screen.getByTitle('Work'));
      expect(mockOnFilterFavorites).toHaveBeenCalledWith(false);
      expect(mockOnDiaryChange).toHaveBeenCalledWith(2);
    });
  });
});
