import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entry, EntryRevision, Diary } from '@/database/entities';
import { AiModule } from '@/modules/ai';
import { UserConfigModule } from '@/modules/config';
import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';

@Module({
  imports: [TypeOrmModule.forFeature([Entry, EntryRevision, Diary]), UserConfigModule, AiModule],
  controllers: [EntriesController],
  providers: [EntriesService],
  exports: [EntriesService],
})
export class EntriesModule {}
