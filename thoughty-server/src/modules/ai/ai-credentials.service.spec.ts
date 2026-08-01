import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { AiCredentialsService } from './ai-credentials.service';

describe('AiCredentialsService', () => {
  const originalServerKey = process.env.OPENROUTER_API_KEY;
  const fetchMock = jest.fn();
  const configService = {
    getDecryptedConfig: jest.fn(),
    setEncryptedConfig: jest.fn(),
    deleteConfig: jest.fn(),
  };
  const usageService = { getPersonalUsage: jest.fn() };
  let service: AiCredentialsService;

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = fetchMock as never;
    configService.getDecryptedConfig.mockResolvedValue('');
    service = new AiCredentialsService(configService as never, usageService as never);
  });

  afterEach(() => {
    if (originalServerKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalServerKey;
  });

  it('reports personal, server, and unavailable credential states without exposing a key', async () => {
    configService.getDecryptedConfig.mockResolvedValueOnce('sk-or-v1-personal-secret');
    await expect(service.getStatus(2)).resolves.toEqual({
      hasPersonalKey: true,
      keyHint: '...ecret',
      source: 'personal',
      aiAvailable: true,
    });

    process.env.OPENROUTER_API_KEY = 'sk-or-v1-server';
    await expect(service.getStatus(2)).resolves.toEqual({
      hasPersonalKey: false,
      keyHint: null,
      source: 'server',
      aiAvailable: true,
    });

    delete process.env.OPENROUTER_API_KEY;
    await expect(service.getStatus(2)).resolves.toEqual({
      hasPersonalKey: false,
      keyHint: null,
      source: 'none',
      aiAvailable: false,
    });
  });

  it('validates a key before storing encrypted configuration', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: { label: 'Personal', usage: 1 } }),
    });
    configService.getDecryptedConfig.mockResolvedValue('sk-or-v1-personal-secret');

    await service.save(2, 'sk-or-v1-personal-secret');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/key',
      expect.objectContaining({
        headers: { Authorization: 'Bearer sk-or-v1-personal-secret' },
      }),
    );
    expect(configService.setEncryptedConfig).toHaveBeenCalledWith(
      2,
      'openRouterApiKey',
      'sk-or-v1-personal-secret',
    );
  });

  it('does not store rejected credentials', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    await expect(service.save(2, 'sk-or-v1-invalid-secret')).rejects.toThrow(BadRequestException);
    expect(configService.setEncryptedConfig).not.toHaveBeenCalled();
  });

  it('maps provider outages and malformed payloads to gateway errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(service.save(2, 'sk-or-v1-personal-secret')).rejects.toThrow(BadGatewayException);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: null }),
    });
    await expect(service.save(2, 'sk-or-v1-personal-secret')).rejects.toThrow(BadGatewayException);
  });

  it('combines sanitized provider figures with Thoughty token usage', async () => {
    configService.getDecryptedConfig.mockResolvedValue('sk-or-v1-personal-secret');
    usageService.getPersonalUsage.mockResolvedValue({ totalTokens: 300, periodDays: 30 });
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          label: 'Personal key',
          usage: 4.5,
          usage_daily: 0.2,
          usage_weekly: 1,
          usage_monthly: 3,
          limit: 10,
          limit_remaining: 5.5,
          limit_reset: 'monthly',
          expires_at: '2027-01-01T00:00:00Z',
        },
      }),
    });

    await expect(service.getUsage(2)).resolves.toEqual({
      provider: {
        label: 'Personal key',
        usage: 4.5,
        usageDaily: 0.2,
        usageWeekly: 1,
        usageMonthly: 3,
        limit: 10,
        limitRemaining: 5.5,
        limitReset: 'monthly',
        expiresAt: '2027-01-01T00:00:00Z',
      },
      thoughty: { totalTokens: 300, periodDays: 30 },
    });
  });

  it('requires a personal key for usage and removes it by user scope', async () => {
    await expect(service.getUsage(2)).rejects.toThrow(BadRequestException);

    process.env.OPENROUTER_API_KEY = 'sk-or-v1-server';
    await service.remove(2);
    expect(configService.deleteConfig).toHaveBeenCalledWith(2, 'openRouterApiKey');
  });
});
