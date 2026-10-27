import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import type { Person } from '../../services/api/peopleService';
import type { TranslationFunction } from '../../types';
import { formatEraDate } from '../../utils/lifeEras';
import { personJournalPath } from '../../utils/mentions';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { mutedTextClass } from '../../utils/tintedText';
import type { Language } from '../../utils/translations';

/** The longest name the server keeps for a person. */
const MAX_NAME_LENGTH = 80;

interface PersonRowProps {
  readonly person: Person;
  readonly canMerge: boolean;
  readonly theme: 'light' | 'dark';
  readonly language: Language;
  readonly t: TranslationFunction;
  /** Resolves an error message to show, or null once renamed. */
  readonly onRename: (name: string) => Promise<string | null>;
  readonly onMerge: () => void;
  readonly onDelete: () => void;
}

/** One person on the People page: their name opens their entries; the name shown can be changed in place. */
export default function PersonRow({ person, canMerge, theme, language, t, onRename, onMerge, onDelete }: PersonRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameButtonRef = useRef<HTMLButtonElement>(null);
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

  const stopEditing = () => {
    setEditing(false);
    setError(null);
    setName(person.name);
    globalThis.setTimeout(() => renameButtonRef.current?.focus(), 0);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('personNameRequired'));
      inputRef.current?.focus();
      return;
    }
    if (saving) return;
    setSaving(true);
    const failure = trimmed === person.name ? null : await onRename(trimmed);
    setSaving(false);
    if (failure) {
      setError(failure);
      inputRef.current?.focus();
      return;
    }
    setEditing(false);
    setError(null);
    globalThis.setTimeout(() => renameButtonRef.current?.focus(), 0);
  };

  const details = [
    pluralPhrase(t, 'personEntryCount', person.entryCount, language),
    person.lastMentionedOn ? t('personLastMentioned', { date: formatEraDate(person.lastMentionedOn, language) }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <li className={`rounded-lg border px-4 py-3 ${isDark ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-white'}`}>
      {editing ? (
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-wrap items-start gap-2"
          onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); stopEditing(); } }}>
          <div className="min-w-[12rem] flex-1">
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
              aria-invalid={error !== null}
              aria-describedby={error ? errorId : undefined}
              autoComplete="off"
              className={`h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${isDark
                ? 'border-gray-700 bg-gray-900 text-gray-100'
                : 'border-gray-300 bg-gray-50 text-gray-900'}`}
            />
            <p className={`mt-1 text-xs ${muted}`}>{t('personNameHelp')}</p>
            {error && <p id={errorId} role="alert" className={`mt-1 text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</p>}
          </div>
          <div className="flex gap-2 pt-6">
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
          <div className="min-w-0">
            <Link to={personJournalPath(person.id)} className="entry-mention-link text-base font-semibold break-words" title={t('personMentionTitle', { name: person.name })}>
              {person.name}
            </Link>
            <p className={`text-sm break-words ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {person.handles.map((handle) => `@${handle}`).join(', ')}
            </p>
            <p className={`text-xs ${muted}`}>{details}</p>
          </div>
          <div className="flex gap-2">
            <button ref={renameButtonRef} type="button" className={iconButton} onClick={() => setEditing(true)}
              aria-label={t('personRename', { name: person.name })} title={t('personRename', { name: person.name })}>
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
