import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Entry, Person } from '@/database/entities';
import type { PersonDateDto } from './dto';
import { personDateDaysOn, toPersonDate, yearsOn, type PersonDateColumns } from './person-dates';

/** A person whose birthday or anniversary is on the writer's day, as Highlights shows them. */
export interface PersonOfTheDay {
  id: number;
  name: string;
  date: PersonDateDto;
  /** Their age, or the years the anniversary marks; null without the year. */
  years: number | null;
  /** Entries that mention them, leaving out the recycle bin and sealed time capsules. */
  entryCount: number;
  /** The newest of those entries, or null when there is none. */
  latestEntry: Entry | null;
}

interface PersonOfTheDayRow extends PersonDateColumns {
  id: number;
  name: string;
  entryCount: number;
  latestEntryId: number | null;
}

/** The entries that mention person `p`, as Highlights counts them: neither in the recycle bin nor sealed. */
const MENTIONING_ENTRIES = `
  FROM entry_people ep
  JOIN entries e ON e.id = ep.entry_id
 WHERE ep.person_id = p.id AND e.user_id = p.user_id AND e.deleted_at IS NULL AND e.sealed_until IS NULL`;

const PEOPLE_OF_THE_DAY_SQL = `
  SELECT p.id, p.name, p.date_kind AS "dateKind", p.date_month AS "dateMonth", p.date_day AS "dateDay", p.date_year AS "dateYear",
         (SELECT COUNT(*)::int ${MENTIONING_ENTRIES}) AS "entryCount",
         (SELECT e.id ${MENTIONING_ENTRIES}
           ORDER BY e.date DESC, e.time_of_day DESC NULLS LAST, e."index" DESC, e.id DESC LIMIT 1) AS "latestEntryId"
    FROM people p
   WHERE p.user_id = $1
     AND (p.date_month, p.date_day) IN (SELECT * FROM unnest($2::int[], $3::int[]))
   ORDER BY lower(p.name), p.id`;

/**
 * Birthdays and anniversaries on the writer's day for Highlights. A date on 29 February comes on 28 February
 * in a year without a 29th. People belong to the writer, not to a diary, so the count and the newest entry
 * read every diary, as the person's view does.
 */
@Injectable()
export class PersonDatesService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async findOn(userId: number, today: string): Promise<PersonOfTheDay[]> {
    const days = personDateDaysOn(today);
    const rows = (await this.personRepository.query(PEOPLE_OF_THE_DAY_SQL, [
      userId,
      days.map(({ month }) => month),
      days.map(({ day }) => day),
    ])) as PersonOfTheDayRow[];
    const entryIds = rows.flatMap(({ latestEntryId }) => (latestEntryId === null ? [] : [Number(latestEntryId)]));
    const entries = entryIds.length
      ? await this.entryRepository.find({ where: { id: In(entryIds), userId }, relations: { diary: true } })
      : [];
    const byId = new Map(entries.map((entry) => [entry.id, entry]));

    return rows.map((row) => {
      const date = toPersonDate(row)!;
      return {
        id: row.id,
        name: row.name,
        date,
        years: yearsOn(date.year, today),
        entryCount: Number(row.entryCount),
        latestEntry: row.latestEntryId === null ? null : byId.get(Number(row.latestEntryId)) ?? null,
      };
    });
  }
}
