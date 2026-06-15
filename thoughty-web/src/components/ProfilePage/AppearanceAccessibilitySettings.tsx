import type { ChangeEvent } from 'react';
import type { ProfileConfig, TranslationFunction } from './types';

type HandleAppearanceChange = (
  e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | { target: { name: string; value: string } }
) => void;

interface AppearanceAccessibilitySettingsProps {
  highContrast: ProfileConfig['highContrast'];
  handleChange: HandleAppearanceChange;
  t: TranslationFunction;
}

function AppearanceAccessibilitySettings({
  highContrast,
  handleChange,
  t,
}: Readonly<AppearanceAccessibilitySettingsProps>) {
  const enabled = highContrast === true || highContrast === 'true';

  return (
    <div className="setting-row horizontal high-contrast-row">
      <div className="setting-info">
        <span className="setting-label">{t('highContrast')}</span>
        <span className="setting-description">{t('highContrastDescription')}</span>
      </div>
      <div className="theme-switch-container setting-row-control">
        <button
          type="button"
          className={`theme-switch ${enabled ? 'dark' : 'light'}`}
          onClick={() => handleChange({ target: { name: 'highContrast', value: enabled ? 'false' : 'true' } })}
          aria-label={t('highContrast')}
        >
          <span className={`switch-thumb ${enabled ? 'on' : 'off'}`} />
        </button>
      </div>
    </div>
  );
}

export default AppearanceAccessibilitySettings;
