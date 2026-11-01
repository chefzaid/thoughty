import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import PageHeader from '../PageHeader/PageHeader';
import { useQuietMode } from '../QuietMode/quietMode';
import type { OpenTask, OpenTasksPage as OpenTasksPageData } from '../../services/api';
import { getPathForView, type TranslationFunction } from '../../types';
import { ENTRY_PERMALINK_PARAM } from '../../utils/appRouting';
import { formatJournalDate } from '../../utils/entryDate';
import { resolveLanguage } from '../../utils/language';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';
import { groupByEntry, openTaskKey, taskPlainText, type OpenTaskGroup } from './openTasksFormat';
import { useOpenTasks } from './useOpenTasks';
import './OpenTasksPage.css';

export interface OpenTasksPageProps {
  readonly theme?: 'light' | 'dark';
  readonly language?: string;
  /** The diary the tasks come from; null for every diary. */
  readonly diaryId: number | null;
  /** The page from the URL, starting at 1. */
  readonly page: number;
  /** The cursor the page starts after, when reached with Next; null to open `page` by its offset. */
  readonly after: string | null;
  readonly onChangePage: (page: number, options?: ChangePageOptions) => void;
  readonly t: TranslationFunction;
}

type Notice = { tone: 'status' | 'error'; text: string } | null;

export interface ChangePageOptions {
  readonly replace?: boolean;
  /** Start the page right after this cursor (the `nextCursor` of the page before). */
  readonly after?: string;
}

interface TaskGroupProps {
  readonly group: OpenTaskGroup;
  readonly language: Language;
  /** Whether each task on the page is ticked, by its key. */
  readonly ticked: ReadonlyMap<string, boolean>;
  readonly busy: ReadonlySet<string>;
  readonly onToggle: (task: OpenTask, checked: boolean) => void;
  readonly t: TranslationFunction;
}

function TaskGroup({ group, language, ticked, busy, onToggle, t }: TaskGroupProps) {
  const date = formatJournalDate(group.date, language);
  const headingId = `open-tasks-entry-${group.entryId}-${group.firstLine}`;

  return (
    <li className="open-tasks-entry">
      <article aria-labelledby={headingId}>
        <header className="open-tasks-entry-header">
          <h2 id={headingId}>
            {date}
            {group.title && <span className="open-tasks-entry-title"> · {group.title}</span>}
          </h2>
          <Link
            className="open-tasks-link"
            to={`${getPathForView('journal')}?${ENTRY_PERMALINK_PARAM}=${group.entryId}`}
            aria-label={t('openTasksOpenEntryOf', { date })}
          >
            {t('openTasksOpenEntry')}
            <span className="codicon codicon-arrow-right" aria-hidden="true" />
          </Link>
        </header>
        <ul className="open-tasks-items">
          {group.tasks.map((task) => {
            const key = openTaskKey(task);
            const checked = ticked.get(key) ?? false;
            return (
              <li key={key}>
                <label className={`open-tasks-item${checked ? ' is-done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    aria-describedby={headingId}
                    // Disabling it while it saves would take keyboard focus away: a second change waits instead
                    onChange={(event) => !busy.has(key) && onToggle(task, event.target.checked)}
                  />
                  <span className="open-tasks-text privacy-text">{taskPlainText(task.text) || task.text}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </article>
    </li>
  );
}

interface TaskListProps {
  readonly data: OpenTasksPageData;
  readonly language: Language;
  readonly onChangePage: (page: number, options?: ChangePageOptions) => void;
  readonly onToggle: (task: OpenTask, checked: boolean) => Promise<boolean>;
  readonly onNotice: (notice: Notice) => void;
  readonly t: TranslationFunction;
}

/**
 * One page of open tasks; what was ticked here stays shown as ticked until the page or diary changes.
 * Next starts after the last task shown, so the ones ticked here cannot make it skip any; Previous opens
 * the page before by its offset, which ticking can only make overlap this one, never leave a gap.
 */
function TaskList({ data, language, onChangePage, onToggle, onNotice, t }: TaskListProps) {
  const { page, nextCursor } = data;
  const quiet = useQuietMode();
  const [ticked, setTicked] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const tickedHere = data.tasks.filter((task) => ticked.get(openTaskKey(task))).length;

  const toggle = async (task: OpenTask, checked: boolean) => {
    const key = openTaskKey(task);
    setBusy((current) => new Set(current).add(key));
    setTicked((current) => new Map(current).set(key, checked));
    const saved = await onToggle(task, checked);
    setBusy((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    if (saved) {
      onNotice({ tone: 'status', text: t(checked ? 'openTasksTicked' : 'openTasksUnticked', { task: taskPlainText(task.text) }) });
    } else {
      setTicked((current) => new Map(current).set(key, !checked));
    }
  };

  return (
    <>
      {!quiet && (
        <p className="open-tasks-count">{pluralPhrase(t, 'openTasksCount', data.total - tickedHere, language)}</p>
      )}
      <ul className="open-tasks-list">
        {groupByEntry(data.tasks).map((group) => (
          <TaskGroup
            key={`${group.entryId}-${group.firstLine}`}
            group={group}
            language={language}
            ticked={ticked}
            busy={busy}
            onToggle={(task, checked) => void toggle(task, checked)}
            t={t}
          />
        ))}
      </ul>
      {(data.totalPages > 1 || page > 1) && (
        <nav className="open-tasks-pagination" aria-label={t('openTasksPagination')}>
          <button type="button" className="open-tasks-button" disabled={page <= 1} onClick={() => onChangePage(page - 1)}>
            {t('openTasksPrevious')}
          </button>
          <span>{t('openTasksPage', { page: Math.min(page, data.totalPages), total: data.totalPages })}</span>
          <button
            type="button"
            className="open-tasks-button"
            disabled={!nextCursor}
            onClick={() => nextCursor && onChangePage(page + 1, { after: nextCursor })}
          >
            {t('openTasksNext')}
          </button>
        </nav>
      )}
    </>
  );
}

/** Every unticked task of the writer's Markdown entries, newest first, each ticked off in place. */
function OpenTasksPage({ theme, language: rawLanguage, diaryId, page, after, onChangePage, t }: OpenTasksPageProps) {
  const language = resolveLanguage(rawLanguage);
  const { tasks, setTask } = useOpenTasks(page, diaryId, after);
  const [notice, setNotice] = useState<Notice>(null);
  const data = tasks.data;

  // A page emptied by ticking elsewhere gives way to the last page that still has tasks
  const placeholder = tasks.isPlaceholderData;
  useEffect(() => {
    if (data && !placeholder && data.totalPages > 0 && data.page > data.totalPages) {
      onChangePage(data.totalPages, { replace: true });
    }
  }, [data, onChangePage, placeholder]);

  const toggle = async (task: OpenTask, checked: boolean) => {
    const result = await setTask(task, checked);
    if (!result.success) {
      setNotice({ tone: 'error', text: t(result.error || 'taskUpdateFailed') });
    }
    return result.success;
  };

  let body;
  if (tasks.isPending) {
    body = <p className="open-tasks-state" role="status">{t('openTasksLoading')}</p>;
  } else if (tasks.isError || !data) {
    body = (
      <div className="open-tasks-state" role="alert">
        <p>{t('openTasksLoadError')}</p>
        <button type="button" className="open-tasks-button" onClick={() => void tasks.refetch()}>{t('openTasksRetry')}</button>
      </div>
    );
  } else if (data.total === 0) {
    body = <p className="open-tasks-state">{t(diaryId === null ? 'openTasksEmpty' : 'openTasksEmptyDiary')}</p>;
  } else {
    body = (
      <TaskList
        key={`${diaryId ?? 'all'}-${page}-${after ?? ''}-${tasks.dataUpdatedAt}`}
        data={data}
        language={language}
        onChangePage={onChangePage}
        onToggle={toggle}
        onNotice={setNotice}
        t={t}
      />
    );
  }

  return (
    <div className={`open-tasks-page ${theme === 'light' ? 'light' : 'dark'}`}>
      <PageHeader title={t('openTasksTitle')} subtitle={t('openTasksIntro')} theme={theme === 'light' ? 'light' : 'dark'} />
      <div className="open-tasks-notice" role="status" aria-live="polite">
        {notice && <p className={notice.tone === 'error' ? 'open-tasks-error' : undefined}>{notice.text}</p>}
      </div>
      {body}
    </div>
  );
}

export default OpenTasksPage;
