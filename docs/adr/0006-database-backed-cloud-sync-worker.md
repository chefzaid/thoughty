# ADR 0006: Run Scheduled Cloud Sync Through a Separate Worker and Database-Backed Queue

- Status: Accepted
- Date: 2026-05-27

## Context

Cloud sync introduces background behavior that should not run inside ordinary request handlers:

- due-schedule polling
- provider token refresh
- export generation
- remote upload/download work
- retries after provider failures
- stale-job recovery after worker interruption

The repository already deploys a dedicated cloud-sync worker alongside the main API. That creates an architectural split that should be captured explicitly.

## Decision

Use a dedicated worker process for scheduled cloud sync and back it with a database queue.

- Bootstrap the worker through `cloud-sync-worker.ts` as a separate Nest application context.
- Persist background jobs in the `cloud_sync_jobs` table.
- Use `CloudSyncQueueService` to enqueue due jobs, claim work, retry failures, and recover stale running jobs.
- Use row-level claiming with `FOR UPDATE SKIP LOCKED` and a unique token for each claim.
- Keep retry state and lock ownership in the database rather than in memory.
- Let the worker poll for runnable jobs every `5` seconds and rescan schedules every `60` seconds instead of introducing a separate message broker.

## Rationale

- Scheduled sync is operationally important but not latency-sensitive in the same way as interactive API requests.
- A separate worker prevents long-running provider interactions from competing directly with API request handling.
- A database-backed queue is sufficient for the current scale and avoids introducing Redis, SQS, RabbitMQ, or another broker purely for one background workflow.
- Storing attempts, locks, status, and retry timestamps in the database makes failure recovery explicit and inspectable.
- Using the same codebase and image as the API keeps deployment and maintenance cost low.

## Consequences

- The database is an intentional part of the background-processing architecture, not only the system of record.
- Cloud sync remains easier to operate than a multi-broker design, but the queue inherits database performance and availability characteristics.
- Claim, heartbeat, recovery and terminal updates check the current owner and
  unexpired lease. A heartbeat renews ownership every 30 seconds; recovery uses
  the database clock and cannot reclaim a job renewed after stale selection.
  Provider calls also check ownership before beginning and use an operation's
  abort signal, with a bounded request timeout. Lease loss or shutdown cancels
  those requests, stops further work and prevents stale completion/failure from
  overwriting a replacement claim. Shutdown awaits active operations before
  closing the application context.
- Keep the worker at one replica. Database fencing cannot undo an external
  upload already accepted before cancellation, nor provide provider-wide
  idempotency. A stopped or partitioned worker can leave a running job until
  its lease expires; recovery/retry may repeat remote effects. Inspect provider
  state when an interrupted upload has an ambiguous outcome.
- If background workloads broaden substantially beyond cloud sync, the current queue model may need to evolve into a more general job platform.

## Verification

The backend tests cover heartbeat cancellation, independent operation signals
and shutdown awaiting active work. `infra/scripts/test-cloud-sync-postgres.sh`
runs real PostgreSQL races for stale completion/failure and heartbeat versus
recovery. It creates its own localhost-only Docker database and does not use
application credentials. Run it after backend dependencies are installed;
normal Jest runs skip this integration fixture unless its explicit test URL is
set. No live cloud provider calls are made by these tests.
