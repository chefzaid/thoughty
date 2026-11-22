import { useState, type ChangeEvent } from 'react';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import type { TranslationFunction } from '../../types';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';
import { useCalendarImport } from './useCalendarEvents';
import '../ImportExport/appImport/AppImportPanel.css';

interface CalendarImportPanelProps {
    readonly language: Language;
    readonly theme?: 'light' | 'dark';
    readonly t: TranslationFunction;
}

type Outcome =
    | { kind: 'importing'; name: string }
    | { kind: 'imported'; imported: number; skippedRecurring: number }
    | { kind: 'cleared' }
    | { kind: 'error'; message: string };

function OutcomeMessage({ outcome, language, t }: Readonly<{ outcome: Outcome; language: Language; t: TranslationFunction }>) {
    switch (outcome.kind) {
        case 'importing':
            return <p className="app-import-note" role="status">{t('calendarImporting', { name: outcome.name })}</p>;
        case 'imported':
            return (
                <p className="app-import-note" role="status">
                    {pluralPhrase(t, 'calendarImported', outcome.imported, language)}
                    {outcome.skippedRecurring > 0 && ` ${pluralPhrase(t, 'calendarSkippedRecurring', outcome.skippedRecurring, language)}`}
                </p>
            );
        case 'cleared':
            return <p className="app-import-note" role="status">{t('calendarCleared')}</p>;
        default:
            return <p className="message error" role="alert">{t(outcome.message)}</p>;
    }
}

/**
 * **Calendar** in Import/Export: imports a calendar file (.ics) whose events the composer then lists on
 * their day, says how many events are kept, and removes them all after a confirmation.
 */
export default function CalendarImportPanel({ language, theme, t }: CalendarImportPanelProps) {
    const { summary, importFile, clear } = useCalendarImport();
    const [outcome, setOutcome] = useState<Outcome | null>(null);
    const [confirmClear, setConfirmClear] = useState(false);
    const eventCount = summary.data?.eventCount ?? 0;
    const lastImportedAt = summary.data?.lastImportedAt;
    const importing = outcome?.kind === 'importing';

    const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setOutcome({ kind: 'importing', name: file.name });
        const result = await importFile(file);
        setOutcome(result.data
            ? { kind: 'imported', imported: result.data.imported, skippedRecurring: result.data.skippedRecurring }
            : { kind: 'error', message: result.error ?? 'calendarImportFailed' });
    };

    const handleClear = async () => {
        setConfirmClear(false);
        const result = await clear();
        setOutcome(result.data ? { kind: 'cleared' } : { kind: 'error', message: result.error ?? 'calendarClearFailed' });
    };

    let countText = t('calendarNoEvents');
    if (summary.isError) {
        countText = t('calendarEventsLoadFailed');
    } else if (eventCount > 0 && lastImportedAt) {
        const date = new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(new Date(lastImportedAt));
        countText = pluralPhrase(t, 'calendarEventCount', eventCount, language, { date });
    }

    return (
        <section className="app-import" aria-labelledby="calendar-import-title">
            <h3 id="calendar-import-title">{t('calendarImportTitle')}</h3>
            <p className="section-description">{t('calendarImportDescription')}</p>
            {summary.isSuccess || summary.isError ? <p className="app-import-note">{countText}</p> : null}
            <div className="file-upload app-import-file">
                <input
                    type="file"
                    id="calendar-import-file"
                    className="app-import-input"
                    accept=".ics,text/calendar"
                    disabled={importing}
                    onChange={(event) => void handleFile(event)}
                />
                <label htmlFor="calendar-import-file" className="file-label">
                    <span className="codicon codicon-calendar" aria-hidden="true" />
                    {t('calendarImportChoose')}
                </label>
            </div>
            {outcome && <OutcomeMessage outcome={outcome} language={language} t={t} />}
            {eventCount > 0 && (
                <div className="app-import-actions">
                    <button type="button" className="io-btn secondary" onClick={() => setConfirmClear(true)}>{t('calendarClear')}</button>
                </div>
            )}
            <ConfirmModal
                isOpen={confirmClear}
                onClose={() => setConfirmClear(false)}
                onConfirm={() => void handleClear()}
                title={t('calendarClearTitle')}
                message={t('calendarClearMessage')}
                confirmLabel={t('calendarClear')}
                theme={theme}
                t={t}
            />
        </section>
    );
}
