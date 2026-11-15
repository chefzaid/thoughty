import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComposerDraft } from '@/database/entities';
import { ComposerDraftsController } from './composer-drafts.controller';
import { ComposerDraftsService } from './composer-drafts.service';

@Module({
  imports: [TypeOrmModule.forFeature([ComposerDraft])],
  controllers: [ComposerDraftsController],
  providers: [ComposerDraftsService],
})
export class ComposerDraftsModule {}
