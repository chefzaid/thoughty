# ADR 0004: Use Backend OpenAPI as the Source of Truth for API Contracts

- Status: Accepted
- Date: 2026-05-27

## Context

Thoughty is a monorepo, but the frontend and backend still evolve independently enough that contract drift is a real risk. The frontend needs reliable knowledge of request payloads, response shapes, query parameters, and endpoint availability. Manually maintained shared types would create a second contract source and eventually diverge from the runtime API.

## Decision

Treat the backend's OpenAPI document as the canonical machine-readable API contract.

- Generate the API description from NestJS controllers and DTOs.
- Export that document into `openapi/openapi.json`.
- Regenerate frontend TypeScript definitions from the exported document into `thoughty-web/src/generated/openapi.d.ts`.
- Keep a root-level `api:sync` command that runs the export and generation steps together.

## Rationale

- The backend already owns the runtime truth of request validation and response behavior.
- NestJS Swagger support makes it practical to derive a useful contract without introducing a second schema authoring system.
- This decision builds on ADR 0003's TypeScript-first platform choice, which makes generated contract sharing practical across the frontend and backend.
- Generated frontend types let service wrappers stay close to the real API without hand-maintained interface duplication.
- The approach scales better than ad hoc shared files because the source remains the actual HTTP interface, not an approximation.

## Consequences

- DTO and controller changes should be followed by contract regeneration.
- Frontend breakage caused by API changes is more likely to appear at build time instead of after deployment.
- OpenAPI generation becomes part of the normal development workflow rather than a documentation-only concern.
- The system intentionally prefers generated contract sharing over direct code sharing between frontend and backend.