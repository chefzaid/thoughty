import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoirAnswer, MemoirProgram } from '@/database/entities';
import { AttachmentsService } from '@/modules/attachments';
import { ConfigService } from '@/modules/config';
import { EntriesService } from '@/modules/entries';
import { LifeErasService } from '@/modules/life-eras';
import type { AnswerMemoirQuestionDto, MemoirAnswerResultDto } from './dto';
import { composeAnswerContent } from './memoir-content';
import { findMemoirChapter, findMemoirQuestion, resolveMemoirLanguage } from './memoir-questions';
import { localDateIn } from './memoir-schedule';

@Injectable()
export class MemoirAnswersService {
  constructor(
    @InjectRepository(MemoirProgram)
    private readonly programRepository: Repository<MemoirProgram>,
    @InjectRepository(MemoirAnswer)
    private readonly answerRepository: Repository<MemoirAnswer>,
    private readonly entriesService: EntriesService,
    private readonly attachmentsService: AttachmentsService,
    private readonly configService: ConfigService,
    private readonly lifeEras: LifeErasService,
  ) {}

  async answer(userId: number, dto: AnswerMemoirQuestionDto): Promise<MemoirAnswerResultDto> {
    const question = findMemoirQuestion(dto.questionId);
    const chapter = question ? findMemoirChapter(question.chapterId) : undefined;
    if (!question || !chapter) {
      throw apiError(NotFoundException, 'MEMOIR_UNKNOWN_QUESTION');
    }

    const program = await this.programRepository.findOne({ where: { userId } });
    if (!program) {
      throw apiError(NotFoundException, 'MEMOIR_NOT_STARTED');
    }
    if (!program.diaryId) {
      throw apiError(ConflictException, 'MEMOIR_DIARY_REQUIRED');
    }

    const attachmentIds = [...new Set(dto.attachmentIds ?? [])];
    if (!dto.text && attachmentIds.length === 0) {
      throw apiError(BadRequestException, 'MEMOIR_ANSWER_EMPTY');
    }
    // An answer whose entry is in the recycle bin no longer counts, so the question can be answered again
    const previous = await this.answerRepository.findOne({
      where: { userId, questionId: question.id },
      relations: { entry: true },
      select: { questionId: true, entryId: true, entry: { id: true } },
    });
    if (previous?.entry) {
      throw apiError(ConflictException, 'MEMOIR_ALREADY_ANSWERED');
    }
    for (const attachmentId of attachmentIds) {
      await this.attachmentsService.getOwnedAttachment(userId, attachmentId);
    }
    // The era the memory belongs to is kept as a tag: the answer itself is dated the day it is written
    const era = dto.eraId ? await this.lifeEras.findOwn(userId, dto.eraId) : null;

    const language = resolveMemoirLanguage((await this.configService.getConfig(userId)).language);
    const chapterTag = chapter.title[language];
    const { entryId } = await this.entriesService.create(userId, {
      text: composeAnswerContent(question.text[language], dto.text),
      tags: era && era.name.toLowerCase() !== chapterTag.toLowerCase() ? [chapterTag, era.name] : [chapterTag],
      date: localDateIn(new Date(), program.timeZone),
      diaryId: program.diaryId,
      visibility: 'private',
      format: 'markdown',
    });

    try {
      if (previous) {
        await this.answerRepository.update({ userId, questionId: question.id }, { entryId });
      } else {
        await this.answerRepository.insert({ userId, questionId: question.id, entryId });
      }
    } catch (error: unknown) {
      // A concurrent answer won the race: keep the journal free of the duplicate entry.
      await this.entriesService.delete(userId, entryId);
      if ((error as { code?: string }).code === '23505') {
        throw apiError(ConflictException, 'MEMOIR_ALREADY_ANSWERED');
      }
      throw error;
    }

    if (attachmentIds.length > 0) {
      await this.attachmentsService.linkMultipleToEntry(userId, attachmentIds, entryId);
    }

    return { questionId: question.id, entryId };
  }
}
