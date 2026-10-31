import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { FontFamilyPreference, TranslationFunction } from '../../types';
import { normalizeFontSize, resolveFontColor, resolveFontFamily } from '../../types/config';
import { countEntryWords } from '../../utils/entryMetrics';
import { resolveLanguage } from '../../utils/language';
import { pluralPhrase } from '../../utils/pluralPhrase';
import MentionSuggestions from '../People/MentionSuggestions';
import { useMentionAutocomplete } from '../People/useMentionAutocomplete';
import { belowCaretLine, centerCaretLine } from './typewriter';
import { isFocusModeShortcut } from './focusModeShortcut';
import { MAX_WORD_GOAL, parseWordGoal, readSavedGoal, saveGoal, wordsPhrase } from './focusModeSession';
import { SprintCountdown, SprintEndNotice, SprintPicker } from './FocusSprint';
import { useFocusSprint } from './useFocusSprint';
import './FocusMode.css';

/** The writing text is larger than the base size, as on a page held at reading distance. */
const TEXT_SCALE = 1.25;

interface FocusModeProps {
    /** The draft, shared with the composer or editor that opened focus mode, so leaving never loses it. */
    readonly text: string;
    readonly onTextChange: (text: string) => void;
    readonly onClose: () => void;
    readonly theme?: 'light' | 'dark';
    readonly fontColor?: string;
    readonly fontFamily?: FontFamilyPreference;
    readonly fontSize?: string | number;
    readonly language?: string;
    readonly placeholder?: string;
    readonly t: TranslationFunction;
}

/**
 * Full-screen, distraction-free writing: only the text, a live word count, an optional word goal
 * for the session, and an optional timed sprint that ends with a quiet note instead of a sound.
 * The caret's line stays near the middle of the screen (typewriter scrolling).
 * Typing `@` offers the writer's people as in the composer, in a list just under the caret's line.
 * Esc, the Done button, or the shortcut leave it, and the text stays in the composer or editor.
 */
export default function FocusMode({
    text,
    onTextChange,
    onClose,
    theme = 'dark',
    fontColor,
    fontFamily,
    fontSize,
    language = 'en',
    placeholder,
    t,
}: FocusModeProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const titleId = useId();
    const goalId = useId();
    const [goalInput, setGoalInput] = useState(readSavedGoal);
    // Words already there when focus mode opened, so the goal counts only what this session adds
    const [wordsAtStart] = useState(() => countEntryWords(text));

    const mentions = useMentionAutocomplete(text, onTextChange);
    const suggestionsOpen = mentions.suggestions !== null;
    const [suggestionsPlacement, setSuggestionsPlacement] = useState<ReturnType<typeof belowCaretLine> | null>(null);

    useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: textareaRef, onClose });

    const keepCaretCentered = useCallback((smooth: boolean) => {
        if (textareaRef.current) {
            centerCaretLine(textareaRef.current, smooth);
        }
    }, []);

    // Start writing at the end of the draft, with its last line in the middle of the screen
    useEffect(() => {
        const area = textareaRef.current;
        if (!area) return undefined;
        area.setSelectionRange(area.value.length, area.value.length);
        keepCaretCentered(false);

        const recenter = () => keepCaretCentered(false);
        globalThis.addEventListener('resize', recenter);
        return () => globalThis.removeEventListener('resize', recenter);
    }, [keepCaretCentered]);

    useLayoutEffect(() => {
        keepCaretCentered(true);
    }, [keepCaretCentered, text]);

    // The people list follows the caret's line, also while typewriter scrolling moves it
    const placeSuggestions = useCallback(() => {
        if (textareaRef.current) {
            setSuggestionsPlacement(belowCaretLine(textareaRef.current));
        }
    }, []);

    useLayoutEffect(() => {
        if (suggestionsOpen) placeSuggestions();
    }, [placeSuggestions, suggestionsOpen, text]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    const words = countEntryWords(text);
    const sprint = useFocusSprint(words);
    const uiLanguage = resolveLanguage(language);
    const goal = parseWordGoal(goalInput);
    const written = Math.max(0, words - wordsAtStart);
    const reached = goal !== null && written >= goal;
    const progressText = goal === null
        ? ''
        : t('focusModeGoalProgress', { written: written.toLocaleString(language), goal: goal.toLocaleString(language) });
    const sprintWordsText = pluralPhrase(t, 'focusModeSprintWords', sprint.wordsInSprint, uiLanguage);
    const sprintAnnouncement = {
        running: '',
        halfway: t('focusModeSprintHalfway'),
        ended: `${t('focusModeSprintEnded')}. ${sprintWordsText}`,
    }[sprint.stage ?? 'running'];

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (isFocusModeShortcut(event)) {
            event.preventDefault();
            onClose();
        }
        // Journal shortcuts (pages, search, new entry) never act behind focus mode; Esc and Tab
        // still reach the dialog's own handling.
        if (event.key !== 'Escape' && event.key !== 'Tab') {
            event.stopPropagation();
        }
    };

    return createPortal(
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`focus-mode ${theme === 'light' ? 'light' : 'dark'}`}
            onKeyDown={handleKeyDown}
        >
            <header className="focus-mode-bar">
                <h2 id={titleId} className="focus-mode-title">{t('focusMode')}</h2>
                <div className="focus-mode-stats">
                    <p className="focus-mode-count">{wordsPhrase(t, words, language)}</p>
                    {sprint.sprint && <SprintCountdown key={sprint.sprint.startedAt} sprint={sprint.sprint} t={t} />}
                </div>
                <div className="focus-mode-goal">
                    <label htmlFor={goalId}>{t('focusModeGoalLabel')}</label>
                    <input
                        id={goalId}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_WORD_GOAL}
                        step={1}
                        value={goalInput}
                        placeholder={t('focusModeGoalPlaceholder')}
                        onChange={(event) => {
                            setGoalInput(event.target.value);
                            saveGoal(parseWordGoal(event.target.value) === null ? '' : event.target.value);
                        }}
                    />
                </div>
                <SprintPicker minutes={sprint.minutes} onChoose={sprint.choose} language={uiLanguage} t={t} />
                <button type="button" className="focus-mode-done" onClick={onClose} title={t('focusModeLeave')}>
                    {t('focusModeDone')}
                </button>
            </header>
            <div className="focus-mode-writing" {...mentions.wrapperProps}>
                <textarea
                    ref={textareaRef}
                    className="focus-mode-text"
                    aria-label={t('focusModeTextLabel')}
                    aria-describedby={`${titleId}-hint`}
                    placeholder={placeholder}
                    value={text}
                    onChange={(event) => onTextChange(event.target.value)}
                    {...mentions.fieldProps}
                    onSelect={(event) => {
                        mentions.fieldProps.onSelect(event);
                        keepCaretCentered(true);
                    }}
                    onScroll={suggestionsOpen ? placeSuggestions : undefined}
                    spellCheck
                    style={{
                        color: resolveFontColor(fontColor, theme),
                        fontFamily: resolveFontFamily(fontFamily),
                        fontSize: `${normalizeFontSize(fontSize) * TEXT_SCALE}px`,
                    }}
                />
                <MentionSuggestions
                    suggestions={mentions.suggestions}
                    placement={suggestionsPlacement}
                    theme={theme}
                    language={uiLanguage}
                    t={t}
                />
            </div>
            <footer className="focus-mode-footer">
                {sprint.stage === 'ended' && (
                    <SprintEndNotice
                        words={sprint.wordsInSprint}
                        onKeepGoing={() => {
                            sprint.keepGoing();
                            // The notice and its buttons go; writing picks up where the caret was
                            textareaRef.current?.focus();
                        }}
                        onStop={onClose}
                        language={uiLanguage}
                        t={t}
                    />
                )}
                <p id={`${titleId}-hint`} className="focus-mode-hint">{t('focusModeHint')}</p>
                {goal !== null && (
                    <div className="focus-mode-progress">
                        <div
                            className="focus-mode-progress-track"
                            role="progressbar"
                            aria-label={t('focusModeGoalProgressLabel')}
                            aria-valuemin={0}
                            aria-valuemax={goal}
                            aria-valuenow={Math.min(written, goal)}
                            aria-valuetext={progressText}
                        >
                            <div className="focus-mode-progress-fill" style={{ width: `${Math.min(100, (written / goal) * 100)}%` }} />
                        </div>
                        <span className="focus-mode-progress-text">{progressText}</span>
                    </div>
                )}
                {/* Announced once when the goal is reached, never on every word */}
                <p role="status" className="focus-mode-reached">{reached ? t('focusModeGoalReached') : ''}</p>
                {/* The sprint's halfway point and end, each said once; the countdown itself stays quiet */}
                <p role="status" className="focus-mode-sprint-status sr-only">{sprintAnnouncement}</p>
            </footer>
        </div>,
        document.body,
    );
}
