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
import { HealthController } from './health.controller';
import {
  createThrottlerModuleOptions,
  DatabaseInputExceptionFilter,
  JsonLogger,
  RequestLoggingMiddleware,
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
    // Client input rejected by the database (e.g. out-of-range ids) is a 400, not a 500
    {
      provide: APP_FILTER,
      useClass: DatabaseInputExceptionFilter,
    },
    {
      provide: JsonLogger,
      useValue: new JsonLogger('App'),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
