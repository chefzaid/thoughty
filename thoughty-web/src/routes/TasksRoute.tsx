import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import DiaryTabs from '../components/DiaryTabs/DiaryTabs';
import OpenTasksPage from '../components/OpenTasks/OpenTasksPage';
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

/** `/tasks?diary=2&page=2`: the open tasks of a diary or of all of them; the page is optional. */
function TasksRoute({ diaries, currentDiaryId, onDiaryChange, onManageDiaries, theme, language, t }: Readonly<TasksRouteProps>) {
  const [searchParams, setSearchParams] = useSearchParams();

  const changePage = useCallback((page: number, options?: { replace?: boolean }) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (page > 1) {
        next.set('page', String(page));
      } else {
        next.delete('page');
      }
      return next;
    }, { replace: options?.replace });
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
        onChangePage={changePage}
        t={t}
      />
    </>
  );
}

export default TasksRoute;
