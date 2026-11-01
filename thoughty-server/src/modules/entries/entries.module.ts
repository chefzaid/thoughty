import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment, Entry, EntryRevision, Diary } from '@/database/entities';
import { AiModule } from '@/modules/ai';
import { UserConfigModule } from '@/modules/config';
import { TimeCapsulesModule } from '@/modules/time-capsules/time-capsules.module';
import { RereadRemindersModule } from '@/modules/reread-reminders/reread-reminders.module';
import { PersonDatesModule } from '@/modules/people/person-dates.module';
import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';
import { EntriesQueryService } from './entries-query.service';
import { EntriesCommandService } from './entries-command.service';
import { EntryLookupService } from './entry-lookup.service';
import { EntryListCacheService } from './entry-list-cache.service';
import { EntrySearchService } from './entry-search.service';
import { EntryCalendarService } from './entry-calendar.service';
import { EntryRandomService } from './entry-random.service';
import { EntryComfortReadsService } from './entry-comfort-reads.service';
import { EntryReaderService } from './entry-reader.service';
import { EntryTaggingService } from './entry-tagging.service';
import { EntryTaskListService } from './entry-task-list.service';
import { EntryOpenTasksService } from './entry-open-tasks.service';
import { EntryMentionsService } from './entry-mentions.service';
import { EntryInlineImagesService } from './entry-inline-images.service';

@Module({
  imports: [TypeOrmModule.forFeature([Entry, EntryRevision, Diary, Attachment]), UserConfigModule, AiModule, TimeCapsulesModule, RereadRemindersModule, PersonDatesModule],
  controllers: [EntriesController],
  providers: [
    EntriesService,
    EntriesQueryService,
    EntryLookupService,
    EntriesCommandService,
    EntryListCacheService,
    EntrySearchService,
    EntryCalendarService,
    EntryRandomService,
    EntryComfortReadsService,
    EntryReaderService,
    EntryTaggingService,
    EntryTaskListService,
    EntryOpenTasksService,
    EntryMentionsService,
    EntryInlineImagesService,
  ],
  exports: [EntriesService, EntriesQueryService, EntryListCacheService, EntrySearchService, EntryMentionsService, EntryInlineImagesService],
})
export class EntriesModule {}
