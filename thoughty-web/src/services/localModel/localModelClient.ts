import type { LocalModelSettings } from './localModelSettings';

/**
 * Why the writer's own model gave no answer, as the translation key the app shows. `localModelBlocked` is a server
 * that answered without allowing this site (CORS), told apart from one that cannot be reached by a second,
 * unreadable (`no-cors`) request that only says whether anything answers.
 */
export type LocalModelProblem =
  | 'localModelNotConfigured'
  | 'localModelUnreachable'
  | 'localModelBlocked'
  | 'localModelUnauthorized'
  | 'localModelModelNotFound'
  | 'localModelNotOpenAi'
  | 'localModelTimeout'
  | 'localModelFailed';

export type LocalModelResult<T> = { readonly data: T; readonly problem: null } | { readonly data: null; readonly problem: LocalModelProblem };

export interface LocalModelMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/** A local model can take a while, loading itself on the first request. */
const COMPLETION_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 10_000;

const failed = (problem: LocalModelProblem): LocalModelResult<never> => ({ data: null, problem });
const answered = <T>(data: T): LocalModelResult<T> => ({ data, problem: null });

function headers(settings: LocalModelSettings, json: boolean): HeadersInit {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
  };
}

/** A request that ran out of time (a `DOMException`, read by name as it may come from another realm). */
const isTimeout = (error: unknown) => {
  const name = (error as { name?: unknown } | null)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
};

/** Why a request threw: it timed out, the server answered without allowing this site, or nothing answered. */
async function networkProblem(error: unknown, url: string): Promise<LocalModelProblem> {
  if (isTimeout(error)) return 'localModelTimeout';
  try {
    await fetch(url, { mode: 'no-cors', signal: AbortSignal.timeout(TEST_TIMEOUT_MS) });
    return 'localModelBlocked';
  } catch {
    return 'localModelUnreachable';
  }
}

/** The problem a refused answer names: a refused key, an unknown model, or no OpenAI-compatible API there. */
async function statusProblem(response: Response): Promise<LocalModelProblem> {
  if (response.status === 401 || response.status === 403) return 'localModelUnauthorized';
  const body = await response.text().catch(() => '');
  if ((response.status === 404 || response.status === 400) && /model/i.test(body) && /not.?found|does not exist|no such/i.test(body)) {
    return 'localModelModelNotFound';
  }
  return response.status === 404 || response.status === 405 ? 'localModelNotOpenAi' : 'localModelFailed';
}

async function send(url: string, init: RequestInit, timeoutMs: number): Promise<LocalModelResult<Response>> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), redirect: 'error', credentials: 'omit' });
    return response.ok ? answered(response) : failed(await statusProblem(response));
  } catch (error) {
    return failed(await networkProblem(error, url));
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** The model's answer to `messages`, from the writer's own OpenAI-compatible server (`POST {baseUrl}/chat/completions`). */
export async function completeWithLocalModel(
  settings: LocalModelSettings,
  messages: readonly LocalModelMessage[],
  temperature: number,
): Promise<LocalModelResult<string>> {
  const result = await send(
    `${settings.baseUrl}/chat/completions`,
    { method: 'POST', headers: headers(settings, true), body: JSON.stringify({ model: settings.model, temperature, stream: false, messages }) },
    COMPLETION_TIMEOUT_MS,
  );
  if (result.data === null) return result;
  const body = (await readJson(result.data)) as { choices?: Array<{ message?: { content?: unknown } }> } | null;
  const content = body?.choices?.[0]?.message?.content;
  return typeof content === 'string' && content.trim() ? answered(content.trim()) : failed('localModelNotOpenAi');
}

/** Whether `model` is one of the ids a server lists; Ollama lists `name:latest` for a model asked for by name. */
const hasModel = (ids: readonly string[], model: string) => ids.some((id) => id === model || id === `${model}:latest` || `${id}:latest` === model);

/**
 * Checks the writer's server the way the AI actions will reach it: it answers `GET {baseUrl}/models` from this
 * page, takes the key, and lists the model. `models` is what it lists, so the writer can pick one.
 */
export async function testLocalModel(settings: LocalModelSettings): Promise<LocalModelResult<true> & { readonly models: readonly string[] }> {
  const result = await send(`${settings.baseUrl}/models`, { headers: headers(settings, false) }, TEST_TIMEOUT_MS);
  if (result.data === null) return { ...result, models: [] };
  const body = (await readJson(result.data)) as { data?: unknown } | null;
  if (!Array.isArray(body?.data)) return { ...failed('localModelNotOpenAi'), models: [] };
  const models = (body.data as unknown[])
    .map((item) => (item && typeof item === 'object' ? (item as { id?: unknown }).id : null))
    .filter((id): id is string => typeof id === 'string');
  return hasModel(models, settings.model) ? { ...answered(true as const), models } : { ...failed('localModelModelNotFound'), models };
}
