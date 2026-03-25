import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { createElement, type ChangeEvent } from 'react';

// Mock the Web Speech API globally for all tests
if (!globalThis.speechSynthesis) {
  Object.defineProperty(globalThis, 'speechSynthesis', {
    value: {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn(() => []),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
}

interface DatePickerProps {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  className?: string;
  placeholder?: string;
  placeholderText?: string;
}

// Mock react-datepicker to avoid issues with CSS imports in tests
vi.mock('react-datepicker', () => ({
  default: function MockDatePicker({
    selected,
    onChange,
    className,
    placeholder,
    placeholderText,
  }: DatePickerProps) {
    return createElement('input', {
      type: 'text',
      'data-testid': 'date-picker',
      className: className,
      placeholder: placeholder || placeholderText,
      value: selected ? selected.toISOString().split('T')[0] : '',
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
          onChange(new Date(e.target.value));
        } else {
          onChange(null);
        }
      },
    });
  },
}));

// Mock CSS imports
vi.mock('react-datepicker/dist/react-datepicker.css', () => ({}));
