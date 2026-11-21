import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CommentLike,
  Entry,
  EntryComment,
  EntryLike,
  SavedEntry,
  TopicFollow,
  UserFollow,
} from '@/database/entities';
import { EntriesModule } from '@/modules/entries';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserFollow,
      TopicFollow,
      EntryComment,
      EntryLike,
      CommentLike,
      SavedEntry,
      Entry,
    ]),
    EntriesModule,
  ],
  controllers: [
    FeedController,
    FollowsController,
    CommentsController,
    LikesController,
    SavedEntriesController,
    LeaderboardController,
    AchievementsController,
  ],
  providers: [
    PublicFeedService,
    FollowsService,
    TopicFollowsService,
    CommentsService,
    LikesService,
    SavedEntriesService,
    LeaderboardService,
    AchievementsService,
  ],
})
export class SocialModule {}
