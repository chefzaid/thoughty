import { useState, type ChangeEvent } from 'react';

import { useAuthenticatedService } from '../../../hooks/useAuthenticatedService';
import { createAppImportService } from '../../../services/api/appImportService';
import type { TranslationFunction } from '../../../types';
import { pluralPhrase } from '../../../utils/pluralPhrase';
import type { Language } from '../../../utils/translations';
import type { AppExport, AppImportSource } from './appImportTypes';
import type { AppImportProgress, AppImportSummary, FailedFileReason } from './runAppImport';
import { useAppImport } from './useAppImport';
import './AppImportPanel.css';

const SOURCE_NAMES: Record<AppImportSource, string> = { dayone: 'Day One', journey: 'Journey' };
const FAILURE_KEYS: Record<FailedFileReason, string> = {
  tooLarge: 'appImportReasonTooLarge',
  unreadable: 'appImportReasonUnreadable',
  rejected: 'appImportReasonRejected',
};
const LISTED_FAILURES = 10;

interface AppImportPanelProps {
  readonly diaryId?: number | null;
  readonly diaryName?: string;
  readonly language: Language;
  readonly onImported?: () => void;
  readonly t: TranslationFunction;
}

function Stat({ value, label, language }: Readonly<{ value: number; label: string; language: Language }>) {
  return (
    <div className="stat">
      <span className="stat-value">{value.toLocaleString(language)}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function ExportPreview({
  data,
  diaryLabel,
  language,
  onStart,
  onCancel,
  t,
}: Readonly<{
  data: AppExport;
  diaryLabel: string;
  language: Language;
  onStart: (journalsAsDiaries: boolean) => void;
  onCancel: () => void;
  t: TranslationFunction;
}>) {
  const [journalsAsDiaries, setJournalsAsDiaries] = useState(data.journals.length > 1);
  const mediaCount = data.entries.reduce((sum, entry) => sum + entry.media.length, 0);
  const formatDay = (date: string) => new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  const first = data.entries[0];
  const last = data.entries.at(-1);

  return (
    <div className="preview-box app-import-box">
      <p className="app-import-heading">{t('appImportFoundFrom', { source: SOURCE_NAMES[data.source] })}</p>
      <div className="preview-stats">
        <Stat value={data.entries.length} label={t('appImportStatEntries')} language={language} />
        <Stat value={data.journals.length} label={t('appImportStatJournals')} language={language} />
        <Stat value={mediaCount} label={t('appImportStatMedia')} language={language} />
        {data.skippedMedia > 0 && <Stat value={data.skippedMedia} label={t('appImportStatSkipped')} language={language} />}
      </div>
      {first && last && <p className="app-import-note">{t('appImportRange', { first: formatDay(first.date), last: formatDay(last.date) })}</p>}

      <fieldset className="app-import-destination">
        <legend>{t('appImportDestination')}</legend>
        <label className="checkbox-label">
          <input type="radio" name="app-import-destination" checked={!journalsAsDiaries} onChange={() => setJournalsAsDiaries(false)} />
          {t('appImportIntoDiary', { diaryName: diaryLabel })}
        </label>
        <label className="checkbox-label">
          <input type="radio" name="app-import-destination" checked={journalsAsDiaries} onChange={() => setJournalsAsDiaries(true)} />
          {t('appImportJournalsAsDiaries', { journals: data.journals.join(', ') })}
        </label>
      </fieldset>
      <p className="app-import-note">{t('appImportPrivacyNote')}</p>

      <div className="app-import-actions">
        <button type="button" className="io-btn primary" disabled={data.entries.length === 0} onClick={() => onStart(journalsAsDiaries)}>
          {t('appImportStart')}
        </button>
        <button type="button" className="io-btn secondary" onClick={onCancel}>{t('cancel')}</button>
      </div>
    </div>
  );
}

function ImportProgress({ progress, onStop, t }: Readonly<{ progress: AppImportProgress; onStop: () => void; t: TranslationFunction }>) {
  const label = t(progress.phase === 'entries' ? 'appImportProgressEntries' : 'appImportProgressFiles', {
    done: progress.done,
    total: progress.total,
  });
  return (
    <div className="preview-box app-import-box">
      <p className="app-import-heading" id="app-import-progress-label">{label}</p>
      <progress className="app-import-progress" max={Math.max(progress.total, 1)} value={progress.done} aria-labelledby="app-import-progress-label" />
      {progress.waitingSeconds !== undefined && <p className="app-import-note">{t('appImportWaiting', { seconds: progress.waitingSeconds })}</p>}
      <p className="app-import-note">{t('appImportKeepOpen')}</p>
      <div className="app-import-actions">
        <button type="button" className="io-btn secondary" onClick={onStop}>{t('appImportStop')}</button>
      </div>
    </div>
  );
}

function ImportResult({
  summary,
  error,
  language,
  onReset,
  t,
}: Readonly<{ summary: AppImportSummary | null; error?: string; language: Language; onReset: () => void; t: TranslationFunction }>) {
  let title = t('appImportDone');
  if (error) {
    title = t('appImportFailed', { error: t(error) });
  } else if (summary?.stopped) {
    title = t('appImportStopped');
  }
  const failed = summary?.failedFiles ?? [];

  return (
    <div className="preview-box app-import-box" role="status">
      <p className={`app-import-heading${error ? ' app-import-error' : ''}`}>{title}</p>
      {summary && (
        <div className="preview-stats">
          <Stat value={summary.imported} label={t('appImportResultImported')} language={language} />
          <Stat value={summary.alreadyImported} label={t('appImportResultAlready')} language={language} />
          <Stat value={summary.attached} label={t('appImportResultAttached')} language={language} />
        </div>
      )}
      {summary && summary.createdDiaries.length > 0 && (
        <p className="app-import-note">{t('appImportCreatedDiaries', { names: summary.createdDiaries.join(', ') })}</p>
      )}
      {failed.length > 0 && (
        <>
          <p className="app-import-note">{t('appImportFailedFiles')}</p>
          <ul className="app-import-failures">
            {failed.slice(0, LISTED_FAILURES).map((file, index) => (
              <li key={`${file.name}-${index}`}>{`${file.name} (${t(FAILURE_KEYS[file.reason])})`}</li>
            ))}
          </ul>
          {failed.length > LISTED_FAILURES && <p className="app-import-note">{pluralPhrase(t, 'appImportMoreFailed', failed.length - LISTED_FAILURES, language)}</p>}
        </>
      )}
      <div className="app-import-actions">
        <button type="button" className="io-btn secondary" onClick={onReset}>{t('appImportAnother')}</button>
      </div>
    </div>
  );
}

/** Imports a Day One or Journey export, read in the browser, with its photos and recordings. */
export function AppImportPanel({ diaryId, diaryName, language, onImported, t }: AppImportPanelProps) {
  const service = useAuthenticatedService(createAppImportService);
  const { state, chooseFile, start, stop, reset } = useAppImport(service, onImported);
  const diaryLabel = diaryId && diaryName ? diaryName : t('appImportDefaultDiary');

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      void chooseFile(file);
    }
  };

  return (
    <section className="app-import" aria-labelledby="app-import-title">
      <h3 id="app-import-title">{t('appImportTitle')}</h3>
      <p className="section-description">{t('appImportDescription')}</p>

      {(state.step === 'idle' || state.step === 'unreadable') && (
        <div className="file-upload app-import-file">
          <input
            type="file"
            id="app-import-file"
            className="app-import-input"
            accept=".zip,.json,application/zip,application/json"
            onChange={handleFile}
          />
          <label htmlFor="app-import-file" className="file-label">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {t('appImportChoose')}
          </label>
        </div>
      )}
      {state.step === 'unreadable' && (
        <p className="message error" role="alert">{t(state.unsupported ? 'appImportUnsupported' : 'appImportReadError')}</p>
      )}
      {state.step === 'reading' && <p className="app-import-note" role="status">{t('appImportReading', { name: state.fileName })}</p>}
      {state.step === 'ready' && (
        <ExportPreview
          data={state.data}
          diaryLabel={diaryLabel}
          language={language}
          onStart={(journalsAsDiaries) => void start(state.data, { diaryId, journalsAsDiaries })}
          onCancel={reset}
          t={t}
        />
      )}
      {state.step === 'importing' && <ImportProgress progress={state.progress} onStop={stop} t={t} />}
      {state.step === 'done' && <ImportResult summary={state.summary} error={state.error} language={language} onReset={reset} t={t} />}
    </section>
  );
}
