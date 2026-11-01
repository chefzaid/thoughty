import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import DiaryTabs from '../components/DiaryTabs/DiaryTabs';
import ImportExport from '../components/ImportExport/ImportExport';
import type { Diary, ImportExportFormat, ImportExportSection } from '../types';
import { resolveLanguage } from '../utils/language';
import { readBookConverterStart } from '../utils/appRouting';

interface ImportExportRouteProps {
  readonly diaries: Diary[];
  readonly currentDiaryId: number | null;
  readonly onDiaryChange: (diaryId: number | null) => void;
  readonly onManageDiaries: () => void;
  readonly onDiariesChanged?: () => void;
  readonly theme?: 'light' | 'dark';
  readonly language?: string;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly initialSection: ImportExportSection;
  readonly initialExportFormat: ImportExportFormat;
  readonly initialIncludeVisibility: boolean;
  readonly onRouteStateChange: (state: {
    section: ImportExportSection;
    exportFormat: ImportExportFormat;
    includeVisibility: boolean;
  }) => void;
}

function ImportExportRoute({
  diaries,
  currentDiaryId,
  onDiaryChange,
  onManageDiaries,
  onDiariesChanged,
  theme,
  language,
  t,
  initialSection,
  initialExportFormat,
  initialIncludeVisibility,
  onRouteStateChange,
}: Readonly<ImportExportRouteProps>) {
  const { state } = useLocation();
  // A Make a book action opens the converter on the entries picked in the journal, or on a person's saved search
  const bookStart = useMemo(() => readBookConverterStart(state), [state]);
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
      <ImportExport
        theme={theme}
        t={t}
        language={resolveLanguage(language)}
        diaryId={currentDiaryId}
        diaryName={diaries.find((diary) => diary.id === currentDiaryId)?.name || t('allDiaries')}
        onDiariesChanged={onDiariesChanged}
        initialSection={initialSection}
        initialExportFormat={initialExportFormat}
        initialIncludeVisibility={initialIncludeVisibility}
        initialBookStart={bookStart}
        onRouteStateChange={onRouteStateChange}
      />
    </>
  );
}

export default ImportExportRoute;