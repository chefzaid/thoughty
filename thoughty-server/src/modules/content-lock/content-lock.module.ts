import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentPin, ContentUnlock, Diary, Entry, User } from '@/database/entities';
import { AuthModule } from '@/modules/auth';
import { ContentLockController } from './content-lock.controller';
import { DiaryLockController, EntryLockController } from './content-locks.controller';
import { ContentLocksService } from './content-locks.service';
import { ContentPinService } from './content-pin.service';
import { ContentUnlockService } from './content-unlock.service';
import { ContentUnlockMiddleware } from './content-unlock.middleware';

/** The PIN lock of diaries and entries: the PIN, its unlocks, and the middleware that reads them. */
@Module({
  imports: [TypeOrmModule.forFeature([ContentPin, ContentUnlock, User, Entry, Diary]), AuthModule],
  controllers: [ContentLockController, EntryLockController, DiaryLockController],
  providers: [ContentPinService, ContentUnlockService, ContentLocksService, ContentUnlockMiddleware],
  exports: [ContentPinService],
})
export class ContentLockModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ContentUnlockMiddleware).forRoutes('{*splat}');
  }
}
