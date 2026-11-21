import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CommentLike,
  Entry,
  EntryComment,
  EntryLike,
  SavedEntry,
  Setting,
  TopicFollow,
  UserBlock,
  UserFollow,
  UserMute,
} from '@/database/entities';
import { EntriesModule } from '@/modules/entries';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { CommentControlsController } from './comment-controls.controller';
import { CommentControlsService } from './comment-controls.service';
import { CommentPolicyService } from './comment-policy.service';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { FeedController } from './feed.controller';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';
import { PublicFeedService } from './public-feed.service';
import { SavedEntriesController } from './saved-entries.controller';
import { SavedEntriesService } from './saved-entries.service';
import { TopicFollowsService } from './topic-follows.service';
import { WriterControlsController } from './writer-controls.controller';
import { WriterControlsService } from './writer-controls.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserFollow,
      TopicFollow,
      EntryComment,
      EntryLike,
      CommentLike,
      SavedEntry,
      Setting,
      Entry,
      UserMute,
      UserBlock,
    ]),
    EntriesModule,
  ],
  controllers: [
    FeedController,
    FollowsController,
    CommentsController,
    CommentControlsController,
    LikesController,
    SavedEntriesController,
    LeaderboardController,
    AchievementsController,
    WriterControlsController,
  ],
  providers: [
    PublicFeedService,
    FollowsService,
    TopicFollowsService,
    CommentsService,
    CommentPolicyService,
    CommentControlsService,
    LikesService,
    SavedEntriesService,
    LeaderboardService,
    AchievementsService,
    WriterControlsService,
  ],
})
export class SocialModule {}
