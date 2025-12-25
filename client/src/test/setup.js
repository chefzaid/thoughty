import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock react-datepicker to avoid issues with CSS imports in tests
vi.mock('react-datepicker', () => ({
    default: function MockDatePicker({ selected, onChange, className, placeholder, placeholderText }) {
        return React.createElement('input', {
            type: 'text',
            'data-testid': 'date-picker',
            className: className,
            placeholder: placeholder || placeholderText,
            value: selected ? selected.toISOString().split('T')[0] : '',
            onChange: (e) => {
                if (e.target.value) {
                    onChange(new Date(e.target.value));
                } else {
                    onChange(null);
                }
            }
        });
    }
}));

// Mock CSS imports
vi.mock('react-datepicker/dist/react-datepicker.css', () => ({}));
