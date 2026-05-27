import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatHistory, Entry } from '@/database/entities';
import { UserConfigModule } from '@/modules/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [UserConfigModule, TypeOrmModule.forFeature([Entry, AiChatHistory])],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}