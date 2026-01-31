import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Diary, Entry } from '@/database/entities';
import { DiariesController } from './diaries.controller';
import { DiariesService } from './diaries.service';

@Module({
  imports: [TypeOrmModule.forFeature([Diary, Entry])],
  controllers: [DiariesController],
  providers: [DiariesService],
  exports: [DiariesService],
})
export class DiariesModule {}
