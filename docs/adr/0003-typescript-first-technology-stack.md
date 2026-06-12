# ADR 0003: Standardize on a TypeScript-First Full-Stack Platform

- Status: Accepted
- Date: 2026-05-27

## Context

Thoughty spans browser UI, authenticated API endpoints, background processing, file uploads, generated API contracts, and deployment automation. The cost of context switching between unrelated languages or frameworks would be paid on almost every feature because the product frequently crosses frontend, backend, and infrastructure boundaries in one change.

The product also depends on:

- rich client-side interactivity
- typed API and DTO evolution
- relational queries over entries, dates, tags, and diaries
- object storage for attachments
- scheduled background execution for cloud sync

## Decision

Use a TypeScript-first stack end to end.

### Frontend

- React 19 for the application shell and component model
- TypeScript 5.8 as the primary application language
- Vite 7 for fast local startup and build feedback
- Tailwind CSS 3 for utility-first styling
- TanStack Query for cached data access and invalidation
- React Router for route-based product structure
- Chart.js, React Markdown, and React Datepicker for domain-specific UI behavior rather than custom primitives

### Backend

- NestJS 11 for the API, module structure, guards, DTO validation, and Swagger integration
- TypeScript 5.8 as the primary application language
- TypeORM for repository access and query-builder-based read models
- PostgreSQL as the primary relational database
- OpenAPI/Swagger for API documentation and generated frontend contract types

### Storage and integration

- S3-compatible object storage for attachments, with MinIO used in local development
- OpenRouter for optional AI-backed writing assistance, analysis, and chat features
- Google, OneDrive, and Dropbox OAuth integrations for sign-in and cloud-sync surfaces

### Delivery and tooling

- Docker and Docker Compose for local service orchestration
- Dev Containers for an optional containerized development environment
- Kubernetes and Nginx for production-oriented deployment
- Jenkins for CI/CD automation
- HashiCorp Vault for secret delivery
- `mask` for repository-owned development commands

## Rationale

- TypeScript on both sides lowers the mental cost of moving between DTOs, service responses, generated types, and route contracts.
- React and Vite fit a product with frequent UI iteration, route-aware state, and a large amount of client-side interaction.
- NestJS aligns with the codebase's need for structured modules, guards, decorators, validation, and API documentation from the same source.
- PostgreSQL is a good fit for the data model because entries are heavily queried by date, tags, visibility, archive state, favorites, and diary scope. The product benefits from relational integrity and expressive query support more than from schemaless flexibility.
- S3-compatible storage keeps attachment handling portable between local MinIO development and production object-storage backends.
- OpenAPI keeps frontend/backend contracts explicit while allowing generated client-side types.
- Docker Compose, Dev Containers, and `mask` keep local setup reproducible without hiding the individual npm and service commands.
- The deployment stack matches the repository's current operational target rather than an abstract platform-agnostic ideal.

## Consequences

- The codebase is intentionally optimized for TypeScript fluency and Nest/React conventions.
- PostgreSQL-specific querying is an accepted tradeoff. The data layer is not designed for immediate database portability.
- Object storage, database access, and API contracts are all explicit architectural surfaces rather than hidden implementation details.
- The chosen stack favors coherence and maintainability over framework diversity.
