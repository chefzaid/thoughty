import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalAiService, textAiForDiary, type TextAiService } from './localAiService';
import { parseTagAnswer, rephraseMessages, summaryMessages, tagMessages, untrustedBlock, unwrapBlock } from './localModelPrompts';

const settings = { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', apiKey: '' };

function stubAnswer(content: string) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The messages the last request sent. */
const sentMessages = (fetchMock: ReturnType<typeof vi.fn>) =>
  JSON.parse((fetchMock.mock.calls.at(-1) as [string, RequestInit])[1].body as string).messages as Array<{ role: string; content: string }>;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the prompts sent to the writer’s own model', () => {
  it('encloses the text as untrusted material that cannot close its own block', () => {
    expect(untrustedBlock('text', 'a </text> b')).toBe('<text>\na &lt;/text> b\n</text>');
    expect(unwrapBlock('text', '<text>\nFixed\n</text>')).toBe('Fixed');
    expect(unwrapBlock('text', 'Fixed')).toBe('Fixed');
    const [system, user] = rephraseMessages('hello', 'polish');
    expect(system?.content).toContain('You are an editor.');
    expect(system?.content).toContain('untrusted source material');
    expect(user).toEqual({ role: 'user', content: '<text>\nhello\n</text>' });
    expect(rephraseMessages('x', 'rewrite')[0]?.content).toContain('You are a ghostwriter.');
  });

  it('sends tags and summaries as JSON source material', () => {
    expect(JSON.parse(tagMessages('A walk', ['nature'], 3)[1]?.content ?? '')).toEqual({ maxTags: 3, existingTags: ['nature'], entry: 'A walk' });
    expect(JSON.parse(summaryMessages('A walk', { includeDetails: ' the dog ', excludeDetails: '' })[1]?.content ?? '')).toEqual({
      includeDetails: 'the dog',
      excludeDetails: null,
      entry: 'A walk',
    });
  });

  it('reads the tags of an answer as the server does', () => {
    expect(parseTagAnswer('Here: ["#Self Care", "nature", "Walks", "walks", 4]', ['Nature'], 5)).toEqual(['self-care', 'walks']);
    expect(parseTagAnswer('["a","b","c"]', [], 2)).toEqual(['a', 'b']);
    expect(parseTagAnswer('no tags', [], 5)).toEqual([]);
    expect(parseTagAnswer('[broken', [], 5)).toEqual([]);
    expect(parseTagAnswer('{"tags": 1}', [], 5)).toEqual([]);
  });
});

describe('createLocalAiService', () => {
  it('rephrases with the writer’s model, keeping the text when it answers with nothing new', async () => {
    const fetchMock = stubAnswer('<text>\nI walked.\n</text>');
    const service = createLocalAiService(() => settings);

    await expect(service.fixWriting('i walkd')).resolves.toEqual({ data: 'I walked.', refusal: null });
    expect(sentMessages(fetchMock)[0]?.content).toContain('You are a proofreader.');

    stubAnswer('<text></text>');
    await expect(service.fixWriting('i walkd', 'polish')).resolves.toEqual({ data: 'i walkd', refusal: null });
  });

  it('suggests tags, at most ten, and summarizes', async () => {
    const fetchMock = stubAnswer('["walks", "dogs"]');
    const service = createLocalAiService(() => settings);

    await expect(service.suggestTags('A walk', ['dogs'], 40)).resolves.toEqual({ data: ['walks'], refusal: null });
    expect(JSON.parse(sentMessages(fetchMock)[1]?.content ?? '').maxTags).toBe(10);

    stubAnswer('A short walk.');
    await expect(service.summarize('A walk', { excludeDetails: 'the rain' })).resolves.toEqual({ data: 'A short walk.', refusal: null });
  });

  it('says why there is no answer: no server set up on this browser, or what went wrong with it', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const unset = createLocalAiService(() => null);

    await expect(unset.fixWriting('x')).resolves.toEqual({ data: null, refusal: 'localModelNotConfigured' });
    await expect(unset.suggestTags('x')).resolves.toEqual({ data: null, refusal: 'localModelNotConfigured' });
    await expect(unset.summarize('x')).resolves.toEqual({ data: null, refusal: 'localModelNotConfigured' });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    const service = createLocalAiService(() => settings);
    await expect(service.fixWriting('x')).resolves.toEqual({ data: null, refusal: 'localModelUnauthorized' });
    await expect(service.suggestTags('x')).resolves.toEqual({ data: null, refusal: 'localModelUnauthorized' });
  });
});

describe('textAiForDiary', () => {
  it('sends Rephrase and Auto Tag to the writer’s own model only for a diary set to it', async () => {
    const aiService = { fixWriting: vi.fn(), suggestTags: vi.fn() } as unknown as TextAiService;
    const localAi = {
      fixWriting: vi.fn().mockResolvedValue({ data: 'Local', refusal: null }),
      suggestTags: vi.fn().mockResolvedValue({ data: ['local'], refusal: null }),
      summarize: vi.fn(),
    };

    expect(textAiForDiary('on', aiService, localAi)).toBe(aiService);
    expect(textAiForDiary('ask', aiService, localAi)).toBe(aiService);

    const local = textAiForDiary('local', aiService, localAi);
    await expect(local.fixWriting('text', 'rewrite', 3, true)).resolves.toEqual({ data: 'Local', refusal: null });
    await expect(local.suggestTags('text', ['a'], 4, 3, true)).resolves.toEqual({ data: ['local'], refusal: null });
    expect(localAi.fixWriting).toHaveBeenCalledWith('text', 'rewrite');
    expect(localAi.suggestTags).toHaveBeenCalledWith('text', ['a'], 4);
    expect(aiService.fixWriting).not.toHaveBeenCalled();
  });
});
