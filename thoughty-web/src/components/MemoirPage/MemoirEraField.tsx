import { useId } from 'react';

import type { LifeEra } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { eraLabel, erasOnDate, joinEraNames } from '../../utils/lifeEras';
import type { Language } from '../../utils/translations';

interface MemoirEraFieldProps {
  readonly eras: readonly LifeEra[];
  /** The day the answer is dated (`YYYY-MM-DD`). */
  readonly answerDate: string;
  /** The era the memory is placed in; null for none. */
  readonly value: number | null;
  readonly onChange: (eraId: number | null) => void;
  readonly disabled: boolean;
  readonly language: Language;
  readonly t: TranslationFunction;
}

/**
 * The life era context of a memoir answer: the eras the answer's date falls in, and the era the
 * memory itself belongs to, kept as a tag on the answer. Shown once the writer has eras.
 */
function MemoirEraField({ eras, answerDate, value, onChange, disabled, language, t }: MemoirEraFieldProps) {
  const id = useId();
  if (eras.length === 0) return null;
  const current = erasOnDate(eras, answerDate);

  return (
    <div className="memoir-field memoir-era">
      {current.length > 0 && (
        <p className="memoir-hint">{t('memoirEraToday', { eras: joinEraNames(current, language) })}</p>
      )}
      <label htmlFor={`${id}-era`} className="memoir-answer-label">{t('memoirEraLabel')}</label>
      <select
        id={`${id}-era`}
        value={value === null ? '' : String(value)}
        disabled={disabled}
        aria-describedby={`${id}-help`}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      >
        <option value="">{t('memoirEraNone')}</option>
        {eras.map((era) => <option key={era.id} value={String(era.id)}>{eraLabel(era)}</option>)}
      </select>
      <p id={`${id}-help`} className="memoir-hint">{t('memoirEraHelp')}</p>
    </div>
  );
}

export default MemoirEraField;
