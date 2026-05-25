import { useCallback, useEffect, useState, type ComponentProps, type FocusEvent } from 'react';
import DatePicker from 'react-datepicker';
import { formatTypedDateValue, parseTypedDateValue } from './typedDateValue';

type DatePickerPlacement = ComponentProps<typeof DatePicker>['popperPlacement'];
type DatePickerRawChangeEvent = Parameters<NonNullable<ComponentProps<typeof DatePicker>['onChangeRaw']>>[0];

interface TypedDatePickerProps {
    readonly selected: Date | null;
    readonly onChange: (date: Date | null) => void;
    readonly className?: string;
    readonly dateFormat?: string;
    readonly placeholderText?: string;
    readonly popperPlacement?: DatePickerPlacement;
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

    const handleRawChange = useCallback((event?: DatePickerRawChangeEvent) => {
        const nextValue = event?.currentTarget instanceof HTMLInputElement
            ? event.currentTarget.value
            : '';
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