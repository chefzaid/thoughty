import type { Person } from '../../services/api/peopleService';
import { tintedTextClass } from '../../utils/tintedText';

interface PersonFilterSelectProps {
    readonly people: readonly Person[];
    /** The person the journal is narrowed to; null for anyone. */
    readonly value: number | null;
    readonly onChange: (personId: number | null) => void;
    readonly onManagePeople?: () => void;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/** The filter bar's person choice, with a way to the People page; shown once the writer mentions someone or one is selected. */
function PersonFilterSelect({ people, value, onChange, onManagePeople, theme, t }: PersonFilterSelectProps) {
    if (people.length === 0 && value === null) {
        return null;
    }
    const isLight = theme === 'light';
    const neutral = isLight ? 'bg-gray-50 border-gray-300 text-gray-700' : 'bg-gray-900 border-gray-700 text-gray-300';
    // A person kept in the filter while the list reloads still shows as selected
    const known = value === null || people.some((person) => person.id === value);

    return (
        <div className="flex h-10 shrink-0 items-center gap-1">
            <select
                value={value === null ? '' : String(value)}
                onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
                className={`h-10 max-w-[14rem] shrink-0 rounded-lg border px-3 text-sm font-medium outline-none focus:ring-1 focus:ring-blue-500 ${value !== null
                    ? `bg-violet-500/10 border-violet-500/50 ${tintedTextClass('violet', theme)}`
                    : neutral}`}
                aria-label={t('personFilterLabel')}
                title={t('personFilterLabel')}
            >
                <option value="">{t('personFilterAll')}</option>
                {!known && <option value={String(value)}>{t('personFilterLabel')}</option>}
                {people.map((person) => (
                    <option key={person.id} value={String(person.id)}>{person.name}</option>
                ))}
            </select>
            {onManagePeople && (
                <button
                    type="button"
                    onClick={onManagePeople}
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${neutral}`}
                    aria-label={t('personFilterManage')}
                    title={t('personFilterManage')}
                >
                    <span className="codicon codicon-organization" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}

export default PersonFilterSelect;
