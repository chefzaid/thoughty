import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Attachment,
  CommentLike,
  Diary,
  Entry,
  EntryComment,
  EntryLike,
  EntryRevision,
  MemoirAnswer,
  MemoirProgram,
  OnThisDayEmail,
  MonthlyRecapEmail,
  type OptInEmailSetting,
  YearReviewMood,
  SavedSearch,
  LifeEra,
  Person,
  Setting,
  User,
  UserFollow,
} from '@/database/entities';
import { isExportableSettingKey } from './config.service';

/** An opt-in email setting as the data download writes it, null when it was never saved. */
function exportOptInEmail(setting: OptInEmailSetting | null) {
  return setting
    ? {
        enabled: setting.enabled,
        deliveryHour: setting.deliveryHour,
        timeZone: setting.timeZone,
        diaryId: setting.diaryId,
        nextSendAt: setting.nextSendAt,
        lastSentOn: setting.lastSentOn,
        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt,
      }
    : null;
}

@Injectable()
export class UserDataExportService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(EntryRevision)
    private readonly revisionRepository: Repository<EntryRevision>,
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(UserFollow)
    private readonly followRepository: Repository<UserFollow>,
    @InjectRepository(EntryComment)
    private readonly commentRepository: Repository<EntryComment>,
    @InjectRepository(EntryLike)
    private readonly entryLikeRepository: Repository<EntryLike>,
    @InjectRepository(CommentLike)
    private readonly commentLikeRepository: Repository<CommentLike>,
    @InjectRepository(MemoirProgram)
    private readonly memoirProgramRepository: Repository<MemoirProgram>,
    @InjectRepository(MemoirAnswer)
    private readonly memoirAnswerRepository: Repository<MemoirAnswer>,
    @InjectRepository(YearReviewMood)
    private readonly yearReviewMoodRepository: Repository<YearReviewMood>,
    @InjectRepository(SavedSearch)
    private readonly savedSearchRepository: Repository<SavedSearch>,
    @InjectRepository(LifeEra)
    private readonly lifeEraRepository: Repository<LifeEra>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(OnThisDayEmail)
    private readonly onThisDayEmailRepository: Repository<OnThisDayEmail>,
    @InjectRepository(MonthlyRecapEmail)
    private readonly monthlyRecapEmailRepository: Repository<MonthlyRecapEmail>,
  ) {}

  async downloadData(userId: number): Promise<Record<string, unknown>> {
    const [user, diaries, entries, revisions, attachments, settings, social, memoir, yearReviewMoods, savedSearches, lifeEras, people, onThisDayEmail, monthlyRecapEmail] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.diaryRepository.find({ where: { userId }, order: { position: 'ASC' } }),
      // Entries in the recycle bin are still personal data until they are removed for good
      this.entryRepository.find({ where: { userId }, order: { date: 'ASC', index: 'ASC' }, withDeleted: true }),
      this.revisionRepository.find({ where: { userId }, order: { createdAt: 'ASC' } }),
      this.attachmentRepository.find({ where: { userId }, order: { createdAt: 'ASC' } }),
      this.settingRepository.find({ where: { userId } }),
      this.collectSocialData(userId),
      this.collectMemoirData(userId),
      this.yearReviewMoodRepository.find({ where: { userId }, order: { year: 'ASC', createdAt: 'ASC' } }),
      this.savedSearchRepository.find({ where: { userId }, order: { createdAt: 'ASC', id: 'ASC' } }),
      this.lifeEraRepository.find({ where: { userId }, order: { startDate: 'ASC', id: 'ASC' } }),
      this.collectPeople(userId),
      this.onThisDayEmailRepository.findOne({ where: { userId } }),
      this.monthlyRecapEmailRepository.findOne({ where: { userId } }),
    ]);

    const safeUser = user
      ? {
          id: user.id,
          username: user.username,
          email: user.email,
          authProvider: user.authProvider,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }
      : null;

    const safeSettings = settings
      .filter((setting) => isExportableSettingKey(setting.key))
      .map((setting) => ({
        key: setting.key,
        value: setting.value,
        updatedAt: setting.updatedAt,
      }));

    return {
      exportedAt: new Date().toISOString(),
      user: safeUser,
      diaries: diaries.map((diary) => ({
        id: diary.id,
        name: diary.name,
        icon: diary.icon,
        color: diary.color,
        visibility: diary.visibility,
        isDefault: diary.isDefault,
        position: diary.position,
        goalType: diary.goalType,
        goalTarget: diary.goalTarget,
        createdAt: diary.createdAt,
      })),
      entries: entries.map((entry) => ({
        id: entry.id,
        diaryId: entry.diaryId,
        date: entry.date,
        index: entry.index,
        timeOfDay: entry.timeOfDay,
        title: entry.title,
        mood: entry.mood,
        feelings: entry.feelings,
        content: entry.content,
        tags: entry.tags,
        format: entry.format,
        visibility: entry.visibility,
        isFavorite: entry.isFavorite,
        createdAt: entry.createdAt,
        deletedAt: entry.deletedAt,
      })),
      revisions: revisions.map((revision) => ({
        id: revision.id,
        entryId: revision.entryId,
        title: revision.title,
        timeOfDay: revision.timeOfDay,
        mood: revision.mood,
        feelings: revision.feelings,
        content: revision.content,
        tags: revision.tags,
        date: revision.date,
        format: revision.format,
        visibility: revision.visibility,
        createdAt: revision.createdAt,
      })),
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        entryId: attachment.entryId,
        originalFilename: attachment.originalFilename,
        mimetype: attachment.mimetype,
        size: attachment.size,
        transcript: attachment.transcript,
        transcribedAt: attachment.transcribedAt,
        createdAt: attachment.createdAt,
      })),
      settings: safeSettings,
      ...social,
      memoir,
      yearReviewMoods: yearReviewMoods.map((mood) => ({
        year: mood.year,
        diaryId: mood.diaryId,
        months: mood.months,
        summary: mood.summary,
        analyzedEntries: mood.analyzedEntries,
        generatedAt: mood.createdAt,
      })),
      savedSearches: savedSearches.map((saved) => ({
        name: saved.name,
        diaryId: saved.diaryId,
        filters: saved.filters,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      })),
      // The ID is what a saved search's `eraId` filter refers to
      lifeEras: lifeEras.map((era) => ({
        id: era.id,
        name: era.name,
        startDate: era.startDate,
        endDate: era.endDate,
        color: era.color,
        emoji: era.emoji,
        note: era.note,
        createdAt: era.createdAt,
        updatedAt: era.updatedAt,
      })),
      people,
      onThisDayEmail: exportOptInEmail(onThisDayEmail),
      monthlyRecapEmail: exportOptInEmail(monthlyRecapEmail),
    };
  }

  /**
   * The people the writer mentions, with their handles and the entries (recycle bin included) that
   * mention them. The ID is what a saved search's `personId` filter refers to.
   */
  private async collectPeople(userId: number) {
    const rows = (await this.personRepository.query(
      `SELECT p.id, p.name, p.created_at AS "createdAt", p.updated_at AS "updatedAt",
              COALESCE((SELECT array_agg(h.handle ORDER BY h.created_at, h.handle) FROM person_handles h WHERE h.person_id = p.id), '{}') AS handles,
              COALESCE((SELECT array_agg(ep.entry_id ORDER BY ep.entry_id) FROM entry_people ep WHERE ep.person_id = p.id), '{}') AS "entryIds"
         FROM people p
        WHERE p.user_id = $1
        ORDER BY p.id`,
      [userId],
    )) as Array<{ id: number; name: string; handles: string[]; entryIds: number[]; createdAt: Date; updatedAt: Date }>;
    return rows.map((person) => ({
      id: person.id,
      name: person.name,
      handles: person.handles,
      entryIds: person.entryIds.map(Number),
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    }));
  }

  private async collectMemoirData(userId: number) {
    const [program, answers] = await Promise.all([
      this.memoirProgramRepository.findOne({ where: { userId } }),
      this.memoirAnswerRepository.find({ where: { userId }, order: { createdAt: 'ASC' } }),
    ]);

    return {
      program: program
        ? {
            diaryId: program.diaryId,
            status: program.status,
            emailEnabled: program.emailEnabled,
            deliveryWeekday: program.deliveryWeekday,
            timeZone: program.timeZone,
            currentQuestionId: program.currentQuestionId,
            nextDeliveryAt: program.nextDeliveryAt,
            lastEmailedAt: program.lastEmailedAt,
            startedAt: program.createdAt,
          }
        : null,
      answers: answers.map((answer) => ({
        questionId: answer.questionId,
        entryId: answer.entryId,
        answeredAt: answer.createdAt,
      })),
    };
  }

  private async collectSocialData(userId: number) {
    const order = { createdAt: 'ASC' } as const;
    const [follows, comments, entryLikes, commentLikes] = await Promise.all([
      this.followRepository.find({
        where: { followerId: userId },
        relations: { followed: true },
        order,
      }),
      this.commentRepository.find({ where: { userId }, order }),
      this.entryLikeRepository.find({ where: { userId }, order }),
      this.commentLikeRepository.find({ where: { userId }, order }),
    ]);

    return {
      following: follows.map((follow) => ({
        userId: follow.followedId,
        username: follow.followed.username,
        followedAt: follow.createdAt,
      })),
      comments: comments.map((comment) => ({
        id: comment.id,
        entryId: comment.entryId,
        content: comment.content,
        createdAt: comment.createdAt,
      })),
      likes: {
        entries: entryLikes.map((like) => ({ entryId: like.entryId, likedAt: like.createdAt })),
        comments: commentLikes.map((like) => ({
          commentId: like.commentId,
          likedAt: like.createdAt,
        })),
      },
    };
  }
}
