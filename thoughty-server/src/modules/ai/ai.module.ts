import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatHistory, Entry } from '@/database/entities';
import { UserConfigModule } from '@/modules/config';
import { AiController } from './ai.controller';
import { AiBookComposerService } from './ai-book-composer.service';
import { AiService } from './ai.service';
import { AiPersonalityService } from './ai-personality.service';
import { AiDuplicateService } from './ai-duplicate.service';
import { AiSemanticSearchService } from './ai-semantic-search.service';

@Module({
  imports: [UserConfigModule, TypeOrmModule.forFeature([Entry, AiChatHistory])],
  controllers: [AiController],
  providers: [
    AiService,
    AiBookComposerService,
    AiPersonalityService,
    AiDuplicateService,
    AiSemanticSearchService,
  ],
  exports: [AiService, AiBookComposerService, AiPersonalityService],
})
export class AiModule {}
