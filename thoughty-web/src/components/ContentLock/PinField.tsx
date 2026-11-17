import { forwardRef } from 'react';

interface PinFieldProps {
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly isDark: boolean;
    readonly describedBy?: string;
    readonly invalid?: boolean;
}

/** Four digits, typed hidden like a password: the PIN of locked diaries and entries. */
const PinField = forwardRef<HTMLInputElement, PinFieldProps>(function PinField(
    { id, label, value, onChange, isDark, describedBy, invalid = false },
    ref,
) {
    const fieldClass = isDark ? 'border-gray-600 bg-gray-900 text-gray-100' : 'border-gray-300 bg-white text-gray-900';
    return (
        <div className="space-y-1">
            <label htmlFor={id} className="block font-medium">{label}</label>
            <input
                ref={ref}
                id={id}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]{4}"
                maxLength={4}
                required
                value={value}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
                className={`w-32 rounded-lg border px-3 py-2 text-center font-mono text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-sky-500 ${fieldClass}`}
            />
        </div>
    );
});

export default PinField;
