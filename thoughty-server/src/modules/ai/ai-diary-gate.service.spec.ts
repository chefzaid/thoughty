import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { AiDiaryGateService } from './ai-diary-gate.service';

describe('AiDiaryGateService', () => {
  const setup = (diary: { id: number; aiMode: string } | null) => {
    const diaryRepository = { findOne: jest.fn().mockResolvedValue(diary) };
    return { gate: new AiDiaryGateService(diaryRepository as never), diaryRepository };
  };

  it('lets a request that names no diary through without reading one', async () => {
    const { gate, diaryRepository } = setup(null);

    await expect(gate.assertTextAiAllowed(1, undefined)).resolves.toBeUndefined();
    await expect(gate.assertTextAiAllowed(1, null)).resolves.toBeUndefined();
    expect(diaryRepository.findOne).not.toHaveBeenCalled();
  });

  it('lets text of the writer’s diary with AI on through', async () => {
    const { gate, diaryRepository } = setup({ id: 4, aiMode: 'on' });

    await expect(gate.assertTextAiAllowed(1, 4)).resolves.toBeUndefined();
    expect(diaryRepository.findOne).toHaveBeenCalledWith({
      where: { id: 4, userId: 1 },
      select: { id: true, aiMode: true },
    });
  });

  it('refuses text of a diary with AI off with 403 DIARY_AI_OFF', async () => {
    const { gate } = setup({ id: 4, aiMode: 'off' });

    await expectApiError(gate.assertTextAiAllowed(1, 4), ForbiddenException, 'DIARY_AI_OFF');
  });

  it('lets text of a diary that asks each time through only with the writer’s consent (403 DIARY_AI_CONSENT_REQUIRED)', async () => {
    const { gate } = setup({ id: 4, aiMode: 'ask' });

    await expect(gate.assertTextAiAllowed(1, 4, true)).resolves.toBeUndefined();
    await expectApiError(gate.assertTextAiAllowed(1, 4), ForbiddenException, 'DIARY_AI_CONSENT_REQUIRED');
    await expectApiError(gate.assertTextAiAllowed(1, 4, false), ForbiddenException, 'DIARY_AI_CONSENT_REQUIRED');
  });

  it('refuses text of a diary on the writer’s own model with 403 DIARY_AI_LOCAL, consent or not', async () => {
    const { gate } = setup({ id: 4, aiMode: 'local' });

    await expectApiError(gate.assertTextAiAllowed(1, 4), ForbiddenException, 'DIARY_AI_LOCAL');
    await expectApiError(gate.assertTextAiAllowed(1, 4, true), ForbiddenException, 'DIARY_AI_LOCAL');
  });

  it('refuses a diary the writer does not own with 404 DIARY_NOT_FOUND', async () => {
    const { gate } = setup(null);

    await expectApiError(gate.assertTextAiAllowed(1, 9), NotFoundException, 'DIARY_NOT_FOUND');
  });
});
