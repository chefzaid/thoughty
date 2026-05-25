import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entry, EntryRevision, Diary } from '@/database/entities';
import { AiModule } from '@/modules/ai';
import { UserConfigModule } from '@/modules/config';
import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';
import { EntriesQueryService } from './entries-query.service';
import { EntriesCommandService } from './entries-command.service';

@Module({
  imports: [TypeOrmModule.forFeature([Entry, EntryRevision, Diary]), UserConfigModule, AiModule],
  controllers: [EntriesController],
  providers: [EntriesService, EntriesQueryService, EntriesCommandService],
  exports: [EntriesService],
})
export class EntriesModule {}
