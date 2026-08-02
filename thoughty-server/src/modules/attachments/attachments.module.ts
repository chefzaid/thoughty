import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment, Entry } from '@/database/entities';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AudioTranscriptionService } from './audio-transcription.service';
import { AiModule } from '@/modules/ai/ai.module';
import { UserConfigModule } from '@/modules/config';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment, Entry]), AiModule, UserConfigModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, AudioTranscriptionService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
