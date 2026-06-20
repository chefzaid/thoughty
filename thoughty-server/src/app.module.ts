import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
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
import { HealthController } from './health.controller';
import { JsonLogger, RATE_LIMITS, RequestLoggingMiddleware } from './common';

@Module({
  controllers: [HealthController],
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ...RATE_LIMITS.default,
      },
    ]),

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
    JsonLogger,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
