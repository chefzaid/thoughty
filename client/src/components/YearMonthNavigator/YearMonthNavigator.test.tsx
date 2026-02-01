import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import YearMonthNavigator from './YearMonthNavigator';
import type { Config } from '../../types';

describe('YearMonthNavigator', () => {
  const mockT = (key: string) => key;
  const mockSetNavYear = vi.fn();
  const mockSetNavMonth = vi.fn();
  const mockOnNavigate = vi.fn();

  const mockConfig: Config = {
    theme: 'dark',
    language: 'en',
    entriesPerPage: 10
  };

  const defaultProps = {
    availableYears: [2024, 2025, 2026],
    availableMonths: ['2025-01', '2025-06', '2025-12', '2026-01', '2026-02'],
    navYear: '',
    setNavYear: mockSetNavYear,
    navMonth: '',
    setNavMonth: mockSetNavMonth,
    onNavigate: mockOnNavigate,
    config: mockConfig,
    t: mockT
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no years available', () => {
    const { container } = render(<YearMonthNavigator {...defaultProps} availableYears={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders year select with available years', () => {
    render(<YearMonthNavigator {...defaultProps} />);
    const yearSelect = screen.getByRole('combobox');
    expect(yearSelect).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();
  });

  it('renders label text', () => {
    render(<YearMonthNavigator {...defaultProps} />);
    expect(screen.getByText('goToFirst:')).toBeInTheDocument();
  });

  it('calls setNavYear and clears month when year is selected', () => {
    render(<YearMonthNavigator {...defaultProps} />);
    const yearSelect = screen.getByRole('combobox');
    fireEvent.change(yearSelect, { target: { value: '2025' } });
    expect(mockSetNavYear).toHaveBeenCalledWith('2025');
    expect(mockSetNavMonth).toHaveBeenCalledWith('');
  });

  it('shows month select when year is selected and has matching months', () => {
    render(<YearMonthNavigator {...defaultProps} navYear="2025" />);
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2); // Year and Month selects
  });

  it('does not show month select when year has no matching months', () => {
    render(<YearMonthNavigator {...defaultProps} navYear="2024" />);
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(1); // Only Year select
  });

  it('displays correct month names in month select', () => {
    render(<YearMonthNavigator {...defaultProps} navYear="2025" />);
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Jun')).toBeInTheDocument();
    expect(screen.getByText('Dec')).toBeInTheDocument();
  });

  it('calls setNavMonth when month is selected', () => {
    render(<YearMonthNavigator {...defaultProps} navYear="2025" />);
    const selects = screen.getAllByRole('combobox');
    const monthSelect = selects[1];
    fireEvent.change(monthSelect, { target: { value: '2025-06' } });
    expect(mockSetNavMonth).toHaveBeenCalledWith('2025-06');
  });

  it('renders Go button', () => {
    render(<YearMonthNavigator {...defaultProps} />);
    expect(screen.getByText('go')).toBeInTheDocument();
  });

  it('disables Go button when no year is selected', () => {
    render(<YearMonthNavigator {...defaultProps} navYear="" />);
    const goButton = screen.getByText('go');
    expect(goButton).toBeDisabled();
  });

  it('enables Go button when year is selected', () => {
    render(<YearMonthNavigator {...defaultProps} navYear="2025" />);
    const goButton = screen.getByText('go');
    expect(goButton).not.toBeDisabled();
  });

  it('calls onNavigate with year only when no month selected', () => {
    render(<YearMonthNavigator {...defaultProps} navYear="2025" navMonth="" />);
    const goButton = screen.getByText('go');
    fireEvent.click(goButton);
    expect(mockOnNavigate).toHaveBeenCalledWith(2025, null);
  });

  it('calls onNavigate with year and month when both selected', () => {
    render(<YearMonthNavigator {...defaultProps} navYear="2025" navMonth="2025-06" />);
    const goButton = screen.getByText('go');
    fireEvent.click(goButton);
    expect(mockOnNavigate).toHaveBeenCalledWith(2025, 6);
  });

  it('applies light theme styling', () => {
    render(<YearMonthNavigator {...defaultProps} config={{ ...mockConfig, theme: 'light' }} />);
    const label = screen.getByText('goToFirst:');
    expect(label).toHaveClass('text-gray-600');
  });

  it('applies dark theme styling', () => {
    render(<YearMonthNavigator {...defaultProps} config={{ ...mockConfig, theme: 'dark' }} />);
    const label = screen.getByText('goToFirst:');
    expect(label).toHaveClass('text-gray-400');
  });
});
