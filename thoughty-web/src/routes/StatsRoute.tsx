import DiaryTabs from '../components/DiaryTabs/DiaryTabs';
import Stats from '../components/Stats/Stats';
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
}: Readonly<StatsRouteProps>) {
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
        theme={theme}
        t={t}
        diaryId={currentDiaryId}
        onOpenJournalDay={onOpenJournalDay}
        tagMetadata={tagMetadata}
      />
    </>
  );
}

export default StatsRoute;