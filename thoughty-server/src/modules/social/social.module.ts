import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entry, UserFollow } from '@/database/entities';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserFollow, Entry])],
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class SocialModule {}
