import { describe, expect, it, vi } from 'vitest';
import { buildAuthenticatedRoutesProps } from './appShellProps';
import { createRoutesParams, createRoutingState } from './appShellProps.test-helpers';
import { makeDiary } from '../test/diaryFixture';

describe('appShellProps', () => {
  it('wires entry templates through user config', async () => {
    const updateConfig = vi.fn().mockResolvedValue(true);
    const saveConfig = vi.fn().mockResolvedValue(false);
    const props = buildAuthenticatedRoutesProps(createRoutesParams({
      updateConfig,
      saveConfig,
      config: {
        theme: 'dark',
        name: 'Zaid',
        tagMetadata: '{}',
        entryTemplates: JSON.stringify([{
          id: 'custom-1',
          name: 'Review',
          content: 'Wins:',
          tags: ['review'],
          visibility: 'private',
          format: 'plain',
        }]),
      },
    }));

    expect(props.journalRouteProps.entryForm.entryTemplates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'builtin-gratitude' }),
        expect.objectContaining({ id: 'custom-1', name: 'Review' }),
      ]),
    );

    // The name dialog reports a failed save itself, so saving a template goes through the quiet update
    await expect(props.journalRouteProps.entryForm.onSaveTemplate?.({
      name: 'Meeting',
      content: 'Notes',
      tags: ['meeting'],
      visibility: 'public',
      format: 'markdown',
    })).resolves.toBe(true);
    expect(updateConfig).toHaveBeenLastCalledWith(expect.objectContaining({
      entryTemplates: expect.stringContaining('Meeting'),
    }));

    // Deleting one has no dialog, so a failure is reported by the app's notice
    await expect(props.journalRouteProps.entryForm.onDeleteTemplate?.('custom-1')).resolves.toBe(false);
    expect(saveConfig).toHaveBeenLastCalledWith(expect.objectContaining({
      entryTemplates: expect.not.stringContaining('custom-1'),
    }));
    expect(updateConfig).toHaveBeenCalledTimes(1);
  });

  it('gives the feed the reading-aloud settings', () => {
    const readingProps = buildAuthenticatedRoutesProps(createRoutesParams({
      config: { theme: 'light', name: 'Zaid', language: 'fr', readDates: false, ttsVoiceUri: 'voice-1' },
    })).feedRouteProps;
    expect(readingProps).toMatchObject({ theme: 'light', language: 'fr', readDates: false, ttsVoiceUri: 'voice-1' });

    const defaultProps = buildAuthenticatedRoutesProps(createRoutesParams({
      config: { theme: 'dark', name: 'Zaid' },
    })).feedRouteProps;
    expect(defaultProps.readDates).toBe(true);
  });

  it('offers created tags in the composer and editor but filters only by used tags', () => {
    const props = buildAuthenticatedRoutesProps(createRoutesParams({
      tagMetadata: { gratitude: { color: '#2563EB' }, focus: { color: '#DC2626' } },
    }));

    expect(props.journalRouteProps.entryForm.allTags).toEqual(['focus', 'gratitude', 'work']);
    expect(props.journalRouteProps.entriesList.allTags).toEqual(['focus', 'gratitude', 'work']);
    expect(props.journalRouteProps.filters.allTags).toEqual(['focus', 'work']);
  });

  it('gives the memoir the diaries, the interface language, and a way to refresh diaries', async () => {
    const fetchDiaries = vi.fn().mockResolvedValue(undefined);
    const diaries = [makeDiary({ id: 3, name: 'Work', icon: 'W' })];
    const props = buildAuthenticatedRoutesProps(createRoutesParams({
      config: { theme: 'light', name: 'Zaid', tagMetadata: '{}', language: 'fr' },
      diariesState: { ...createRoutesParams().diariesState, diaries, fetchDiaries },
    }));

    expect(props.memoirRouteProps).toEqual(expect.objectContaining({ theme: 'light', language: 'fr', diaries }));
    await props.memoirRouteProps.onDiariesChanged();
    expect(fetchDiaries).toHaveBeenCalled();
  });

  it('wires profile, tag manager, diary management, and import-export callbacks', async () => {
    const saveConfig = vi.fn().mockResolvedValue(true);
    const downloadUserData = vi.fn().mockResolvedValue(true);
    const handleRenameTag = vi.fn().mockResolvedValue(true);
    const handleDeleteDiary = vi.fn().mockImplementation(async (_id: number, callback: () => Promise<void>) => {
      await callback();
    });
    const handleManageDiaries = vi.fn();
    const handleDiaryChange = vi.fn();
    const handleImportExportRouteStateChange = vi.fn();
    const handleViewChange = vi.fn();
    const fetchEntries = vi.fn().mockResolvedValue(undefined);

    const props = buildAuthenticatedRoutesProps(createRoutesParams({
      saveConfig,
      downloadUserData,
      handleRenameTag,
      diariesState: {
        currentDiaryId: 3,
        diaries: [makeDiary({ id: 3, name: 'Work', icon: 'W' })],
        fetchDiaries: vi.fn().mockResolvedValue(undefined),
        handleCreateDiary: vi.fn().mockResolvedValue(undefined),
        handleDeleteDiary,
        handleReorderDiaries: vi.fn().mockResolvedValue(undefined),
        handleSetDefaultDiary: vi.fn().mockResolvedValue(undefined),
        handleUpdateDiary: vi.fn().mockResolvedValue(undefined),
      },
      entriesState: {
        ...createRoutesParams().entriesState,
        fetchEntries,
      },
      routingState: createRoutingState({
        handleDiaryChange,
        handleImportExportRouteStateChange,
        handleManageDiaries,
        handleViewChange,
      }),
    }));

    await props.profileRouteProps.onUpdateConfig({ theme: 'light' } as never);
    await props.tagManagerRouteProps.onUpdateConfig({ theme: 'light' } as never);
    await props.profileRouteProps.onDownloadData();
    await props.tagManagerRouteProps.onRenameTag('old', 'new');
    await props.diariesRouteProps.onDeleteDiary(3);

    props.statsRouteProps.onManageDiaries();
    props.statsRouteProps.onDiaryChange(8);
    props.statsRouteProps.onOpenJournalDay?.('2024-01-22');
    props.importExportRouteProps.onManageDiaries();
    props.importExportRouteProps.onDiaryChange(9);
    props.importExportRouteProps.onRouteStateChange?.({
      section: 'import',
      exportFormat: 'json',
      includeVisibility: true,
    });
    props.journalRouteProps.diaryTabs.onManageDiaries();

    expect(saveConfig).toHaveBeenCalledTimes(2);
    expect(downloadUserData).toHaveBeenCalledTimes(1);
    expect(handleRenameTag).toHaveBeenCalledWith('old', 'new');
    expect(handleDeleteDiary).toHaveBeenCalledWith(3, expect.any(Function));
    expect(fetchEntries).toHaveBeenCalled();
    expect(handleManageDiaries).toHaveBeenCalledWith('stats');
    expect(handleManageDiaries).toHaveBeenCalledWith('importExport');
    expect(handleManageDiaries).toHaveBeenCalledWith('journal');
    expect(handleDiaryChange).toHaveBeenCalledWith(8);
    expect(handleDiaryChange).toHaveBeenCalledWith(9);
    expect(props.statsRouteProps.onOpenJournalDay).toBeDefined();
    expect(props.journalRouteProps.filters.setFilterDateObj).toHaveBeenCalledWith(new Date('2024-01-22T00:00:00.000Z'));
    expect(props.journalRouteProps.filters.setPage).toHaveBeenCalledWith(1);
    expect(handleViewChange).toHaveBeenCalledWith('journal');
    expect(handleImportExportRouteStateChange).toHaveBeenCalledWith({
      section: 'import',
      exportFormat: 'json',
      includeVisibility: true,
    });
  });
});
