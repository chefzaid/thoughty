# ADR 0005: Apply Selective CQRS in the Entry Domain

- Status: Accepted
- Date: 2026-05-27

## Context

The entries domain is the most behaviorally dense part of Thoughty. It handles:

- filtered and paginated read models
- entry lookup by date, index, or permalink target
- highlights such as random entry and `On This Day`
- revision history
- bulk mutations
- tag rename operations
- entry reordering
- AI-assisted tag augmentation during writes

Keeping all of that in one service would make the dominant product area harder to evolve and reason about.

At the same time, a full CQRS/event-sourcing stack would be excessive for the actual complexity and would introduce infrastructure that the rest of the codebase does not need.

## Decision

Use a selective CQRS style in the entries module.

- Keep `EntriesService` as a thin facade.
- Route read behavior to `EntriesQueryService`.
- Route write behavior to `EntriesCommandService`.
- Use this split only where the domain complexity justifies it.
- Do not adopt full event sourcing, command buses, query buses, or the Nest CQRS package at this stage.

## Rationale

- Entry reads and writes have different complexity profiles. Query behavior is dominated by composable filters and optimized SQL, while command behavior is dominated by validation, revision capture, indexing rules, and side effects.
- The split makes the read path easier to optimize without mixing it with mutation rules.
- The write path can coordinate AI tagging, revision creation, reindexing, and diary-default behavior without making every read-oriented method harder to parse.
- Applying the pattern selectively avoids turning the whole codebase into ceremony-heavy pseudo-CQRS.

## Consequences

- The entries module is more internally structured than simpler modules such as stats or config.
- Future complex domains can adopt the same pattern if they reach a similar level of complexity.
- The project documents this as selective CQRS, not full CQRS. That distinction matters for expectations around events, buses, and read-model duplication.
- Architectural discipline is required to keep query-heavy logic in query services and side-effect-heavy logic in command services.