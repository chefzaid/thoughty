# Data Model Reference

The practical reference for Thoughty's relational model. [ADR 0010](./adr/0010-journal-data-model.md) explains the decision; this file lists the entities and the rules contributors must preserve. Columns are documented by the entity files in [`thoughty-server/src/database/entities`](../thoughty-server/src/database/entities); the schema itself is defined by the [migrations](../thoughty-server/src/database/migrations).

## Entity Relationship Overview

```mermaid
erDiagram
    User ||--o{ Diary : owns
    User ||--o{ Entry : owns
    User ||--o{ Attachment : owns
    User ||--o{ Setting : has
    User ||--o{ RefreshToken : has
    User ||--o{ CloudSyncJob : queues
    User ||--o{ AiUsageEvent : records
    User ||--o{ BookVersion : saves
    User ||--o{ FeatureRequest : submits
    User ||--o{ FeatureRequestVote : casts
    FeatureRequest ||--o{ FeatureRequestVote : receives
    User ||--o{ UserFollow : follows
    User ||--o{ EntryComment : writes
    User ||--o{ EntryLike : gives
    User ||--o{ CommentLike : gives
    User ||--o| MemoirProgram : runs
    User ||--o{ MemoirAnswer : writes
    User ||--o{ YearReviewMood : keeps
    User ||--o{ SavedSearch : saves

    Diary ||--o{ Entry : contains
    Diary ||--o{ BookVersion : scopes
    Diary ||--o{ MemoirProgram : collects
    Diary ||--o{ YearReviewMood : scopes
    Diary ||--o{ SavedSearch : scopes

    Entry ||--o{ EntryRevision : snapshots
    Entry ||--o{ Attachment : links
    Entry ||--o| AiChatHistory : has
    Entry ||--o{ EntryComment : receives
    Entry ||--o{ EntryLike : receives
    Entry ||--o| MemoirAnswer : answers
    EntryComment ||--o{ CommentLike : receives
```

Uniqueness rules worth knowing: diary names per user, one setting per key, one AI chat per entry, one vote per idea, one like per user and item, one follow per pair (never yourself), one memoir program per user, and one memoir answer per question and per entry, and saved search names per user whatever their case. Comments hold 1 to 1,000 non-blank characters.

## Ownership and Deletion Rules

Every table except `users` references a user, and those foreign keys cascade. Accounts are first soft-deleted (`users.deleted_at`). The worker hard-deletes the user row after `ACCOUNT_PURGE_AFTER_DAYS` (default 30), after removing the account's files from object storage, and the cascades remove the rest. A new table that references users must cascade too; `account-purge.integration.spec.ts` checks every foreign key to `users`.

| Entity | Deletion behavior |
|---|---|
| `User` | Deleting an account sets `deleted_at` and removes refresh tokens. Deleted users cannot sign in, and their content leaves the feed, follows, comments, likes, and counts. The account and everything it owns or wrote is erased after the grace period. |
| `Diary` | The default diary cannot be deleted. Deleting another first moves its entries, including those in the recycle bin, to the default diary, and drops its writing goal with the row. `entries.diary_id` is `ON DELETE SET NULL` as a safety net. |
| `Entry` | Deleting moves it to the [recycle bin](#recycle-bin). Purging it hard-deletes the row, which cascades revisions, attachment rows, AI chat, comments, likes, and the memoir answer. |
| `EntryRevision`, `AiChatHistory`, `EntryComment`, `EntryLike`, `CommentLike` | Deleted with their entry (or comment). Comments and likes also go with their author. A comment can be removed by its author or the entry owner. |
| `Attachment` | The row is deleted with its entry or user. Purging an entry and deleting an attachment also remove the stored object. Any other hard delete leaves the object behind. |
| `MemoirProgram` | Deleted with the user or when the memoir is stopped. Deleting its diary keeps the program with no diary (`SET NULL`) until another is chosen. |
| `MemoirAnswer` | Deleted with the user or the entry. Kept when the memoir is stopped. While the entry is in the recycle bin the question counts as unanswered; answering it again points the row at the new entry. |
| `BookVersion` | Deleted with the user. A diary's journal versions (`diary:<id>`) go with the diary (`ON DELETE CASCADE`); the all-diaries history (`all`) stays. A saved search's versions (`search:<id>`) are deleted with the saved search, in the same transaction, after its delete confirmation says how many go. Hand-picked versions (`picked`) stay listed and downloadable when their entries are deleted; only a new version from the same picks is refused (`400 BOOK_PICKED_ENTRIES_UNAVAILABLE`) until the missing picks are removed. |
| `YearReviewMood` | Deleted with the user or their diary. |
| `SavedSearch` | Deleted with the user, and with it the book versions saved from it. Deleting its diary keeps the search, its book versions, and widens it to all diaries (`SET NULL`). |
| Everything else | Deleted with the user. Votes also go with their request. |

## Entries

### Journal Coordinates

An entry is identified by `id`, but its journal `date` (chosen by the writer, not taken from `created_at`) and same-day `index` are product-level coordinates too.

- `index` numbers the entries of one day. A new entry takes the next number of its day. Deleting an entry closes the gap; a restored entry goes to the end of its day.
- Permalinks use `id`. Cross-references use `[[2024-01-15]]` and `[[2024-01-15#2]]`, which resolve by date and index.
- `title` (`VARCHAR(200)`, one line) and `time_of_day` (`TIME(0)`, served as `HH:MM`) are optional. Setting a time never renumbers anything, so `[[date#n]]` keeps pointing at the same entry.
- A day is listed by `time_of_day ASC NULLS FIRST, index ASC` (`addSameDayOrder`): untimed entries in their manual order, then timed entries earliest first. The journal, `[[date#n]]` lookups, backlinks, books, PDF/HTML/EPUB documents, and the year in review use this order.
- Drag reordering (`PATCH /api/entries/reorder`) applies to untimed entries. It reuses the indexes the listed entries already hold, so entries left out of the list keep their numbers.
- Text exports (TXT, JSON, Markdown, CSV, the Markdown folder) list a day by `index`. An import numbers a day's entries in file order, so importing into an empty journal restores every number.

### Recycle Bin

Deleting entries (singly, in bulk, or with delete-all) sets `entries.deleted_at`, a TypeORM delete date column. TypeORM leaves these rows out of entity queries and joins. **Raw SQL, `update`, and `delete` calls must add `deleted_at IS NULL` themselves**, as the tag usage, achievements, and public feed queries do. An entry in the bin is visible only through `/api/recycle-bin`.

- Related rows stay in place while the entry is in the bin. Restoring puts it back at the end of its day, in its diary or in the default diary when that diary is gone.
- Entries stay 30 days. The worker purges older ones hourly in batches of 100 with `FOR UPDATE SKIP LOCKED`, then removes their attachment objects after commit. Deleting forever from the bin takes the same path.
- The partial index `idx_entries_user_deleted_at` on `(user_id, deleted_at) WHERE deleted_at IS NOT NULL` serves the bin listing and the purge.

### Imported Entries

Entries imported from Day One or Journey ([ADR 0020](./adr/0020-browser-side-app-imports-and-streamed-archives.md)) keep `import_ref`, the source app and its entry ID (`dayone:<uuid>`, `journey:<id>`). Other entries leave it null.

- An import looks entries up by reference first, so running the same import again returns the existing entries and their attachment names instead of duplicating them.
- The partial unique index `idx_entries_user_import_ref` on `(user_id, import_ref)` skips entries in the recycle bin. Importing again creates a new entry; restoring the old one then clears its reference.
- Imported entries are private Markdown entries, numbered after the entries already on their day. Their media are ordinary attachments.

### Moods and Feelings

- `mood` is a nullable `SMALLINT` from 1 (very low) to 5 (very good), checked by `chk_entries_mood`. `feelings` is `TEXT[] NOT NULL DEFAULT '{}'` and can be set without a mood.
- `normalizeFeelings` stores feelings lowercase and without duplicates: at most 10, each at most 40 characters, with the characters that would break the export formats removed (commas, semicolons, pipes, braces, brackets, backticks, and double quotes).
- Curated feelings are stored by their English key (`calm`), whatever the interface language. Words the writer types are kept as written.
- The partial index `idx_entries_user_mood_date` on `(user_id, mood, date) WHERE mood IS NOT NULL` serves the mood filter (`mood=4,5`, `mood=any`, `mood=none`) and mood stats. Stats (`StatsMoodService`) and the year in review compute from these columns on request.
- Mood and feelings are private: the public feed and share text never include them.

### Task List Ticks

Markdown task items (`- [ ]`, `- [x]`) are plain text in `entries.content`; nothing else stores them.

- `PATCH /api/entries/:id/tasks` (`EntryTaskListService`) sets the box on one 0-based line and changes nothing else. It locks the row (`FOR UPDATE`) so concurrent ticks serialize, and answers `409` when the line is no longer a task. Plain-text entries are refused.
- It saves a revision like any edit, unless the latest revision is under ten minutes old and differs only in ticks (`revisionCoversTicks`), so a run of ticks keeps one revision.

## Tags

There is no tag table. Tags are strings in the `entries.tags` text array, GIN-indexed for containment filters. Per-user tag metadata (color and category, keyed by lowercase tag name) is a JSON value in the `tagMetadata` setting.

- The known tags are the union of tags used by entries and tags in metadata. A tag created in the Tags view exists only as metadata until an entry uses it.
- `GET /api/entries/tags` returns used tags with counts. `PATCH /api/entries/tags/rename` and `DELETE /api/entries/tags?tag=` rewrite every owned entry's array; the client updates the metadata alongside.
- AI tagging, tag organization, and books use the same arrays. A **category** (such as Work) only groups tags in the UI. Tag correlations are computed on demand.
- If tags ever need their own ownership, permissions, or relationships, revisit this model with a new ADR.

## Full-Text Search

`entries.search_vector` is a stored generated `tsvector`, `GENERATED ALWAYS AS (entry_search_vector(title, content, tags)) STORED`. PostgreSQL keeps it current; the application never selects or writes it.

- **Weights and index.** Title and tags weigh `A`, content `B`. The GIN index `idx_entries_user_search_vector` on `(user_id, search_vector)` uses `btree_gin`, so a search reads only the writer's own matches. The `tags` GIN index serves an exact tag-name match alongside, which keeps tags such as `c++` findable.
- **Languages.** Every entry is indexed with both `thoughty_en` and `thoughty_fr`, copies of `english` and `french` that apply `unaccent` before stemming (`ete` finds "été", `walk` finds "walking"). Journals mix both languages and an entry has no language of its own, so a per-user, per-entry, or unstemmed `simple` configuration was rejected. The cost is a vector twice the size, and stop words of one language are indexed by the other.
- **Queries.** `websearch_to_tsquery` parses the search in both configurations, joined with `||`. It supports `"phrases"`, `-exclusions`, and `or`, and never raises a syntax error. A last bare word of two or more characters also matches as a prefix (`word:*`). A search with no words (only symbols or emoji) falls back to an escaped `ILIKE` on title and content plus an exact tag match.
- **Ranking.** Results sort by `ts_rank(search_vector, query, 1)` plus the rank without the prefix term, so whole words come first, then by date. `sort=date` keeps the usual pinned and date order.
- **Highlights.** `ts_headline` marks the non-excluded terms in title and text separately. A marked run is kept only when it matches its term by itself, so a phrase is highlighted only where it appears whole. The runs are returned as `search_matches`, and the web app highlights exactly those.
- **Migrations.** `EntryFullTextSearch1785974400000` installs `unaccent` and `btree_gin` (trusted contrib extensions, kept on rollback). `entry_search_vector` is `IMMUTABLE` with `SET search_path FROM CURRENT`, so it works while `pg_restore` runs with an empty search path. `EntryTitleAndTime1786060800000` replaced it with the three-argument version. Changing the generated column rewrites `entries` (about 17 s for 107,000 entries locally).

### Search Performance on a Large Journal

Measured on PostgreSQL 16 on a development machine with the dev seed's main journal (9,785 entries from 2015 to 2026, 2.3 MB of text) and a ten-fold copy under another account (97,850 entries, 22 MB). First page of 10, median of seven runs through `EntriesQueryService.getEntries`:

| Request | 9,785 entries | 97,850 entries |
|---|---|---|
| No search (baseline) | 13 ms | 119 ms |
| Rare or absent word (`zzzz`) | 12 ms | 103 ms |
| `"long run" -rain` (5.5% of entries match) | 16 ms | 109 ms |
| `walk` (7%) | 22 ms | 164 ms |
| `gratef`, read as a prefix (10%) | 25 ms | 142 ms |
| `coffee or tea` (22%) | 31 ms | 229 ms |
| `ILIKE` match alone, for comparison | 25 to 43 ms | 240 to 380 ms |
| Highlights for a page of 50 entries | 6 to 9 ms | 4 to 7 ms |

The index lookup takes under a millisecond for a rare word. Search cost grows with the number of matches, since each is counted and ranked: roughly 5 to 8 ms per thousand. `sort=date` is 20 to 35% faster on broad searches because it skips ranking. Most of the large baseline is the tag list returned with every page. The vector takes about 650 bytes per entry (2.8 times its text) and the index 15 MB for 107,000 entries. `npm run benchmark` includes an `entries_full_text_search` query for checking a real database.

## Diary Writing Goals

A diary can carry one optional writing goal in `goal_type` (`entries_per_week` or `words_per_day`) and `goal_target`. The `chk_diaries_goal` constraint keeps them set together or both null, with 1 to 50 entries a week or 10 to 10,000 words a day; `DIARY_GOAL_LIMITS` and the `IsDiaryGoalTarget` validator hold the same bounds for the API, which answers `400 VALIDATION_FAILED` outside them. On `PUT /api/diaries/:id`, leaving `goalType` out keeps the goal and `null` removes it.

Progress is computed on request (`StatsGoalService`, in `GET /api/stats` as `goals`), never stored: one grouped query sums each goal diary's entries and words per day (words as in the other stats, split on whitespace), leaving out the recycle bin and entries dated after `today`, the writer's local day sent by the app (the server's UTC day without it). Days are summed into Monday-to-Sunday weeks for an entries goal. Each goal reports the current period's progress, whether it is met, the current and longest streaks, and the first day of every period that met it, which the activity heatmap marks. Only the writer's own diaries are read: a diary ID of someone else's diary gives no goal.

## Writing Streak

`GET /api/stats/streak` (`StatsStreakService`) measures the journal's daily streak on request, never stored, with the same `diaryId` and `today` query as `GET /api/stats`. One grouped query lists the distinct days with an entry up to `today` (the writer's local day; the server's UTC day without it), and a second reads the latest entry on or before it (by date, then time of day and same-day index), with its title and a plain-text snippet (`plainExcerpt`, 140 characters). Both leave out the recycle bin and read only the writer's own entries, so another writer's diary ID gives no streak. The answer (`WritingStreakResponseDto`) has `currentStreak` (days in a row ending today, or yesterday while today has no entry yet, counted by `currentRun`, the helper the diary goals use), `writtenToday`, `daysSinceLastEntry`, and `lastEntry` (null for an empty journal). The web decides what to show from these: the streak from two days on, the pick-up prompt from three days without an entry. The `streakCard` setting (`'true'`/`'false'`, shown unless `'false'`) turns the card off; the day it was dismissed is kept in the browser's `localStorage` (`thoughty.writingStreakDismissedOn`) and never reaches the server.

## Saved Searches

`saved_searches` keeps named journal views (`SavedSearchesModule`, `/api/saved-searches`): a `name` (`VARCHAR(80)`, not blank), the diary scope `diary_id` (null for all diaries), and the filter bar's state in `filters` (JSONB).

- `filters` holds `search`, `searchMode` (`keyword` or `semantic`), `sort` (`relevance` or `date`), `tags`, `date` (`YYYY-MM-DD` or null), `visibility` (`all`, `public`, `private`), `archiveStatus` (`active`, `archived`, `all`), `favorites`, and `mood` (the entry list's mood filter, or empty). `SavedSearchFiltersDto` validates every field with the same bounds as `GET /api/entries` and refuses unknown ones, so a new filter needs a DTO field (old rows simply lack it) rather than a migration.
- The unique index `uq_saved_searches_user_name` on `(user_id, lower(name))` gives one name per writer whatever its case; a clash answers `409 SAVED_SEARCH_NAME_TAKEN`. Lists are sorted by name, case-insensitively.
- A writer keeps at most 50 (`SAVED_SEARCH_LIMIT`, sent with the list). Saves take a transaction-scoped advisory lock on `(hashtext('saved_searches'), user_id)`, so concurrent saves cannot pass the limit. The diary must be the writer's own.
- Each listed search carries `bookVersionCount`, the book versions saved from it (`scope_key` `search:<id>`), counted in one grouped query; the delete confirmation names that count, since deleting the search deletes those versions.
- Saved searches are private: they are only read by their owner, and they are part of the data download.

## Public Feed Eligibility

`Entry.visibility` (the owner's choice) and `Entry.moderationStatus` (`visible`, `hidden`, `under_review`, `removed`, set by the platform) are independent ([ADR 0013](./adr/0013-public-social-content-and-moderation.md)). An entry is **feed-eligible** when it is `public` and `visible`, not archived, not in the recycle bin, and its author is not deleted. The composite index `idx_entries_public_feed` serves the newest-first feed reads.

- The feed reads entries and users directly and projects only feed-safe author fields.
- The **Following** scope applies the same rules to followed authors. A user can be followed only while they have a feed-eligible entry, so follows cannot probe private accounts.
- Comments and likes can be read or written only while their entry is feed-eligible. Nobody can like their own entry or comment. Content by deleted users is neither listed nor counted.
- Reports and enforcement records do not exist yet. They will be separate entities, not new visibility values.

## Other Domains

- **Diaries.** One diary is the default capture target. `All Diaries` is a view, not a row.
- **Attachments.** Metadata lives in PostgreSQL and blobs in S3-compatible storage ([ADR 0011](./adr/0011-attachments-and-object-storage.md)). `storedFilename` is the generated object key; `originalFilename` is only for display. A file can be uploaded before it is linked to an entry.
- **Settings.** `settings` holds user-scoped key/value configuration. Cloud provider tokens, personal OpenRouter keys, and other integration secrets are encrypted with `CONFIG_ENCRYPTION_SECRET`. Personal OpenRouter keys are left out of configuration responses and data exports. New setting groups should document their keys, value shape, and privacy impact.
- **AI usage.** `ai_usage_events` records credential source (personal or server), model, tokens, and cost, never prompts, completions, or keys. The dashboard shows personal-key usage for the last 30 days.
- **Book versions.** Each saved book is an immutable `BYTEA` file (PDF, EPUB, HTML, or Markdown) with a manifest of chapter titles and entry IDs only. `source` (JSONB) records where its entries came from: `{"kind":"journal","diaryId"}`, `{"kind":"savedSearch","savedSearchId","savedSearchName"}` or `{"kind":"entries","entryIds":[...]}`; versions saved before sources existed default to the journal. `scope_key` gives each diary (`diary:<id>`), all diaries (`all`), each saved search (`search:<id>`) and the hand-picked books (`picked`) its own version sequence; a transaction-scoped advisory lock on the user and scope serializes numbering. `diary_id` is set only for journal books, so deleting a diary deletes its book versions but not those of saved searches or picks. Deleting a saved search deletes its versions in the same transaction, under the same advisory lock, and a version being saved for a saved search deleted meanwhile is refused (`404 SAVED_SEARCH_NOT_FOUND`); the migration `OrphanedSavedSearchBookVersions1786579200000` removed the versions left behind by saved searches deleted before this rule. The binary is loaded only by the owner's download query.
- **Guided memoir.** `MemoirProgram` stores the collecting diary, `active` or `paused`, the email choice, and the schedule: `delivery_weekday` (0 = Sunday) at 09:00 in the IANA `time_zone`. `current_question_id` is this week's question and `next_delivery_at` drives the worker. The question catalogue is code (`modules/memoir/memoir-questions.ts`), referenced by stable string IDs. Answers are ordinary private entries; `MemoirAnswer` only links question and entry.
- **Year in review.** Everything is computed from entries on request except the AI mood arc. `YearReviewMood` keeps the latest reading per scope (diary null for all diaries): one `{month, mood, valence}` item per month in JSONB (valence -2 to 2), a summary, and the number of entries read. Reading again replaces it in one transaction.

## Schema Migrations

The schema is managed by ordered TypeORM migrations in `thoughty-server/src/database/migrations`; `synchronize` is off.

- `npm run migrate` (root) or `npm run db:migrate` (server) applies every pending migration in one transaction.
- `InitialSchema1784764800000` is an idempotent baseline. On an existing database it fills in missing baseline objects before being recorded; on a fresh database it creates the whole baseline.
- Each schema change is a new timestamped migration. Never edit a migration that has shipped.
- Generate a candidate with `npm run migration:generate -- src/database/migrations/<name>`, review both `up` and `down`, and test against fresh and upgraded databases. Most migrations have a spec next to the data source in `thoughty-server/src/database`.

## Read Replicas

Read replicas are optional. Set `POSTGRES_READ_REPLICA_HOSTS` (comma-separated) and TypeORM keeps writes on `POSTGRES_HOST` while it may route reads to the replicas. `POSTGRES_READ_REPLICA_PORTS` sets their ports. User, password, and database inherit the primary's values unless `POSTGRES_READ_REPLICA_USER`, `POSTGRES_READ_REPLICA_PASSWORD`, or `POSTGRES_READ_REPLICA_DB` are set.

Enable only replicas that stream from the primary with acceptable lag for journal, stats, search, and feed reads. Migrations and writes always target the primary.
