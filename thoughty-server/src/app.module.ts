import { Module } from '@nestjs/common';
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
import { AttachmentsModule } from './modules/attachments';
import { AiModule } from './modules/ai';
import { CloudSyncModule } from './modules/cloud-sync';

@Module({
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
        ttl: 900000, // 15 minutes
        limit: 100,
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
    AttachmentsModule,
    AiModule,
    CloudSyncModule,
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
  ],
})
export class AppModule {}
