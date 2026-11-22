import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import type { Person } from '../../services/api/peopleService';
import type { TranslationFunction } from '../../types';
import { formatEraDate } from '../../utils/lifeEras';
import { personJournalPath } from '../../utils/mentions';
import {
  formatPersonDate,
  personDateDrafts,
  PERSON_DATES_MAX,
  readPersonDateDrafts,
  samePersonDates,
  type PersonDate,
  type PersonDateDraft,
  type PersonDateInput,
} from '../../utils/personDates';
import {
  addPersonGroup,
  personGroupKey,
  PERSON_GROUPS_MAX,
  samePersonGroups,
  type PersonGroupSummary,
} from '../../utils/personGroups';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { reachOutDraft, readReachOutDraft, type ReachOutDays } from '../../utils/personReachOut';
import { writersToday } from '../../utils/entryDate';
import { mutedTextClass } from '../../utils/tintedText';
import type { Language } from '../../utils/translations';
import PersonDatesFields from './PersonDatesFields';
import PersonGroupsField from './PersonGroupsField';
import PersonNotesField, { PERSON_NOTES_MAX_LENGTH } from './PersonNotesField';
import PersonMentionsOverTime from './PersonMentionsOverTime';
import PersonReachOutFields from './PersonReachOutFields';

/** The longest name the server keeps for a person. */
const MAX_NAME_LENGTH = 80;

/**
 * What the editor saves: the name shown, and the reminder, last contact and notes that changed (null removes each),
 * and the dates and the groups when they changed.
 */
export interface PersonChanges {
  readonly name: string;
  readonly dates?: PersonDateInput[];
  readonly reachOutDays?: ReachOutDays | null;
  readonly lastContactOn?: string | null;
  readonly notes?: string | null;
  readonly groups?: string[];
}

type EditorField = 'name' | 'date' | 'reachOut' | 'notes' | 'groups';

/** The field a code the API refuses a save with is about: PERSON_DATE_* the date, PERSON_CONTACT_* the last contact. */
function failedField(failure: string): EditorField {
  if (failure.startsWith('apiError_PERSON_DATE_')) return 'date';
  return failure.startsWith('apiError_PERSON_CONTACT_') ? 'reachOut' : 'name';
}

interface PersonRowProps {
  readonly person: Person;
  readonly canMerge: boolean;
  /** Every group of the writer's, with how many people are in each. */
  readonly groups: readonly PersonGroupSummary[];
  readonly theme: 'light' | 'dark';
  readonly language: Language;
  readonly t: TranslationFunction;
  /** Resolves the translation key of why the save failed, or null once saved. */
  readonly onSave: (changes: PersonChanges) => Promise<string | null>;
  readonly onMerge: () => void;
  readonly onDelete: () => void;
}

/** A person's date on their row: "Birthday: March 14, 1992", or "Anniversary (Wedding): June 2, 2012" with a label. */
function dateLine(date: PersonDate, language: Language, t: TranslationFunction): string {
  const params = { kind: t(`personDateKind_${date.kind}`), date: formatPersonDate(date, language) };
  return date.label ? t('personDateShownLabeled', { ...params, label: date.label }) : t('personDateShown', params);
}

/**
 * One person on the People page: their name opens their entries; the name shown, their birthday and
 * anniversaries, their reach-out reminder, the writer's notes on them and their groups can be changed in place.
 */
export default function PersonRow({ person, canMerge, groups: allGroups, theme, language, t, onSave, onMerge, onDelete }: PersonRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.name);
  const [dateDrafts, setDateDrafts] = useState<PersonDateDraft[]>(() => personDateDrafts(person.dates));
  const [reachOut, setReachOut] = useState(() => reachOutDraft(person));
  const [notes, setNotes] = useState(person.notes ?? '');
  const [groups, setGroups] = useState<readonly string[]>(person.groups);
  const [pendingGroup, setPendingGroup] = useState('');
  const [error, setError] = useState<{ field: EditorField; message: string; index: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const datesRef = useRef<HTMLFieldSetElement>(null);
  const lastContactRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const groupRef = useRef<HTMLInputElement>(null);
  // The groups of the writer's other people: a group only this person is in can still be spelled anew
  const otherGroups = useMemo(() => allGroups
    .filter((group) => group.count > (person.groups.some((own) => personGroupKey(own) === group.key) ? 1 : 0))
    .map((group) => group.name), [allGroups, person.groups]);
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
    setDateDrafts(personDateDrafts(person.dates));
    setReachOut(reachOutDraft(person));
    setNotes(person.notes ?? '');
    setGroups(person.groups);
    setPendingGroup('');
    setEditing(true);
  };

  const stopEditing = () => {
    setEditing(false);
    setError(null);
    globalThis.setTimeout(() => editButtonRef.current?.focus(), 0);
  };

  /** Shows why the save failed and moves the focus to the field it is about: for a date, the kind of date `index`. */
  const fail = (field: EditorField, message: string, index = 0) => {
    setError({ field, message, index });
    if (field === 'date') {
      const dates = datesRef.current;
      (dates?.querySelectorAll<HTMLElement>('[data-person-date-kind]')[index] ?? dates?.querySelector<HTMLElement>('[data-person-date-add]'))?.focus();
      return;
    }
    ({ name: inputRef, reachOut: lastContactRef, notes: notesRef, groups: groupRef })[field].current?.focus();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      fail('name', t('personNameRequired'));
      return;
    }
    const read = readPersonDateDrafts(dateDrafts, today);
    if ('error' in read) {
      fail('date', t(read.error), read.index);
      return;
    }
    // Dates a merge joined past the limit stay as they are until the writer changes them
    const datesChanged = !samePersonDates(read.dates, person.dates);
    if (datesChanged && read.dates.length > PERSON_DATES_MAX) {
      fail('date', t('personDatesTooMany', { max: PERSON_DATES_MAX }), PERSON_DATES_MAX);
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
    // A group typed and not added yet is added on save; groups a merge joined past the limit stay until changed
    const savedGroups = addPersonGroup(groups, pendingGroup, otherGroups);
    const groupsChanged = !samePersonGroups(savedGroups, person.groups);
    if (groupsChanged && savedGroups.length > PERSON_GROUPS_MAX) {
      fail('groups', t('personGroupsTooMany', { max: PERSON_GROUPS_MAX }));
      return;
    }
    if (saving) return;
    const changes: PersonChanges = {
      name: trimmed,
      ...(datesChanged ? { dates: read.dates } : {}),
      ...(readReachOut.reachOutDays === person.reachOutDays ? {} : { reachOutDays: readReachOut.reachOutDays }),
      ...(readReachOut.lastContactOn === person.lastContactOn ? {} : { lastContactOn: readReachOut.lastContactOn }),
      ...(savedNotes === person.notes ? {} : { notes: savedNotes }),
      ...(groupsChanged ? { groups: savedGroups } : {}),
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
          <PersonDatesFields
            name={name.trim() || person.name}
            drafts={dateDrafts}
            onChange={setDateDrafts}
            isDark={isDark}
            language={language}
            t={t}
            error={error?.field === 'date' ? { id: errorId, index: error.index } : undefined}
            fieldsetRef={datesRef}
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
          <PersonGroupsField
            name={name.trim() || person.name}
            groups={groups}
            pending={pendingGroup}
            known={otherGroups}
            onGroupsChange={setGroups}
            onPendingChange={setPendingGroup}
            isDark={isDark}
            t={t}
            errorId={error?.field === 'groups' ? errorId : undefined}
            inputRef={groupRef}
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
            {person.groups.length > 0 && (
              <ul aria-label={t('personGroupsLabel')} className="my-1 flex flex-wrap gap-1">
                {person.groups.map((group) => (
                  <li key={group} className={`rounded-full border px-2 py-0.5 text-xs break-all ${isDark
                    ? 'border-gray-600 bg-gray-900 text-gray-200'
                    : 'border-gray-300 bg-gray-100 text-gray-800'}`}>
                    {group}
                  </li>
                ))}
              </ul>
            )}
            {person.dates.length > 0 && (
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {person.dates.map((date) => dateLine(date, language, t)).join(' · ')}
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
            <button type="button" className={iconButton} onClick={() => setShowMentions((shown) => !shown)} aria-expanded={showMentions}
              aria-label={t('personMentionsShow', { name: person.name })} title={t('personMentionsShow', { name: person.name })}>
              <span className="codicon codicon-graph" aria-hidden="true" />
            </button>
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
          {showMentions && (
            <div className="basis-full">
              <PersonMentionsOverTime scope={{ personId: person.id }} name={person.name} theme={theme} language={language} t={t} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}
