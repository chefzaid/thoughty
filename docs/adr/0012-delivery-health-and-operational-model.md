# ADR 0012: Keep Delivery and Operational Verification Simple, Explicit, and Repository-Owned

- Status: Accepted
- Date: 2026-05-27

## Context

Thoughty already has an implemented operational model:

- Jenkins installs dependencies, lints, tests, builds images, smoke-tests migrations, pushes images, and deploys Kubernetes manifests
- Kubernetes rollouts depend on `/api/health` for API liveness and readiness
- the cloud-sync worker is rolled out separately after schema migration
- runtime logs are intentionally modest rather than highly instrumented

The repository's operational model prioritizes explicit, repository-owned safety controls over broader platform machinery. It does not currently depend on centralized tracing or elaborate automation layers to deliver safe rollouts, and that narrower scope is intentional for the current system.

## Decision

Treat delivery and operational verification as repository-owned concerns with a minimal but explicit runtime health model.

- Keep the Jenkins pipeline as the primary automated delivery workflow.
- Require lint and test stages before image publication.
- Require a server-image smoke test that runs database migrations against a disposable PostgreSQL container before deployment.
- Roll out the API before migrations, run migrations against the target environment, then start the worker and web deployments.
- Keep `/api/health` as the canonical public health endpoint for probes.
- Use application logging and worker/job status fields for basic runtime troubleshooting instead of claiming a richer observability stack than currently exists.

## Rationale

- The pipeline already encodes important operational safety rules, especially around migration ordering and worker startup timing.
- Explicit health checks and rollout waits are more valuable at the current scale than a more abstract platform story.
- Smoke-testing migrations before deployment reduces one of the most expensive failure classes for this system.
- The current operational posture favors explicit rollout safety and low operational indirection over a larger platform surface area.

## Consequences

- Delivery behavior is part of the architecture and should be updated when deployment ordering or runtime surfaces change.
- `/api/health` is a stable operational contract, not an incidental endpoint.
- The system currently has basic operational visibility, not full observability. That is acceptable as long as it is stated honestly.
- Future investment in metrics, tracing, alerting, or centralized log aggregation can extend this model, but should not rewrite its current assumptions accidentally.