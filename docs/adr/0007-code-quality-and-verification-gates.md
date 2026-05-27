# ADR 0007: Keep Code Quality Enforcement Lightweight but Continuous

- Status: Accepted
- Date: 2026-05-27

## Context

Thoughty is large enough to need meaningful quality gates, but not so large that it benefits from a heavy governance layer or multiple parallel static-analysis systems. The repository already uses a combination of TypeScript, linting, tests, generated contracts, and runtime validation. What is missing is an explicit statement that these are part of the architecture, not just developer preference.

## Decision

Use lightweight, always-on quality gates that fit the monorepo's day-to-day development model.

- TypeScript is required across frontend and backend.
- ESLint is the primary linting surface for both applications.
- Prettier remains the formatter for backend source formatting workflows.
- Backend testing uses Jest for unit and e2e coverage.
- Frontend testing uses Vitest and Testing Library for unit/component checks and Playwright for end-to-end browser flows.
- Runtime DTO discipline is enforced through Nest's global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, and transformation enabled.
- Shared API correctness is reinforced by OpenAPI export and frontend type generation.
- Root-level scripts and `mask` commands remain the normal entry points for verification and synchronization tasks.

## Rationale

- The repository needs guardrails that developers can run continuously, not only in heavyweight CI environments.
- TypeScript, linting, and generated contracts catch a large class of regressions before runtime.
- OpenAPI export and frontend type generation are part of that quality story as well, not a separate documentation exercise; see ADR 0004 for the contract-generation workflow itself.
- Runtime validation remains necessary because static types do not protect the HTTP boundary.
- Keeping the toolchain simple makes it more likely that contributors will use it consistently.

## Consequences

- Quality enforcement is convention-driven and integrated into normal development commands.
- The repo favors fast feedback over heavyweight process tooling.
- Architectural changes should consider their impact on local verification, generated contracts, and testability.
- The codebase does not currently rely on a separate enterprise code-quality platform to stay maintainable.