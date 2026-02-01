import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders spinner container', () => {
    const { container } = render(<LoadingSpinner />);
    const spinnerContainer = container.querySelector('.min-h-screen');
    expect(spinnerContainer).toBeInTheDocument();
  });

  it('renders with default classes', () => {
    const { container } = render(<LoadingSpinner />);
    const spinnerContainer = container.firstChild;
    expect(spinnerContainer).toHaveClass('min-h-screen');
    expect(spinnerContainer).toHaveClass('flex');
    expect(spinnerContainer).toHaveClass('items-center');
    expect(spinnerContainer).toHaveClass('justify-center');
    expect(spinnerContainer).toHaveClass('bg-gray-900');
  });

  it('renders spinner element with animation', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('rounded-full');
    expect(spinner).toHaveClass('h-12');
    expect(spinner).toHaveClass('w-12');
    expect(spinner).toHaveClass('border-b-2');
    expect(spinner).toHaveClass('border-indigo-500');
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingSpinner className="custom-class" />);
    const spinnerContainer = container.firstChild;
    expect(spinnerContainer).toHaveClass('custom-class');
  });

  it('combines default and custom classes', () => {
    const { container } = render(<LoadingSpinner className="extra-padding" />);
    const spinnerContainer = container.firstChild;
    expect(spinnerContainer).toHaveClass('min-h-screen');
    expect(spinnerContainer).toHaveClass('extra-padding');
  });

  it('handles empty className', () => {
    const { container } = render(<LoadingSpinner className="" />);
    const spinnerContainer = container.firstChild;
    expect(spinnerContainer).toHaveClass('min-h-screen');
  });
});
