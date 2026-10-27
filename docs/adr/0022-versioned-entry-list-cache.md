# ADR 0022: Check the Journal List Cache Against a Version the Database Keeps

- Status: Accepted
- Date: 2026-10-27

## Context

Each API replica keeps the journal list (`GET /api/entries`) it last read for a writer, for `ENTRIES_CACHE_TTL_SECONDS` (30 s by default). Until now a copy was dropped only when a service called `EntryListCacheService.invalidateUser`, and only on the replica that ran it. That missed writes in three ways:

- **Forgotten callers.** The text import, the app import (entries and their files) and other writers changed entries without calling it, so the journal could show the list from before the import for up to 30 s.
- **Other processes.** The worker opens time capsules, purges the recycle bin and deleted accounts in a process of its own; nothing it did reached the replicas' caches.
- **Other replicas.** The server runs two replicas behind one service; a write on one never reached the other's cache, so even an edit could vanish from the list on the next request.

Options considered:

- **Call the invalidation from every writer.** Each new write path has to remember it, and it still cannot reach other replicas or the worker.
- **Invalidate from a TypeORM subscriber.** Central, but blind to raw SQL and query-builder updates without entities, and still per process.
- **Share the cache in Redis.** Redis is optional, and invalidation would still depend on every writer.
- **PostgreSQL `LISTEN`/`NOTIFY`.** Reaches every replica, but asynchronously: a read straight after a write can still beat the notification.
- **A per-writer version the database moves on.** Every write is seen, by whoever makes it, and the next read compares one number.

## Decision

- `entry_list_versions (user_id, version, changed_by)` holds one version per writer. A deferred constraint trigger (`trg_<table>_entry_list_version`, `AFTER INSERT OR UPDATE OR DELETE ... DEFERRABLE INITIALLY DEFERRED FOR EACH ROW`) on every table the list reads (`entries`, `diaries`, `attachments`, `life_eras`, `entry_people`) moves the writer's version on when the transaction commits.
- The bump runs once per transaction (`changed_by` holds the transaction that last moved it) and at commit, after the transaction's other locks, so the version row is never held while the transaction waits for another lock. The version and the data it describes become visible in the same commit; a rolled-back transaction moves nothing.
- `EntryListCacheService.getOrLoad` reads the writer's version from the primary (one primary-key lookup) before every list read, serves a copy only when it was read at that same version, and otherwise loads the list and keeps it under the version read before it ran. A change committed while it ran moves the version on, so that copy is never served.
- No write path invalidates anything. A new table the list reads gets the trigger in the migration that adds it; `entry-list-cache.integration.spec.ts` records the SQL of a list read with every filter and fails when a table it reads has no trigger.

## Consequences

- A write by any service, replica, worker, migration or raw SQL statement shows in the next list read on every replica, and the time-to-live only bounds the cache's memory.
- Every list read costs one extra indexed query, including cache hits; writes to the list tables run one trigger per row at commit, and the first per transaction updates one small row.
- Two transactions writing for the same writer queue on that writer's version row only during their commits.
- PostgreSQL refuses to alter or index a table whose changed rows still have deferred trigger events queued in the transaction, so `npm run migrate` (`runPendingMigrations`) starts its transaction with `SET CONSTRAINTS ALL IMMEDIATE`, and a hand-run script or `down` that changes rows of a list table and then alters it does the same.
- With read replicas, the list itself may still be read from a lagging replica; the cache keeps such a copy under the primary's version until the next change or the time-to-live, as an uncached read would have returned it too.
