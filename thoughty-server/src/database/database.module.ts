import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, Diary, Entry, EntryRevision, RefreshToken, Setting, Attachment, CloudSyncJob, AiChatHistory } from './entities';
import { buildPostgresPoolOptions } from './postgres-pool-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST', 'localhost'),
        port: configService.get<number>('POSTGRES_PORT', 5432),
        username: configService.get<string>('POSTGRES_USER', 'postgres'),
        password: configService.get<string>('POSTGRES_PASSWORD', 'password'),
        database: configService.get<string>('POSTGRES_DB', 'journal'),
        entities: [User, Diary, Entry, EntryRevision, RefreshToken, Setting, Attachment, CloudSyncJob, AiChatHistory],
        extra: buildPostgresPoolOptions({
          POSTGRES_POOL_MAX: configService.get<string>('POSTGRES_POOL_MAX'),
          POSTGRES_POOL_IDLE_TIMEOUT_MS: configService.get<string>('POSTGRES_POOL_IDLE_TIMEOUT_MS'),
          POSTGRES_POOL_CONNECTION_TIMEOUT_MS: configService.get<string>('POSTGRES_POOL_CONNECTION_TIMEOUT_MS'),
        }),
        synchronize: false, // Don't auto-sync in production; use migrations
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),
    TypeOrmModule.forFeature([User, Diary, Entry, RefreshToken, Setting, Attachment, CloudSyncJob, AiChatHistory]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
