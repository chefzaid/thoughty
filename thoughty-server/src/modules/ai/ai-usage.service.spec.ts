import { AiUsageService } from './ai-usage.service';

describe('AiUsageService', () => {
  const queryBuilder: Record<string, jest.Mock> = {};
  const repository = {
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  let service: AiUsageService;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of ['select', 'addSelect', 'where', 'andWhere']) {
      queryBuilder[method] = jest.fn().mockReturnValue(queryBuilder);
    }
    queryBuilder.getRawOne = jest.fn();
    repository.createQueryBuilder.mockReturnValue(queryBuilder);
    service = new AiUsageService(repository as never);
  });

  it('stores only bounded numerical usage metadata', async () => {
    await service.recordResponse(7, 'personal', 'fallback/model', {
      model: 'provider/model',
      choices: [{ message: { content: 'private completion' } }],
      usage: {
        prompt_tokens: 120,
        completion_tokens: 30,
        total_tokens: 150,
        cost: 0.0042,
        completion_tokens_details: { reasoning_tokens: 8 },
      },
    });

    expect(repository.save).toHaveBeenCalledWith({
      userId: 7,
      credentialSource: 'personal',
      model: 'provider/model',
      promptTokens: 120,
      completionTokens: 30,
      reasoningTokens: 8,
      totalTokens: 150,
      cost: '0.0042',
    });
    expect(JSON.stringify(repository.save.mock.calls[0][0])).not.toContain('private completion');
  });

  it('ignores responses without usage and sanitizes invalid counters', async () => {
    await service.recordResponse(7, 'server', 'model', { choices: [] });
    expect(repository.save).not.toHaveBeenCalled();

    await service.recordResponse(7, 'server', 'model', {
      usage: { prompt_tokens: -1, completion_tokens: '10', total_tokens: 0, cost: Number.NaN },
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: '0',
      }),
    );
  });

  it('aggregates personal usage over the bounded dashboard period', async () => {
    queryBuilder.getRawOne.mockResolvedValue({
      promptTokens: '1000',
      completionTokens: '250',
      reasoningTokens: '40',
      totalTokens: '1250',
      cost: '0.125',
      requests: '6',
    });

    await expect(service.getPersonalUsage(7)).resolves.toEqual({
      promptTokens: 1000,
      completionTokens: 250,
      reasoningTokens: 40,
      totalTokens: 1250,
      cost: 0.125,
      requests: 6,
      periodDays: 30,
    });
    expect(queryBuilder.where).toHaveBeenCalledWith('usage.user_id = :userId', { userId: 7 });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('usage.credential_source = :source', {
      source: 'personal',
    });
  });

  it('does not fail an AI request when usage persistence fails', async () => {
    const loggerSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();
    repository.save.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.reporter(7, 'personal')({ usage: { total_tokens: 1 } }, 'model'),
    ).resolves.toBeUndefined();
    expect(loggerSpy).toHaveBeenCalled();
  });
});
