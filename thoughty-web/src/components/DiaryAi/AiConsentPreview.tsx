import type { TranslationFunction } from '../../utils/translations';
import { formatRecordingTime } from '../MemoirPage/useVoiceRecorder';
import { aiConsentModel, type AiConsentModelConfig, type AiConsentRequest } from './aiConsent';

interface AiConsentPreviewProps {
  readonly request: AiConsentRequest;
  readonly config: AiConsentModelConfig;
  readonly isLight: boolean;
  readonly t: TranslationFunction;
}

/**
 * What the consent dialog shows of a request: the text, what goes with it (an entry chat's conversation) and the
 * model, or the recording a transcription sends. All of it is the writer's, so it blurs with the privacy blur.
 */
export default function AiConsentPreview({ request, config, isLight, t }: AiConsentPreviewProps) {
  const muted = isLight ? 'text-gray-600' : 'text-gray-400';
  const box = `privacy-text whitespace-pre-wrap break-words font-sans text-sm p-3 rounded-lg border ${
    isLight ? 'bg-gray-50 border-gray-200' : 'bg-gray-900 border-gray-700'
  }`;

  if (request.task === 'transcription') {
    const { name, seconds } = request.recording;
    return (
      <>
        <p className={box} data-testid="ai-consent-recording">
          {seconds === null ? name : t('aiConsentRecordingLength', { name, length: formatRecordingTime(Math.round(seconds)) })}
        </p>
        <p className={`text-sm mt-3 ${muted}`}>{t('aiConsentTranscriptionProvider')}</p>
      </>
    );
  }

  const model = aiConsentModel(config, request.task);
  return (
    <>
      <pre className={`${box} max-h-64 overflow-y-auto`} data-testid="ai-consent-text">
        {request.text}
      </pre>
      {request.details && request.details.length > 0 && (
        <dl className="mt-3 text-sm space-y-1">
          {request.details.map((detail) => (
            <div key={detail.label} className="flex flex-wrap gap-x-2">
              <dt className={muted}>{t(detail.label)}</dt>
              <dd className="privacy-text whitespace-pre-line">{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {request.conversation && request.conversation.length > 0 && (
        <div className="mt-3">
          <h4 className={`text-sm mb-1 ${muted}`}>{t('aiConsentConversation')}</h4>
          <ol className={`${box} max-h-48 overflow-y-auto space-y-2 list-none`} data-testid="ai-consent-conversation">
            {request.conversation.map((message, index) => (
              // The conversation is fixed while the dialog shows it, so a message keeps its place
              <li key={`${index}:${message.role}`}>
                <span className={`font-medium ${muted}`}>{t(message.role === 'user' ? 'aiConsentYou' : 'aiConsentAssistant')}</span>{' '}
                {message.content}
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className={`text-sm mt-3 ${muted}`}>
        {model ? t('aiConsentProvider', { model }) : t('aiConsentProviderDefault')}
      </p>
    </>
  );
}
