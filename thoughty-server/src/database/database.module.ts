import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, Diary, Entry, EntryRevision, RefreshToken, Setting, Attachment, CloudSyncJob, AiChatHistory } from './entities';
import { buildPostgresConnectionOptions } from './postgres-connection-options';
import { buildPostgresPoolOptions } from './postgres-pool-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        ...buildPostgresConnectionOptions({
          POSTGRES_HOST: configService.get<string>('POSTGRES_HOST'),
          POSTGRES_PORT: configService.get<string>('POSTGRES_PORT'),
          POSTGRES_USER: configService.get<string>('POSTGRES_USER'),
          POSTGRES_PASSWORD: configService.get<string>('POSTGRES_PASSWORD'),
          POSTGRES_DB: configService.get<string>('POSTGRES_DB'),
          POSTGRES_READ_REPLICA_HOSTS: configService.get<string>('POSTGRES_READ_REPLICA_HOSTS'),
          POSTGRES_READ_REPLICA_PORTS: configService.get<string>('POSTGRES_READ_REPLICA_PORTS'),
          POSTGRES_READ_REPLICA_USER: configService.get<string>('POSTGRES_READ_REPLICA_USER'),
          POSTGRES_READ_REPLICA_PASSWORD: configService.get<string>('POSTGRES_READ_REPLICA_PASSWORD'),
          POSTGRES_READ_REPLICA_DB: configService.get<string>('POSTGRES_READ_REPLICA_DB'),
        }),
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
