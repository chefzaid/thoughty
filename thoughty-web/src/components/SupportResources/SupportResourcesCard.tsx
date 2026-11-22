import { useId } from 'react';

import type { TranslationFunction } from '../../types';
import { mutedTextClass } from '../../utils/tintedText';
import SupportResourceList from './SupportResourceList';

interface SupportResourcesCardProps {
  readonly onClose: () => void;
  readonly theme: 'light' | 'dark';
  readonly t: TranslationFunction;
  /** The heading's level where the card sits: 2 in the journal, 4 inside the chat dialog. */
  readonly headingLevel?: 2 | 3 | 4;
  readonly className?: string;
}

/**
 * A calm card with crisis lines, shown when an entry or a chat carries a sign of crisis (utils/crisisSignals).
 * It never takes focus or blocks anything; it is announced politely and **Close** (or Escape inside it) hides it.
 */
function SupportResourcesCard({ onClose, theme, t, headingLevel = 2, className = '' }: SupportResourcesCardProps) {
  const headingId = useId();
  const isDark = theme !== 'light';
  const Heading = `h${headingLevel}` as const;

  return (
    <>
      <p className="sr-only" role="status">{`${t('supportTitle')} ${t('supportIntro')}`}</p>
      <section
        aria-labelledby={headingId}
        data-testid="support-resources"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
        className={`rounded-xl border px-4 py-3 text-left ${isDark
          ? 'border-sky-400/30 bg-gray-800 text-gray-100'
          : 'border-sky-200 bg-sky-50 text-gray-900'
          } ${className}`}
      >
        <div className="flex items-start gap-3">
          <span className={`codicon codicon-heart mt-0.5 text-lg ${isDark ? 'text-sky-300' : 'text-sky-700'}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <Heading id={headingId} className="font-semibold">{t('supportTitle')}</Heading>
            <p className={`text-sm ${mutedTextClass(isDark)}`}>{t('supportIntro')}</p>
          </div>
        </div>
        <SupportResourceList
          t={t}
          className="mt-3 space-y-1 text-sm"
          linkClassName={`font-semibold underline underline-offset-2 ${isDark ? 'text-sky-300 hover:text-sky-200' : 'text-sky-800 hover:text-sky-900'}`}
        />
        <p className={`mt-3 text-xs ${mutedTextClass(isDark)}`}>{t('supportNotTherapy')}</p>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            title={t('supportCloseHint')}
            className={`h-9 rounded-lg px-3 text-sm font-medium transition-colors ${isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-sky-100'}`}
          >
            {t('supportClose')}
          </button>
        </div>
      </section>
    </>
  );
}

export default SupportResourcesCard;
