import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@/modules/config';
import { AiBookComposerService } from './ai-book-composer.service';

describe('AiBookComposerService', () => {
  let service: AiBookComposerService;
  let configService: { getDecryptedConfig: jest.Mock };
  const fetchMock = jest.fn();

  const createService = async (apiKey = 'sk-or-test-key') => {
    process.env.OPENROUTER_API_KEY = apiKey;

    configService = {
      getDecryptedConfig: jest.fn().mockResolvedValue(''),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiBookComposerService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    return module.get<AiBookComposerService>(AiBookComposerService);
  };

  beforeEach(async () => {
    service = await createService();
    globalThis.fetch = fetchMock as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  const chapterEntries = [
    { date: '2024-01-10', content: 'First thought about travel.' },
    { date: '2024-02-05', content: 'Second thought about travel.' },
  ];

  it('throws when no API key is configured', async () => {
    service = await createService('');

    await expect(service.composeBookChapter(1, 'Travel', chapterEntries)).rejects.toThrow(BadRequestException);
  });

  it('reports configuration state through isConfigured', async () => {
    expect(service.isConfigured()).toBe(true);

    service = await createService('');
    expect(service.isConfigured()).toBe(false);
  });

  it('returns an empty string when there are no usable entries', async () => {
    const result = await service.composeBookChapter(1, 'Travel', [{ date: '2024-01-01', content: '   ' }]);

    expect(result).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('weaves entries into a chapter via OpenRouter with strict instructions', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'A flowing chapter about travel.' } }],
      }),
    });

    const result = await service.composeBookChapter(1, 'Travel', chapterEntries);

    expect(result).toBe('A flowing chapter about travel.');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.4);
    expect(body.messages[0].content).toContain('"Travel"');
    expect(body.messages[0].content).toContain('never invent');
    expect(body.messages[1].content).toContain('First thought about travel.');
    expect(body.messages[1].content).toContain('[2024-01-10]');
  });

  it('supports a creative weaving mode with looser connective narration', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'A more lyrical chapter about travel.' } }],
      }),
    });

    await service.composeBookChapter(1, 'Travel', chapterEntries, 'creative');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.65);
    expect(body.messages[0].content).toContain('sensory texture');
  });

  it('composes long chapters in sequential parts that continue each other', async () => {
    const longEntries = [
      { date: '2024-01-01', content: 'a'.repeat(15000) },
      { date: '2024-01-02', content: 'b'.repeat(15000) },
    ];
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'Part one.' } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'Part two.' } }] }),
      });

    const result = await service.composeBookChapter(1, 'Travel', longEntries);

    expect(result).toBe('Part one.\n\nPart two.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.messages[1].content).toContain('Continue the same chapter seamlessly');
    expect(secondBody.messages[1].content).toContain('Part one.');
  });

  it('throws BadGatewayException when OpenRouter fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: jest.fn() });

    await expect(service.composeBookChapter(1, 'Travel', chapterEntries)).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when OpenRouter returns no content', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ choices: [{ message: { content: '' } }] }),
    });

    await expect(service.composeBookChapter(1, 'Travel', chapterEntries)).rejects.toThrow(BadGatewayException);
  });
});
