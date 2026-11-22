import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import type { Person } from '../../services/api/peopleService';
import type { TranslationFunction } from '../../types';
import { formatEraDate } from '../../utils/lifeEras';
import { personJournalPath } from '../../utils/mentions';
import {
  formatPersonDate,
  personDateDraft,
  readPersonDateDraft,
  samePersonDate,
  type PersonDateInput,
} from '../../utils/personDates';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { reachOutDraft, readReachOutDraft, type ReachOutDays } from '../../utils/personReachOut';
import { writersToday } from '../../utils/entryDate';
import { mutedTextClass } from '../../utils/tintedText';
import type { Language } from '../../utils/translations';
import PersonDateFields from './PersonDateFields';
import PersonNotesField, { PERSON_NOTES_MAX_LENGTH } from './PersonNotesField';
import PersonReachOutFields from './PersonReachOutFields';

/** The longest name the server keeps for a person. */
const MAX_NAME_LENGTH = 80;

/** What the editor saves: the name shown, and the date, reminder, last contact and notes that changed (null removes each). */
export interface PersonChanges {
  readonly name: string;
  readonly date?: PersonDateInput | null;
  readonly reachOutDays?: ReachOutDays | null;
  readonly lastContactOn?: string | null;
  readonly notes?: string | null;
}

type EditorField = 'name' | 'date' | 'reachOut' | 'notes';

/** The field a code the API refuses a save with is about: PERSON_DATE_* the date, PERSON_CONTACT_* the last contact. */
function failedField(failure: string): EditorField {
  if (failure.startsWith('apiError_PERSON_DATE_')) return 'date';
  return failure.startsWith('apiError_PERSON_CONTACT_') ? 'reachOut' : 'name';
}

interface PersonRowProps {
  readonly person: Person;
  readonly canMerge: boolean;
  readonly theme: 'light' | 'dark';
  readonly language: Language;
  readonly t: TranslationFunction;
  /** Resolves the translation key of why the save failed, or null once saved. */
  readonly onSave: (changes: PersonChanges) => Promise<string | null>;
  readonly onMerge: () => void;
  readonly onDelete: () => void;
}

/**
 * One person on the People page: their name opens their entries; the name shown, their birthday or
 * anniversary, their reach-out reminder and the writer's notes on them can be changed in place.
 */
export default function PersonRow({ person, canMerge, theme, language, t, onSave, onMerge, onDelete }: PersonRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.name);
  const [dateDraft, setDateDraft] = useState(() => personDateDraft(person.date));
  const [reachOut, setReachOut] = useState(() => reachOutDraft(person));
  const [notes, setNotes] = useState(person.notes ?? '');
  const [error, setError] = useState<{ field: EditorField; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const kindRef = useRef<HTMLSelectElement>(null);
  const lastContactRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const today = writersToday();
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();
  const errorId = useId();
  const isDark = theme === 'dark';
  const muted = mutedTextClass(isDark);
  const iconButton = `grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${isDark
    ? 'border-gray-600 bg-gray-900 text-gray-200 hover:bg-gray-800'
    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'}`;

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEditing = () => {
    setName(person.name);
    setDateDraft(personDateDraft(person.date));
    setReachOut(reachOutDraft(person));
    setNotes(person.notes ?? '');
    setEditing(true);
  };

  const stopEditing = () => {
    setEditing(false);
    setError(null);
    globalThis.setTimeout(() => editButtonRef.current?.focus(), 0);
  };

  const fail = (field: EditorField, message: string) => {
    setError({ field, message });
    ({ name: inputRef, date: kindRef, reachOut: lastContactRef, notes: notesRef })[field].current?.focus();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      fail('name', t('personNameRequired'));
      return;
    }
    const read = readPersonDateDraft(dateDraft);
    if ('error' in read) {
      fail('date', t(read.error));
      return;
    }
    const readReachOut = readReachOutDraft(reachOut, today);
    if ('error' in readReachOut) {
      fail('reachOut', t(readReachOut.error));
      return;
    }
    const savedNotes = notes.trim() || null;
    // Notes a merge joined past the limit stay as they are until the writer changes them
    if (savedNotes !== person.notes && savedNotes && savedNotes.length > PERSON_NOTES_MAX_LENGTH) {
      fail('notes', t('personNotesTooLong', { max: PERSON_NOTES_MAX_LENGTH.toLocaleString(language) }));
      return;
    }
    if (saving) return;
    const changes: PersonChanges = {
      name: trimmed,
      ...(samePersonDate(read.date, person.date) ? {} : { date: read.date }),
      ...(readReachOut.reachOutDays === person.reachOutDays ? {} : { reachOutDays: readReachOut.reachOutDays }),
      ...(readReachOut.lastContactOn === person.lastContactOn ? {} : { lastContactOn: readReachOut.lastContactOn }),
      ...(savedNotes === person.notes ? {} : { notes: savedNotes }),
    };
    let failure: string | null = null;
    if (trimmed !== person.name || Object.keys(changes).length > 1) {
      setSaving(true);
      failure = await onSave(changes);
      setSaving(false);
    }
    if (failure) {
      fail(failedField(failure), t(failure));
      return;
    }
    stopEditing();
  };

  const details = [
    pluralPhrase(t, 'personEntryCount', person.entryCount, language),
    person.lastMentionedOn ? t('personLastMentioned', { date: formatEraDate(person.lastMentionedOn, language) }) : null,
  ].filter(Boolean).join(' · ');
  const reachOutLine = [
    person.reachOutDays === null ? null : t('reachOutShown', { interval: t(`reachOutAfter_${person.reachOutDays}`) }),
    person.lastContactOn ? t('reachOutLastContactShown', { date: formatEraDate(person.lastContactOn, language) }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <li className={`rounded-lg border px-4 py-3 ${isDark ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-white'}`}>
      {editing ? (
        <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-2"
          onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); stopEditing(); } }}>
          <div className="min-w-[12rem]">
            <label htmlFor={inputId} className={`mb-1 block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              {t('personNameLabel', { handle: `@${person.handles[0] ?? ''}` })}
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={error?.field === 'name'}
              aria-describedby={error?.field === 'name' ? errorId : undefined}
              autoComplete="off"
              className={`h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${isDark
                ? 'border-gray-700 bg-gray-900 text-gray-100'
                : 'border-gray-300 bg-gray-50 text-gray-900'}`}
            />
            <p className={`mt-1 text-xs ${muted}`}>{t('personNameHelp')}</p>
          </div>
          <PersonDateFields
            name={name.trim() || person.name}
            draft={dateDraft}
            onChange={setDateDraft}
            isDark={isDark}
            language={language}
            t={t}
            errorId={error?.field === 'date' ? errorId : undefined}
            kindRef={kindRef}
          />
          <PersonReachOutFields
            name={name.trim() || person.name}
            draft={reachOut}
            onChange={setReachOut}
            today={today}
            isDark={isDark}
            t={t}
            errorId={error?.field === 'reachOut' ? errorId : undefined}
            lastContactRef={lastContactRef}
          />
          <PersonNotesField
            name={name.trim() || person.name}
            value={notes}
            onChange={setNotes}
            isDark={isDark}
            language={language}
            t={t}
            errorId={error?.field === 'notes' ? errorId : undefined}
            textareaRef={notesRef}
          />
          {error && <p id={errorId} role="alert" className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error.message}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="h-10 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
              {saving ? t('personSaving') : t('save')}
            </button>
            <button type="button" onClick={stopEditing} className={`h-10 rounded-lg border px-4 text-sm font-medium ${isDark ? 'border-gray-600 text-gray-200' : 'border-gray-300 text-gray-700'}`}>
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link to={personJournalPath(person.id)} className="entry-mention-link text-base font-semibold break-words" title={t('personMentionTitle', { name: person.name })}>
              {person.name}
            </Link>
            <p className={`text-sm break-words ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {person.handles.map((handle) => `@${handle}`).join(', ')}
            </p>
            {person.date && (
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('personDateShown', { kind: t(`personDateKind_${person.date.kind}`), date: formatPersonDate(person.date, language) })}
              </p>
            )}
            {reachOutLine && <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{reachOutLine}</p>}
            {person.notes && (
              <p className={`privacy-text my-1 whitespace-pre-wrap break-words text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                <span className="sr-only">{t('personNotesLabel')}: </span>
                {person.notes}
              </p>
            )}
            <p className={`text-xs ${muted}`}>{details}</p>
          </div>
          <div className="flex gap-2">
            <button ref={editButtonRef} type="button" className={iconButton} onClick={startEditing}
              aria-label={t('personEdit', { name: person.name })} title={t('personEdit', { name: person.name })}>
              <span className="codicon codicon-edit" aria-hidden="true" />
            </button>
            {canMerge && (
              <button type="button" className={iconButton} onClick={onMerge}
                aria-label={t('personMerge', { name: person.name })} title={t('personMerge', { name: person.name })}>
                <span className="codicon codicon-merge" aria-hidden="true" />
              </button>
            )}
            <button type="button" className={`${iconButton} ${isDark ? 'text-red-300' : 'text-red-700'}`} onClick={onDelete}
              aria-label={t('personDelete', { name: person.name })} title={t('personDelete', { name: person.name })}>
              <span className="codicon codicon-trash" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
