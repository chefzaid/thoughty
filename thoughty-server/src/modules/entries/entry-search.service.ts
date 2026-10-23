import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { ENTRY_SEARCH_CONFIGS, parseEntrySearch, type EntrySearchTerm } from './entry-search-query';

/** A search PostgreSQL can read as words, or one it cannot (only symbols or emoji), matched literally. */
export type PreparedEntrySearch =
  | {
      kind: 'text';
      text: string;
      /** What entries must match: the search with its last word read as a prefix. */
      matchQuery: string;
      /** The search as typed, when it differs from `matchQuery` and ranks whole-word matches higher. */
      exactQuery?: string;
      terms: EntrySearchTerm[];
    }
  | { kind: 'literal'; text: string };

/** At most this many distinct matches are returned for one entry. */
const MAX_MATCHES_PER_ENTRY = 20;
const MARK_START = '\u0002';
const MARK_END = '\u0003';
const HEADLINE_OPTIONS = `HighlightAll=true, StartSel="${MARK_START}", StopSel="${MARK_END}"`;
/** Marked words with nothing but spaces or punctuation between them form one match. */
const MARKED_RUN_PATTERN =
  `${MARK_START}[^${MARK_END}]*${MARK_END}` +
  `(?:[^${MARK_START}${MARK_END}[:alnum:]]{1,8}${MARK_START}[^${MARK_END}]*${MARK_END})*`;

function anyConfig(build: (config: string) => string): string {
  return `(${ENTRY_SEARCH_CONFIGS.map((config) => build(`'${config}'`)).join(' || ')})`;
}

@Injectable()
export class EntrySearchService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  /** Turns a typed search into the tsquery entries are matched and ranked with. */
  async prepare(search: string): Promise<PreparedEntrySearch | null> {
    const parsed = parseEntrySearch(search);
    if (!parsed.text) {
      return null;
    }

    const exact = anyConfig((config) => `websearch_to_tsquery(${config}, $1)`);
    const params: string[] = [parsed.text];
    let match = exact;
    if (parsed.prefix) {
      const rest = anyConfig((config) => `websearch_to_tsquery(${config}, $2)`);
      const prefix = anyConfig((config) => `to_tsquery(${config}, $3)`);
      match = `(${rest} ${parsed.prefix.joinWithOr ? '||' : '&&'} ${prefix})`;
      params.push(parsed.prefix.rest, `${parsed.prefix.word}:*`);
    }

    const [row] = (await this.entryRepository.query(
      `SELECT match_query::text AS "matchQuery", numnode(match_query) AS "matchNodes",
              exact_query::text AS "exactQuery", numnode(exact_query) AS "exactNodes"
         FROM (SELECT ${match} AS match_query, ${exact} AS exact_query) AS search`,
      params,
    )) as Array<{ matchQuery: string; matchNodes: number; exactQuery: string; exactNodes: number }>;

    if (!row || Number(row.matchNodes) === 0) {
      return { kind: 'literal', text: parsed.text };
    }

    return {
      kind: 'text',
      text: parsed.text,
      matchQuery: row.matchQuery,
      exactQuery:
        Number(row.exactNodes) > 0 && row.exactQuery !== row.matchQuery ? row.exactQuery : undefined,
      terms: parsed.terms,
    };
  }

  /**
   * The words and phrases of each entry that match the search, as written in the entry, for
   * highlighting. PostgreSQL marks them with `ts_headline` in both languages; adjacent marked
   * words are joined into one match and kept only when they match a typed term on their own,
   * so a quoted phrase is highlighted where the phrase appears, not wherever one of its words does.
   */
  async findMatches(
    userId: number,
    entryIds: number[],
    terms: EntrySearchTerm[],
  ): Promise<Map<number, string[]>> {
    const matches = new Map<number, string[]>();
    if (entryIds.length === 0 || terms.length === 0) {
      return matches;
    }

    const rows = (await this.entryRepository.query(
      `WITH terms AS (
         SELECT config.name AS config, term.query AS query
           FROM unnest($3::text[], $4::boolean[]) AS typed(term_text, is_prefix)
          CROSS JOIN unnest($5::regconfig[]) AS config(name)
          CROSS JOIN LATERAL (
            SELECT CASE WHEN typed.is_prefix THEN to_tsquery(config.name, typed.term_text || ':*')
                        ELSE websearch_to_tsquery(config.name, typed.term_text) END AS query
          ) AS term
       )
       SELECT e.id AS id, array_agg(DISTINCT run.text) AS matches
         FROM entries e
         JOIN terms ON numnode(terms.query) > 0
        CROSS JOIN LATERAL regexp_matches(ts_headline(terms.config, e.content, terms.query, $6), $7, 'g') AS marked(parts)
        CROSS JOIN LATERAL (SELECT translate(marked.parts[1], $8, '') AS text) AS run
        WHERE e.id = ANY($1::int[]) AND e.user_id = $2 AND e.deleted_at IS NULL
          AND to_tsvector(terms.config, run.text) @@ terms.query
        GROUP BY e.id`,
      [
        entryIds,
        userId,
        terms.map((term) => term.text),
        terms.map((term) => term.prefix),
        [...ENTRY_SEARCH_CONFIGS],
        HEADLINE_OPTIONS,
        MARKED_RUN_PATTERN,
        `${MARK_START}${MARK_END}`,
      ],
    )) as Array<{ id: number; matches: string[] | null }>;

    for (const row of rows) {
      matches.set(Number(row.id), distinctMatches(row.matches ?? []));
    }
    return matches;
  }
}

/** Drops matches that differ only in case, longest first so a phrase wins over its words. */
function distinctMatches(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length || left.localeCompare(right))
    .filter((value) => {
      const key = value.toLocaleLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, MAX_MATCHES_PER_ENTRY);
}
