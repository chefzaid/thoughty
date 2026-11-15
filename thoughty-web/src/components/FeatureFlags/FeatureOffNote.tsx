import type { TranslationFunction } from '../../types';
import type { FeatureFlagsTranslationKey } from '../../utils/translations.featureFlags';
import './FeatureOffNote.css';

interface FeatureOffNoteProps {
  /** What the note says, such as `featureOffAi`. */
  readonly message: FeatureFlagsTranslationKey;
  readonly theme?: 'light' | 'dark';
  readonly className?: string;
  readonly t: TranslationFunction;
}

/** Says, where a switched-off feature would be, that it is off for now and that nothing was lost. */
function FeatureOffNote({ message, theme, className = '', t }: FeatureOffNoteProps) {
  return (
    <p
      className={`feature-off-note ${theme === 'light' ? 'light' : 'dark'} ${className}`.trim()}
      data-testid="feature-off-note"
      role="note"
    >
      <span className="codicon codicon-debug-pause" aria-hidden="true" />
      <span>{t(message)}</span>
    </p>
  );
}

export default FeatureOffNote;
