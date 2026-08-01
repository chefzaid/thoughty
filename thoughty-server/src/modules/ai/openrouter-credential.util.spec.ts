import { resolveOpenRouterCredential } from './openrouter-credential.util';

describe('resolveOpenRouterCredential', () => {
  const originalServerKey = process.env.OPENROUTER_API_KEY;

  afterEach(() => {
    if (originalServerKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalServerKey;
  });

  it('prefers a personal OpenRouter key', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-server-key';
    const config = { getDecryptedConfig: jest.fn().mockResolvedValue('sk-or-v1-personal-key') };

    await expect(resolveOpenRouterCredential(config as never, 4)).resolves.toEqual({
      apiKey: 'sk-or-v1-personal-key',
      source: 'personal',
    });
  });

  it('falls back to the server key and rejects unrelated setting values', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-server-key';
    const config = { getDecryptedConfig: jest.fn().mockResolvedValue('openai/model') };

    await expect(resolveOpenRouterCredential(config as never, 4)).resolves.toEqual({
      apiKey: 'sk-or-v1-server-key',
      source: 'server',
    });
  });

  it('returns null when no credential exists', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const config = { getDecryptedConfig: jest.fn().mockResolvedValue('') };

    await expect(resolveOpenRouterCredential(config as never, 4)).resolves.toBeNull();
  });
});
