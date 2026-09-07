# ADR 0012: Keep Delivery and Operational Verification Simple, Explicit, and Repository-Owned

- Status: Accepted
- Date: 2026-05-27

The job topology, retention, image-builder, and code-quality portions of this decision are superseded by [ADR 0019](./0019-explicit-delivery-jobs.md). Its GitOps, migration-ordering, and runtime-health decisions remain active.

## Context

Thoughty already has an implemented operational model:

- GitLab CI installs dependencies, lints, tests, packages immutable artifacts and images, updates desired image tags in Git, and verifies Argo CD reconciliation
- Kubernetes rollouts depend on `/api/health` for API liveness and readiness
- the cloud-sync worker is rolled out separately after schema migration
- runtime logs are intentionally modest rather than highly instrumented

The repository's operational model prioritizes explicit, repository-owned safety controls over broader platform machinery. It does not currently depend on centralized tracing or elaborate automation layers to deliver safe rollouts, and that narrower scope is intentional for the current system.

## Decision

Treat delivery and operational verification as repository-owned concerns with a minimal but explicit runtime health model.

- Keep the GitLab CI pipeline as the primary automated delivery workflow.
- Require lint and test stages before image publication.
- Retain job artifacts for short-term diagnostics and publish immutable versioned server/web archives to GitLab's Generic Package Registry.
- Reuse persistent dependency caches and 30-day registry-backed Kaniko layers to reduce repeat pipeline work.
- Manage schema evolution with immutable, timestamped TypeORM migrations and a database-owned migration history.
- Use a pre-sync database setup hook, a sync-wave migration hook, and later runtime sync waves so schema preparation completes before API, worker, and web rollout.
- Keep Git as desired state and let Argo CD reconcile, prune, self-heal, and verify the exact deployment revision.
- Keep `/api/health` as the canonical public health endpoint for probes.
- Use application logging and worker/job status fields for basic runtime troubleshooting instead of claiming a richer observability stack than currently exists.

## Rationale

- The pipeline and Argo CD hooks encode important operational safety rules, especially around migration ordering and exact-revision verification.
- Ordered migration history makes applied schema state explicit and prevents previously completed changes from running again.
- Explicit health checks and rollout waits are more valuable at the current scale than a more abstract platform story.
- Ordered database setup and migration hooks reduce one of the most expensive deployment failure classes for this system.
- The current operational posture favors explicit rollout safety and low operational indirection over a larger platform surface area.

## Consequences

- Delivery behavior is part of the architecture and should be updated when deployment ordering or runtime surfaces change.
- Shipped migration files are immutable; corrections are represented by later migrations and production rollback favors forward fixes.
- `/api/health` is a stable operational contract, not an incidental endpoint.
- The system currently has basic operational visibility, not full observability. That is acceptable as long as it is stated honestly.
- Future investment in metrics, tracing, alerting, or centralized log aggregation can extend this model, but should not rewrite its current assumptions accidentally.
