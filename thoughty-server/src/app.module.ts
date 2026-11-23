import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './database';
import { AuthModule, JwtAuthGuard } from './modules/auth';
import { EntriesModule } from './modules/entries';
import { DiariesModule } from './modules/diaries';
import { StatsModule } from './modules/stats';
import { UserConfigModule } from './modules/config';
import { IoModule } from './modules/io';
import { BooksModule } from './modules/books';
import { AttachmentsModule } from './modules/attachments';
import { AiModule } from './modules/ai';
import { CloudSyncModule } from './modules/cloud-sync';
import { MetricsModule } from './modules/metrics';
import { FeatureRequestsModule } from './modules/feature-requests';
import { SocialModule } from './modules/social';
import { MemoirModule } from './modules/memoir';
import { ReviewModule } from './modules/review';
import { RecycleBinModule } from './modules/recycle-bin';
import { SavedSearchesModule } from './modules/saved-searches';
import { LifeErasModule } from './modules/life-eras';
import { CalendarModule } from './modules/calendar';
import { PeopleModule } from './modules/people';
import { OnThisDayEmailModule } from './modules/on-this-day-email';
import { MonthlyRecapEmailModule } from './modules/monthly-recap-email';
import { WritingReminderEmailModule } from './modules/writing-reminder-email';
import { YearReviewEmailModule } from './modules/year-review-email';
import { OptInEmailModule } from './modules/opt-in-email';
import { AccountPurgeModule } from './modules/account-purge';
import { TimeCapsuleEmailModule } from './modules/time-capsules';
import { ShareLinksModule } from './modules/share-links';
import { ComposerDraftsModule } from './modules/composer-drafts';
import { ContentLockModule } from './modules/content-lock';
import { AccessTokensModule } from './modules/access-tokens';
import { HealthController } from './health.controller';
import {
  createThrottlerModuleOptions,
  ApiErrorCodeFilter,
  DatabaseInputExceptionFilter,
  FeatureFlagGuard,
  FeatureFlagsModule,
  JsonLogger,
  applyRequestLogging,
} from './common';

@Module({
  controllers: [HealthController],
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot(createThrottlerModuleOptions()),

    // Database
    DatabaseModule,

    // Runtime feature flags, read by the guard below and by the services that check one
    FeatureFlagsModule,

    // Feature modules
    AuthModule,
    EntriesModule,
    DiariesModule,
    StatsModule,
    UserConfigModule,
    IoModule,
    BooksModule,
    AttachmentsModule,
    AiModule,
    CloudSyncModule,
    MetricsModule,
    FeatureRequestsModule,
    SocialModule,
    MemoirModule,
    ReviewModule,
    RecycleBinModule,
    SavedSearchesModule,
    LifeErasModule,
    CalendarModule,
    PeopleModule,
    OnThisDayEmailModule,
    MonthlyRecapEmailModule,
    WritingReminderEmailModule,
    YearReviewEmailModule,
    OptInEmailModule,
    AccountPurgeModule,
    TimeCapsuleEmailModule,
    ShareLinksModule,
    ComposerDraftsModule,
    ContentLockModule,
    AccessTokensModule,
  ],
  providers: [
    // Global JWT Auth Guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Refuses a `@RequireFeature` route while its feature flag is off (after auth and rate limits)
    {
      provide: APP_GUARD,
      useClass: FeatureFlagGuard,
    },
    // Client input rejected by the database (e.g. out-of-range ids) is a 400, not a 500
    {
      provide: APP_FILTER,
      useClass: DatabaseInputExceptionFilter,
    },
    // Every HTTP error carries a machine-readable `code` the web app translates
    {
      provide: APP_FILTER,
      useClass: ApiErrorCodeFilter,
    },
    {
      provide: JsonLogger,
      useValue: new JsonLogger('App'),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    applyRequestLogging(consumer);
  }
}
