import type { VisitorPreferences } from '../../hooks/useVisitorPreferences';
import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { MoonIcon, SunIcon } from '../ThemeIcons/ThemeIcons';
import './VisitorPreferencesSwitch.css';

/** Each interface language, shown by its code and named in its own language. */
const LANGUAGES: readonly (readonly [Language, string, string])[] = [
  ['en', 'EN', 'English'],
  ['fr', 'FR', 'Français'],
];

interface VisitorPreferencesSwitchProps {
  readonly preferences: VisitorPreferences;
  readonly t: TranslationFunction;
}

/**
 * The language and theme switch of the public pages, for a visitor without a session: it overrides
 * the browser's language and the system theme, and this browser remembers the choice.
 */
export default function VisitorPreferencesSwitch({ preferences, t }: VisitorPreferencesSwitchProps) {
  const { language, theme, chooseLanguage, chooseTheme } = preferences;
  const nextTheme = theme === 'light' ? 'dark' : 'light';

  return (
    <div className={`visitor-preferences ${theme}`} role="group" aria-label={t('visitorPreferencesLabel')}>
      <div className="visitor-preferences-languages" role="group" aria-label={t('language')}>
        {LANGUAGES.map(([code, short, name]) => (
          <button
            key={code}
            type="button"
            lang={code}
            aria-label={name}
            aria-pressed={language === code}
            onClick={() => chooseLanguage(code)}
          >
            {short}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="visitor-preferences-theme"
        aria-label={t(nextTheme === 'light' ? 'visitorThemeUseLight' : 'visitorThemeUseDark')}
        title={t(nextTheme === 'light' ? 'visitorThemeUseLight' : 'visitorThemeUseDark')}
        onClick={() => chooseTheme(nextTheme)}
      >
        {nextTheme === 'light' ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  );
}
