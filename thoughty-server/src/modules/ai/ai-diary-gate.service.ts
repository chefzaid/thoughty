import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diary } from '@/database/entities';
import { apiError } from '@/common/errors';
import { assertDiaryAiAllowed } from '@/common/diary-ai';

/**
 * The diary check of an AI request that sends its text rather than an entry (Rephrase, Auto Tag): the request
 * may name the diary the text is written in; a diary with AI off refuses it, and one that asks before each AI
 * request refuses it unless the request carries the writer's consent. A request naming none is let through, as it
 * was before the check.
 */
@Injectable()
export class AiDiaryGateService {
  constructor(
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
  ) {}

  /**
   * `404 DIARY_NOT_FOUND` for a diary the writer does not own, `403 DIARY_AI_OFF` for one with AI off, and
   * `403 DIARY_AI_CONSENT_REQUIRED` for one that asks each time when `consent` is not true.
   */
  async assertTextAiAllowed(userId: number, diaryId: number | null | undefined, consent?: boolean): Promise<void> {
    if (diaryId == null) {
      return;
    }
    const diary = await this.diaryRepository.findOne({
      where: { id: diaryId, userId },
      select: { id: true, aiMode: true },
    });
    if (!diary) {
      throw apiError(NotFoundException, 'DIARY_NOT_FOUND');
    }
    assertDiaryAiAllowed(diary, consent);
  }
}
