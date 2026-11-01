import type { ContractUser } from './contract-client';
import { createEntry } from './contract-fixtures';
import type { ContractContext } from './contract-suite';

/**
 * The journal list's query as `useEntriesState` and `entryListParams` build it, with the filters at
 * their defaults: empty search, tags, date and visibility ("all" is sent as empty), active entries.
 */
export function journalQuery(overrides: Record<string, string> = {}): URLSearchParams {
  const params = new URLSearchParams({
    page: '1',
    limit: '10',
    search: '',
    tags: '',
    date: '',
    visibility: '',
  });
  params.append('archiveStatus', 'active');
  for (const [name, value] of Object.entries(overrides)) params.set(name, value);
  return params;
}

export interface ListedEntry {
  id: number;
  content: string;
  is_favorite: boolean;
  is_archived: boolean;
  is_pinned: boolean;
  visibility: string;
  tags: string[];
}

/** The ids of the journal page `query` lists for `user`. */
export async function listJournalIds(
  context: ContractContext,
  user: ContractUser,
  query: URLSearchParams,
): Promise<number[]> {
  const response = await context.client.call('GET /api/entries', { as: user, query, status: 200 });
  return (response.body as { entries: ListedEntry[] }).entries.map((entry) => entry.id);
}

/** The entries the journal suites start from, by name. */
export interface JournalIds {
  /** Alice's titled, mood-rated walk on 2024-03-10, tagged `walks` and `river`. */
  walk: number;
  /** Alice's second entry that day, tagged `walks`. */
  second: number;
  /** Alice's Markdown task list on 2024-03-11, with two open tasks. */
  tasks: number;
  /** Alice's entry on 2024-03-12 linking back to `[[2024-03-10]]`. */
  reference: number;
  /** Bob's own entry on 2024-03-10, tagged `walks`, which no route may show Alice. */
  bob: number;
}

/** Writes the journal the entry suites read and change, through `POST /api/entries`. */
export async function writeJournal(context: ContractContext): Promise<JournalIds> {
  const { alice, bob } = context;
  return {
    walk: await createEntry(context, alice, {
      text: 'A walk by the river',
      tags: ['walks', 'river'],
      date: '2024-03-10',
      title: 'River',
      mood: 4,
    }),
    second: await createEntry(context, alice, {
      text: 'Another walk the same day',
      tags: ['walks'],
      date: '2024-03-10',
    }),
    tasks: await createEntry(context, alice, {
      text: '- [ ] buy bread\n- [ ] call mum',
      tags: ['todo'],
      date: '2024-03-11',
      format: 'markdown',
    }),
    reference: await createEntry(context, alice, {
      text: 'Back to [[2024-03-10]]',
      tags: [],
      date: '2024-03-12',
    }),
    bob: await createEntry(context, bob, {
      text: 'Bob’s own entry',
      tags: ['walks'],
      date: '2024-03-10',
    }),
  };
}
