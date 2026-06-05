# ADR 0018: Decide Offline and Mobile Sync Before Building Mobile Apps

- Status: Proposed
- Date: 2026-06-05

## Context

The roadmap includes iOS/Android apps with offline journaling and later synchronization. Offline mobile support changes the write model: entries, attachments, tags, diaries, and edits may be created while the server is unavailable.

The current web/API architecture assumes the server and PostgreSQL are the authoritative write path.

## Decision

Before implementing mobile offline writes, define an explicit sync model.

The decision should cover:

- whether the server remains authoritative or clients keep local-first replicas
- client-generated IDs or temporary IDs for offline-created records
- conflict detection and resolution for entry edits, diary changes, and tag metadata
- offline attachment handling and upload retry behavior
- local encryption expectations for cached journal content
- sync queue format and retry rules
- how revision history is generated from offline edits
- how public/social features interact with offline-created content

Prefer a conservative first version where private draft capture can work offline, but public publishing and social interactions require server confirmation.

## Rationale

- Journaling benefits from offline capture, but conflict handling can quickly corrupt user trust if it is implicit.
- Attachments are harder to sync than text entries and need separate retry and storage rules.
- Mobile local storage raises privacy concerns because journal data may live on a device for long periods.
- Public/social writes should not be published from stale local state without server-side moderation and authorization checks.

## Consequences

- Mobile work should not start by simply mirroring current REST calls into native screens.
- API contracts may need sync-oriented endpoints or batch mutation support.
- The data model may need client IDs, sync metadata, tombstones, or conflict records.
- Security documentation must be updated with local data protection assumptions.