import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entry, EntryComment, UserFollow } from '@/database/entities';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserFollow, EntryComment, Entry])],
  controllers: [FollowsController, CommentsController],
  providers: [FollowsService, CommentsService],
})
export class SocialModule {}
