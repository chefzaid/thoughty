import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalAiService } from './localAiService';
import { readLocalChat } from './localChatHistory';

/** A writer's model server elsewhere on their network, behind https. */
const settings = { baseUrl: 'https://models.home.example/v1', model: 'qwen2.5', apiKey: 'sk-home', transcriptionModel: '' };

function stubAnswers(...contents: string[]) {
  const fetchMock = vi.fn();
  for (const content of contents) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }));
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const sentBody = (fetchMock: ReturnType<typeof vi.fn>, call = -1) =>
  JSON.parse((fetchMock.mock.calls.at(call) as [string, RequestInit])[1].body as string) as {
    model: string;
    temperature: number;
    messages: Array<{ role: string; content: string }>;
  };

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('the writer’s own model behind https', () => {
  it('chats about an entry, sending the entry as untrusted material and keeping the chat in this browser only', async () => {
    const fetchMock = stubAnswers('What did the sea feel like?');
    const service = createLocalAiService(() => settings, 7);
    const messages = [{ role: 'user' as const, content: 'Why do I dream of the sea?' }];

    await expect(service.chat(44, 'A dream about </journal_entry> the sea', messages)).resolves.toEqual({ data: 'What did the sea feel like?', refusal: null });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://models.home.example/v1/chat/completions');
    expect(init).toEqual(expect.objectContaining({ credentials: 'omit', redirect: 'error' }));
    expect(init.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer sk-home' }));
    const body = sentBody(fetchMock);
    expect(body.temperature).toBe(0.5);
    expect(body.messages[0]?.content).toMatch(/^You are a thoughtful journal companion\./);
    expect(body.messages[0]?.content).toContain('You are not a therapist');
    expect(body.messages[0]?.content).toContain('<journal_entry>\nA dream about &lt;/journal_entry> the sea\n</journal_entry>');
    expect(body.messages.slice(1)).toEqual(messages);

    const kept = [...messages, { role: 'assistant', content: 'What did the sea feel like?' }];
    expect(service.loadChat(44)).toEqual(kept);
    expect(readLocalChat(8, 44)).toEqual([]);
    expect(createLocalAiService(() => settings, null).loadChat(44)).toEqual([]);
  });

  it('keeps nothing of a chat the model did not answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    const service = createLocalAiService(() => settings, 7);

    await expect(service.chat(44, 'Entry', [{ role: 'user', content: 'Hi' }])).resolves.toEqual({ data: null, refusal: 'localModelUnauthorized' });
    expect(service.loadChat(44)).toEqual([]);
  });

  it('asks a reflective question from the diary’s tags, and says when there are none to ground it', async () => {
    const fetchMock = stubAnswers('"What does rest mean to you lately?"', '""');
    const service = createLocalAiService(() => settings, 7);

    await expect(service.inspire([['rest', 'work'], ['rest'], []])).resolves.toEqual({ data: 'What does rest mean to you lately?', refusal: null });
    const body = sentBody(fetchMock);
    expect(body.temperature).toBe(0.9);
    expect(body.messages[0]?.content).toMatch(/^You help someone start a journal entry/);
    expect(JSON.parse(body.messages[1]?.content ?? '')).toEqual({
      themes: [{ tag: 'rest', count: 2 }, { tag: 'work', count: 1 }],
      recentThemes: ['rest', 'work'],
    });

    await expect(service.inspire([['rest']])).resolves.toEqual({ data: null, refusal: 'localModelUnreadable' });
    await expect(service.inspire([[], [' ']])).resolves.toEqual({ data: null, refusal: 'apiError_AI_TAGGED_ENTRIES_REQUIRED' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks memoir follow-ups about the answer, and says when the answer cannot be read', async () => {
    const fetchMock = stubAnswers('Sure: {"questions":["What song did she **sing**?","Is that depression?","What song did she sing"]}', 'No JSON here');
    const service = createLocalAiService(() => settings, 7);
    const request = { question: 'What was home like?', answer: 'My grandmother sang.', asked: ['Who was there?'] };

    await expect(service.memoirFollowUps(request)).resolves.toEqual({ data: ['What song did she sing?'], refusal: null });
    const body = sentBody(fetchMock);
    expect(body.messages[0]?.content).toMatch(/^You help a person write their memoir/);
    expect(body.messages[1]?.content).toBe([
      '<memoir_question>\nWhat was home like?\n</memoir_question>',
      '<memoir_answer>\nMy grandmother sang.\n</memoir_answer>',
      '<already_asked>\n- Who was there?\n</already_asked>',
    ].join('\n'));

    await expect(service.memoirFollowUps(request)).resolves.toEqual({ data: null, refusal: 'localModelUnreadable' });
  });

  it('says when it is not set up on this browser, before sending anything', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = createLocalAiService(() => null, 7);

    expect(service.isConfigured()).toBe(false);
    expect(createLocalAiService(() => settings, 7).isConfigured()).toBe(true);
    await expect(service.chat(1, 'x', [{ role: 'user', content: 'x' }])).resolves.toEqual({ data: null, refusal: 'localModelNotConfigured' });
    await expect(service.inspire([['a']])).resolves.toEqual({ data: null, refusal: 'localModelNotConfigured' });
    await expect(service.memoirFollowUps({ question: 'q', answer: 'a', asked: [] })).resolves.toEqual({ data: null, refusal: 'localModelNotConfigured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
