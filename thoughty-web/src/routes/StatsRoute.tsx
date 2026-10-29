import { useNavigate } from 'react-router-dom';

import DiaryTabs from '../components/DiaryTabs/DiaryTabs';
import Stats from '../components/Stats/Stats';
import YearReviewTeaser from '../components/YearReview/YearReviewTeaser';
import { getPathForView } from '../types';
import type { Diary } from '../types';
import type { TagMetadataMap } from '../utils/tagMetadata';

interface StatsRouteProps {
  readonly diaries: Diary[];
  readonly currentDiaryId: number | null;
  readonly onDiaryChange: (diaryId: number | null) => void;
  readonly onManageDiaries: () => void;
  readonly onOpenJournalDay?: (date: string) => void | Promise<void>;
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly tagMetadata?: TagMetadataMap;
  readonly language?: string;
}

function StatsRoute({
  diaries,
  currentDiaryId,
  onDiaryChange,
  onManageDiaries,
  onOpenJournalDay,
  theme,
  t,
  tagMetadata,
  language,
}: Readonly<StatsRouteProps>) {
  const navigate = useNavigate();

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
      <Stats
        teaser={(
          <YearReviewTeaser
            theme={theme}
            onOpen={() => navigate(`${getPathForView('review')}${currentDiaryId ? `?diary=${currentDiaryId}` : ''}`)}
            t={t}
          />
        )}
        theme={theme}
        t={t}
        diaryId={currentDiaryId}
        onOpenJournalDay={onOpenJournalDay}
        onManageDiaries={onManageDiaries}
        tagMetadata={tagMetadata}
        language={language}
      />
    </>
  );
}

export default StatsRoute;