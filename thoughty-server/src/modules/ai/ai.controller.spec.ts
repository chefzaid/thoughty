import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

describe('AiController', () => {
  let controller: AiController;
  let aiService: { suggestTags: jest.Mock };

  beforeEach(async () => {
    aiService = {
      suggestTags: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: aiService }],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  it('delegates tag suggestions to the service', async () => {
    aiService.suggestTags.mockResolvedValue({ tags: ['focus', 'work'] });

    const result = await controller.suggestTags(
      { userId: 1, email: 'test@example.com' } as any,
      { content: 'Ship the sprint planning notes', existingTags: ['planning'], maxTags: 5 },
    );

    expect(aiService.suggestTags).toHaveBeenCalledWith(1, {
      content: 'Ship the sprint planning notes',
      existingTags: ['planning'],
      maxTags: 5,
    });
    expect(result).toEqual({ tags: ['focus', 'work'] });
  });
});