import FeatureOffNote from '../FeatureFlags/FeatureOffNote';
import type { TranslationFunction } from '../../types';
import type { FeatureFlagsTranslationKey } from '../../utils/translations.featureFlags';

interface FeatureOffSectionProps {
  readonly title: string;
  readonly message: FeatureFlagsTranslationKey;
  readonly isDark: boolean;
  readonly t: TranslationFunction;
}

/** A profile section whose feature is switched off: its title, and a note that its settings are kept. */
function FeatureOffSection({ title, message, isDark, t }: Readonly<FeatureOffSectionProps>) {
  return (
    <div className="profile-section">
      <div className="section-header">
        <span className="codicon codicon-debug-pause section-icon" aria-hidden="true" />
        <h2 className="section-title">{title}</h2>
      </div>
      <div className="section-content">
        <FeatureOffNote message={message} theme={isDark ? 'dark' : 'light'} t={t} />
      </div>
    </div>
  );
}

export default FeatureOffSection;
