import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { assertDiaryAiAllowed } from '@/common/diary-ai';
import { MemoirProgram } from '@/database/entities';
import { AiMemoirFollowUpsService } from '@/modules/ai';
import { ConfigService } from '@/modules/config';
import type { MemoirFollowUpsDto, MemoirFollowUpsResponseDto } from './dto';
import { findMemoirQuestion, resolveMemoirLanguage } from './memoir-questions';

/**
 * Memoir interview mode: follow-up questions for an answer being written, asked about the memoir's own question
 * in the writer's language. Nothing is kept: the answer is read from the request and the questions go back to it.
 */
@Injectable()
export class MemoirFollowUpsService {
  constructor(
    @InjectRepository(MemoirProgram)
    private readonly programRepository: Repository<MemoirProgram>,
    private readonly configService: ConfigService,
    private readonly aiFollowUps: AiMemoirFollowUpsService,
  ) {}

  async suggest(userId: number, dto: MemoirFollowUpsDto): Promise<MemoirFollowUpsResponseDto> {
    const question = findMemoirQuestion(dto.questionId);
    if (!question) {
      throw apiError(NotFoundException, 'MEMOIR_UNKNOWN_QUESTION');
    }
    const program = await this.programRepository.findOne({ where: { userId }, relations: { diary: true } });
    if (!program) {
      throw apiError(NotFoundException, 'MEMOIR_NOT_STARTED');
    }
    // The answer is going to the memoir diary, which may keep AI out or ask first
    assertDiaryAiAllowed(program.diary, dto.aiConsent);

    const language = resolveMemoirLanguage((await this.configService.getConfig(userId)).language);
    const questions = await this.aiFollowUps.suggest(userId, {
      question: question.text[language],
      answer: dto.text,
      asked: dto.asked ?? [],
    });
    return { questions };
  }
}
