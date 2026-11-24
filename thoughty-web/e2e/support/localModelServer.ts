import type { Page, Route } from '@playwright/test';

/** Where the specs' writer runs their own model: Ollama's address on this device. */
export const LOCAL_MODEL_URL = 'http://localhost:11434/v1';
/** A writer's model server elsewhere on their network, behind https. */
export const HTTPS_MODEL_URL = 'https://models.home.example/v1';

interface LocalModelServerOptions {
  /** The server's OpenAI-compatible base address. */
  readonly baseUrl?: string;
  /** The models `GET /models` lists. */
  readonly models?: readonly string[];
  /** Whether it allows the app's origin (Ollama without `OLLAMA_ORIGINS` does not). */
  readonly allowsApp?: boolean;
  /** What its speech-to-text endpoint hears in every recording; without it the server has none, as Ollama. */
  readonly transcript?: string;
}

/** A recording the server was sent to transcribe: the model asked for and the file's name and size. */
interface TranscriptionRequest {
  readonly model: string;
  readonly filename: string;
  readonly bytes: number;
}

/** The model and the file of a multipart transcription request. */
function readTranscriptionRequest(body: Buffer, contentType: string): TranscriptionRequest {
  const boundary = /boundary=(.+)$/.exec(contentType)?.[1] ?? '';
  const text = body.toString('latin1');
  const file = /name="file"; filename="([^"]*)"\r\nContent-Type: [^\r]*\r\n\r\n/.exec(text);
  const start = file ? file.index + file[0].length : 0;
  return {
    model: /name="model"\r\n\r\n([^\r]*)/.exec(text)?.[1] ?? '',
    filename: file?.[1] ?? '',
    bytes: file ? text.indexOf(`\r\n--${boundary}`, start) - start : 0,
  };
}

interface ChatRequest {
  readonly model: string;
  readonly messages: Array<{ role: string; content: string }>;
}

/** What the fake model answers, by the task its system prompt names. */
function answerFor({ messages }: ChatRequest): string {
  const system = messages[0]?.content ?? '';
  const user = messages[1]?.content ?? '';
  if (system.startsWith('You are a proofreader.')) return `<text>\nFixed locally: ${user.replace(/^<text>\n|\n<\/text>$/g, '')}\n</text>`;
  if (system.startsWith('Suggest tags')) return '["family", "letters"]';
  if (system.startsWith('Summarize')) return 'A letter to my sister, summarized on this device.';
  if (system.startsWith('You are a thoughtful journal companion.')) return `My model hears you: ${messages.at(-1)?.content ?? ''}`;
  if (system.startsWith('You help someone start a journal entry')) return '"What would you write to your sister today?"';
  if (system.startsWith('You help a person write their memoir')) return '{"questions":["What did the kitchen smell like?","Who sang with her?"]}';
  return 'Hello';
}

/**
 * An OpenAI-compatible server the writer runs on their own device (Ollama, LM Studio) or elsewhere behind https
 * (`baseUrl`), answering the browser directly: `GET /models`, `POST /chat/completions` and, given a `transcript`,
 * `POST /audio/transcriptions`, allowing the app's origin unless told otherwise. The chat and transcription
 * requests it received are returned for the spec to read.
 */
export async function routeLocalModelServer(
  page: Page,
  { baseUrl = LOCAL_MODEL_URL, models = ['llama3.2:latest'], allowsApp = true, transcript }: LocalModelServerOptions = {},
) {
  const basePath = new URL(baseUrl).pathname;
  const chatRequests: ChatRequest[] = [];
  const transcriptionRequests: TranscriptionRequest[] = [];
  const cors = { 'Access-Control-Allow-Origin': 'http://localhost:5173', 'Access-Control-Allow-Headers': 'content-type, authorization', 'Access-Control-Allow-Methods': 'GET, POST' };
  await page.route(`${baseUrl}/**`, async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    // A fulfilled route skips the browser's CORS check, so a server that does not allow the app is played by what
    // the page then sees: a readable (CORS) request, which names its origin, fails as a network error, and an
    // unreadable (no-cors) one, which does not, gets through
    const readable = (await request.headerValue('origin')) !== null;
    if (!allowsApp) {
      await (readable ? route.abort('failed') : route.fulfill({ status: 200, body: '' }));
    } else if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
    } else if (path === `${basePath}/models`) {
      await route.fulfill({ status: 200, headers: cors, json: { object: 'list', data: models.map((id) => ({ id, object: 'model' })) } });
    } else if (path === `${basePath}/chat/completions` && request.method() === 'POST') {
      const body = request.postDataJSON() as ChatRequest;
      chatRequests.push(body);
      await route.fulfill({ status: 200, headers: cors, json: { choices: [{ message: { role: 'assistant', content: answerFor(body) } }] } });
    } else if (path === `${basePath}/audio/transcriptions` && request.method() === 'POST' && transcript !== undefined) {
      transcriptionRequests.push(readTranscriptionRequest(request.postDataBuffer() ?? Buffer.alloc(0), (await request.headerValue('content-type')) ?? ''));
      await route.fulfill({ status: 200, headers: cors, json: { text: transcript } });
    } else {
      await route.fulfill({ status: 404, headers: cors, body: '404 page not found' });
    }
  });
  return { chatRequests, transcriptionRequests };
}
