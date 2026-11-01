import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { COMPOSER_FOCUS_STATE } from '../components/JournalView/composerFocusRoute';
import { useQuickCapture, type QuickCaptureState } from '../components/QuickCapture/useQuickCapture';
import type { createEntriesService } from '../services/api/entriesService';
import { getPathForView, type ViewType } from '../types';
import { ENTRY_PERMALINK_PARAM, toSearchString } from '../utils/appRouting';
import type { Notifier } from './useAppNotice';

interface AppQuickCaptureOptions {
  readonly entriesService: Pick<ReturnType<typeof createEntriesService>, 'createEntry'>;
  readonly notifier: Notifier;
  readonly currentView: ViewType | null;
  /** The current address's query, which the journal keeps when quick capture opens its composer there. */
  readonly searchParams: URLSearchParams;
  readonly navigate: NavigateFunction;
  readonly openView: (view: ViewType, state?: unknown) => void;
  /** The composer's text, which **Open in full** adds the captured text to. */
  readonly setComposerText: Dispatch<SetStateAction<string>>;
  /** Runs after a save, so the journal and the views measured from it read the new entry. */
  readonly onSaved: () => void;
}

/** The address of an entry in the journal, as the app's own link (the permalink without its origin). */
export function entryPermalinkPath(entryId: number): string {
  return `${getPathForView('journal')}${toSearchString(new URLSearchParams({ [ENTRY_PERMALINK_PARAM]: String(entryId) }))}`;
}

/** The composer's text with the captured text added after it, a blank line apart, so nothing written there is lost. */
export function appendToDraft(draft: string, text: string): string {
  if (!text) return draft;
  return draft.trim() ? `${draft.trimEnd()}\n\n${text}` : text;
}

/** Quick capture in the signed-in app: its saved entry opens in the journal, and **Open in full** goes on in the composer. */
export function useAppQuickCapture({
  entriesService,
  notifier,
  currentView,
  searchParams,
  navigate,
  openView,
  setComposerText,
  onSaved,
}: AppQuickCaptureOptions): QuickCaptureState {
  const onOpenEntry = useCallback((entryId: number) => {
    navigate(entryPermalinkPath(entryId));
  }, [navigate]);

  const onOpenInFull = useCallback((text: string) => {
    setComposerText((draft) => appendToDraft(draft, text));
    if (currentView === 'journal') {
      // The journal stays as it is (diary, filters, page); only focus moves to the composer
      navigate({ pathname: getPathForView('journal'), search: toSearchString(searchParams) }, { state: COMPOSER_FOCUS_STATE });
    } else {
      openView('journal', COMPOSER_FOCUS_STATE);
    }
  }, [currentView, navigate, openView, searchParams, setComposerText]);

  return useQuickCapture({
    entriesService,
    notifier,
    onSaved,
    entryPath: entryPermalinkPath,
    onOpenEntry,
    onOpenInFull,
  });
}
