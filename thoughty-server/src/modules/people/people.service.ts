import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, type EntityManager } from 'typeorm';
import { apiError } from '@/common/errors';
import { Person } from '@/database/entities';
import { PEOPLE_LIMIT, PEOPLE_LOCK_NAMESPACE } from '@/modules/entries';
import { MergePersonDto, PersonListResponseDto, PersonResponseDto, UpdatePersonDto } from './dto';
import { assertValidPersonDate, toPersonDate, type PersonDateColumns } from './person-dates';

interface PersonRow extends PersonDateColumns {
  id: number;
  name: string;
  handles: string[] | null;
  entryCount: number;
  lastMentionedOn: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Each person with their handles, how many entries outside the recycle bin mention them and the latest one's date. */
const PERSON_SUMMARY_SQL = `
  SELECT p.id, p.name, p.created_at AS "createdAt", p.updated_at AS "updatedAt",
         p.date_kind AS "dateKind", p.date_month AS "dateMonth", p.date_day AS "dateDay", p.date_year AS "dateYear",
         (SELECT array_agg(h.handle ORDER BY h.created_at, h.handle) FROM person_handles h WHERE h.person_id = p.id) AS handles,
         COUNT(e.id)::int AS "entryCount",
         to_char(MAX(e.date), 'YYYY-MM-DD') AS "lastMentionedOn"
    FROM people p
    LEFT JOIN entry_people ep ON ep.person_id = p.id
    LEFT JOIN entries e ON e.id = ep.entry_id AND e.deleted_at IS NULL
   WHERE p.user_id = $1 AND ($2::int IS NULL OR p.id = $2)
   GROUP BY p.id
   ORDER BY lower(p.name), p.id`;

/**
 * The people the writer mentions. Mentions add them (see `syncEntryMentions`); here they are listed,
 * renamed, given a birthday or an anniversary, merged and deleted. Text is never rewritten: renaming
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

  /** Changes the name shown and, when `dto.date` is given, sets their birthday or anniversary (null removes it). */
  async update(userId: number, id: number, dto: UpdatePersonDto, now = new Date()): Promise<PersonResponseDto> {
    const person = await this.personRepository.findOne({ where: { id, userId } });
    if (!person) {
      throw apiError(NotFoundException, 'PERSON_NOT_FOUND');
    }
    person.name = dto.name;
    if (dto.date !== undefined) {
      const date = dto.date;
      if (date) {
        assertValidPersonDate(date, now);
      }
      person.dateKind = date?.kind ?? null;
      person.dateMonth = date?.month ?? null;
      person.dateDay = date?.day ?? null;
      person.dateYear = date?.year ?? null;
    }
    await this.personRepository.save(person);
    return this.summary(this.personRepository.manager, userId, id);
  }

  /** Moves a duplicate's handles, entries and (when the person has none) date to the person, then deletes the duplicate. */
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
      // The person kept keeps their own date, and takes the duplicate's when they have none
      await manager.query(
        `UPDATE people p SET date_kind = d.date_kind, date_month = d.date_month, date_day = d.date_day, date_year = d.date_year
           FROM people d WHERE p.id = $1 AND d.id = $2 AND p.date_month IS NULL AND d.date_month IS NOT NULL`,
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

  private async summary(manager: EntityManager, userId: number, id: number): Promise<PersonResponseDto> {
    const [person] = await this.summaries(manager, userId, id);
    return person;
  }

  private async summaries(manager: EntityManager, userId: number, id: number | null): Promise<PersonResponseDto[]> {
    const rows = (await manager.query(PERSON_SUMMARY_SQL, [userId, id])) as PersonRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      handles: row.handles ?? [],
      entryCount: Number(row.entryCount),
      lastMentionedOn: row.lastMentionedOn,
      date: toPersonDate(row),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
}
