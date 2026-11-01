import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from 'react';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import type EntryForm from '../EntryForm/EntryForm';
import type { Entry, TranslationFunction } from '../../types';
import { entryStartingPoint, hasComposerDraft } from '../../utils/entryStartingPoint';
import { resolveLanguage } from '../../utils/language';
import { entryReplyDraft } from '../EntriesList/entryReply';

type ComposerState = Pick<ComponentProps<typeof EntryForm>,
  'newEntryText' | 'setNewEntryText' | 'title' | 'setTitle' | 'timeOfDay' | 'setTimeOfDay' | 'mood' | 'setMood'
  | 'feelings' | 'setFeelings' | 'tags' | 'setTags' | 'timeCapsule' | 'setTimeCapsule' | 'setVisibility' | 'setFormat'>
  & Partial<Pick<ComponentProps<typeof EntryForm>, 'setSelectedDate'>>;

interface ComposerSeedOptions {
  readonly composer: ComposerState;
  /** The visibility a new entry starts with; the source entry's own is never copied. */
  readonly defaultVisibility?: 'public' | 'private';
  /** Wraps the new entry form, which is scrolled to and whose writing field takes focus. */
  readonly formRef: RefObject<HTMLElement | null>;
  /** The writer's language, for the quotation marks of a reply to a plain entry. */
  readonly language?: string;
  readonly theme?: 'light' | 'dark';
  readonly t: TranslationFunction;
}

/** What the new entry form is filled with, and why (which the replace warning says). */
interface ComposerSeed {
  readonly kind: 'startingPoint' | 'reply';
  readonly text: string;
  readonly tags: string[];
  readonly format: 'plain' | 'markdown';
  /** Set when the entry is kept private whatever the default visibility. */
  readonly privateOnly?: boolean;
  /** Set when the new entry goes on today rather than on the date already picked. */
  readonly today?: boolean;
}

/** How long the Markdown editor may take to load on first use before focus stops following it. */
const EDITOR_LOAD_WINDOW_MS = 3000;

const REPLACE_MESSAGES = {
  startingPoint: 'startFromEntryReplaceMessage',
  reply: 'replyReplaceMessage',
} as const;

/**
 * Fills the new entry form from an entry, then scrolls to it and focuses its writing field. A draft
 * already there is replaced only once the writer confirms.
 * - **Use as a starting point**: the entry's text, tags and format (see `entryStartingPoint`), with the
 *   default visibility.
 * - **Write a reply**: a short quote of the entry and a `[[date#n]]` link to it (see `entryReplyDraft`),
 *   on today, in the entry's format, with no tags, and private when the quoted entry is private, so a
 *   public default never publishes its words.
 */
export function useComposerSeed({ composer, defaultVisibility, formRef, language, theme, t }: ComposerSeedOptions): {
  startFromEntry: (entry: Entry) => void;
  replyToEntry: (entry: Entry) => void;
  /** Scrolls to the form and focuses its writing field, the caret after the text. */
  focusComposer: () => void;
  dialog: ReactNode;
} {
  const [pendingSeed, setPendingSeed] = useState<ComposerSeed | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  // The latest form state, so the actions stay the same functions and the entry cards need not re-render
  const latest = useRef({ composer, defaultVisibility, language });
  latest.current = { composer, defaultVisibility, language };

  const focusComposer = useCallback(() => setFocusRequest((count) => count + 1), []);

  const applySeed = useCallback((seed: ComposerSeed) => {
    const { composer: form, defaultVisibility: visibility } = latest.current;
    form.setNewEntryText(seed.text);
    form.setTags(seed.tags);
    form.setFormat(seed.format);
    form.setVisibility(seed.privateOnly ? 'private' : visibility ?? 'private');
    if (seed.today) {
      form.setSelectedDate?.(new Date());
    }
    form.setTitle?.('');
    form.setTimeOfDay?.('');
    form.setMood?.(null);
    form.setFeelings?.([]);
    form.setTimeCapsule?.(null);
    focusComposer();
  }, [focusComposer]);

  const seedComposer = useCallback((seed: ComposerSeed | null) => {
    if (!seed) {
      return;
    }
    if (hasComposerDraft(latest.current.composer)) {
      setPendingSeed(seed);
    } else {
      applySeed(seed);
    }
  }, [applySeed]);

  const startFromEntry = useCallback((entry: Entry) => {
    const draft = entryStartingPoint(entry);
    seedComposer(draft && { kind: 'startingPoint', ...draft });
  }, [seedComposer]);

  const replyToEntry = useCallback((entry: Entry) => {
    const draft = entryReplyDraft(entry, resolveLanguage(latest.current.language));
    seedComposer(draft && { kind: 'reply', ...draft, tags: [], privateOnly: entry.visibility === 'private', today: true });
  }, [seedComposer]);

  useEffect(() => {
    const container = formRef.current;
    if (focusRequest === 0 || !container) {
      return undefined;
    }

    // The caret goes to the end, under the quote of a reply, ready to write on
    const focusField = () => {
      const field = container.querySelector('textarea');
      field?.focus({ preventScroll: true });
      field?.setSelectionRange(field.value.length, field.value.length);
    };
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
      isOpen={pendingSeed !== null}
      onClose={() => setPendingSeed(null)}
      onConfirm={() => {
        if (pendingSeed) {
          applySeed(pendingSeed);
        }
        setPendingSeed(null);
      }}
      title={t('startFromEntryReplaceTitle')}
      message={t(REPLACE_MESSAGES[pendingSeed?.kind ?? 'startingPoint'])}
      confirmLabel={t('startFromEntryReplaceConfirm')}
      theme={theme}
      t={t}
    />
  );

  return { startFromEntry, replyToEntry, focusComposer, dialog };
}
