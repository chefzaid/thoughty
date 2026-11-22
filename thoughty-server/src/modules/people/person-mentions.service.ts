import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { hideLockedEntriesSql } from '@/common/content-lock';
import { Person } from '@/database/entities';
import { mentionMonthsSql, mentionsOverTime, type MentionMonthRow, type MentionsOverTime } from './person-mentions';

const groupKey = (name: string) => name.toLocaleLowerCase();

/**
 * How often the writer's entries mention a person, or anyone in one of their groups, month by month and year by year,
 * with the mood of those entries. People belong to the writer, not to a diary, so every diary counts.
 */
@Injectable()
export class PersonMentionsService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
  ) {}

  async forPerson(userId: number, id: number, today: string): Promise<MentionsOverTime> {
    if (!(await this.personRepository.exists({ where: { id, userId } }))) {
      throw apiError(NotFoundException, 'PERSON_NOT_FOUND');
    }
    return this.count(userId, [id], today);
  }

  /** An entry that mentions several people of the group counts once; a group no one is in has no mentions. */
  async forGroup(userId: number, group: string, today: string): Promise<MentionsOverTime> {
    const key = groupKey(group);
    const people = await this.personRepository.find({ where: { userId }, select: { id: true, groups: true } });
    const ids = people.filter((person) => person.groups.some((name) => groupKey(name) === key)).map((person) => person.id);
    return this.count(userId, ids, today);
  }

  private async count(userId: number, ids: number[], today: string): Promise<MentionsOverTime> {
    const rows = ids.length
      ? ((await this.personRepository.query(mentionMonthsSql(hideLockedEntriesSql(userId)), [userId, today, ids])) as MentionMonthRow[])
      : [];
    return mentionsOverTime(rows, today);
  }
}
