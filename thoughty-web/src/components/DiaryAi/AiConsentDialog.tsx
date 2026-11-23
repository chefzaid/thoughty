import { useId, useRef } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { Config } from '../../types';
import type { TranslationFunction } from '../../utils/translations';
import type { AiConsentModelConfig, AiConsentRequest } from './aiConsent';
import AiConsentPreview from './AiConsentPreview';

interface AiConsentDialogProps {
  /** The request waiting for the writer's answer; the dialog is closed while there is none. */
  readonly request: AiConsentRequest | null;
  readonly config: Pick<Config, 'theme'> & AiConsentModelConfig;
  readonly onAnswer: (agreed: boolean) => void;
  readonly t: TranslationFunction;
}

/**
 * Before an AI request from a diary that asks each time: shows exactly the text it sends, what goes with it and
 * where (or the recording a transcription sends), and sends nothing until the writer confirms. Focus starts on
 * Cancel, and Escape cancels.
 */
export default function AiConsentDialog({ request, config, onAnswer, t }: AiConsentDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const introId = useId();
  const isOpen = request !== null;

  useDialogFocus({ isOpen, dialogRef, initialFocusRef: cancelRef, onClose: () => onAnswer(false) });

  if (!request) return null;

  const isLight = config.theme === 'light';
  const muted = isLight ? 'text-gray-600' : 'text-gray-400';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop: a pointer target only; keyboard users cancel with Escape or the Cancel button. */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
        onClick={() => onAnswer(false)}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={introId}
        className={`relative z-10 w-full max-w-lg mx-4 p-6 rounded-xl shadow-2xl border ${
          isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-gray-800 border-gray-700 text-gray-100'
        }`}
      >
        <h3 id={titleId} className="text-lg font-semibold mb-2">{t('aiConsentTitle')}</h3>
        <p id={introId} className={`text-sm mb-3 ${muted}`}>
          {t(request.task === 'transcription' ? 'aiConsentRecordingIntro' : 'aiConsentIntro')}
        </p>
        <AiConsentPreview request={request} config={config} isLight={isLight} t={t} />
        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            ref={cancelRef}
            onClick={() => onAnswer(false)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => onAnswer(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('aiConsentSend')}
          </button>
        </div>
      </div>
    </div>
  );
}
