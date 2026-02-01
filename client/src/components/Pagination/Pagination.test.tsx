import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from './Pagination';

describe('Pagination', () => {
  const mockT = (key: string, params?: Record<string, string | number>) => {
    if (key === 'ofTotal' && params?.total) {
      return `of ${params.total}`;
    }
    return key;
  };
  const mockSetPage = vi.fn();
  const mockSetInputPage = vi.fn();

  const defaultProps = {
    page: 5,
    totalPages: 10,
    setPage: mockSetPage,
    inputPage: '5',
    setInputPage: mockSetInputPage,
    theme: 'dark' as const,
    t: mockT
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders pagination controls', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByTitle('first')).toBeInTheDocument();
    expect(screen.getByTitle('previous')).toBeInTheDocument();
    expect(screen.getByTitle('next')).toBeInTheDocument();
    expect(screen.getByTitle('last')).toBeInTheDocument();
  });

  it('displays current page in input', () => {
    render(<Pagination {...defaultProps} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(5);
  });

  it('displays total pages', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByText('of 10')).toBeInTheDocument();
  });

  it('disables first button on first page', () => {
    render(<Pagination {...defaultProps} page={1} />);
    expect(screen.getByTitle('first')).toBeDisabled();
  });

  it('disables previous button on first page', () => {
    render(<Pagination {...defaultProps} page={1} />);
    expect(screen.getByTitle('previous')).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<Pagination {...defaultProps} page={10} />);
    expect(screen.getByTitle('next')).toBeDisabled();
  });

  it('disables last button on last page', () => {
    render(<Pagination {...defaultProps} page={10} />);
    expect(screen.getByTitle('last')).toBeDisabled();
  });

  it('enables all buttons on middle page', () => {
    render(<Pagination {...defaultProps} page={5} />);
    expect(screen.getByTitle('first')).not.toBeDisabled();
    expect(screen.getByTitle('previous')).not.toBeDisabled();
    expect(screen.getByTitle('next')).not.toBeDisabled();
    expect(screen.getByTitle('last')).not.toBeDisabled();
  });

  it('goes to first page when first button is clicked', () => {
    render(<Pagination {...defaultProps} />);
    fireEvent.click(screen.getByTitle('first'));
    expect(mockSetPage).toHaveBeenCalledWith(1);
  });

  it('goes to previous page when previous button is clicked', () => {
    render(<Pagination {...defaultProps} />);
    fireEvent.click(screen.getByTitle('previous'));
    expect(mockSetPage).toHaveBeenCalled();
  });

  it('goes to next page when next button is clicked', () => {
    render(<Pagination {...defaultProps} />);
    fireEvent.click(screen.getByTitle('next'));
    expect(mockSetPage).toHaveBeenCalled();
  });

  it('goes to last page when last button is clicked', () => {
    render(<Pagination {...defaultProps} />);
    fireEvent.click(screen.getByTitle('last'));
    expect(mockSetPage).toHaveBeenCalledWith(10);
  });

  it('updates input value on change', () => {
    render(<Pagination {...defaultProps} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '7' } });
    expect(mockSetInputPage).toHaveBeenCalledWith('7');
  });

  it('navigates to page on blur with valid input', () => {
    render(<Pagination {...defaultProps} inputPage="7" />);
    const input = screen.getByRole('spinbutton');
    fireEvent.blur(input);
    expect(mockSetPage).toHaveBeenCalledWith(7);
    expect(mockSetInputPage).toHaveBeenCalledWith('7');
  });

  it('clamps to 1 when input is less than 1', () => {
    render(<Pagination {...defaultProps} inputPage="0" />);
    const input = screen.getByRole('spinbutton');
    fireEvent.blur(input);
    expect(mockSetPage).toHaveBeenCalledWith(1);
    expect(mockSetInputPage).toHaveBeenCalledWith('1');
  });

  it('clamps to totalPages when input exceeds it', () => {
    render(<Pagination {...defaultProps} inputPage="15" />);
    const input = screen.getByRole('spinbutton');
    fireEvent.blur(input);
    expect(mockSetPage).toHaveBeenCalledWith(10);
    expect(mockSetInputPage).toHaveBeenCalledWith('10');
  });

  it('handles NaN input by defaulting to 1', () => {
    render(<Pagination {...defaultProps} inputPage="abc" />);
    const input = screen.getByRole('spinbutton');
    fireEvent.blur(input);
    expect(mockSetPage).toHaveBeenCalledWith(1);
  });

  it('navigates on Enter key press', () => {
    render(<Pagination {...defaultProps} inputPage="8" />);
    const input = screen.getByRole('spinbutton');
    // Component calls blur() on Enter, which triggers blur handler
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(mockSetPage).toHaveBeenCalledWith(8);
  });

  it('applies light theme styling', () => {
    render(<Pagination {...defaultProps} theme="light" />);
    const firstButton = screen.getByTitle('first');
    expect(firstButton).toHaveClass('bg-white');
  });

  it('applies dark theme styling', () => {
    render(<Pagination {...defaultProps} theme="dark" />);
    const firstButton = screen.getByTitle('first');
    expect(firstButton).toHaveClass('bg-gray-800');
  });

  it('shows page label', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByText('page')).toBeInTheDocument();
  });
});
