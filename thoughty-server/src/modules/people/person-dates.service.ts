import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Entry, Person } from '@/database/entities';
import type { PersonDateDto, PersonReachOutHighlightDto } from './dto';
import { personDateDaysOn, toPersonDate, yearsOn, type PersonDateColumns } from './person-dates';
import { REACH_OUT_HIGHLIGHTS_LIMIT } from './person-reach-out';
import { hideLockedEntriesSql } from '@/common/content-lock';

/** A person whose birthday or anniversary is on the writer's day, as Highlights shows them. */
export interface PersonOfTheDay {
  id: number;
  name: string;
  date: PersonDateDto;
  /** Their age, or the years the anniversary marks; null without the year. */
  years: number | null;
  /** Entries that mention them, leaving out the recycle bin, sealed time capsules and (unless unlocked) locked entries. */
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

/**
 * The entries that mention person `p`, as Highlights counts them: neither in the recycle bin nor sealed, nor
 * locked unless the request is unlocked (`lockFilter`).
 */
const mentioningEntries = (lockFilter: string) => `
  FROM entry_people ep
  JOIN entries e ON e.id = ep.entry_id
 WHERE ep.person_id = p.id AND e.user_id = p.user_id AND e.deleted_at IS NULL AND e.sealed_until IS NULL${lockFilter}`;

const peopleOfTheDaySql = (lockFilter: string) => `
  SELECT p.id, p.name, p.date_kind AS "dateKind", p.date_month AS "dateMonth", p.date_day AS "dateDay", p.date_year AS "dateYear",
         (SELECT COUNT(*)::int ${mentioningEntries(lockFilter)}) AS "entryCount",
         (SELECT e.id ${mentioningEntries(lockFilter)}
           ORDER BY e.date DESC, e.time_of_day DESC NULLS LAST, e."index" DESC, e.id DESC LIMIT 1) AS "latestEntryId"
    FROM people p
   WHERE p.user_id = $1
     AND (p.date_month, p.date_day) IN (SELECT * FROM unnest($2::int[], $3::int[]))
   ORDER BY lower(p.name), p.id`;

interface PersonReachOutRow {
  id: number;
  name: string;
  reachOutDays: number | string;
  lastContactOn: string | null;
  lastMentionedOn: string | null;
  daysSince: number | string | null;
}

/**
 * The writer's people with a reach-out reminder that is due on their day `$2`: as many days as the reminder
 * asks, or more, since the later of the last contact and the newest entry that mentions them (`GREATEST`
 * leaves out a missing one), or neither on record. The longest out of touch come first, then by name.
 */
const reachOutsDueSql = (lockFilter: string) => `
  SELECT p.id, p.name, p.reach_out_days AS "reachOutDays",
         to_char(p.last_contact_on, 'YYYY-MM-DD') AS "lastContactOn",
         to_char(m.last_mentioned_on, 'YYYY-MM-DD') AS "lastMentionedOn",
         $2::date - GREATEST(p.last_contact_on, m.last_mentioned_on) AS "daysSince"
    FROM people p
    CROSS JOIN LATERAL (SELECT MAX(e.date) AS last_mentioned_on ${mentioningEntries(lockFilter)}) m
   WHERE p.user_id = $1 AND p.reach_out_days IS NOT NULL
     AND COALESCE($2::date - GREATEST(p.last_contact_on, m.last_mentioned_on) >= p.reach_out_days, TRUE)
   ORDER BY GREATEST(p.last_contact_on, m.last_mentioned_on) ASC NULLS FIRST, lower(p.name), p.id
   LIMIT ${REACH_OUT_HIGHLIGHTS_LIMIT}`;

/**
 * Birthdays and anniversaries on the writer's day for Highlights, and the people due a reach-out. A date on 29 February comes on 28 February
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
    const rows = (await this.personRepository.query(peopleOfTheDaySql(hideLockedEntriesSql(userId)), [
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

  /**
   * The people Highlights reminds the writer to reach out to on their day `today`, the longest out of touch
   * first, up to `REACH_OUT_HIGHLIGHTS_LIMIT`. A mention counts as being in touch, like a recorded contact.
   */
  async findReachOutsDue(userId: number, today: string): Promise<PersonReachOutHighlightDto[]> {
    const rows = (await this.personRepository.query(reachOutsDueSql(hideLockedEntriesSql(userId)), [userId, today])) as PersonReachOutRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      reachOutDays: Number(row.reachOutDays),
      lastContactOn: row.lastContactOn,
      lastMentionedOn: row.lastMentionedOn,
      daysSince: row.daysSince === null ? null : Number(row.daysSince),
    }));
  }
}
