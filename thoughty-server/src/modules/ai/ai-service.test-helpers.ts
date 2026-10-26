import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiChatHistory, Entry } from '@/database/entities';
import { ConfigService } from '@/modules/config';
import { AiService } from './ai.service';

/** The `AiService` under test and the collaborator mocks behind it. */
export interface AiServiceTestBed {
  service: AiService;
  configService: { getDecryptedConfig: jest.Mock };
  entryRepository: { findOne: jest.Mock };
  chatHistoryRepository: { findOne: jest.Mock; save: jest.Mock };
}

/**
 * A fresh `AiService` with `OPENROUTER_API_KEY` set to `apiKey` (empty for "no key"). No user
 * setting is configured, the entry repository finds entry 10 and there is no chat history yet.
 */
export async function createAiServiceTestBed(apiKey = 'sk-or-test-key'): Promise<AiServiceTestBed> {
  process.env.OPENROUTER_API_KEY = apiKey;

  const configService = {
    getDecryptedConfig: jest.fn().mockResolvedValue(''),
  };

  const entryRepository = {
    findOne: jest.fn().mockResolvedValue({ id: 10, userId: 1, content: 'Saved entry' }),
  };

  const chatHistoryRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation(async (value) => value),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AiService,
      { provide: ConfigService, useValue: configService },
      { provide: getRepositoryToken(Entry), useValue: entryRepository },
      { provide: getRepositoryToken(AiChatHistory), useValue: chatHistoryRepository },
    ],
  }).compile();

  return {
    service: module.get<AiService>(AiService),
    configService,
    entryRepository,
    chatHistoryRepository,
  };
}
