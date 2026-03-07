import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterControls from './FilterControls';

// Mock TagPicker component
vi.mock('../TagPicker/TagPicker', () => ({
  default: ({ onChange, placeholder }: { onChange: (tags: string[]) => void; placeholder: string }) => (
    <div data-testid="tag-picker">
      <input placeholder={placeholder} onChange={(e) => onChange([e.target.value])} />
    </div>
  )
}));

// Mock react-datepicker
vi.mock('react-datepicker', () => ({
  default: ({ onChange, placeholderText, selected }: { onChange: (date: Date | null) => void; placeholderText: string; selected: Date | null }) => (
    <input
      data-testid="date-picker"
      placeholder={placeholderText}
      value={selected?.toISOString() || ''}
      onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
    />
  )
}));

describe('FilterControls', () => {
  const mockT = (key: string) => key;
  const mockSetSearch = vi.fn();
  const mockSetFilterTags = vi.fn();
  const mockSetFilterDateObj = vi.fn();
  const mockSetFilterVisibility = vi.fn();
  const mockSetPage = vi.fn();
  const mockOnOpenHighlights = vi.fn();

  const defaultProps = {
    search: '',
    setSearch: mockSetSearch,
    filterTags: [],
    setFilterTags: mockSetFilterTags,
    filterDateObj: null,
    setFilterDateObj: mockSetFilterDateObj,
    filterVisibility: 'all' as const,
    setFilterVisibility: mockSetFilterVisibility,
    allTags: ['tag1', 'tag2', 'tag3'],
    entryDates: ['2026-01-15', '2026-01-20'],
    setPage: mockSetPage,
    theme: 'dark' as const,
    t: mockT,
    onOpenHighlights: mockOnOpenHighlights
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input', () => {
    render(<FilterControls {...defaultProps} />);
    expect(screen.getByPlaceholderText('searchPlaceholder')).toBeInTheDocument();
  });

  it('renders tag picker', () => {
    render(<FilterControls {...defaultProps} />);
    expect(screen.getByTestId('tag-picker')).toBeInTheDocument();
  });

  it('renders date picker', () => {
    render(<FilterControls {...defaultProps} />);
    expect(screen.getByTestId('date-picker')).toBeInTheDocument();
  });

  it('updates search and resets page on input change', () => {
    render(<FilterControls {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(searchInput, { target: { value: 'test search' } });
    expect(mockSetSearch).toHaveBeenCalledWith('test search');
    expect(mockSetPage).toHaveBeenCalledWith(1);
  });

  it('cycles visibility filter when button is clicked', () => {
    render(<FilterControls {...defaultProps} filterVisibility="all" />);
    const visibilityButton = screen.getByTitle('filterVisibility');
    fireEvent.click(visibilityButton);
    expect(mockSetFilterVisibility).toHaveBeenCalledWith('public');
    expect(mockSetPage).toHaveBeenCalledWith(1);
  });

  it('cycles from public to private', () => {
    render(<FilterControls {...defaultProps} filterVisibility="public" />);
    const visibilityButton = screen.getByTitle('filterVisibility');
    fireEvent.click(visibilityButton);
    expect(mockSetFilterVisibility).toHaveBeenCalledWith('private');
  });

  it('cycles from private to all', () => {
    render(<FilterControls {...defaultProps} filterVisibility="private" />);
    const visibilityButton = screen.getByTitle('filterVisibility');
    fireEvent.click(visibilityButton);
    expect(mockSetFilterVisibility).toHaveBeenCalledWith('all');
  });

  it('resets all filters when reset button is clicked', () => {
    render(<FilterControls {...defaultProps} search="test" filterTags={['tag1']} filterVisibility="public" />);
    const resetButton = screen.getByTitle('resetFilters');
    fireEvent.click(resetButton);
    expect(mockSetSearch).toHaveBeenCalledWith('');
    expect(mockSetFilterTags).toHaveBeenCalledWith([]);
    expect(mockSetFilterDateObj).toHaveBeenCalledWith(null);
    expect(mockSetFilterVisibility).toHaveBeenCalledWith('all');
    expect(mockSetPage).toHaveBeenCalledWith(1);
  });

  it('opens highlights modal when highlights button is clicked', () => {
    render(<FilterControls {...defaultProps} />);
    const highlightsButton = screen.getByTitle('seeHighlights');
    fireEvent.click(highlightsButton);
    expect(mockOnOpenHighlights).toHaveBeenCalled();
  });

  it('renders with light theme', () => {
    render(<FilterControls {...defaultProps} theme="light" />);
    const searchInput = screen.getByPlaceholderText('searchPlaceholder');
    expect(searchInput).toHaveClass('bg-gray-50');
  });

  it('renders with dark theme', () => {
    render(<FilterControls {...defaultProps} theme="dark" />);
    const searchInput = screen.getByPlaceholderText('searchPlaceholder');
    expect(searchInput).toHaveClass('bg-gray-900');
  });

  it('shows correct visibility icon and text for all', () => {
    render(<FilterControls {...defaultProps} filterVisibility="all" />);
    expect(screen.getByText('allEntries')).toBeInTheDocument();
  });

  it('shows correct visibility icon and text for public', () => {
    render(<FilterControls {...defaultProps} filterVisibility="public" />);
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  it('shows correct visibility icon and text for private', () => {
    render(<FilterControls {...defaultProps} filterVisibility="private" />);
    expect(screen.getByText('private')).toBeInTheDocument();
  });

  it('applies correct styling for public visibility button', () => {
    render(<FilterControls {...defaultProps} filterVisibility="public" />);
    const visibilityButton = screen.getByTitle('filterVisibility');
    expect(visibilityButton).toHaveClass('text-green-500');
  });

  it('applies correct styling for private visibility button', () => {
    render(<FilterControls {...defaultProps} filterVisibility="private" />);
    const visibilityButton = screen.getByTitle('filterVisibility');
    expect(visibilityButton).toHaveClass('text-gray-500');
  });
});
