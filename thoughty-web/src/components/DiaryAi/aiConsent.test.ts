import { describe, expect, it, vi } from 'vitest';
import { aiConsentModel, confirmAiRequest, consentDetails } from './aiConsent';

const request = { text: 'Text', task: 'writing' as const };

describe('AI consent', () => {
  it('sends a request unasked outside a diary that asks each time', async () => {
    const requestConsent = vi.fn();
    await expect(confirmAiRequest('on', requestConsent, request)).resolves.toEqual({ send: true });
    await expect(confirmAiRequest('off', requestConsent, request)).resolves.toEqual({ send: true });
    expect(requestConsent).not.toHaveBeenCalled();
  });

  it('sends a request of a diary that asks each time only once the writer agrees, with the consent', async () => {
    await expect(confirmAiRequest('ask', vi.fn().mockResolvedValue(true), request)).resolves.toEqual({ send: true, aiConsent: true });
    await expect(confirmAiRequest('ask', vi.fn().mockResolvedValue(false), request)).resolves.toEqual({ send: false });
    // Nothing that could ask: nothing is sent
    await expect(confirmAiRequest('ask', undefined, request)).resolves.toEqual({ send: false });
  });

  it('names the task’s own model, else the writer’s model, else none for Thoughty’s default', () => {
    expect(aiConsentModel({ openRouterWritingModel: 'a/writer', openRouterModel: 'a/main' }, 'writing')).toBe('a/writer');
    expect(aiConsentModel({ openRouterWritingModel: ' ', openRouterModel: 'a/main' }, 'writing')).toBe('a/main');
    expect(aiConsentModel({ openRouterTagModel: 'a/tags' }, 'tag')).toBe('a/tags');
    expect(aiConsentModel({ openRouterSummaryModel: 'a/summary' }, 'summary')).toBe('a/summary');
    expect(aiConsentModel({ openRouterChatModel: 'a/chat' }, 'chat')).toBe('a/chat');
    expect(aiConsentModel({ openRouterPromptModel: 'a/prompt', openRouterModel: 'a/main' }, 'prompt')).toBe('a/prompt');
    expect(aiConsentModel({}, 'summary')).toBeNull();
  });

  it('leaves the empty details out', () => {
    expect(consentDetails([
      { label: 'aiConsentTags', value: '' },
      null,
      { label: 'summaryIncludeDetails', value: 'the boat' },
    ])).toEqual([{ label: 'summaryIncludeDetails', value: 'the boat' }]);
  });
});
