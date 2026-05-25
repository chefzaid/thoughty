import { useCallback, useEffect, useState, type FocusEvent } from 'react';
import DatePicker from 'react-datepicker';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatTypedDateValue(date: Date | null | undefined): string {
    if (!date) {
        return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

export function parseTypedDateValue(value: string): Date | null | undefined {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return null;
    }

    const match = ISO_DATE_PATTERN.exec(trimmedValue);
    if (!match) {
        return undefined;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsedDate = new Date(year, month - 1, day);
    parsedDate.setHours(0, 0, 0, 0);

    if (
        parsedDate.getFullYear() !== year
        || parsedDate.getMonth() !== month - 1
        || parsedDate.getDate() !== day
    ) {
        return undefined;
    }

    return parsedDate;
}

interface TypedDatePickerProps {
    readonly selected: Date | null;
    readonly onChange: (date: Date | null) => void;
    readonly className?: string;
    readonly dateFormat?: string;
    readonly placeholderText?: string;
    readonly popperPlacement?: string;
    readonly portalId?: string;
    readonly isClearable?: boolean;
}

function TypedDatePicker({
    selected,
    onChange,
    className,
    dateFormat = 'yyyy-MM-dd',
    placeholderText,
    popperPlacement,
    portalId,
    isClearable,
}: TypedDatePickerProps) {
    const [draftValue, setDraftValue] = useState<string>(() => formatTypedDateValue(selected));

    useEffect(() => {
        setDraftValue(formatTypedDateValue(selected));
    }, [selected]);

    const handlePickerChange = useCallback((date: Date | null) => {
        setDraftValue(formatTypedDateValue(date));
        onChange(date);
    }, [onChange]);

    const handleRawChange = useCallback((event?: { target: { value: string } }) => {
        const nextValue = event?.target.value ?? '';
        setDraftValue(nextValue);

        const parsedDate = parseTypedDateValue(nextValue);
        if (parsedDate !== undefined) {
            onChange(parsedDate);
        }
    }, [onChange]);

    const handleBlur = useCallback((event: FocusEvent<HTMLInputElement>) => {
        const parsedDate = parseTypedDateValue(event.target.value);

        if (parsedDate === undefined) {
            setDraftValue(formatTypedDateValue(selected));
            return;
        }

        setDraftValue(formatTypedDateValue(parsedDate));
        onChange(parsedDate);
    }, [onChange, selected]);

    return (
        <DatePicker
            selected={selected}
            onChange={handlePickerChange}
            onChangeRaw={handleRawChange}
            onBlur={handleBlur}
            value={draftValue}
            className={className}
            dateFormat={dateFormat}
            placeholderText={placeholderText}
            popperPlacement={popperPlacement}
            portalId={portalId}
            isClearable={isClearable}
        />
    );
}

export default TypedDatePicker;