import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { MemoirFollowUpsService } from './memoir-follow-ups.service';

describe('MemoirFollowUpsService', () => {
  const programRepository = { findOne: jest.fn() };
  const configService = { getConfig: jest.fn() };
  const aiFollowUps = { suggest: jest.fn() };
  const service = new MemoirFollowUpsService(programRepository as never, configService as never, aiFollowUps as never);

  beforeEach(() => {
    jest.clearAllMocks();
    programRepository.findOne.mockResolvedValue({ userId: 4, diary: { id: 9, aiMode: 'on' } });
    configService.getConfig.mockResolvedValue({ language: 'fr' });
    aiFollowUps.suggest.mockResolvedValue(['Que chantait votre grand-mère ?']);
  });

  it('asks about the question in the writer’s language, with the follow-ups already offered', async () => {
    await expect(service.suggest(4, { questionId: 'childhood-home', text: 'Un figuier.', asked: ['Qui l’a planté ?'] }))
      .resolves.toEqual({ questions: ['Que chantait votre grand-mère ?'] });

    expect(programRepository.findOne).toHaveBeenCalledWith({ where: { userId: 4 }, relations: { diary: true } });
    expect(aiFollowUps.suggest).toHaveBeenCalledWith(4, {
      question: expect.stringMatching(/maison/),
      answer: 'Un figuier.',
      asked: ['Qui l’a planté ?'],
    });
  });

  it('asks nothing already offered when none was, and in English by default', async () => {
    configService.getConfig.mockResolvedValue({});
    await service.suggest(4, { questionId: 'childhood-home', text: 'A fig tree.' });

    expect(aiFollowUps.suggest).toHaveBeenCalledWith(4, expect.objectContaining({ question: expect.stringMatching(/home/), asked: [] }));
  });

  it('refuses an unknown question, or a memoir not started, before asking the AI', async () => {
    await expectApiError(service.suggest(4, { questionId: 'moon-landing', text: 'x' }), NotFoundException, 'MEMOIR_UNKNOWN_QUESTION');
    programRepository.findOne.mockResolvedValue(null);
    await expectApiError(service.suggest(4, { questionId: 'childhood-home', text: 'x' }), NotFoundException, 'MEMOIR_NOT_STARTED');
    expect(aiFollowUps.suggest).not.toHaveBeenCalled();
  });

  it('refuses with 403 DIARY_AI_OFF when the memoir diary has AI off, before asking the AI', async () => {
    programRepository.findOne.mockResolvedValue({ userId: 4, diary: { id: 9, aiMode: 'off' } });
    await expectApiError(service.suggest(4, { questionId: 'childhood-home', text: 'x' }), ForbiddenException, 'DIARY_AI_OFF');
    expect(aiFollowUps.suggest).not.toHaveBeenCalled();
  });

  it('asks the AI for a memoir diary that asks each time only with the writer’s consent', async () => {
    programRepository.findOne.mockResolvedValue({ userId: 4, diary: { id: 9, aiMode: 'ask' } });
    configService.getConfig.mockResolvedValue({});
    await expectApiError(service.suggest(4, { questionId: 'childhood-home', text: 'x' }), ForbiddenException, 'DIARY_AI_CONSENT_REQUIRED');
    expect(aiFollowUps.suggest).not.toHaveBeenCalled();

    await service.suggest(4, { questionId: 'childhood-home', text: 'x', aiConsent: true });
    expect(aiFollowUps.suggest).toHaveBeenCalledTimes(1);
  });
});
