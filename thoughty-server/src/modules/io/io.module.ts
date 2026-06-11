import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entry, Setting, Diary, User } from '@/database/entities';
import { IoController } from './io.controller';
import { IoService } from './io.service';

@Module({
  imports: [TypeOrmModule.forFeature([Entry, Setting, Diary, User])],
  controllers: [IoController],
  providers: [IoService],
  exports: [IoService],
})
export class IoModule {}
