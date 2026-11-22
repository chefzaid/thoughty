import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, type EntityManager } from 'typeorm';
import { apiError } from '@/common/errors';
import { Person, PersonDate } from '@/database/entities';
import { PEOPLE_LIMIT, PEOPLE_LOCK_NAMESPACE } from '@/modules/entries';
import { MergePersonDto, PersonListResponseDto, PersonResponseDto, UpdatePersonDto } from './dto';
import { assertValidPersonDates, PERSON_DATES_JSON_SQL, toPersonDate, type PersonDateColumns } from './person-dates';
import { normalizePersonGroups } from './person-groups';
import { assertValidContactDay } from './person-reach-out';
import { hideLockedEntriesSql } from '@/common/content-lock';

interface PersonRow {
  id: number;
  dates: PersonDateColumns[];
  name: string;
  handles: string[] | null;
  entryCount: number;
  lastMentionedOn: string | null;
  reachOutDays: number | string | null;
  lastContactOn: string | null;
  notes: string | null;
  groups: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Each person with their handles, how many entries outside the recycle bin mention them and the latest
 * one's date; locked entries count only while the request is unlocked (`lockFilter`).
 */
const personSummarySql = (lockFilter: string) => `
  SELECT p.id, p.name, p.created_at AS "createdAt", p.updated_at AS "updatedAt",
         ${PERSON_DATES_JSON_SQL} AS dates,
         p.reach_out_days AS "reachOutDays", to_char(p.last_contact_on, 'YYYY-MM-DD') AS "lastContactOn", p.notes, p.groups,
         (SELECT array_agg(h.handle ORDER BY h.created_at, h.handle) FROM person_handles h WHERE h.person_id = p.id) AS handles,
         COUNT(e.id)::int AS "entryCount",
         to_char(MAX(e.date), 'YYYY-MM-DD') AS "lastMentionedOn"
    FROM people p
    LEFT JOIN entry_people ep ON ep.person_id = p.id
    LEFT JOIN entries e ON e.id = ep.entry_id AND e.deleted_at IS NULL${lockFilter}
   WHERE p.user_id = $1 AND ($2::int IS NULL OR p.id = $2)
   GROUP BY p.id
   ORDER BY lower(p.name), p.id`;

/**
 * The people the writer mentions. Mentions add them (see `syncEntryMentions`); here they are listed,
 * renamed, given a birthday and anniversaries, a reach-out reminder, notes and groups, marked as contacted, merged and deleted. Text is never rewritten: renaming
 * changes the name shown, merging moves a duplicate's handles to the person kept, and deleting unlinks
 * their entries and leaves `@handle` in the text.
 */
@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
  ) {}

  async list(userId: number): Promise<PersonListResponseDto> {
    return { people: await this.summaries(this.personRepository.manager, userId, null), limit: PEOPLE_LIMIT };
  }

  /**
   * Changes the name shown and, for each of them given, their reach-out reminder, their last contact and the writer's
   * notes (null removes it), and their groups and their important dates (an empty list removes them).
   */
  async update(userId: number, id: number, dto: UpdatePersonDto, now = new Date()): Promise<PersonResponseDto> {
    const person = await this.findOwn(userId, id);
    if (dto.lastContactOn) {
      assertValidContactDay(dto.lastContactOn, now);
    }
    if (dto.dates) {
      assertValidPersonDates(dto.dates, now);
    }
    person.name = dto.name;
    if (dto.reachOutDays !== undefined) {
      person.reachOutDays = dto.reachOutDays;
    }
    if (dto.lastContactOn !== undefined) {
      person.lastContactOn = dto.lastContactOn;
    }
    if (dto.notes !== undefined) {
      person.notes = dto.notes;
    }
    if (dto.groups !== undefined) {
      person.groups = normalizePersonGroups(dto.groups, await this.groupsOfOthers(userId, id));
    }
    const dates = dto.dates;
    return this.personRepository.manager.transaction(async (manager) => {
      await manager.getRepository(Person).save(person);
      if (dates) {
        const repository = manager.getRepository(PersonDate);
        await repository.delete({ personId: id });
        const rows = dates.map(({ kind, label, month, day, year }) => ({ personId: id, kind, label: label ?? null, month, day, year: year ?? null }));
        if (rows.length) {
          await repository.insert(rows);
        }
      }
      return this.summary(manager, userId, id);
    });
  }

  /** Records the writer's day `today` (already checked as theirs) as the last contact, which ends a due reach-out. */
  async markContacted(userId: number, id: number, today: string): Promise<PersonResponseDto> {
    const person = await this.findOwn(userId, id);
    person.lastContactOn = today;
    await this.personRepository.save(person);
    return this.summary(this.personRepository.manager, userId, id);
  }

  /**
   * Moves a duplicate's handles, entries, dates (but a second birthday or a date the person already has) and, when the
   * person has none, reach-out reminder to the person, keeps the later of their last contacts, adds the duplicate's
   * notes after the person's and the duplicate's groups the person is not in (ignoring case) after theirs, then deletes
   * the duplicate.
   */
  async merge(userId: number, id: number, dto: MergePersonDto): Promise<PersonResponseDto> {
    const duplicateId = dto.duplicateId;
    if (duplicateId === id) {
      throw apiError(BadRequestException, 'PERSON_MERGE_SAME');
    }
    return this.personRepository.manager.transaction(async (manager) => {
      // Saving an entry links it under the same lock, so no link to the duplicate is added meanwhile
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [PEOPLE_LOCK_NAMESPACE, userId]);
      const found = await manager.getRepository(Person).count({ where: { id: In([id, duplicateId]), userId } });
      if (found !== 2) {
        throw apiError(NotFoundException, 'PERSON_NOT_FOUND');
      }
      await manager.query('UPDATE person_handles SET person_id = $1 WHERE person_id = $2', [id, duplicateId]);
      // The person kept keeps their own dates and takes the duplicate's others: not a second birthday, nor a date
      // they already have (the same kind, day and label ignoring case), which go with the duplicate
      await manager.query(
        `UPDATE person_dates d SET person_id = $1
          WHERE d.person_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM person_dates own
               WHERE own.person_id = $1 AND own.kind = d.kind
                 AND (d.kind = 'birthday' OR (own.month = d.month AND own.day = d.day
                      AND lower(COALESCE(own.label, '')) = lower(COALESCE(d.label, '')))))`,
        [id, duplicateId],
      );
      await manager.query(
        `UPDATE people p SET reach_out_days = COALESCE(p.reach_out_days, d.reach_out_days),
                             last_contact_on = GREATEST(p.last_contact_on, d.last_contact_on),
                             notes = CASE WHEN p.notes IS NULL OR d.notes IS NULL THEN COALESCE(p.notes, d.notes)
                                          ELSE p.notes || E'\\n\\n' || d.notes END,
                             groups = p.groups || ARRAY(
                               SELECT g FROM unnest(d.groups) WITH ORDINALITY AS dg(g, n)
                                WHERE lower(g) <> ALL (SELECT lower(own) FROM unnest(p.groups) AS own)
                                ORDER BY n)
           FROM people d WHERE p.id = $1 AND d.id = $2`,
        [id, duplicateId],
      );
      await manager.query(
        `INSERT INTO entry_people (entry_id, person_id)
         SELECT entry_id, $1 FROM entry_people WHERE person_id = $2 ON CONFLICT DO NOTHING`,
        [id, duplicateId],
      );
      await manager.query(
        `UPDATE saved_searches SET filters = jsonb_set(filters, '{personId}', to_jsonb($2::int)), updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND filters->>'personId' = $3`,
        [userId, id, String(duplicateId)],
      );
      await manager.getRepository(Person).delete({ id: duplicateId, userId });
      await manager.getRepository(Person).update({ id, userId }, { updatedAt: new Date() });
      return this.summary(manager, userId, id);
    });
  }

  /** Deletes a person and their links; entries keep their text, and saved searches for them widen to anyone. */
  async delete(userId: number, id: number): Promise<{ success: boolean }> {
    await this.personRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [PEOPLE_LOCK_NAMESPACE, userId]);
      const result = await manager.getRepository(Person).delete({ id, userId });
      if (!result.affected) {
        throw apiError(NotFoundException, 'PERSON_NOT_FOUND');
      }
      await manager.query(
        `UPDATE saved_searches SET filters = jsonb_set(filters, '{personId}', 'null'::jsonb), updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND filters->>'personId' = $2`,
        [userId, String(id)],
      );
    });
    return { success: true };
  }

  private async findOwn(userId: number, id: number): Promise<Person> {
    const person = await this.personRepository.findOne({ where: { id, userId } });
    if (!person) {
      throw apiError(NotFoundException, 'PERSON_NOT_FOUND');
    }
    return person;
  }

  /** The group names the writer gives their other people, to spell a group the same way on everyone in it. */
  private async groupsOfOthers(userId: number, id: number): Promise<string[]> {
    const rows = (await this.personRepository.query(
      'SELECT DISTINCT g AS name FROM people p, unnest(p.groups) AS g WHERE p.user_id = $1 AND p.id <> $2 ORDER BY g',
      [userId, id],
    )) as Array<{ name: string }>;
    return rows.map((row) => row.name);
  }

  private async summary(manager: EntityManager, userId: number, id: number): Promise<PersonResponseDto> {
    const [person] = await this.summaries(manager, userId, id);
    return person;
  }

  private async summaries(manager: EntityManager, userId: number, id: number | null): Promise<PersonResponseDto[]> {
    const rows = (await manager.query(personSummarySql(hideLockedEntriesSql(userId)), [userId, id])) as PersonRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      handles: row.handles ?? [],
      entryCount: Number(row.entryCount),
      lastMentionedOn: row.lastMentionedOn,
      dates: row.dates.map(toPersonDate),
      reachOutDays: row.reachOutDays === null ? null : Number(row.reachOutDays),
      lastContactOn: row.lastContactOn,
      notes: row.notes,
      groups: row.groups,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
}
