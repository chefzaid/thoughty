# ADR 0002: Adopt a Modular Monolith with a Route-Driven UI Shell and Feature-Oriented Code Structure

- Status: Accepted
- Date: 2026-05-27

## Context

Thoughty has grown beyond a simple CRUD application. The codebase now includes authentication, diaries, entries, attachments, AI-assisted flows, import/export, statistics, and cloud sync. Those capabilities are coupled by shared concepts such as the current user, diaries, entry visibility, configuration, and attachment ownership.

The repository also ships a single browser application that must support deep links, authenticated and unauthenticated flows, entry permalinks, route-specific query state, and a shared application shell.

Without an explicit structural decision, the codebase would drift either toward a flat monolith with weak internal boundaries or toward premature service decomposition that would add operational cost without removing much domain coupling.

There is also a second structural risk inside the repository itself. Even if the runtime stays a monolith, the code can still become incoherent if backend features dissolve into generic layer folders or if frontend behavior gets buried inside leaf components and ad hoc global state.

## Decision

Adopt a modular monolith on the backend and a route-driven single-page application shell on the frontend, and make those runtime boundaries the primary code-organization boundaries as well.

### Backend structure

- Keep a single NestJS application process for the primary API surface.
- Treat feature modules as the main internal boundary: `auth`, `entries`, `diaries`, `stats`, `config`, `io`, `attachments`, `ai`, and `cloud-sync`.
- Let `AppModule` assemble infrastructure and cross-cutting guards while feature modules own controllers, DTOs, services, and repository wiring.
- Keep shared code in `common/` and `database/` only when it is genuinely cross-domain.
- Keep runtime application code under `src/modules/<feature>`.
- Reserve `src/common` for truly cross-cutting decorators and utilities.
- Reserve `src/database` for persistence infrastructure and entities.
- Keep operational and maintenance scripts in `scripts/` rather than mixing them with runtime modules.
- Permit deeper internal structure inside modules when justified, such as the entries command/query split and the cloud-sync queue/worker split.

### Frontend structure

- Keep a single React application with one authenticated shell and a small set of top-level routes.
- Use route components such as `JournalRoute`, `StatsRoute`, `ProfileRoute`, `TagManagerRoute`, `ImportExportRoute`, and `DiariesRoute` as the top-level UI boundaries.
- Centralize shared authenticated chrome in `AuthenticatedAppLayout`.
- Let `App.tsx` coordinate URL state, route transitions, and cross-route concerns, while `hooks/useAppState.ts` owns most data orchestration.
- Keep top-level route files thin and let feature views own most rendering details.
- Use hook-based orchestration rather than a monolithic client-state store for the dominant flows around config, diaries, entries, and editing.
- Centralize API access through service factories and TanStack Query-backed data fetching and invalidation.
- Treat query-string state as part of the product contract for navigable flows such as diary scope, import/export presets, and entry permalinks.

## Rationale

- The domain is cohesive enough that splitting services would not remove the need for shared database access, shared auth state, or coordinated user configuration.
- The modular monolith keeps deployment, migrations, local setup, and debugging straightforward while still forcing domain-level separation.
- Feature-first backend structure matches how the product changes in practice. Most changes belong to one feature area and its immediate dependencies, not to a generic global controller-service-repository layer.
- Separating `modules/`, `common/`, `database/`, and `scripts/` keeps lifecycle concerns explicit instead of letting runtime code and operational code bleed together.
- The frontend is not a set of isolated microfrontends. It is one product with a shared navigation model, shared auth context, and stable deep links, so a single route-driven shell is the cheaper and clearer architecture.
- Route and search-parameter state are intentional parts of the product behavior. Entry permalinks, import/export presets, and diary-specific views all depend on this.
- A hook-based orchestration layer keeps API-backed state reusable and testable without forcing every concern into a single global client store.
- Thin route wrappers preserve a readable route tree while allowing feature components to remain responsible for presentation.

## Consequences

- Feature modules are the primary unit of ownership and review. New capabilities should usually start as a module or an extension to an existing module rather than as new top-level infrastructure.
- The architecture optimizes for clear internal boundaries before distributed-system boundaries.
- Cross-domain coupling remains possible and must be reviewed intentionally. A modular monolith is a discipline, not a hard process boundary.
- Frontend routing decisions are architecture decisions. Query-string semantics and route shapes should be treated as public product behavior, not as incidental UI implementation details.
- Backend directory layout is part of maintainability, not only aesthetics. Cross-module sharing should remain explicit rather than becoming the default.
- `App.tsx` is intentionally a coordination layer and should not be forced into artificial thinness if doing so only hides real route and shell behavior elsewhere.
- Complex frontend cross-route behavior should usually move into hooks or route composition, not into deeply nested presentational components.