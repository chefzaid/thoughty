import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entry, EntryRevision, Diary } from '@/database/entities';
import { AiModule } from '@/modules/ai';
import { UserConfigModule } from '@/modules/config';
import { TimeCapsulesModule } from '@/modules/time-capsules/time-capsules.module';
import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';
import { EntriesQueryService } from './entries-query.service';
import { EntriesCommandService } from './entries-command.service';
import { EntryLookupService } from './entry-lookup.service';
import { EntryListCacheService } from './entry-list-cache.service';
import { EntrySearchService } from './entry-search.service';
import { EntryCalendarService } from './entry-calendar.service';
import { EntryTaggingService } from './entry-tagging.service';
import { EntryTaskListService } from './entry-task-list.service';
import { EntryMentionsService } from './entry-mentions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Entry, EntryRevision, Diary]), UserConfigModule, AiModule, TimeCapsulesModule],
  controllers: [EntriesController],
  providers: [
    EntriesService,
    EntriesQueryService,
    EntryLookupService,
    EntriesCommandService,
    EntryListCacheService,
    EntrySearchService,
    EntryCalendarService,
    EntryTaggingService,
    EntryTaskListService,
    EntryMentionsService,
  ],
  exports: [EntriesService, EntriesQueryService, EntryListCacheService, EntrySearchService, EntryMentionsService],
})
export class EntriesModule {}
