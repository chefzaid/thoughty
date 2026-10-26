import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diary, MemoirAnswer, MemoirProgram, User } from '@/database/entities';
import { EmailService } from '@/modules/auth/services/email.service';
import { DiariesService } from '@/modules/diaries';
import type {
  MemoirChapterDto,
  MemoirLeftDto,
  MemoirOverviewDto,
  MemoirProgramDto,
  StartMemoirDto,
  UpdateMemoirDto,
} from './dto';
import { countAnswerWords } from './memoir-content';
import { MEMOIR_CHAPTERS, MEMOIR_QUESTIONS, nextUnansweredQuestion } from './memoir-questions';
import { isValidTimeZone, nextWeeklyDelivery } from './memoir-schedule';

const MEMOIR_DIARY_ICON = '📖';
const WORDS_PER_PAGE = 250;

interface AnswerSummary {
  questionId: string;
  entryId: number;
  createdAt: Date;
  content: string;
}

@Injectable()
export class MemoirService {
  constructor(
    @InjectRepository(MemoirProgram)
    private readonly programRepository: Repository<MemoirProgram>,
    @InjectRepository(MemoirAnswer)
    private readonly answerRepository: Repository<MemoirAnswer>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly diariesService: DiariesService,
    private readonly emailService: EmailService,
  ) {}

  async getOverview(userId: number): Promise<MemoirOverviewDto> {
    const [program, answers] = await Promise.all([
      this.programRepository.findOne({ where: { userId } }),
      this.loadAnswers(userId),
    ]);
    const answersById = new Map(answers.map((answer) => [answer.questionId, answer]));
    const words = answers.reduce((total, answer) => total + countAnswerWords(answer.content), 0);
    const answered = MEMOIR_QUESTIONS.filter((question) => answersById.has(question.id)).length;

    return {
      program: program ? await this.toProgramDto(userId, program) : null,
      chapters: MEMOIR_CHAPTERS.map((chapter): MemoirChapterDto => ({
        id: chapter.id,
        title: { ...chapter.title },
        questions: chapter.questions.map((question) => {
          const answer = answersById.get(question.id);
          return {
            id: question.id,
            text: { ...question.text },
            answer: answer ? { entryId: answer.entryId, answeredAt: answer.createdAt.toISOString() } : null,
          };
        }),
      })),
      progress: {
        answered,
        total: MEMOIR_QUESTIONS.length,
        words,
        estimatedPages: Math.ceil(words / WORDS_PER_PAGE),
      },
    };
  }

  async start(userId: number, dto: StartMemoirDto): Promise<MemoirOverviewDto> {
    if (await this.programRepository.exists({ where: { userId } })) {
      throw apiError(ConflictException, 'MEMOIR_ALREADY_STARTED');
    }
    this.assertTimeZone(dto.timeZone);

    const diaryId = dto.diaryId
      ? await this.requireOwnedDiaryId(userId, dto.diaryId)
      : await this.findOrCreateDiaryId(userId, dto.diaryName ?? '');
    const answered = await this.loadAnsweredIds(userId);
    const now = new Date();

    try {
      await this.programRepository.insert({
        userId,
        diaryId,
        status: 'active',
        emailEnabled: dto.emailEnabled,
        deliveryWeekday: dto.deliveryWeekday,
        timeZone: dto.timeZone,
        currentQuestionId: nextUnansweredQuestion(null, answered)?.id ?? null,
        currentQuestionAt: now,
        nextDeliveryAt: nextWeeklyDelivery(now, dto.deliveryWeekday, dto.timeZone),
      });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') {
        throw apiError(ConflictException, 'MEMOIR_ALREADY_STARTED');
      }
      throw error;
    }

    return this.getOverview(userId);
  }

  async update(userId: number, dto: UpdateMemoirDto): Promise<MemoirOverviewDto> {
    const program = await this.requireProgram(userId);
    if (dto.timeZone !== undefined) this.assertTimeZone(dto.timeZone);
    if (dto.diaryId !== undefined) program.diaryId = await this.requireOwnedDiaryId(userId, dto.diaryId);

    const reschedule =
      (dto.deliveryWeekday !== undefined && dto.deliveryWeekday !== program.deliveryWeekday) ||
      (dto.timeZone !== undefined && dto.timeZone !== program.timeZone) ||
      (dto.status === 'active' && program.status === 'paused');

    program.emailEnabled = dto.emailEnabled ?? program.emailEnabled;
    program.deliveryWeekday = dto.deliveryWeekday ?? program.deliveryWeekday;
    program.timeZone = dto.timeZone ?? program.timeZone;
    program.status = dto.status ?? program.status;
    if (reschedule) {
      program.nextDeliveryAt = nextWeeklyDelivery(new Date(), program.deliveryWeekday, program.timeZone);
    }

    await this.programRepository.save(program);
    return this.getOverview(userId);
  }

  /** Stops the program; answers stay in the journal and count again if the memoir is restarted. */
  async leave(userId: number): Promise<MemoirLeftDto> {
    await this.programRepository.delete({ userId });
    return { success: true };
  }

  /** Replaces this week's question with the next unanswered one without waiting for the weekly delivery. */
  async skip(userId: number): Promise<MemoirOverviewDto> {
    const program = await this.requireProgram(userId);
    const next = nextUnansweredQuestion(program.currentQuestionId, await this.loadAnsweredIds(userId));
    program.currentQuestionId = next?.id ?? null;
    program.currentQuestionAt = new Date();
    await this.programRepository.save(program);
    return this.getOverview(userId);
  }

  private async toProgramDto(userId: number, program: MemoirProgram): Promise<MemoirProgramDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, email: true, emailVerified: true },
    });

    return {
      diaryId: program.diaryId,
      status: program.status,
      emailEnabled: program.emailEnabled,
      emailAvailable: Boolean(user?.email && user.emailVerified && this.emailService.isConfigured()),
      deliveryWeekday: program.deliveryWeekday,
      timeZone: program.timeZone,
      currentQuestionId: program.currentQuestionId,
      nextDeliveryAt: program.nextDeliveryAt.toISOString(),
      startedAt: program.createdAt.toISOString(),
    };
  }

  private async requireProgram(userId: number): Promise<MemoirProgram> {
    const program = await this.programRepository.findOne({ where: { userId } });
    if (!program) {
      throw apiError(NotFoundException, 'MEMOIR_NOT_STARTED');
    }
    return program;
  }

  private assertTimeZone(timeZone: string): void {
    if (!isValidTimeZone(timeZone)) {
      throw apiError(BadRequestException, 'VALIDATION_FAILED', 'Unknown time zone');
    }
  }

  private async requireOwnedDiaryId(userId: number, diaryId: number): Promise<number> {
    const diary = await this.diaryRepository.findOne({ where: { id: diaryId, userId } });
    if (!diary) {
      throw apiError(NotFoundException, 'DIARY_NOT_FOUND');
    }
    return diary.id;
  }

  /** Restarting the memoir with the same diary name continues in that diary instead of failing. */
  private async findOrCreateDiaryId(userId: number, name: string): Promise<number> {
    const existing = await this.diaryRepository.findOne({ where: { userId, name: name.trim() } });
    if (existing) {
      return existing.id;
    }
    const diary = await this.diariesService.create(userId, { name, icon: MEMOIR_DIARY_ICON, visibility: 'private' });
    return diary.id;
  }

  private async loadAnsweredIds(userId: number): Promise<Set<string>> {
    const answers = await this.answerRepository.find({
      where: { userId },
      relations: { entry: true },
      select: { questionId: true, entryId: true, entry: { id: true } },
    });
    return new Set(answers.filter((answer) => answer.entry).map((answer) => answer.questionId));
  }

  /** Answers whose entry is in the recycle bin load without it and count as unanswered. */
  private async loadAnswers(userId: number): Promise<AnswerSummary[]> {
    const answers = await this.answerRepository.find({
      where: { userId },
      relations: { entry: true },
      select: { questionId: true, entryId: true, createdAt: true, entry: { id: true, content: true } },
    });
    return answers.filter((answer) => answer.entry).map((answer) => ({
      questionId: answer.questionId,
      entryId: answer.entryId,
      createdAt: answer.createdAt,
      content: answer.entry?.content ?? '',
    }));
  }
}
