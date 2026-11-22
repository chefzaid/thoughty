import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { EMBEDDED_BOOK_IMAGE_TYPES } from '@/common/utils';
import { MemoirPhotoAnswer, MemoirProgram } from '@/database/entities';
import { AttachmentsService } from '@/modules/attachments';
import { ConfigService } from '@/modules/config';
import { EntriesService } from '@/modules/entries';
import { LifeErasService } from '@/modules/life-eras';
import type { AnswerMemoirPhotoDto, MemoirPhotoAnswerResultDto } from './dto';
import { composePhotoAnswerContent, MEMOIR_PHOTO_TAG } from './memoir-photo';
import { findMemoirChapter, resolveMemoirLanguage } from './memoir-questions';
import { localDateIn } from './memoir-schedule';

const PHOTO_TYPES: ReadonlySet<string> = new Set(EMBEDDED_BOOK_IMAGE_TYPES);

/**
 * Photo prompts: an old photo and what is happening in it become a private Markdown entry in the memoir
 * diary, the photo placed in the text between the question and the story, so a book prints it next to
 * the answer. The story is tagged with the chosen life chapter (else Photos) and life era, like answers.
 */
@Injectable()
export class MemoirPhotoAnswersService {
  constructor(
    @InjectRepository(MemoirProgram)
    private readonly programRepository: Repository<MemoirProgram>,
    @InjectRepository(MemoirPhotoAnswer)
    private readonly photoAnswerRepository: Repository<MemoirPhotoAnswer>,
    private readonly entriesService: EntriesService,
    private readonly attachmentsService: AttachmentsService,
    private readonly configService: ConfigService,
    private readonly lifeEras: LifeErasService,
  ) {}

  async answer(userId: number, dto: AnswerMemoirPhotoDto): Promise<MemoirPhotoAnswerResultDto> {
    const program = await this.programRepository.findOne({ where: { userId } });
    if (!program) {
      throw apiError(NotFoundException, 'MEMOIR_NOT_STARTED');
    }
    if (!program.diaryId) {
      throw apiError(ConflictException, 'MEMOIR_DIARY_REQUIRED');
    }
    if (!dto.text) {
      throw apiError(BadRequestException, 'MEMOIR_PHOTO_EMPTY');
    }

    const photo = await this.attachmentsService.getOwnedAttachment(userId, dto.attachmentId);
    if (!PHOTO_TYPES.has(photo.mimetype)) {
      throw apiError(BadRequestException, 'MEMOIR_PHOTO_NOT_IMAGE');
    }
    if (photo.entryId !== null) {
      throw apiError(ConflictException, 'MEMOIR_PHOTO_IN_USE');
    }
    const era = dto.eraId ? await this.lifeEras.findOwn(userId, dto.eraId) : null;

    const language = resolveMemoirLanguage((await this.configService.getConfig(userId)).language);
    const chapter = dto.chapterId ? findMemoirChapter(dto.chapterId) : undefined;
    const chapterTag = chapter ? chapter.title[language] : MEMOIR_PHOTO_TAG[language];
    // The text places the photo, which joins the new entry as it is saved
    const { entryId } = await this.entriesService.create(userId, {
      text: composePhotoAnswerContent(language, photo.id, dto.caption ?? '', dto.text),
      tags: era && era.name.toLowerCase() !== chapterTag.toLowerCase() ? [chapterTag, era.name] : [chapterTag],
      date: localDateIn(new Date(), program.timeZone),
      diaryId: program.diaryId,
      visibility: 'private',
      format: 'markdown',
    });
    await this.photoAnswerRepository.insert({ userId, entryId });
    return { entryId };
  }
}
