import type { ChangeEvent } from 'react';
import type { ProfileConfig, TranslationFunction } from './types';
import SettingSwitch from './SettingSwitch';

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
  return (
    <SettingSwitch
      name="highContrast"
      label={t('highContrast')}
      description={t('highContrastDescription')}
      enabled={highContrast === true || highContrast === 'true'}
      handleChange={handleChange}
      rowClassName="high-contrast-row"
    />
  );
}

export default AppearanceAccessibilitySettings;
