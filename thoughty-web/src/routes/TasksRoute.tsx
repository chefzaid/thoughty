import { useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import DiaryTabs from '../components/DiaryTabs/DiaryTabs';
import OpenTasksPage, { type ChangePageOptions } from '../components/OpenTasks/OpenTasksPage';
import type { Diary, TranslationFunction } from '../types';

interface TasksRouteProps {
  readonly diaries: Diary[];
  readonly currentDiaryId: number | null;
  readonly onDiaryChange: (diaryId: number | null) => void;
  readonly onManageDiaries: () => void;
  readonly theme?: 'light' | 'dark';
  readonly language?: string;
  readonly t: TranslationFunction;
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : 1;
}

/** The cursor a page reached with Next starts after, kept in the history entry rather than the address. */
function parseAfter(state: unknown): string | null {
  const after = (state as { openTasksAfter?: unknown } | null)?.openTasksAfter;
  return typeof after === 'string' && after !== '' ? after : null;
}

/**
 * `/tasks?diary=2&page=2`: the open tasks of a diary or of all of them; the page is optional. A page
 * reached with Next also keeps its cursor in the history entry, so going back and forth (or reloading)
 * finds the same tasks; a link without one opens the page by its offset.
 */
function TasksRoute({ diaries, currentDiaryId, onDiaryChange, onManageDiaries, theme, language, t }: Readonly<TasksRouteProps>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state } = useLocation();

  const changePage = useCallback((page: number, options?: ChangePageOptions) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (page > 1) {
        next.set('page', String(page));
      } else {
        next.delete('page');
      }
      return next;
    }, { replace: options?.replace, state: options?.after ? { openTasksAfter: options.after } : null });
  }, [setSearchParams]);

  return (
    <>
      <DiaryTabs
        diaries={diaries}
        currentDiaryId={currentDiaryId}
        onDiaryChange={onDiaryChange}
        onManageDiaries={onManageDiaries}
        theme={theme}
        t={t}
      />
      <OpenTasksPage
        theme={theme}
        language={language}
        diaryId={currentDiaryId}
        page={parsePage(searchParams.get('page'))}
        after={parseAfter(state)}
        onChangePage={changePage}
        t={t}
      />
    </>
  );
}

export default TasksRoute;
