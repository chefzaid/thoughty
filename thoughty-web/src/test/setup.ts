import '@testing-library/jest-dom/vitest';
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
  onChangeRaw?: (event?: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  placeholderText?: string;
  value?: string;
}

// Mock react-datepicker to avoid issues with CSS imports in tests
vi.mock('react-datepicker', () => ({
  default: function MockDatePicker({
    selected,
    onChange,
    onChangeRaw,
    onBlur,
    className,
    placeholder,
    placeholderText,
    value,
  }: DatePickerProps) {
    return createElement('input', {
      type: 'text',
      'data-testid': 'date-picker',
      className: className,
      placeholder: placeholder || placeholderText,
      value: value ?? (selected ? selected.toISOString().split('T')[0] : ''),
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        if (onChangeRaw) {
          onChangeRaw(e);
          return;
        }

        if (e.target.value) {
          onChange(new Date(e.target.value));
        } else {
          onChange(null);
        }
      },
      onBlur: (e: ChangeEvent<HTMLInputElement>) => onBlur?.(e),
    });
  },
}));

// Mock CSS imports
vi.mock('react-datepicker/dist/react-datepicker.css', () => ({}));

// Mock @uiw/react-md-editor which depends on browser APIs unavailable in jsdom
interface MDEditorMockProps {
  value?: string;
  onChange?: (val?: string) => void;
  preview?: string;
  height?: number;
  visibleDragbar?: boolean;
  textareaProps?: {
    placeholder?: string;
    title?: string;
    style?: Record<string, string>;
  };
}

function createMDEditorMock() {
  return {
    default: function MockMDEditor({ value, onChange, textareaProps }: MDEditorMockProps) {
      return createElement('div', { 'data-color-mode': 'dark', 'data-testid': 'md-editor' },
        createElement('textarea', {
          value: value || '',
          onChange: (e: ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value),
          placeholder: textareaProps?.placeholder,
          title: textareaProps?.title,
          style: textareaProps?.style,
        })
      );
    },
  };
}

vi.mock('@uiw/react-md-editor', createMDEditorMock);
vi.mock('@uiw/react-md-editor/nohighlight', createMDEditorMock);
