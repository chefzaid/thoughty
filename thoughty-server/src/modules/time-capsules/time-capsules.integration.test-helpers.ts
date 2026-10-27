import type { DataSource } from 'typeorm';
import { Attachment, CommentLike, Diary, Entry, EntryComment, EntryLike, EntryRevision, Person, UserFollow } from '@/database/entities';
import { EntriesCommandService } from '@/modules/entries/entries-command.service';
import { EntriesQueryService } from '@/modules/entries/entries-query.service';
import { EntriesService } from '@/modules/entries/entries.service';
import { EntryCalendarService } from '@/modules/entries/entry-calendar.service';
import { EntryListCacheService } from '@/modules/entries/entry-list-cache.service';
import { EntryLookupService } from '@/modules/entries/entry-lookup.service';
import { EntryMentionsService } from '@/modules/entries/entry-mentions.service';
import { EntrySearchService } from '@/modules/entries/entry-search.service';
import { EntryTaskListService } from '@/modules/entries/entry-task-list.service';
import { PeopleService } from '@/modules/people/people.service';
import { RecycleBinService } from '@/modules/recycle-bin/recycle-bin.service';
import { CommentsService } from '@/modules/social/comments.service';
import { LikesService } from '@/modules/social/likes.service';
import { PublicFeedService } from '@/modules/social/public-feed.service';
import { TimeCapsuleDeliveryService } from './time-capsule-delivery.service';
import { timeCapsuleServiceOn } from './time-capsules.test-helpers';

/** The journal services as the API wires them, on a PostgreSQL integration spec's database, with email captured. */
export function buildTimeCapsuleBed(dataSource: DataSource) {
  const entries = dataSource.getRepository(Entry);
  const revisions = dataSource.getRepository(EntryRevision);
  const comments = dataSource.getRepository(EntryComment);
  const timeCapsules = timeCapsuleServiceOn(dataSource);
  const search = new EntrySearchService(entries);
  const cache = new EntryListCacheService({});
  const configService = { getConfig: jest.fn().mockResolvedValue({ maxPinnedEntries: '3', language: 'en' }) };
  const commands = new EntriesCommandService(
    entries,
    revisions,
    dataSource.getRepository(Diary),
    { resolveSavedTags: async (_user: number, _text: string, tags: string[]) => tags } as never,
    configService as never,
    new EntryMentionsService(entries),
    timeCapsules,
  );
  const queries = new EntriesQueryService(entries, revisions, search, timeCapsules);
  const journal = new EntriesService(
    queries,
    new EntryLookupService(entries),
    commands,
    cache,
    new EntryTaskListService(dataSource),
    new EntryCalendarService(entries, search),
    timeCapsules,
  );
  const likes = new LikesService(dataSource.getRepository(EntryLike), dataSource.getRepository(CommentLike), comments, entries);
  const emailService = { isConfigured: () => true, sendRenderedEmail: jest.fn().mockResolvedValue(undefined) };
  const delivery = new TimeCapsuleDeliveryService(
    dataSource,
    timeCapsules,
    configService as never,
    emailService as never,
    { get: (_key: string, fallback: string) => fallback } as never,
  );

  return {
    entries,
    journal,
    timeCapsules,
    delivery,
    emailService,
    bin: new RecycleBinService(
      dataSource,
      entries,
      dataSource.getRepository(Attachment),
      { removeStoredFiles: jest.fn().mockResolvedValue([]) } as never,
      configService as never,
      cache,
    ),
    people: new PeopleService(dataSource.getRepository(Person), cache),
    feed: new PublicFeedService(entries, dataSource.getRepository(UserFollow), comments, likes),
    comments: new CommentsService(comments, entries, likes),
  };
}
