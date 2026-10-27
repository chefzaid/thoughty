import type { LifeEra } from '../../services/api/lifeErasService';
import { eraLabel } from '../../utils/lifeEras';
import { tintedTextClass } from '../../utils/tintedText';

interface EraFilterSelectProps {
    readonly eras: readonly LifeEra[];
    /** The era the journal is narrowed to; null for any date. */
    readonly value: number | null;
    readonly onChange: (eraId: number | null) => void;
    readonly onManageEras?: () => void;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/** The filter bar's life era choice, with a way to manage eras; shown once the writer has eras or one is selected. */
function EraFilterSelect({ eras, value, onChange, onManageEras, theme, t }: EraFilterSelectProps) {
    if (eras.length === 0 && value === null) {
        return null;
    }
    const isLight = theme === 'light';
    const neutral = isLight ? 'bg-gray-50 border-gray-300 text-gray-700' : 'bg-gray-900 border-gray-700 text-gray-300';
    // An era kept in the filter while the list reloads still shows as selected
    const known = value === null || eras.some((era) => era.id === value);

    return (
        <div className="flex h-10 shrink-0 items-center gap-1">
            <select
                value={value === null ? '' : String(value)}
                onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
                className={`h-10 max-w-[14rem] shrink-0 rounded-lg border px-3 text-sm font-medium outline-none focus:ring-1 focus:ring-blue-500 ${value !== null
                    ? `bg-indigo-500/10 border-indigo-500/50 ${tintedTextClass('indigo', theme)}`
                    : neutral}`}
                aria-label={t('eraFilterLabel')}
                title={t('eraFilterLabel')}
            >
                <option value="">{t('eraFilterAll')}</option>
                {!known && <option value={String(value)}>{t('eraFilterLabel')}</option>}
                {eras.map((era) => (
                    <option key={era.id} value={String(era.id)}>{eraLabel(era)}</option>
                ))}
            </select>
            {onManageEras && (
                <button
                    type="button"
                    onClick={onManageEras}
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${neutral}`}
                    aria-label={t('eraFilterManage')}
                    title={t('eraFilterManage')}
                >
                    <span className="codicon codicon-settings-gear" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}

export default EraFilterSelect;
