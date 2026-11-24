import type { Page, Route } from '@playwright/test';

/** Where the specs' writer runs their own model: Ollama's address on this device. */
export const LOCAL_MODEL_URL = 'http://localhost:11434/v1';

interface LocalModelServerOptions {
  /** The models `GET /models` lists. */
  readonly models?: readonly string[];
  /** Whether it allows the app's origin (Ollama without `OLLAMA_ORIGINS` does not). */
  readonly allowsApp?: boolean;
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
  return 'Hello';
}

/**
 * An OpenAI-compatible server the writer runs on their own device (Ollama, LM Studio), answering the browser
 * directly: `GET /models` and `POST /chat/completions`, allowing the app's origin unless told otherwise. The chat
 * requests it received are returned for the spec to read.
 */
export async function routeLocalModelServer(page: Page, { models = ['llama3.2:latest'], allowsApp = true }: LocalModelServerOptions = {}) {
  const chatRequests: ChatRequest[] = [];
  const cors = { 'Access-Control-Allow-Origin': 'http://localhost:5173', 'Access-Control-Allow-Headers': 'content-type, authorization', 'Access-Control-Allow-Methods': 'GET, POST' };
  await page.route(`${LOCAL_MODEL_URL}/**`, async (route: Route) => {
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
    } else if (path === '/v1/models') {
      await route.fulfill({ status: 200, headers: cors, json: { object: 'list', data: models.map((id) => ({ id, object: 'model' })) } });
    } else if (path === '/v1/chat/completions' && request.method() === 'POST') {
      const body = request.postDataJSON() as ChatRequest;
      chatRequests.push(body);
      await route.fulfill({ status: 200, headers: cors, json: { choices: [{ message: { role: 'assistant', content: answerFor(body) } }] } });
    } else {
      await route.fulfill({ status: 404, headers: cors, body: '404 page not found' });
    }
  });
  return { chatRequests };
}
