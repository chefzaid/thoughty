import { useEffect, useId, useState } from 'react';
import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { formatCountdown, parseSprintMinutes, SPRINT_MINUTES, sprintEndsAt, type Sprint } from './focusSprint';

const RING_RADIUS = 7;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

interface SprintPickerProps {
    readonly minutes: number | null;
    readonly onChoose: (minutes: number | null) => void;
    readonly language: Language;
    readonly t: TranslationFunction;
}

/** Off, 5, 10 or 15 minutes; choosing a length starts the sprint. */
export function SprintPicker({ minutes, onChoose, language, t }: SprintPickerProps) {
    const id = useId();
    return (
        <div className="focus-mode-goal">
            <label htmlFor={id}>{t('focusModeSprintLabel')}</label>
            <select id={id} value={minutes ?? ''} onChange={(event) => onChoose(parseSprintMinutes(event.target.value))}>
                <option value="">{t('focusModeSprintOff')}</option>
                {SPRINT_MINUTES.map((length) => (
                    <option key={length} value={length}>{pluralPhrase(t, 'focusModeSprintMinutes', length, language)}</option>
                ))}
            </select>
        </div>
    );
}

interface SprintCountdownProps {
    readonly sprint: Sprint;
    readonly t: TranslationFunction;
}

/**
 * The time left as mm:ss beside the word count, with a thin ring that empties (hidden when the
 * writer asks for reduced motion). It is a timer that screen readers do not read out on every
 * second; the halfway point and the end are announced once each by focus mode.
 */
export function SprintCountdown({ sprint, t }: SprintCountdownProps) {
    const endsAt = sprintEndsAt(sprint);
    const [now, setNow] = useState(Date.now);

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const tick = () => {
            clearTimeout(timeout);
            const current = Date.now();
            setNow(current);
            const left = endsAt - current;
            // Wake on the next whole second, so the display changes with the clock
            if (left > 0) timeout = setTimeout(tick, left % 1000 || 1000);
        };
        tick();
        document.addEventListener('visibilitychange', tick);
        return () => {
            clearTimeout(timeout);
            document.removeEventListener('visibilitychange', tick);
        };
    }, [endsAt]);

    const left = Math.max(0, endsAt - now);
    const share = left / (sprint.minutes * 60_000);
    return (
        <span className="focus-mode-sprint-countdown">
            <svg className="focus-mode-sprint-ring" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
                <circle className="focus-mode-sprint-ring-track" cx="9" cy="9" r={RING_RADIUS} />
                <circle
                    className="focus-mode-sprint-ring-fill"
                    cx="9"
                    cy="9"
                    r={RING_RADIUS}
                    strokeDasharray={RING_LENGTH}
                    strokeDashoffset={RING_LENGTH * (1 - share)}
                />
            </svg>
            <span role="timer" aria-live="off" aria-atomic="true">
                <span className="sr-only">{t('focusModeSprintTimeLeft')} </span>
                {formatCountdown(left)}
            </span>
        </span>
    );
}

interface SprintEndNoticeProps {
    readonly words: number;
    readonly onKeepGoing: () => void;
    readonly onStop: () => void;
    readonly language: Language;
    readonly t: TranslationFunction;
}

/** The calm end of a sprint: no sound, no notification, just a note in focus mode and two ways on. */
export function SprintEndNotice({ words, onKeepGoing, onStop, language, t }: SprintEndNoticeProps) {
    const titleId = useId();
    return (
        <section className="focus-mode-sprint-end" aria-labelledby={titleId}>
            <h3 id={titleId} className="focus-mode-sprint-end-title">{t('focusModeSprintEnded')}</h3>
            <p className="focus-mode-sprint-end-words">{pluralPhrase(t, 'focusModeSprintWords', words, language)}</p>
            <div className="focus-mode-sprint-end-actions">
                <button type="button" className="focus-mode-done" onClick={onKeepGoing}>{t('focusModeSprintKeepGoing')}</button>
                <button type="button" className="focus-mode-done" onClick={onStop}>{t('focusModeSprintStop')}</button>
            </div>
        </section>
    );
}
