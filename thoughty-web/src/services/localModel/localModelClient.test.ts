import { afterEach, describe, expect, it, vi } from 'vitest';
import { completeWithLocalModel, testLocalModel } from './localModelClient';

const settings = { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', apiKey: '', transcriptionModel: '' };
const messages = [{ role: 'user' as const, content: 'Hello' }];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Answers each request in turn: a response, or an error it throws. */
function stubFetch(...answers: unknown[]) {
  const fetchMock = vi.fn();
  for (const answer of answers) {
    if (answer instanceof Response) fetchMock.mockResolvedValueOnce(answer);
    else fetchMock.mockRejectedValueOnce(answer);
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('completeWithLocalModel', () => {
  it('asks the writer’s server for a chat completion, without cookies or redirects, and reads its answer', async () => {
    const fetchMock = stubFetch(json({ choices: [{ message: { content: '  Bonjour  ' } }] }));

    await expect(completeWithLocalModel({ ...settings, apiKey: 'k-1' }, messages, 0.2)).resolves.toEqual({ data: 'Bonjour', problem: null });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', credentials: 'omit' });
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer k-1' });
    expect(JSON.parse(init.body as string)).toEqual({ model: 'llama3.2', temperature: 0.2, stream: false, messages });
  });

  it('sends no key when none is set', async () => {
    const fetchMock = stubFetch(json({ choices: [{ message: { content: 'Hi' } }] }));
    await completeWithLocalModel(settings, messages, 0.2);
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('tells a server that does not allow this site (CORS) from one that cannot be reached', async () => {
    const blocked = stubFetch(new TypeError('Failed to fetch'), new Response(null, { status: 200 }));
    await expect(completeWithLocalModel(settings, messages, 0.2)).resolves.toEqual({ data: null, problem: 'localModelBlocked' });
    expect(blocked.mock.calls[1]).toEqual(['http://localhost:11434/v1/chat/completions', expect.objectContaining({ mode: 'no-cors' })]);

    stubFetch(new TypeError('Failed to fetch'), new TypeError('Failed to fetch'));
    await expect(completeWithLocalModel(settings, messages, 0.2)).resolves.toEqual({ data: null, problem: 'localModelUnreachable' });
  });

  it('says when the model took too long', async () => {
    stubFetch(new DOMException('The operation timed out.', 'TimeoutError'));
    await expect(completeWithLocalModel(settings, messages, 0.2)).resolves.toEqual({ data: null, problem: 'localModelTimeout' });
  });

  it('names a refused key, an unknown model, a server with no such API, and any other failure', async () => {
    const cases: Array<[Response, string]> = [
      [json({ error: 'unauthorized' }, 401), 'localModelUnauthorized'],
      [json({ error: { message: 'model "llama9" not found, try pulling it first' } }, 404), 'localModelModelNotFound'],
      [json({ error: 'The model `x` does not exist' }, 400), 'localModelModelNotFound'],
      [new Response('404 page not found', { status: 404 }), 'localModelNotOpenAi'],
      [new Response('', { status: 405 }), 'localModelNotOpenAi'],
      [json({ error: 'out of memory' }, 500), 'localModelFailed'],
      [json({ choices: [] }), 'localModelNotOpenAi'],
      [new Response('not json', { status: 200 }), 'localModelNotOpenAi'],
    ];
    for (const [response, problem] of cases) {
      stubFetch(response);
      await expect(completeWithLocalModel(settings, messages, 0.2)).resolves.toEqual({ data: null, problem });
    }
  });
});

describe('testLocalModel', () => {
  it('finds the model among those the server lists, Ollama’s `:latest` names included', async () => {
    const fetchMock = stubFetch(json({ data: [{ id: 'llama3.2:latest' }, { id: 'mistral' }, null] }));

    await expect(testLocalModel(settings)).resolves.toEqual({ data: true, problem: null, models: ['llama3.2:latest', 'mistral'] });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:11434/v1/models');

    stubFetch(json({ data: [{ id: 'mistral' }] }));
    await expect(testLocalModel({ ...settings, model: 'mistral:latest' })).resolves.toMatchObject({ problem: null });
  });

  it('says which models the server has when it lacks the one named', async () => {
    stubFetch(json({ data: [{ id: 'mistral' }, { id: 'phi3' }] }));
    await expect(testLocalModel(settings)).resolves.toEqual({ data: null, problem: 'localModelModelNotFound', models: ['mistral', 'phi3'] });
  });

  it('says what is wrong with a server that does not answer as expected', async () => {
    stubFetch(json({ models: [] }));
    await expect(testLocalModel(settings)).resolves.toEqual({ data: null, problem: 'localModelNotOpenAi', models: [] });

    stubFetch(new TypeError('Failed to fetch'), new Response(null, { status: 200 }));
    await expect(testLocalModel(settings)).resolves.toEqual({ data: null, problem: 'localModelBlocked', models: [] });

    stubFetch(new Response('', { status: 403 }));
    await expect(testLocalModel(settings)).resolves.toEqual({ data: null, problem: 'localModelUnauthorized', models: [] });
  });
});
