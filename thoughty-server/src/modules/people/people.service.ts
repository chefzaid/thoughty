import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, type EntityManager } from 'typeorm';
import { apiError } from '@/common/errors';
import { Person } from '@/database/entities';
import { EntryListCacheService, PEOPLE_LIMIT, PEOPLE_LOCK_NAMESPACE } from '@/modules/entries';
import { MergePersonDto, PersonListResponseDto, PersonResponseDto, UpdatePersonDto } from './dto';

interface PersonRow {
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
 * renamed, merged and deleted. Text is never rewritten: renaming changes the name shown, merging moves
 * a duplicate's handles to the person kept, and deleting unlinks their entries and leaves `@handle` in the text.
 */
@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    private readonly entryListCache: EntryListCacheService,
  ) {}

  async list(userId: number): Promise<PersonListResponseDto> {
    return { people: await this.summaries(this.personRepository.manager, userId, null), limit: PEOPLE_LIMIT };
  }

  async rename(userId: number, id: number, dto: UpdatePersonDto): Promise<PersonResponseDto> {
    const person = await this.personRepository.findOne({ where: { id, userId } });
    if (!person) {
      throw apiError(NotFoundException, 'PERSON_NOT_FOUND');
    }
    person.name = dto.name;
    await this.personRepository.save(person);
    return this.summary(this.personRepository.manager, userId, id);
  }

  /** Moves a duplicate's handles and entries to the person, then deletes the duplicate. */
  async merge(userId: number, id: number, dto: MergePersonDto): Promise<PersonResponseDto> {
    const duplicateId = dto.duplicateId;
    if (duplicateId === id) {
      throw apiError(BadRequestException, 'PERSON_MERGE_SAME');
    }
    const merged = await this.personRepository.manager.transaction(async (manager) => {
      // Saving an entry links it under the same lock, so no link to the duplicate is added meanwhile
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [PEOPLE_LOCK_NAMESPACE, userId]);
      const found = await manager.getRepository(Person).count({ where: { id: In([id, duplicateId]), userId } });
      if (found !== 2) {
        throw apiError(NotFoundException, 'PERSON_NOT_FOUND');
      }
      await manager.query('UPDATE person_handles SET person_id = $1 WHERE person_id = $2', [id, duplicateId]);
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
    this.entryListCache.invalidateUser(userId);
    return merged;
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
    this.entryListCache.invalidateUser(userId);
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
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
}
