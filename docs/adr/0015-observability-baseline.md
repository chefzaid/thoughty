# ADR 0015: Establish a Privacy-Aware Observability Baseline

- Status: Proposed
- Date: 2026-06-05

## Context

ADR 0012 states that Thoughty currently has basic operational visibility: health checks, rollout waits, application logs, and worker job status fields. The roadmap includes structured logging, request tracing, monitoring, alerting, and product telemetry.

Because Thoughty handles sensitive journal content, observability must improve without accidentally logging private entries, attachment contents, provider tokens, or AI prompts.

## Decision

Adopt a minimal privacy-aware observability baseline before expanding production usage.

- Emit structured JSON logs from the API and worker.
- Include request IDs/correlation IDs across request logs and worker job logs.
- Log route, method, status, latency, authenticated user ID where appropriate, and error class.
- Never log journal content, raw tokens, passwords, reset tokens, provider tokens, attachment contents, or AI prompt/response bodies by default.
- Add basic metrics for process health, request latency, error count, queue depth, job success/failure, and database connectivity.
- Define minimum alerts for API health, high error rate, worker failures, stuck sync jobs, database unavailability, and storage integration failures.
- Keep product telemetry opt-in or privacy-preserving, and document exactly what is collected.

## Rationale

- Operators need enough signal to diagnose failures without reading private user content.
- Structured logs and correlation IDs are the smallest useful step toward tracing.
- Worker queue metrics are necessary because sync failures may not show up as direct user-facing request failures.
- Telemetry can help prioritize product work, but it is sensitive in a journaling app and should be bounded explicitly.

## Consequences

- Logging changes should include redaction review.
- New integrations should define safe error logging behavior.
- Product analytics should not be introduced as generic event capture without a privacy review.
- This ADR extends ADR 0012 rather than replacing its simple repository-owned delivery model.