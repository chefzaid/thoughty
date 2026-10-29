import { useMemo, useRef, useState } from 'react';

import PageHeader from '../PageHeader/PageHeader';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import type { Person } from '../../services/api/peopleService';
import type { TranslationFunction } from '../../types';
import { resolveLanguage } from '../../utils/language';
import { normalizeMentionHandle } from '../../utils/mentions';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { mutedTextClass } from '../../utils/tintedText';
import MergePersonDialog from './MergePersonDialog';
import PersonRow from './PersonRow';
import { usePeople } from './usePeople';

export interface PeoplePageProps {
  readonly theme?: 'light' | 'dark';
  readonly language?: string;
  readonly t: TranslationFunction;
}

/**
 * The people the writer mentions with `@name`: how many entries mention each, a link to those
 * entries, and renaming, merging and deleting. People are the writer's own notes, never accounts.
 */
export default function PeoplePage({ theme = 'dark', language: languageSetting, t }: PeoplePageProps) {
  const { list, people, rename, merge, remove } = usePeople();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [merging, setMerging] = useState<Person | null>(null);
  const [deleting, setDeleting] = useState<Person | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const language = resolveLanguage(languageSetting);
  const isDark = theme === 'dark';
  const muted = mutedTextClass(isDark);
  const limit = list.data?.limit ?? 0;

  const shown = useMemo(() => {
    const key = normalizeMentionHandle(query.trim());
    if (!key) return people;
    return people.filter((person) => normalizeMentionHandle(person.name).includes(key)
      || person.handles.some((handle) => handle.includes(key)));
  }, [people, query]);

  const renamePerson = async (person: Person, name: string): Promise<string | null> => {
    const result = await rename(person.id, name);
    if (!result.data) return t(result.error ?? 'personSaveFailed');
    setStatus(t('personRenamed', { name: result.data.name }));
    return null;
  };

  const mergeInto = async (person: Person, duplicate: Person): Promise<string | null> => {
    const result = await merge(person.id, duplicate.id);
    if (!result.data) return t(result.error ?? 'personMergeFailed');
    setMerging(null);
    setStatus(t('personMerged', { duplicate: duplicate.name, name: result.data.name }));
    headingRef.current?.focus();
    return null;
  };

  const confirmDelete = async () => {
    const person = deleting;
    setDeleting(null);
    if (!person) return;
    const result = await remove(person.id);
    setStatus(result.data ? t('personDeleted', { name: person.name }) : t(result.error ?? 'personDeleteFailed'));
    headingRef.current?.focus();
  };

  return (
    <div className={`grid w-full gap-4 [&>.page-header]:mb-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
      <PageHeader title={t('people')} subtitle={t('peopleIntro')} titleRef={headingRef} theme={isDark ? 'dark' : 'light'} />
      <p className="sr-only" role="status" aria-live="polite">{status}</p>

      {list.isLoading && <p className={muted}>{t('peopleLoading')}</p>}
      {list.isError && <p role="alert" className={isDark ? 'text-red-300' : 'text-red-700'}>{t('peopleLoadFailed')}</p>}
      {list.isSuccess && people.length === 0 && <p className={muted}>{t('peopleEmpty')}</p>}

      {people.length > 0 && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="grid gap-1 text-sm font-medium">
              {t('peopleFind')}
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={`h-10 w-64 max-w-full rounded-lg border px-3 text-sm font-normal outline-none focus:ring-1 focus:ring-blue-500 ${isDark
                  ? 'border-gray-700 bg-gray-900 text-gray-100'
                  : 'border-gray-300 bg-gray-50 text-gray-900'}`}
              />
            </label>
            <p className={`text-sm ${muted}`}>{t('peopleCount', { count: people.length, limit })}</p>
          </div>
          {shown.length === 0
            ? <p className={muted}>{t('peopleNoMatch')}</p>
            : (
              <ul className="grid gap-2" aria-label={pluralPhrase(t, 'peopleListLabel', shown.length, language)}>
                {shown.map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    canMerge={people.length > 1}
                    theme={theme}
                    language={language}
                    t={t}
                    onRename={(name) => renamePerson(person, name)}
                    onMerge={() => setMerging(person)}
                    onDelete={() => setDeleting(person)}
                  />
                ))}
              </ul>
            )}
        </>
      )}

      {merging && (
        <MergePersonDialog
          person={merging}
          candidates={people.filter((person) => person.id !== merging.id)}
          theme={theme}
          t={t}
          onCancel={() => setMerging(null)}
          onMerge={(duplicate) => mergeInto(merging, duplicate)}
        />
      )}
      <ConfirmModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title={t('personDeleteTitle', { name: deleting?.name ?? '' })}
        message={t('personDeleteMessage', { handle: `@${deleting?.handles[0] ?? ''}` })}
        theme={theme}
        t={t}
      />
    </div>
  );
}
