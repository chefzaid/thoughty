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

  it('keeps the prompt cards drawn in user config, quietly', () => {
    const updateConfig = vi.fn().mockResolvedValue(false);
    const saveConfig = vi.fn();
    const config = { theme: 'dark' as const, name: 'Zaid', promptCardsDrawn: 'people-2' };
    const { entryForm } = buildAuthenticatedRoutesProps(createRoutesParams({ updateConfig, saveConfig, config })).journalRouteProps;

    expect(entryForm.promptCardsDrawn).toBe('people-2');
    expect(entryForm.promptCardsReady).toBe(true);
    entryForm.onPromptCardsDrawnChange?.('people-2,places-5');
    expect(updateConfig).toHaveBeenCalledWith({ ...config, promptCardsDrawn: 'people-2,places-5' });
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it('keeps Draw a card waiting for the settings and never saves a draw over cards it could not read', () => {
    const updateConfig = vi.fn().mockResolvedValue(true);
    const pending = buildAuthenticatedRoutesProps(createRoutesParams({ updateConfig, configLoaded: false, configRead: false }));
    expect(pending.journalRouteProps.entryForm.promptCardsReady).toBe(false);

    // Offline, or after a failed read, cards are drawn but not saved over the history kept on the server
    const unread = buildAuthenticatedRoutesProps(createRoutesParams({ updateConfig, configLoaded: true, configRead: false }));
    expect(unread.journalRouteProps.entryForm.promptCardsReady).toBe(true);
    unread.journalRouteProps.entryForm.onPromptCardsDrawnChange?.('places-5');
    expect(updateConfig).not.toHaveBeenCalled();
  });

  it('saves no change built on the stored settings before they were read, and says so', async () => {
    const updateConfig = vi.fn().mockResolvedValue(true);
    const saveConfig = vi.fn().mockResolvedValue(true);
    const notify = vi.fn();
    const props = buildAuthenticatedRoutesProps(createRoutesParams({
      updateConfig, saveConfig, notify, config: {}, configLoaded: true, configRead: false,
    }));

    await expect(props.profileRouteProps.onUpdateConfig({ theme: 'light', name: 'zaid' })).resolves.toBe(false);
    await expect(props.tagManagerRouteProps.onUpdateConfig({ tagMetadata: '{"new":{"color":"#7C3AED"}}' })).resolves.toBe(false);
    await expect(props.journalRouteProps.entryForm.onDeleteTemplate?.('custom-1')).resolves.toBe(false);
    expect(notify).toHaveBeenCalledTimes(3);
    expect(notify).toHaveBeenCalledWith('settingsUnreadSaveRefused');

    // The template name dialog says itself that the template was not saved
    await expect(props.journalRouteProps.entryForm.onSaveTemplate?.({
      name: 'Meeting', content: 'Notes', tags: [], visibility: 'private', format: 'plain',
    })).resolves.toBe(false);
    expect(notify).toHaveBeenCalledTimes(3);

    // A setting that stands alone is still saved: it replaces nothing else
    await props.memoirRouteProps.onSimpleModeChange?.(true);
    await props.welcomeRouteProps.onFinish();
    expect(saveConfig.mock.calls).toEqual([[{ memoirSimpleMode: true }], [{ onboardingDone: true }]]);
    expect(updateConfig).not.toHaveBeenCalled();
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

  it('writes about a feed entry in the journal’s composer', () => {
    const params = createRoutesParams();
    const { feedRouteProps } = buildAuthenticatedRoutesProps(params);
    feedRouteProps.onWriteAbout?.({
      id: 4, date: '2026-08-01', index: 1, title: null, timeOfDay: null, tags: ['walks'], content: 'A walk', format: 'plain',
      createdAt: '2026-08-01T12:00:00.000Z', commentCount: 0, likeCount: 0, liked: false, saved: false, locked: false,
      author: { id: 2, username: 'maya', avatarUrl: null, isFollowed: false, followRequested: false, approvalRequired: false },
    });
    expect(params.routingState.handleViewChange).toHaveBeenCalledWith('journal', {
      writeAbout: { content: 'A walk', format: 'plain', username: 'maya' },
    });
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

  it('gives the memoir simple mode and saves it with the other settings', async () => {
    const saveConfig = vi.fn().mockResolvedValue(true);
    const config = { theme: 'dark' as const, name: 'Zaid', tagMetadata: '{}', memoirSimpleMode: true };
    const { memoirRouteProps } = buildAuthenticatedRoutesProps(createRoutesParams({ config, saveConfig }));

    expect(memoirRouteProps.simpleMode).toBe(true);
    await expect(memoirRouteProps.onSimpleModeChange?.(false)).resolves.toBe(true);
    expect(saveConfig).toHaveBeenCalledWith({ ...config, memoirSimpleMode: false });
    expect(buildAuthenticatedRoutesProps(createRoutesParams()).memoirRouteProps.simpleMode).toBe(false);
  });

  it('marks the welcome page done with the other settings and gives a diary its first template', async () => {
    const saveConfig = vi.fn().mockResolvedValue(true);
    const handleUpdateDiary = vi.fn().mockResolvedValue(undefined);
    const config = { theme: 'light' as const, name: 'Zaid', tagMetadata: '{}', onboardingDone: false };
    const { welcomeRouteProps } = buildAuthenticatedRoutesProps(createRoutesParams({
      config,
      saveConfig,
      diariesState: { ...createRoutesParams().diariesState, handleUpdateDiary },
    }));

    expect(welcomeRouteProps.theme).toBe('light');
    await expect(welcomeRouteProps.onFinish()).resolves.toBe(true);
    expect(saveConfig).toHaveBeenCalledWith({ ...config, onboardingDone: true });

    await welcomeRouteProps.onSetDiaryTemplate(makeDiary({ id: 2, name: 'Notes', icon: 'N', color: '#2A9D8F' }), 'builtin-gratitude');
    expect(handleUpdateDiary).toHaveBeenLastCalledWith(2, { name: 'Notes', icon: 'N', visibility: 'private', color: '#2A9D8F', defaultTemplateId: 'builtin-gratitude' });
    // A diary without a colour keeps none: the API sets no colour it was not sent
    await welcomeRouteProps.onSetDiaryTemplate(makeDiary({ id: 3, name: 'Plain' }), 'builtin-daily-reflection');
    expect(handleUpdateDiary).toHaveBeenLastCalledWith(3, { name: 'Plain', icon: '📓', visibility: 'private', defaultTemplateId: 'builtin-daily-reflection' });
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
    props.statsRouteProps.onOpenJournalTag?.('family');
    props.statsRouteProps.onSearchJournal?.('jardin');
    props.tasksRouteProps.onManageDiaries();
    props.tasksRouteProps.onDiaryChange(10);
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
    expect(handleManageDiaries).toHaveBeenCalledWith('tasks');
    expect(handleDiaryChange).toHaveBeenCalledWith(10);
    expect(props.tasksRouteProps).toMatchObject({ currentDiaryId: 3, diaries: [expect.objectContaining({ id: 3 })] });
    expect(handleManageDiaries).toHaveBeenCalledWith('importExport');
    expect(handleManageDiaries).toHaveBeenCalledWith('journal');
    expect(handleDiaryChange).toHaveBeenCalledWith(8);
    expect(handleDiaryChange).toHaveBeenCalledWith(9);
    expect(props.statsRouteProps.onOpenJournalDay).toBeDefined();
    expect(props.journalRouteProps.filters.setFilterDateObj).toHaveBeenCalledWith(new Date('2024-01-22T00:00:00.000Z'));
    // A tag opened from the moods shows every entry with it, whatever day was chosen before
    expect(props.journalRouteProps.filters.setFilterTags).toHaveBeenCalledWith(['family']);
    expect(props.journalRouteProps.filters.setFilterDateObj).toHaveBeenLastCalledWith(null);
    // A word from the words used most opens a keyword search for it, over every date
    expect(props.journalRouteProps.filters.setSearchMode).toHaveBeenCalledWith('keyword');
    expect(props.journalRouteProps.filters.setSearch).toHaveBeenCalledWith('jardin');
    expect(handleViewChange).toHaveBeenCalledWith('journal');
    expect(handleImportExportRouteStateChange).toHaveBeenCalledWith({
      section: 'import',
      exportFormat: 'json',
      includeVisibility: true,
    });
  });

  it('hands the journal the infinite scroll of the list', () => {
    const params = createRoutesParams();
    const { feed } = buildAuthenticatedRoutesProps(params).journalRouteProps;

    expect(feed).toBe(params.entriesState.feed);
  });

  it('offers no AI action in the composer while it writes into a diary with AI off', () => {
    const on = createRoutesParams();
    expect(buildAuthenticatedRoutesProps(on).journalRouteProps.entryForm).toMatchObject({
      onSuggestTags: on.entryFormState.handleSuggestTags,
      onFixWriting: on.entryFormState.handleFixWriting,
    });

    const off = createRoutesParams();
    const { entryForm } = buildAuthenticatedRoutesProps({ ...off, entryFormState: { ...off.entryFormState, diaryAiMode: 'off' } }).journalRouteProps;
    expect(entryForm.onSuggestTags).toBeUndefined();
    expect(entryForm.onFixWriting).toBeUndefined();
    expect(entryForm.onGetInspiration).toBeUndefined();
  });

  it('keeps Auto Tag and Rephrase in a composer whose diary asks each time, but not Get Inspired', () => {
    const ask = createRoutesParams();
    const { entryForm } = buildAuthenticatedRoutesProps({ ...ask, entryFormState: { ...ask.entryFormState, diaryAiMode: 'ask' } }).journalRouteProps;
    expect(entryForm.onSuggestTags).toBe(ask.entryFormState.handleSuggestTags);
    expect(entryForm.onFixWriting).toBe(ask.entryFormState.handleFixWriting);
    expect(entryForm.onGetInspiration).toBeUndefined();
  });

  it('offers Auto Tag, Rephrase and Get Inspired in a composer whose diary is on the writer’s own model', () => {
    const local = createRoutesParams();
    const handleGetInspiration = vi.fn();
    const { entryForm } = buildAuthenticatedRoutesProps({
      ...local, handleGetInspiration, entryFormState: { ...local.entryFormState, diaryAiMode: 'local' },
    }).journalRouteProps;
    expect(entryForm.onSuggestTags).toBe(local.entryFormState.handleSuggestTags);
    expect(entryForm.onFixWriting).toBe(local.entryFormState.handleFixWriting);
    expect(entryForm.onGetInspiration).toBe(handleGetInspiration);
  });
});
