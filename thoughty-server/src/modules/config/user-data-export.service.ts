import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Attachment,
  CalendarEvent,
  CommentLike,
  ComposerDraft,
  Diary,
  Entry,
  EntryComment,
  EntryLike,
  EntryRevision,
  MemoirAnswer,
  MemoirPhotoAnswer,
  MemoirProgram,
  MemoirSnooze,
  OnThisDayEmail,
  MonthlyRecapEmail,
  WritingReminderEmail,
  type OptInEmailSetting,
  YearReviewMood,
  WeeklyReflection,
  PersonalAccessToken,
  SavedSearch,
  LifeEra,
  Person,
  Setting,
  ShareLink,
  TimeCapsule,
  User,
  SavedEntry,
  TopicFollow,
  UserBlock,
  UserFollow,
  UserMute,
} from '@/database/entities';
import { TimeCapsuleService } from '@/modules/time-capsules/time-capsules.service';
import { PERSON_DATES_JSON_SQL, toPersonDate, type PersonDateColumns } from '@/modules/people/person-dates';
import { isExportableSettingKey } from './config.service';
import { ContentLockedException, holdsLockedContent, isContentUnlocked } from '@/common/content-lock';
import { apiError } from '@/common/errors';
import { AccountActivityService } from '@/modules/auth/account-activity/account-activity.service';

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
    @InjectRepository(TimeCapsule)
    private readonly timeCapsuleRepository: Repository<TimeCapsule>,
    private readonly timeCapsules: TimeCapsuleService,
    @InjectRepository(ShareLink)
    private readonly shareLinkRepository: Repository<ShareLink>,
    @InjectRepository(MemoirSnooze)
    private readonly memoirSnoozeRepository: Repository<MemoirSnooze>,
    @InjectRepository(ComposerDraft)
    private readonly composerDraftRepository: Repository<ComposerDraft>,
    @InjectRepository(SavedEntry)
    private readonly savedEntryRepository: Repository<SavedEntry>,
    @InjectRepository(TopicFollow)
    private readonly topicFollowRepository: Repository<TopicFollow>,
    @InjectRepository(UserMute)
    private readonly muteRepository: Repository<UserMute>,
    @InjectRepository(UserBlock)
    private readonly blockRepository: Repository<UserBlock>,
    private readonly accountActivity: AccountActivityService,
    @InjectRepository(WeeklyReflection)
    private readonly weeklyReflectionRepository: Repository<WeeklyReflection>,
    @InjectRepository(PersonalAccessToken)
    private readonly accessTokenRepository: Repository<PersonalAccessToken>,
    @InjectRepository(WritingReminderEmail)
    private readonly writingReminderEmailRepository: Repository<WritingReminderEmail>,
    @InjectRepository(MemoirPhotoAnswer)
    private readonly memoirPhotoAnswerRepository: Repository<MemoirPhotoAnswer>,
    @InjectRepository(CalendarEvent)
    private readonly calendarEventRepository: Repository<CalendarEvent>,
  ) {}

  /**
   * Everything the writer's account holds, locked diaries and entries included (it is their data), so
   * while anything is locked the request must be unlocked with the PIN (423 otherwise).
   */
  async downloadData(userId: number): Promise<Record<string, unknown>> {
    if (!isContentUnlocked(userId) && (await holdsLockedContent(this.entryRepository, userId))) {
      throw apiError(ContentLockedException, 'CONTENT_LOCKED');
    }
    const [user, diaries, entries, revisions, attachments, settings, social, memoir, yearReviewMoods, savedSearches, lifeEras, people, onThisDayEmail, monthlyRecapEmail, capsules, shareLinks, composerDraft, accountEvents, newBrowserEmail, weeklyReflections, accessTokens, writingReminderEmail, calendarEvents] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      // With each diary's own writing reminder hour, when it has one
      this.diaryRepository.find({ where: { userId }, order: { position: 'ASC' }, relations: { writingReminder: true } }),
      // Entries in the recycle bin are still personal data until they are removed for good, and sealed
      // time capsules are written as they were sealed
      this.entryRepository
        .find({ where: { userId }, order: { date: 'ASC', index: 'ASC' }, withDeleted: true })
        .then((loaded) => this.timeCapsules.reveal(loaded)),
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
      this.timeCapsuleRepository.find({ where: { userId }, order: { createdAt: 'ASC', id: 'ASC' } }),
      // The token's hash is never selected; the token itself was never kept
      this.shareLinkRepository.find({ where: { userId }, order: { createdAt: 'ASC', id: 'ASC' } }),
      this.composerDraftRepository.findOne({ where: { userId } }),
      this.accountActivity.listForDownload(userId),
      this.accountActivity.newBrowserEmailEnabled(userId),
      this.weeklyReflectionRepository.find({ where: { userId }, order: { weekEnd: 'ASC', id: 'ASC' } }),
      // The token's hash is never selected; the token itself was never kept
      this.accessTokenRepository.find({ where: { userId }, order: { createdAt: 'ASC', id: 'ASC' } }),
      this.writingReminderEmailRepository.findOne({ where: { userId } }),
      this.calendarEventRepository.find({ where: { userId }, order: { createdAt: 'ASC', id: 'ASC' } }),
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
        defaultTemplateId: diary.defaultTemplateId,
        isLocked: diary.isLocked,
        createdAt: diary.createdAt,
        writingReminder: diary.writingReminder
          ? {
              enabled: diary.writingReminder.enabled,
              deliveryHour: diary.writingReminder.deliveryHour,
              timeZone: diary.writingReminder.timeZone,
              nextSendAt: diary.writingReminder.nextSendAt,
              lastSentOn: diary.writingReminder.lastSentOn,
              createdAt: diary.writingReminder.createdAt,
              updatedAt: diary.writingReminder.updatedAt,
            }
          : null,
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
        commentPolicy: entry.commentPolicy,
        isFavorite: entry.isFavorite,
        createdAt: entry.createdAt,
        deletedAt: entry.deletedAt,
        sealedUntil: entry.sealedUntil,
        rereadOn: entry.rereadOn,
        isLocked: entry.isLocked,
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
        hasPosterFrame: Boolean(attachment.posterFilename),
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
      weeklyReflections: weeklyReflections.map((reflection) => ({
        diaryId: reflection.diaryId,
        weekStart: reflection.weekStart,
        weekEnd: reflection.weekEnd,
        themes: reflection.themes,
        summary: reflection.summary,
        question: reflection.question,
        analyzedEntries: reflection.analyzedEntries,
        generatedAt: reflection.createdAt,
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
      writingReminderEmail: exportOptInEmail(writingReminderEmail),
      // When each time capsule was sealed for and when it opened; a sealed one's text is with its entry
      timeCapsules: capsules.map((capsule) => ({
        entryId: capsule.entryId,
        opensOn: capsule.opensOn,
        openHour: capsule.openHour,
        timeZone: capsule.timeZone,
        openAt: capsule.openAt,
        openedAt: capsule.openedAt,
        sealedAt: capsule.createdAt,
      })),
      // Private share links, without their tokens: what each shares, until when, and how often it was read
      shareLinks: shareLinks.map((link) => ({
        entryId: link.entryId,
        bookVersionId: link.bookVersionId,
        label: link.label,
        showMood: link.showMood,
        showTags: link.showTags,
        maxViews: link.maxViews,
        viewCount: link.viewCount,
        lastViewedAt: link.lastViewedAt,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
      })),
      // The new entry still being written in the composer, saved from any device; null when there is none
      composerDraft: composerDraft
        ? {
            title: composerDraft.title,
            content: composerDraft.content,
            tags: composerDraft.tags,
            format: composerDraft.format,
            mood: composerDraft.mood,
            feelings: composerDraft.feelings,
            revision: composerDraft.revision,
            createdAt: composerDraft.createdAt,
            updatedAt: composerDraft.updatedAt,
          }
        : null,
      // The past year's sign-ins and security changes, with browser and system names only
      accountActivity: {
        newBrowserEmail,
        events: accountEvents.map(({ kind, browser, system, createdAt }) => ({ kind, browser, system, createdAt })),
      },
      // Personal access tokens for the public API: names, scopes and dates, never a token or its hash
      accessTokens: accessTokens.map(({ name, tokenHint, scopes, timeZone, expiresAt, lastUsedAt, createdAt }) => ({
        name, hint: tokenHint, scopes, timeZone, expiresAt, lastUsedAt, createdAt,
      })),
      // The events of the imported calendar files
      calendarEvents: calendarEvents.map(({ uid, summary, location, allDay, startsAt, endsAt, startDate, endDate, createdAt, updatedAt }) => ({
        uid, summary, location, allDay, startsAt, endsAt, startDate, endDate, importedAt: createdAt, updatedAt,
      })),
    };
  }

  /**
   * The people the writer mentions, with their handles, their birthday and anniversaries, their reach-out
   * reminder and last contact, the writer's notes on them, their groups, and the entries
   * (recycle bin included) that mention them. The ID is what a saved search's `personId` filter refers to.
   */
  private async collectPeople(userId: number) {
    const rows = (await this.personRepository.query(
      `SELECT p.id, p.name, p.created_at AS "createdAt", p.updated_at AS "updatedAt",
              ${PERSON_DATES_JSON_SQL} AS dates,
              p.reach_out_days AS "reachOutDays", to_char(p.last_contact_on, 'YYYY-MM-DD') AS "lastContactOn", p.notes, p.groups,
              COALESCE((SELECT array_agg(h.handle ORDER BY h.created_at, h.handle) FROM person_handles h WHERE h.person_id = p.id), '{}') AS handles,
              COALESCE((SELECT array_agg(ep.entry_id ORDER BY ep.entry_id) FROM entry_people ep WHERE ep.person_id = p.id), '{}') AS "entryIds"
         FROM people p
        WHERE p.user_id = $1
        ORDER BY p.id`,
      [userId],
    )) as Array<{ dates: PersonDateColumns[]; id: number; name: string; handles: string[]; entryIds: number[]; createdAt: Date; updatedAt: Date }
      & { reachOutDays: number | string | null; lastContactOn: string | null; notes: string | null; groups: string[] }>;
    return rows.map((person) => ({
      id: person.id,
      name: person.name,
      handles: person.handles,
      dates: person.dates.map(toPersonDate),
      reachOutDays: person.reachOutDays === null ? null : Number(person.reachOutDays),
      lastContactOn: person.lastContactOn,
      notes: person.notes,
      groups: person.groups,
      entryIds: person.entryIds.map(Number),
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    }));
  }

  private async collectMemoirData(userId: number) {
    const [program, answers, photoAnswers] = await Promise.all([
      this.memoirProgramRepository.findOne({ where: { userId } }),
      this.memoirAnswerRepository.find({ where: { userId }, order: { createdAt: 'ASC' } }),
      this.memoirPhotoAnswerRepository.find({ where: { userId }, order: { createdAt: 'ASC', entryId: 'ASC' } }),
    ]);

    const snoozes = program
      ? await this.memoirSnoozeRepository.find({ where: { programId: program.id }, order: { snoozedUntil: 'ASC' } })
      : [];

    return {
      program: program
        ? {
            diaryId: program.diaryId,
            status: program.status,
            emailEnabled: program.emailEnabled,
            deliveryWeekday: program.deliveryWeekday,
            timeZone: program.timeZone,
            themes: program.themes,
            currentQuestionId: program.currentQuestionId,
            nextDeliveryAt: program.nextDeliveryAt,
            lastEmailedAt: program.lastEmailedAt,
            startedAt: program.createdAt,
            setAside: snoozes.map(({ questionId, snoozedUntil }) => ({ questionId, snoozedUntil })),
          }
        : null,
      answers: answers.map((answer) => ({
        questionId: answer.questionId,
        entryId: answer.entryId,
        answeredAt: answer.createdAt,
      })),
      photoAnswers: photoAnswers.map((answer) => ({ entryId: answer.entryId, answeredAt: answer.createdAt })),
    };
  }

  private async collectSocialData(userId: number) {
    const order = { createdAt: 'ASC' } as const;
    const [follows, topics, comments, entryLikes, commentLikes, savedEntries, mutes, blocks] = await Promise.all([
      this.followRepository.find({
        where: { followerId: userId },
        relations: { followed: true },
        order,
      }),
      this.topicFollowRepository.find({ where: { userId }, order }),
      this.commentRepository.find({ where: { userId }, order }),
      this.entryLikeRepository.find({ where: { userId }, order }),
      this.commentLikeRepository.find({ where: { userId }, order }),
      this.savedEntryRepository.find({ where: { userId }, order }),
      this.muteRepository.find({ where: { userId }, relations: { muted: true }, order }),
      this.blockRepository.find({ where: { blockerId: userId }, relations: { blocked: true }, order }),
    ]);

    return {
      following: follows.map((follow) => ({
        userId: follow.followedId,
        username: follow.followed.username,
        followedAt: follow.createdAt,
      })),
      followedTopics: topics.map((topic) => ({ tag: topic.tag, followedAt: topic.createdAt })),
      mutedWriters: mutes.map((mute) => ({
        userId: mute.mutedId,
        username: mute.muted.username,
        mutedAt: mute.createdAt,
      })),
      blockedWriters: blocks.map((block) => ({
        userId: block.blockedId,
        username: block.blocked.username,
        blockedAt: block.createdAt,
      })),
      comments: comments.map((comment) => ({
        id: comment.id,
        entryId: comment.entryId,
        content: comment.content,
        createdAt: comment.createdAt,
        // The entry's writer hid it: only they and you see it
        hiddenAt: comment.hiddenAt,
      })),
      likes: {
        entries: entryLikes.map((like) => ({ entryId: like.entryId, likedAt: like.createdAt })),
        comments: commentLikes.map((like) => ({
          commentId: like.commentId,
          likedAt: like.createdAt,
        })),
      },
      savedEntries: savedEntries.map((saved) => ({
        entryId: saved.entryId,
        savedAt: saved.createdAt,
      })),
    };
  }
}
