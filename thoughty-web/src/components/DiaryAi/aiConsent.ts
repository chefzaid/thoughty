import type { Config } from '../../types';
import type { DiaryAiMode } from '../../utils/diaryAi';

/** The AI tasks about a text that may ask for consent, each with the model setting it is sent to. */
export type AiConsentTask = 'tag' | 'writing' | 'summary' | 'chat' | 'prompt';

const TASK_MODEL_SETTINGS = {
  tag: 'openRouterTagModel',
  writing: 'openRouterWritingModel',
  summary: 'openRouterSummaryModel',
  chat: 'openRouterChatModel',
  prompt: 'openRouterPromptModel',
} as const satisfies Record<AiConsentTask, keyof Config>;

/** The model settings the consent dialog reads to name where a request goes. */
export type AiConsentModelConfig = Pick<Config, (typeof TASK_MODEL_SETTINGS)[AiConsentTask] | 'openRouterModel'>;

/** Something else a request sends beside the text, named by its translation key (the summary's as its dialog names them). */
export interface AiConsentDetail {
  readonly label: 'aiConsentTags' | 'aiConsentQuestion' | 'aiConsentAskedBefore' | 'summaryIncludeDetails' | 'summaryExcludeDetails';
  readonly value: string;
}

/** One message of an entry chat, as it is sent. */
export interface AiConsentMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

/** What one AI request about a text would send: the text, what else goes with it, and the task (for its model). */
export interface AiConsentTextRequest {
  readonly text: string;
  readonly details?: readonly AiConsentDetail[];
  /** The conversation an entry chat sends after the entry, the new message last. */
  readonly conversation?: readonly AiConsentMessage[];
  readonly task: AiConsentTask;
}

/** A recording sent to be transcribed: its file name, and its length in seconds when it is known. */
export interface AiConsentRecordingRequest {
  readonly task: 'transcription';
  readonly recording: { readonly name: string; readonly seconds: number | null };
}

/** What one AI request would send, as the consent dialog shows it. */
export type AiConsentRequest = AiConsentTextRequest | AiConsentRecordingRequest;

/** Shows the writer what a request would send; resolves true once they confirm, false when they cancel. */
export type RequestAiConsent = (request: AiConsentRequest) => Promise<boolean>;

/** Whether to send a request, and the consent it carries for a diary that asks each time. */
export type AiConsentAnswer = { readonly send: false } | { readonly send: true; readonly aiConsent?: true };

const SEND_UNASKED: AiConsentAnswer = { send: true };
const DECLINED: AiConsentAnswer = { send: false };
const AGREED: AiConsentAnswer = { send: true, aiConsent: true };

/**
 * Asks before an AI request about the text of a diary in `mode`: a diary that asks each time shows the writer what
 * would be sent and sends it, with `aiConsent`, only once they confirm; any other diary sends it unasked.
 */
export async function confirmAiRequest(
  mode: DiaryAiMode,
  requestConsent: RequestAiConsent | undefined,
  request: AiConsentRequest,
): Promise<AiConsentAnswer> {
  if (mode !== 'ask') return SEND_UNASKED;
  if (!requestConsent) return DECLINED;
  return (await requestConsent(request)) ? AGREED : DECLINED;
}

/** The model a task's request goes to: its own setting, else the writer's model, else null for Thoughty's default. */
export function aiConsentModel(config: AiConsentModelConfig, task: AiConsentTask): string | null {
  return config[TASK_MODEL_SETTINGS[task]]?.trim() || config.openRouterModel?.trim() || null;
}

/** The details a request sends beside its text, leaving out the empty ones. */
export function consentDetails(details: readonly (AiConsentDetail | null)[]): AiConsentDetail[] {
  return details.filter((detail): detail is AiConsentDetail => detail !== null && detail.value.trim() !== '');
}

/** The diary the text of an AI request is written in, as the composer knows it. */
export interface AiRequestDiary {
  readonly diaryId?: number;
  readonly mode: DiaryAiMode;
  /** Opens the consent dialog, for a diary that asks each time; without it such a request is not sent. */
  readonly requestConsent?: RequestAiConsent;
  /** Hears that the server refused the request for the diary's AI mode, so the diaries are loaded again. */
  readonly onModeRefused?: () => void;
}
