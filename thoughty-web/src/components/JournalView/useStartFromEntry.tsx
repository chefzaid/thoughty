import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from 'react';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import type EntryForm from '../EntryForm/EntryForm';
import type { Entry, TranslationFunction } from '../../types';
import { entryStartingPoint, hasComposerDraft, type EntryStartingPoint } from '../../utils/entryStartingPoint';

type ComposerState = Pick<ComponentProps<typeof EntryForm>,
  'newEntryText' | 'setNewEntryText' | 'title' | 'setTitle' | 'timeOfDay' | 'setTimeOfDay' | 'mood' | 'setMood'
  | 'feelings' | 'setFeelings' | 'tags' | 'setTags' | 'timeCapsule' | 'setTimeCapsule' | 'setVisibility' | 'setFormat'>;

interface StartFromEntryOptions {
  readonly composer: ComposerState;
  /** The visibility a new entry starts with; the source entry's own is never copied. */
  readonly defaultVisibility?: 'public' | 'private';
  /** Wraps the new entry form, which is scrolled to and whose writing field takes focus. */
  readonly formRef: RefObject<HTMLElement | null>;
  readonly theme?: 'light' | 'dark';
  readonly t: TranslationFunction;
}

/** How long the Markdown editor may take to load on first use before focus stops following it. */
const EDITOR_LOAD_WINDOW_MS = 3000;

/**
 * **Use as a starting point**: an entry's text, tags and format fill the new entry form as a fresh
 * draft (see `entryStartingPoint`), with the default visibility. A draft already there is replaced
 * only once the writer confirms.
 */
export function useStartFromEntry({ composer, defaultVisibility, formRef, theme, t }: StartFromEntryOptions): {
  startFromEntry: (entry: Entry) => void;
  dialog: ReactNode;
} {
  const [pendingDraft, setPendingDraft] = useState<EntryStartingPoint | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  // The latest form state, so the action stays the same function and the entry cards need not re-render
  const latest = useRef({ composer, defaultVisibility });
  latest.current = { composer, defaultVisibility };

  const applyDraft = useCallback((draft: EntryStartingPoint) => {
    const { composer: form, defaultVisibility: visibility } = latest.current;
    form.setNewEntryText(draft.text);
    form.setTags(draft.tags);
    form.setFormat(draft.format);
    form.setVisibility(visibility ?? 'private');
    form.setTitle?.('');
    form.setTimeOfDay?.('');
    form.setMood?.(null);
    form.setFeelings?.([]);
    form.setTimeCapsule?.(null);
    setFocusRequest((count) => count + 1);
  }, []);

  const startFromEntry = useCallback((entry: Entry) => {
    const draft = entryStartingPoint(entry);
    if (!draft) {
      return;
    }
    if (hasComposerDraft(latest.current.composer)) {
      setPendingDraft(draft);
    } else {
      applyDraft(draft);
    }
  }, [applyDraft]);

  useEffect(() => {
    const container = formRef.current;
    if (focusRequest === 0 || !container) {
      return undefined;
    }

    const focusField = () => container.querySelector('textarea')?.focus({ preventScroll: true });
    container.scrollIntoView?.({ block: 'start' });
    focusField();
    // The Markdown editor loads on first use and takes the place of the field focused meanwhile
    const observer = new MutationObserver(() => {
      if (document.activeElement === null || document.activeElement === document.body) {
        focusField();
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    const stopWatching = globalThis.setTimeout(() => observer.disconnect(), EDITOR_LOAD_WINDOW_MS);
    return () => {
      observer.disconnect();
      globalThis.clearTimeout(stopWatching);
    };
  }, [focusRequest, formRef]);

  const dialog = (
    <ConfirmModal
      isOpen={pendingDraft !== null}
      onClose={() => setPendingDraft(null)}
      onConfirm={() => {
        if (pendingDraft) {
          applyDraft(pendingDraft);
        }
        setPendingDraft(null);
      }}
      title={t('startFromEntryReplaceTitle')}
      message={t('startFromEntryReplaceMessage')}
      confirmLabel={t('startFromEntryReplaceConfirm')}
      theme={theme}
      t={t}
    />
  );

  return { startFromEntry, dialog };
}
