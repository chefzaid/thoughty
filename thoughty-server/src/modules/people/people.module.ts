import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from '@/database/entities';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { PersonMentionsService } from './person-mentions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Person])],
  controllers: [PeopleController],
  providers: [PeopleService, PersonMentionsService],
  exports: [PeopleService],
})
export class PeopleModule {}
