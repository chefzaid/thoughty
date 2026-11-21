import { useCallback, type ComponentProps } from 'react';

import type EntriesList from '../EntriesList/EntriesList';
import type EntryForm from '../EntryForm/EntryForm';
import type { BulkAction, BulkActionOptions } from '../EntriesList/BulkActionBar';
import type { Person } from '../../services/api/peopleService';
import type { Entry, TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { usePeopleCheck } from '../PeopleCheck/usePeopleCheck';
import { entryTexts, rewriteOutcome, useRewriteEntries } from '../PeopleCheck/useRewriteEntries';

type ComposerProps = Pick<ComponentProps<typeof EntryForm>, 'newEntryText' | 'setNewEntryText' | 'title' | 'setTitle' | 'visibility' | 'onSubmit'>;
type ListProps = Pick<
  ComponentProps<typeof EntriesList>,
  'entries' | 'selectedIds' | 'onToggleVisibility' | 'onBulkAction' | 'onSaveEdit'
  | 'editingEntry' | 'editText' | 'setEditText' | 'editTitle' | 'setEditTitle' | 'editVisibility'
>;

interface JournalPeopleCheckOptions<C extends ComposerProps, L extends ListProps> {
  readonly people: readonly Person[];
  readonly entryForm: C;
  readonly entriesList: L;
  readonly onNotify: (message: string) => void;
  readonly theme: 'light' | 'dark';
  readonly language: Language;
  readonly t: TranslationFunction;
}

/** Whether saving the entry editor shares words not shared before: it makes the entry public, or changes a public one. */
function editorShares(
  { editingEntry, editVisibility, editText, editTitle }: Pick<ListProps, 'editingEntry' | 'editVisibility' | 'editText' | 'editTitle'>,
): boolean {
  return editingEntry !== null && editVisibility === 'public' && (
    editingEntry.visibility !== 'public'
    || editText !== editingEntry.content
    || (editTitle ?? '') !== (editingEntry.title ?? '')
  );
}

/**
 * The journal's ways of making an entry public (the composer, the entry editor, an entry's visibility button
 * and the bulk **Make public**), each first checking the people the entry names. In an editor **Replace** changes
 * the words there; on saved entries it saves the new words and leaves the entries private, to read again.
 */
export function useJournalPeopleCheck<C extends ComposerProps, L extends ListProps>({
  people, entryForm, entriesList, onNotify, theme, language, t,
}: JournalPeopleCheckOptions<C, L>): { entryForm: C; entriesList: L; dialog: ReturnType<typeof usePeopleCheck>['dialog'] } {
  const { check, dialog } = usePeopleCheck({ people, theme, language, t });
  const rewrite = useRewriteEntries();

  const replaceSaved = useCallback(async (entries: readonly Entry[], rewritten: Parameters<typeof rewrite>[1]) => {
    onNotify(rewriteOutcome(await rewrite(entries, rewritten), t, language));
  }, [language, onNotify, rewrite, t]);

  const { onSubmit, visibility, title = '', newEntryText, setNewEntryText, setTitle } = entryForm;
  const submit = useCallback((event: Parameters<ComposerProps['onSubmit']>[0]) => {
    if (visibility !== 'public') {
      onSubmit(event);
      return;
    }
    event.preventDefault();
    check({
      texts: [{ key: 'composer', title, text: newEntryText }],
      mode: 'editor',
      share: () => onSubmit(event),
      replace: ([composer]) => {
        if (!composer) return;
        setNewEntryText(composer.text);
        setTitle?.(composer.title);
      },
    });
  }, [check, newEntryText, onSubmit, setNewEntryText, setTitle, title, visibility]);

  const { onSaveEdit, setEditText, setEditTitle, onToggleVisibility, onBulkAction, entries, selectedIds } = entriesList;
  const { editingEntry, editText, editTitle, editVisibility } = entriesList;
  const saveEdit = useCallback(() => {
    if (!editingEntry || !editorShares({ editingEntry, editText, editTitle, editVisibility })) {
      onSaveEdit();
      return;
    }
    check({
      texts: [{ key: editingEntry.id, title: editTitle ?? '', text: editText }],
      mode: 'editor',
      share: onSaveEdit,
      replace: ([edited]) => {
        if (!edited) return;
        setEditText(edited.text);
        setEditTitle?.(edited.title);
      },
    });
  }, [check, editText, editTitle, editVisibility, editingEntry, onSaveEdit, setEditText, setEditTitle]);

  const toggleVisibility = useCallback((entry: Entry) => {
    if (entry.visibility === 'public') {
      onToggleVisibility(entry);
      return;
    }
    check({
      texts: entryTexts([entry]),
      mode: 'saved',
      share: () => onToggleVisibility(entry),
      replace: (rewritten) => void replaceSaved([entry], rewritten),
    });
  }, [check, onToggleVisibility, replaceSaved]);

  const bulkAction = useCallback((action: BulkAction, options?: BulkActionOptions) => {
    if (action !== 'visibility' || options?.visibility !== 'public') {
      onBulkAction?.(action, options);
      return;
    }
    const going = entries.filter((entry) => selectedIds?.has(entry.id) && entry.visibility !== 'public');
    check({
      texts: entryTexts(going),
      mode: 'saved',
      share: () => onBulkAction?.(action, options),
      replace: (rewritten) => void replaceSaved(going, rewritten),
    });
  }, [check, entries, onBulkAction, replaceSaved, selectedIds]);

  return {
    entryForm: { ...entryForm, onSubmit: submit },
    entriesList: {
      ...entriesList,
      onSaveEdit: saveEdit,
      onToggleVisibility: toggleVisibility,
      onBulkAction: onBulkAction && bulkAction,
    },
    dialog,
  };
}
