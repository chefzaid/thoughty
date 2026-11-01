import type { TranslationFunction } from '../../types';
import './QuietModeNote.css';

interface QuietModeNoteProps {
  readonly theme?: 'light' | 'dark';
  /** Extra classes, such as one that keeps it out of a printed page. */
  readonly className?: string;
  readonly t: TranslationFunction;
}

/** Says why a page shows fewer numbers than usual, and where quiet mode is turned off. */
function QuietModeNote({ theme, className = '', t }: QuietModeNoteProps) {
  return (
    <p className={`quiet-mode-note ${theme === 'light' ? 'light' : 'dark'} ${className}`.trim()} data-testid="quiet-mode-note">
      <span className="codicon codicon-eye-closed" aria-hidden="true" />
      <span>{t('quietModeNote')}</span>
    </p>
  );
}

export default QuietModeNote;
