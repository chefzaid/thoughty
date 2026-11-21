import type { MemoirTheme, MemoirThemeId } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { localize, type MemoirLanguage } from './memoirFormat';
import './MemoirThemeFields.css';

interface MemoirThemeFieldsProps {
  readonly idPrefix: string;
  readonly themes: readonly MemoirTheme[];
  readonly selected: readonly MemoirThemeId[];
  readonly language: MemoirLanguage;
  /** The chosen themes, in the life order the server lists them. */
  readonly onChange: (themes: MemoirThemeId[]) => void;
  readonly t: TranslationFunction;
}

/** The themed chapters a writer adds to their weekly questions, shared by the start form and the settings. */
function MemoirThemeFields({ idPrefix, themes, selected, language, onChange, t }: MemoirThemeFieldsProps) {
  const toggle = (id: MemoirThemeId, checked: boolean) =>
    onChange(themes.filter((theme) => (theme.id === id ? checked : selected.includes(theme.id))).map((theme) => theme.id));

  return (
    <fieldset className="memoir-themes" aria-describedby={`${idPrefix}-themes-hint`}>
      <legend>{t('memoirThemesLegend')}</legend>
      <p id={`${idPrefix}-themes-hint`} className="memoir-hint">{t('memoirThemesHint')}</p>
      <ul>
        {themes.map((theme) => {
          const id = `${idPrefix}-theme-${theme.id}`;
          return (
            <li key={theme.id}>
              <label className="memoir-checkbox" htmlFor={id}>
                <input
                  id={id}
                  type="checkbox"
                  checked={selected.includes(theme.id)}
                  onChange={(event) => toggle(theme.id, event.target.checked)}
                />
                <span>{localize(theme.title, language)}</span>
                <span className="memoir-theme-count">{pluralPhrase(t, 'memoirThemeQuestions', theme.questionCount, language)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export default MemoirThemeFields;
