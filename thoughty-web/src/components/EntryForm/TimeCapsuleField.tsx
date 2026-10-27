import { useId } from 'react';
import {
    browserTimeZone,
    defaultTimeCapsule,
    timeCapsuleDateBounds,
    type TimeCapsuleDraft,
} from '../../utils/timeCapsule';

interface TimeCapsuleFieldProps {
    /** Prefix for the field's ids; it must not start with `entry-`, which entry cards use. */
    readonly id: string;
    /** The capsule being set up, or null when the entry is not sealed. */
    readonly value: TimeCapsuleDraft | null;
    readonly onChange: (value: TimeCapsuleDraft | null) => void;
    readonly inputClass: string;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * "Seal as a time capsule": a checkbox that reveals the local day (tomorrow up to fifty years ahead)
 * and hour the entry opens at, in the writer's own time zone, with what sealing means.
 */
export default function TimeCapsuleField({ id, value, onChange, inputClass, theme, t }: TimeCapsuleFieldProps) {
    const hintId = useId();
    const isLight = theme === 'light';
    const { min, max } = timeCapsuleDateBounds(new Date());

    return (
        <div className="space-y-2">
            <label htmlFor={`${id}-toggle`} className={`inline-flex cursor-pointer items-center gap-2 text-sm font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                <input
                    id={`${id}-toggle`}
                    type="checkbox"
                    checked={value !== null}
                    onChange={(event) => onChange(event.target.checked ? defaultTimeCapsule(new Date()) : null)}
                    className="h-4 w-4 rounded accent-blue-500"
                />
                <span className="codicon codicon-lock" aria-hidden="true" />
                {t('timeCapsuleSeal')}
            </label>
            {value && (
                <fieldset className="flex flex-wrap items-end gap-3" aria-describedby={hintId}>
                    <legend className="sr-only">{t('timeCapsuleSeal')}</legend>
                    <div className="flex flex-col gap-1">
                        <label htmlFor={`${id}-date`} className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{t('timeCapsuleOpensOn')}</label>
                        <input
                            id={`${id}-date`}
                            type="date"
                            required
                            min={min}
                            max={max}
                            value={value.opensOn}
                            onChange={(event) => onChange({ ...value, opensOn: event.target.value })}
                            className={`${inputClass} w-44`}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label htmlFor={`${id}-hour`} className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{t('timeCapsuleOpenHour')}</label>
                        <select
                            id={`${id}-hour`}
                            value={value.openHour}
                            onChange={(event) => onChange({ ...value, openHour: Number(event.target.value) })}
                            className={`${inputClass} w-28`}
                        >
                            {HOURS.map((hour) => (
                                <option key={hour} value={hour}>{`${String(hour).padStart(2, '0')}:00`}</option>
                            ))}
                        </select>
                    </div>
                    <p id={hintId} className={`basis-full text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                        {t('timeCapsuleSealHint', { zone: browserTimeZone() })}
                    </p>
                </fieldset>
            )}
        </div>
    );
}
