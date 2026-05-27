# ADR 0001: Split Documentation Out of Root README

- Status: Accepted
- Date: 2026-05-27

## Context

The repository documentation lived in a single root README that mixed product overview, feature catalog, setup, commands, testing, infrastructure, CI/CD, and storage guidance.

That format made the file hard to scan, increased the cost of updating one topic, and discouraged adding decision records or deeper guides.

## Decision

Move detailed documentation into a `docs/` tree and keep the root README as the only navigation-oriented project entry point.

Organize the documentation by responsibility:

- `docs/features.md` for product capabilities and platform overview
- `docs/development.md` for local setup, commands, and testing
- `docs/deployment.md` for production operations and infrastructure guides
- `docs/adr/` for durable architectural and documentation decisions

## Consequences

- New contributors get a shorter root README with clearer navigation.
- Development and deployment guidance stay in single, top-level documents instead of nested doc indexes.
- Future design and architecture choices now have an established ADR location.
- Cross-link maintenance becomes important because documentation is no longer centralized in one file.