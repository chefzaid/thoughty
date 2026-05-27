# ADR 0010: Model the Journal Around Diaries, Dated Entries, Revisions, and Attachments

- Status: Accepted
- Date: 2026-05-27

## Context

Thoughty is fundamentally a journal system, not a generic note tree or document workspace. The core user experience is driven by:

- multiple diaries per user
- entries grouped by date
- multiple entries on the same day
- tags, favorites, archive state, and visibility as entry metadata
- revision history for edited entries
- optional attachments linked to entries

Those choices affect querying, navigation, import/export, highlights, and statistics. They therefore need to be recorded as intentional data-model decisions.

## Decision

Model the journal around a small set of relational aggregates.

### Diaries

- Diaries are user-owned containers with name, icon, color, visibility, default-diary flag, and explicit position.
- Diary names are unique per user.
- One diary acts as the default capture target and safe fallback when a non-default diary is deleted.

### Entries

- Entries are the central record.
- Every entry belongs to a user and may belong to a diary.
- Entries are dated with a journal date rather than a freeform timestamp-only model.
- Multiple entries on the same date are distinguished by an integer `index`.
- Tags are stored directly on the entry, along with format, visibility, favorite state, and archive state.

### Revisions

- Entry revisions are stored separately from the live entry.
- Revisions capture content, tags, date, format, and visibility snapshots before updates.
- Revisions are attached to entries and deleted with them.

### Attachments

- Attachments are separate records with user ownership, optional entry linkage, original filename, stored filename, MIME type, and size.
- Attachments can exist before final entry linkage and then be associated later.

### Background jobs and settings

- User-scoped settings persist preferences and integration state.
- Cloud sync jobs are modeled as first-class database records with status, attempts, locking metadata, and result/error messages.

## Rationale

- A journal application benefits from date-first querying and navigation, which is why date plus same-day index is a better fit than an undifferentiated document list.
- Keeping revisions separate preserves edit history without complicating the live entry record.
- Tag storage on the entry keeps filtering and export behavior simple enough for the current product shape.
- Explicit diary position and default-diary semantics support the product's navigation and delete/move rules cleanly.

## Consequences

- PostgreSQL-specific query behavior, such as array-based tag filtering, is an accepted tradeoff of the current model.
- Entry identity is not just `id`; date and index remain meaningful product-level coordinates.
- Revision history is additive storage by design and should be treated as a durability feature, not an incidental audit table.
- If tags or metadata become more relationally complex later, the current entry-centric design may need to evolve.