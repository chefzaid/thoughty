import { useEffect, useState } from 'react';

import ConfirmModal from '../ConfirmModal/ConfirmModal';
import type { RecycleBinRestoreResult, ServiceResult, TrashedEntry } from '../../services/api';
import type { Diary, TranslationFunction } from '../../types';
import { formatTimeOfDay } from '../../utils/entryTime';
import { resolveLanguage } from '../../utils/language';
import type { Language } from '../../utils/translations';
import {
  binCountPhrase,
  binExcerpt,
  daysUntilPurge,
  formatBinDate,
  formatDeletedOn,
} from './recycleBinFormat';
import { useRecycleBin } from './useRecycleBin';
import './RecycleBinPage.css';

const RETENTION_DAYS = 30;

export interface RecycleBinPageProps {
  readonly theme?: 'light' | 'dark';
  readonly language?: string;
  readonly diaries: Diary[];
  /** The page from the URL, starting at 1. */
  readonly page: number;
  readonly onChangePage: (page: number, options?: { replace?: boolean }) => void;
  readonly onBack: () => void;
  readonly t: TranslationFunction;
}

type PendingConfirmation = { kind: 'delete'; entry: TrashedEntry } | { kind: 'empty' } | null;
type Notice = { tone: 'success' | 'error'; text: string } | null;

interface TrashedEntryCardProps {
  readonly entry: TrashedEntry;
  readonly defaultDiaryName: string;
  readonly language: Language;
  readonly busy: boolean;
  readonly onRestore: () => void;
  readonly onDelete: () => void;
  readonly t: TranslationFunction;
}

function TrashedEntryCard({ entry, defaultDiaryName, language, busy, onRestore, onDelete, t }: TrashedEntryCardProps) {
  const date = entry.timeOfDay
    ? `${formatBinDate(entry.date, language)} · ${formatTimeOfDay(entry.timeOfDay, language)}`
    : formatBinDate(entry.date, language);
  const daysLeft = daysUntilPurge(entry.purgeAt);
  const headingId = `recycle-bin-entry-${entry.id}`;

  return (
    <li className="recycle-bin-entry">
      <article aria-labelledby={headingId}>
        <header className="recycle-bin-entry-header">
          <h2 id={headingId}>{date}</h2>
          <span
            className="recycle-bin-diary"
            style={entry.diaryColor ? { borderColor: entry.diaryColor } : undefined}
          >
            {entry.diaryName
              ? t('recycleBinReturnsTo', { diary: `${entry.diaryIcon ?? ''} ${entry.diaryName}`.trim() })
              : t('recycleBinReturnsToDefault', { diary: defaultDiaryName })}
          </span>
        </header>
        {entry.title && <p className="recycle-bin-title">{entry.title}</p>}
        <p className="recycle-bin-excerpt">{binExcerpt(entry.content)}</p>
        <p className="recycle-bin-meta">
          <span>{t('recycleBinDeletedOn', { date: formatDeletedOn(entry.deletedAt, language) })}</span>
          <span className={daysLeft <= 3 ? 'recycle-bin-soon' : undefined}>
            {daysLeft === 0 ? t('recycleBinPurgeToday') : binCountPhrase(t, 'recycleBinDaysLeft', daysLeft, language)}
          </span>
          {entry.attachmentCount > 0 && <span>{binCountPhrase(t, 'recycleBinFiles', entry.attachmentCount, language)}</span>}
          {entry.tags.length > 0 && <span>{entry.tags.map((tag) => `#${tag}`).join(' ')}</span>}
        </p>
        <div className="recycle-bin-entry-actions">
          <button
            type="button"
            className="recycle-bin-primary"
            aria-label={t('recycleBinRestoreEntry', { date })}
            disabled={busy}
            onClick={onRestore}
          >
            <span className="codicon codicon-discard" aria-hidden="true" />
            {t('recycleBinRestore')}
          </button>
          <button
            type="button"
            className="recycle-bin-danger"
            aria-label={t('recycleBinDeleteEntry', { date })}
            disabled={busy}
            onClick={onDelete}
          >
            <span className="codicon codicon-trash" aria-hidden="true" />
            {t('recycleBinDeleteForever')}
          </button>
        </div>
      </article>
    </li>
  );
}

/** Deleted entries waiting 30 days to be restored or removed for good. */
function RecycleBinPage({ theme, language: rawLanguage, diaries, page, onChangePage, onBack, t }: RecycleBinPageProps) {
  const language = resolveLanguage(rawLanguage);
  const { bin, restore, restoreAll, deletePermanently, empty } = useRecycleBin(page);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingConfirmation>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const data = bin.data;
  const defaultDiaryName = diaries.find((diary) => diary.isDefault)?.name ?? t('recycleBinDefaultDiary');
  const entries = (count: number) => binCountPhrase(t, 'recycleBinEntries', count, language);

  // A page emptied by restoring or deleting gives way to the last page that still has entries
  useEffect(() => {
    if (data && page > data.totalPages) {
      onChangePage(data.totalPages, { replace: true });
    }
  }, [data, onChangePage, page]);

  const perform = async <T,>(request: () => Promise<ServiceResult<T>>, describe: (result: T) => string) => {
    setBusy(true);
    setNotice(null);
    const result = await request();
    setBusy(false);
    setNotice(result.data
      ? { tone: 'success', text: describe(result.data) }
      : { tone: 'error', text: t('recycleBinActionError') });
  };

  const describeRestore = (result: RecycleBinRestoreResult) => {
    const restored = t('recycleBinRestored', { entries: entries(result.restoredCount) });
    return result.movedToDefaultCount > 0
      ? `${restored} ${t('recycleBinMovedToDefault', { entries: entries(result.movedToDefaultCount), diary: defaultDiaryName })}`
      : restored;
  };

  const confirm = () => {
    const confirmation = pending;
    setPending(null);
    if (confirmation?.kind === 'delete') {
      void perform(() => deletePermanently([confirmation.entry.id]), (result) => t('recycleBinDeleted', { entries: entries(result.deletedCount) }));
    } else if (confirmation?.kind === 'empty') {
      void perform(empty, (result) => t('recycleBinDeleted', { entries: entries(result.deletedCount) }));
    }
  };

  let body;
  if (bin.isPending) {
    body = <p className="recycle-bin-state" role="status">{t('recycleBinLoading')}</p>;
  } else if (bin.isError || !data) {
    body = (
      <div className="recycle-bin-state" role="alert">
        <p>{t('recycleBinLoadError')}</p>
        <button type="button" className="recycle-bin-secondary" onClick={() => void bin.refetch()}>{t('recycleBinRetry')}</button>
      </div>
    );
  } else if (data.total === 0) {
    body = <p className="recycle-bin-state">{t('recycleBinEmptyState', { days: data.retentionDays })}</p>;
  } else {
    body = (
      <>
        <p className="recycle-bin-count">{t('recycleBinCount', { entries: entries(data.total) })}</p>
        <ul className="recycle-bin-list">
          {data.entries.map((entry) => (
            <TrashedEntryCard
              key={entry.id}
              entry={entry}
              defaultDiaryName={defaultDiaryName}
              language={language}
              busy={busy}
              onRestore={() => void perform(() => restore([entry.id]), describeRestore)}
              onDelete={() => setPending({ kind: 'delete', entry })}
              t={t}
            />
          ))}
        </ul>
        {data.totalPages > 1 && (
          <nav className="recycle-bin-pagination" aria-label={t('recycleBinPagination')}>
            <button type="button" className="recycle-bin-secondary" disabled={page <= 1} onClick={() => onChangePage(page - 1)}>
              {t('recycleBinPrevious')}
            </button>
            <span>{t('recycleBinPage', { page: Math.min(page, data.totalPages), total: data.totalPages })}</span>
            <button
              type="button"
              className="recycle-bin-secondary"
              disabled={page >= data.totalPages}
              onClick={() => onChangePage(page + 1)}
            >
              {t('recycleBinNext')}
            </button>
          </nav>
        )}
      </>
    );
  }

  const isEmpty = !data || data.total === 0;

  return (
    <div className={`recycle-bin-page ${theme === 'light' ? 'light' : 'dark'}`}>
      <header className="recycle-bin-header">
        <div>
          <h1>{t('recycleBinTitle')}</h1>
          <p className="recycle-bin-intro">{t('recycleBinIntro', { days: data?.retentionDays ?? RETENTION_DAYS })}</p>
        </div>
        <div className="recycle-bin-toolbar">
          <button type="button" className="recycle-bin-secondary" onClick={onBack}>
            <span className="codicon codicon-arrow-left" aria-hidden="true" />
            {t('recycleBinBack')}
          </button>
          <button
            type="button"
            className="recycle-bin-primary"
            disabled={isEmpty || busy}
            onClick={() => void perform(restoreAll, describeRestore)}
          >
            {t('recycleBinRestoreAll')}
          </button>
          <button type="button" className="recycle-bin-danger" disabled={isEmpty || busy} onClick={() => setPending({ kind: 'empty' })}>
            {t('recycleBinEmpty')}
          </button>
        </div>
      </header>
      <div className="recycle-bin-notice" role="status" aria-live="polite">
        {notice && <p className={notice.tone === 'error' ? 'recycle-bin-error' : undefined}>{notice.text}</p>}
      </div>
      {body}
      <ConfirmModal
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        title={t(pending?.kind === 'empty' ? 'recycleBinEmptyTitle' : 'recycleBinDeleteTitle')}
        message={pending?.kind === 'delete'
          ? t('recycleBinDeleteMessage', { date: formatBinDate(pending.entry.date, language) })
          : t('recycleBinEmptyMessage', { entries: entries(data?.total ?? 0) })}
        confirmLabel={t(pending?.kind === 'empty' ? 'recycleBinEmpty' : 'recycleBinDeleteForever')}
        theme={theme}
        t={t}
      />
    </div>
  );
}

export default RecycleBinPage;
