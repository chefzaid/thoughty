import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TypedDatePicker from './TypedDatePicker';

vi.mock('react-datepicker', () => ({
    default: ({
        className,
        onBlur,
        onChange,
        onChangeRaw,
        placeholderText,
        value,
    }: {
        className?: string;
        onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
        onChange?: (date: Date | null) => void;
        onChangeRaw?: (event?: { currentTarget: HTMLInputElement }) => void;
        placeholderText?: string;
        value?: string;
    }) => (
        <div>
            <input
                className={className}
                data-testid="typed-date-input"
                placeholder={placeholderText}
                value={value}
                onBlur={(event) => onBlur?.(event as React.FocusEvent<HTMLInputElement>)}
                onChange={(event) => onChangeRaw?.({ currentTarget: event.currentTarget })}
            />
            <button type="button" onClick={() => onChange?.(new Date('2024-02-20T00:00:00.000Z'))}>pick-date</button>
            <button type="button" onClick={() => onChange?.(null)}>clear-date</button>
        </div>
    ),
}));

describe('TypedDatePicker', () => {
    it('formats the selected date and handles picker changes', () => {
        const onChange = vi.fn();

        render(
            <TypedDatePicker
                selected={new Date('2024-01-15T00:00:00.000Z')}
                onChange={onChange}
                className="date-input"
                placeholderText="YYYY-MM-DD"
            />,
        );

        expect(screen.getByTestId('typed-date-input')).toHaveValue('2024-01-15');
        expect(screen.getByTestId('typed-date-input')).toHaveClass('date-input');
        expect(screen.getByPlaceholderText('YYYY-MM-DD')).toBeInTheDocument();

        fireEvent.click(screen.getByText('pick-date'));
        fireEvent.click(screen.getByText('clear-date'));

        expect(onChange).toHaveBeenNthCalledWith(1, new Date('2024-02-20T00:00:00.000Z'));
        expect(onChange).toHaveBeenNthCalledWith(2, null);
    });

    it('parses valid typed input and normalizes it on blur', () => {
        const onChange = vi.fn();

        render(
            <TypedDatePicker
                selected={new Date('2024-01-15T00:00:00.000Z')}
                onChange={onChange}
            />,
        );

        fireEvent.change(screen.getByTestId('typed-date-input'), { target: { value: '2024-03-05' } });
        fireEvent.blur(screen.getByTestId('typed-date-input'), { target: { value: '2024-03-05' } });

        expect(onChange).toHaveBeenNthCalledWith(1, new Date(2024, 2, 5));
        expect(onChange).toHaveBeenNthCalledWith(2, new Date(2024, 2, 5));
        expect(screen.getByTestId('typed-date-input')).toHaveValue('2024-03-05');
    });

    it('keeps invalid typed input local and restores the last valid date on blur', async () => {
        const onChange = vi.fn();
        const { rerender } = render(
            <TypedDatePicker
                selected={new Date('2024-01-15T00:00:00.000Z')}
                onChange={onChange}
            />,
        );

        fireEvent.change(screen.getByTestId('typed-date-input'), { target: { value: '2024-02-31' } });
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.blur(screen.getByTestId('typed-date-input'), { target: { value: '2024-02-31' } });

        rerender(<TypedDatePicker selected={null} onChange={onChange} />);
        expect(screen.getByTestId('typed-date-input')).toHaveValue('');
    });
});