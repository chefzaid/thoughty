import { ServiceUnavailableException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AiController } from '@/modules/ai/ai.controller';
import { AttachmentsController } from '@/modules/attachments/attachments.controller';
import { BooksController } from '@/modules/books/books.controller';
import { CloudSyncController } from '@/modules/cloud-sync/cloud-sync.controller';
import { ReviewController } from '@/modules/review/review.controller';
import { ShareLinksController } from '@/modules/share-links/share-links.controller';
import { SharedContentController } from '@/modules/share-links/shared-content.controller';
import { CommentsController } from '@/modules/social/comments.controller';
import { FeedController } from '@/modules/social/feed.controller';
import { FollowsController } from '@/modules/social/follows.controller';
import { LeaderboardController } from '@/modules/social/leaderboard.controller';
import { LikesController } from '@/modules/social/likes.controller';
import { StatsController } from '@/modules/stats/stats.controller';
import { FeatureFlagGuard } from './feature-flag.guard';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlag } from './feature-flags.service';
import { featureFlagsWith } from './feature-flags.test-helpers';

type Controller = { prototype: object; name: string };

function routeContext(controller: Controller, method: string): ExecutionContext {
  const handler = (controller.prototype as Record<string, () => unknown>)[method];
  if (!handler) throw new Error(`${controller.name}.${method} does not exist`);
  return { getHandler: () => handler, getClass: () => controller } as unknown as ExecutionContext;
}

function guardWith(flags: Partial<Record<FeatureFlag, boolean>>): FeatureFlagGuard {
  return new FeatureFlagGuard(new Reflector(), featureFlagsWith(flags));
}

/** Routes of each feature, as `[controller, method]`. */
const GUARDED_ROUTES: Record<FeatureFlag, Array<[Controller, string]>> = {
  ai: [
    [AiController, 'listModels'],
    [AiController, 'saveCredential'],
    [AiController, 'getUsage'],
    [AiController, 'suggestTags'],
    [AiController, 'fixWriting'],
    [AiController, 'summarizeEntry'],
    [AiController, 'generateInspiration'],
    [AiController, 'findDuplicates'],
    [AiController, 'semanticSearch'],
    [AiController, 'previewJournalRetag'],
    [AiController, 'applyJournalRetag'],
    [AiController, 'chat'],
    [AiController, 'getHistory'],
    [AttachmentsController, 'transcribe'],
    [ReviewController, 'readMood'],
    [StatsController, 'analyzePersonality'],
  ],
  bookConverter: [
    [BooksController, 'listVersions'],
    [BooksController, 'createVersion'],
    [BooksController, 'downloadVersion'],
    [BooksController, 'pickedEntries'],
    [BooksController, 'preview'],
    [BooksController, 'export'],
    [BooksController, 'exportWithCover'],
    [BooksController, 'upload'],
  ],
  cloudSync: [
    [CloudSyncController, 'getStatus'],
    [CloudSyncController, 'getAuthUrl'],
    [CloudSyncController, 'connect'],
    [CloudSyncController, 'listFiles'],
    [CloudSyncController, 'upload'],
    [CloudSyncController, 'download'],
    [CloudSyncController, 'getSchedules'],
    [CloudSyncController, 'setSchedule'],
    [CloudSyncController, 'deleteSchedule'],
    [CloudSyncController, 'triggerSync'],
  ],
  publicSharing: [
    [FeedController, 'getFeed'],
    [CommentsController, 'list'],
    [CommentsController, 'create'],
    [CommentsController, 'remove'],
    [LikesController, 'likeEntry'],
    [LikesController, 'unlikeComment'],
    [FollowsController, 'list'],
    [FollowsController, 'follow'],
    [LeaderboardController, 'getLeaderboard'],
    [ShareLinksController, 'create'],
    [SharedContentController, 'open'],
    [SharedContentController, 'downloadBook'],
    [SharedContentController, 'attachment'],
    [SharedContentController, 'poster'],
  ],
};

/** What a writer stored can always be taken back, whatever the flags: an AI key, a cloud connection, a share link. */
const ALWAYS_OPEN_ROUTES: Array<[Controller, string]> = [
  [AiController, 'getCredentialStatus'],
  [AiController, 'removeCredential'],
  [CloudSyncController, 'disconnect'],
  [ShareLinksController, 'list'],
  [ShareLinksController, 'revoke'],
  [AttachmentsController, 'upload'],
  [ReviewController, 'getReview'],
  [StatsController, 'getStats'],
];

const ALL_OFF = Object.fromEntries(Object.keys(DEFAULT_FEATURE_FLAGS).map((flag) => [flag, false]));

describe('FeatureFlagGuard', () => {
  describe.each(Object.entries(GUARDED_ROUTES) as Array<[FeatureFlag, Array<[Controller, string]>]>)(
    'the %s feature',
    (flag, routes) => {
      it.each(routes.map(([controller, method]) => [`${controller.name}.${method}`, controller, method] as const))(
        'refuses %s with 503 FEATURE_DISABLED while it is off',
        async (_name, controller, method) => {
          const refusal = await guardWith({ [flag]: false }).canActivate(routeContext(controller, method))
            .catch((error: unknown) => error);

          expect(refusal).toBeInstanceOf(ServiceUnavailableException);
          expect((refusal as ServiceUnavailableException).getResponse()).toMatchObject({ code: 'FEATURE_DISABLED' });
        },
      );

      it('lets its routes through while it is on, even with every other feature off', async () => {
        const guard = guardWith({ ...ALL_OFF, [flag]: true });
        for (const [controller, method] of routes) {
          await expect(guard.canActivate(routeContext(controller, method))).resolves.toBe(true);
        }
      });
    },
  );

  it.each(ALWAYS_OPEN_ROUTES.map(([controller, method]) => [`${controller.name}.${method}`, controller, method] as const))(
    'lets %s through with every feature off',
    async (_name, controller, method) => {
      await expect(guardWith(ALL_OFF).canActivate(routeContext(controller, method))).resolves.toBe(true);
    },
  );
});
