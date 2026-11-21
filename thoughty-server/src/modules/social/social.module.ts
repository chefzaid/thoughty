import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CommentLike,
  Entry,
  EntryComment,
  EntryLike,
  SavedEntry,
  UserFollow,
} from '@/database/entities';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([UserFollow, EntryComment, EntryLike, CommentLike, SavedEntry, Entry]),
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
    CommentsService,
    LikesService,
    SavedEntriesService,
    LeaderboardService,
    AchievementsService,
  ],
})
export class SocialModule {}
