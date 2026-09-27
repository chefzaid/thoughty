import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentLike, Entry, EntryComment, EntryLike, UserFollow } from '@/database/entities';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { FeedController } from './feed.controller';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';
import { PublicFeedService } from './public-feed.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserFollow, EntryComment, EntryLike, CommentLike, Entry])],
  controllers: [FeedController, FollowsController, CommentsController, LikesController],
  providers: [PublicFeedService, FollowsService, CommentsService, LikesService],
})
export class SocialModule {}
