import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatHistory, Entry } from '@/database/entities';
import { UserConfigModule } from '@/modules/config';
import { AiController } from './ai.controller';
import { AiBookComposerService } from './ai-book-composer.service';
import { AiService } from './ai.service';

@Module({
  imports: [UserConfigModule, TypeOrmModule.forFeature([Entry, AiChatHistory])],
  controllers: [AiController],
  providers: [AiService, AiBookComposerService],
  exports: [AiService, AiBookComposerService],
})
export class AiModule {}
