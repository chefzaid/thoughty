import { resolveAiModel } from './ai-model.util';

describe('resolveAiModel', () => {
  it('prefers the task model, then user default, then server default', async () => {
    const configService = {
      getDecryptedConfig: jest
        .fn()
        .mockResolvedValueOnce('anthropic/task')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('openai/user')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce(''),
    };

    await expect(
      resolveAiModel(configService as never, 3, 'openai/server', 'taskKey'),
    ).resolves.toBe('anthropic/task');
    await expect(
      resolveAiModel(configService as never, 3, 'openai/server', 'taskKey'),
    ).resolves.toBe('openai/user');
    await expect(resolveAiModel(configService as never, 3, 'openai/server')).resolves.toBe(
      'openai/server',
    );
  });
});
