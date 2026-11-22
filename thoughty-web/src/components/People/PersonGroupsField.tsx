import { useId, type Ref } from 'react';

import type { TranslationFunction } from '../../types';
import { addPersonGroup, personGroupKey, PERSON_GROUP_NAME_MAX_LENGTH, PERSON_GROUPS_MAX } from '../../utils/personGroups';
import { mutedTextClass } from '../../utils/tintedText';

interface PersonGroupsFieldProps {
  readonly name: string;
  readonly groups: readonly string[];
  /** The group name typed and not added yet; saving the person adds it. */
  readonly pending: string;
  /** The writer's groups on their other people, offered as suggestions and used for their spelling. */
  readonly known: readonly string[];
  readonly onGroupsChange: (groups: string[]) => void;
  readonly onPendingChange: (pending: string) => void;
  readonly isDark: boolean;
  readonly t: TranslationFunction;
  /** The id of the message about the groups to announce with them, when there is one. */
  readonly errorId?: string;
  readonly inputRef?: Ref<HTMLInputElement>;
}

/**
 * The groups a person belongs to in the People page editor: each with a button that takes them out, and a field
 * that adds one, suggesting the writer's other groups. Groups a merge joined past the limit stay until changed.
 */
export default function PersonGroupsField({
  name, groups, pending, known, onGroupsChange, onPendingChange, isDark, t, errorId, inputRef,
}: PersonGroupsFieldProps) {
  const ids = { label: useId(), field: useId(), help: useId(), list: useId(), full: useId() };
  const muted = mutedTextClass(isDark);
  const full = groups.length >= PERSON_GROUPS_MAX;
  const suggestions = known.filter((group) => !groups.some((own) => personGroupKey(own) === personGroupKey(group)));

  const add = () => {
    if (full || !pending.trim()) return;
    onGroupsChange(addPersonGroup(groups, pending, known));
    onPendingChange('');
  };

  return (
    <div className="mt-3">
      <p id={ids.label} className={`mb-1 text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('personGroupsLabel')}</p>
      <p id={ids.help} className={`mb-2 text-xs ${muted}`}>{t('personGroupsHelp', { name })}</p>
      {groups.length === 0
        ? <p className={`mb-2 text-sm ${muted}`}>{t('personGroupsNone')}</p>
        : (
          <ul aria-labelledby={ids.label} className="mb-2 flex flex-wrap gap-2">
            {groups.map((group) => (
              <li key={group} className={`inline-flex items-center gap-1 rounded-full border py-0.5 pl-3 pr-1 text-sm ${isDark
                ? 'border-gray-600 bg-gray-900 text-gray-100'
                : 'border-gray-300 bg-gray-100 text-gray-900'}`}>
                <span className="break-all">{group}</span>
                <button
                  type="button"
                  onClick={() => onGroupsChange(groups.filter((other) => other !== group))}
                  aria-label={t('personGroupsRemove', { name, group })}
                  title={t('personGroupsRemove', { name, group })}
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                >
                  <span className="codicon codicon-close" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor={ids.field} className={`mb-1 block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            {t('personGroupsAdd')}
          </label>
          <input
            ref={inputRef}
            id={ids.field}
            type="text"
            list={ids.list}
            value={pending}
            maxLength={PERSON_GROUP_NAME_MAX_LENGTH}
            onChange={(event) => onPendingChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              // Enter adds the group instead of saving the whole person
              event.preventDefault();
              add();
            }}
            aria-invalid={errorId ? true : undefined}
            aria-describedby={[ids.help, full ? ids.full : undefined, errorId].filter(Boolean).join(' ')}
            autoComplete="off"
            className={`h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${isDark
              ? 'border-gray-700 bg-gray-900 text-gray-100'
              : 'border-gray-300 bg-gray-50 text-gray-900'}`}
          />
          <datalist id={ids.list}>
            {suggestions.map((group) => <option key={group} value={group} />)}
          </datalist>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={full || !pending.trim()}
          className={`h-10 rounded-lg border px-4 text-sm font-medium disabled:opacity-60 ${isDark
            ? 'border-gray-600 text-gray-200 hover:bg-gray-800'
            : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
        >
          {t('personGroupsAddButton')}
        </button>
      </div>
      {full && <p id={ids.full} className={`mt-1 text-xs ${muted}`}>{t('personGroupsFull', { name, max: PERSON_GROUPS_MAX })}</p>}
    </div>
  );
}
