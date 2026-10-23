# Development Guide

You run the NestJS API and the Vite React app on your machine. PostgreSQL and [RustFS](https://github.com/rustfs/rustfs) (S3-compatible storage) run in Docker Compose. [`mask`](https://github.com/jacobdeichert/mask) wraps the common flows in `Maskfile.md`, and every task has a plain `npm` equivalent.

## Prerequisites

- Node.js 22 (the version in the Dockerfiles)
- Docker with Docker Compose
- `mask` (optional)

## Quick Start

```bash
mask build   # npm install in both apps (--clean removes node_modules first)
mask run     # start the whole stack
```

`mask run` starts the `db` and `storage` Compose services, applies pending migrations, and seeds the database if it has no users. It then starts the API in watch mode and the Vite dev server. Sign in as `test` with the password `Test1234!`.

| Surface | URL |
|---|---|
| Web app | `http://localhost:5173` (proxies `/api` to the API) |
| API / Swagger UI | `http://localhost:3001` / `http://localhost:3001/api-docs` |
| PostgreSQL | `localhost:5432`, user `postgres`, password `password`, database `journal` |
| S3 API / storage console | `http://localhost:9000` / `http://localhost:9001/rustfs/console/` (user and password `minioadmin`) |

### Without mask

```bash
(cd thoughty-server && npm install) && (cd thoughty-web && npm install)
docker compose -f infra/compose/compose.yaml up -d db storage
npm run migrate
npm run seed
cd thoughty-server && npm run dev    # terminal 1
cd thoughty-web && npm run dev       # terminal 2
```

### VS Code Dev Container

`.devcontainer/` adds an `app` container (Node 22, `git`, `postgresql-client`, the GitHub CLI, and `mask` on x86_64 hosts) next to the `db` and `storage` services. It installs dependencies and forwards ports `3001`, `5173`, `5432`, `9000`, and `9001`. It also points the API at the services (`POSTGRES_HOST=db`, `S3_ENDPOINT=http://storage:9000`), so do not override those in a `.env`. The container has no Docker, so skip `mask run` and use the [manual commands](#without-mask) from `npm run migrate` on.

## Configuration

The defaults in the code match the Compose stack, so you need no `.env` locally. To change a value, copy `thoughty-server/.env.example` to `thoughty-server/.env`. The example file lists the database, JWT, CORS, SMTP, Redis, S3, OpenRouter, and cloud sync variables.

| To enable | Set |
|---|---|
| AI features | `OPENROUTER_API_KEY`, or a personal key in Profile |
| Cloud sync | the Google Drive, OneDrive, or Dropbox client ID and secret |
| Email (password reset, verification, 2FA codes, memoir questions) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`. Without them, no email is sent and the API logs a warning. |
| Shared rate-limit counters | `REDIS_URL` or `REDIS_HOST` (in memory when unset) |

Read replicas ([Data Model](./data-model.md#read-replicas)), request body limits ([Security](./security.md#abuse-controls)), and feature flags (`FEATURE_FLAG_PROVIDER_URL`, or a static `FEATURE_FLAGS=flag=true,other=false`) are optional and not in the example file. Production settings are in the [Deployment Guide](./deployment.md#configuration-and-secrets). The web app's only variable is `VITE_GOOGLE_CLIENT_ID` for Google sign-in.

## Seed Data

`npm run seed` deletes and recreates the accounts below with a deterministic data set. It leaves other accounts alone. Every account uses the password `Test1234!`.

| Account | Purpose |
|---|---|
| `test` (`test@example.com`) | Main journal: about 10,000 entries, one to four a day since 2016, across five diaries |
| `maya` | Community member with mostly public entries, for the **Feed** |
| `sam` | Public entries in every moderation state; only visible, active ones reach the feed |
| `leo` | Deleted account whose entries must never appear; login is refused |
| `newbie` | Unverified account with an empty journal, for onboarding and empty states |

The `test` journal exercises every feature: Markdown, pins, archive, revisions, `[[date]]` cross-references, **On This Day**, planted duplicates, yearly tag themes, templates, AI chats, a guided memoir, and feature requests. `test`, `maya`, and `sam` follow, comment on, and like each other, which fills the social views. Attachments upload only when object storage is reachable. `cd thoughty-server && npm run db:validate-seed` checks the data without writing.

## Everyday Commands

| Command (repository root) | Does |
|---|---|
| `npm run migrate` / `mask migrate` | apply pending migrations |
| `npm run seed` / `mask seed` | recreate the seed accounts |
| `npm run check-db` / `mask check-db` | print the users, settings, diaries, and entries |
| `mask nuke-db` | drop every table, migrate, and seed after you type `nuke` (`--force` skips the prompt, `--entries` deletes only entries) |
| `mask lint` | lint both apps (`--fix` also fixes the web app; the server always fixes) |
| `npm run api:sync` | export the OpenAPI document and regenerate the web API types |
| `npm run kill` / `mask kill` | kill **every** Node process on the machine (`pkill -f node`), not only Thoughty's |

| Command (`thoughty-server`) | Does |
|---|---|
| `npm run cloud-sync-worker` | run the background worker (cloud sync, weekly memoir questions) |
| `npm run migration:generate -- src/database/migrations/<Name>` | generate a migration candidate |
| `npm run migration:revert` | revert the latest migration (development only) |

Tests are in the [Testing Guide](./testing.md).

## Changing the API

Backend DTOs and controllers define the API contract ([ADR 0004](./adr/0004-openapi-as-contract-source.md)). After you change a route or DTO, run `npm run api:sync` and commit `thoughty-server/openapi/openapi.json` and `thoughty-web/src/generated/openapi.d.ts`. The frontend must call every product endpoint; `cd thoughty-web && npm run api:usage` checks this.

## Changing the Schema

TypeORM `synchronize` is off, so each schema change needs a new migration in `thoughty-server/src/database/migrations`. Generate a candidate against an up-to-date local database, review `up` and `down`, and apply it with `npm run migrate`. Test a fresh and an upgraded database. Never edit a migration that may have run elsewhere. See [Data Model](./data-model.md#schema-migrations), and [Operations](./operations.md#migrations) for production.

## Adding Text to the UI

User-facing strings go through `t('key')`. Add each key to its key type and to the English and French maps. Core keys are in `thoughty-web/src/utils/translations.ts`. Feature keys are in files beside it, such as `translations.mood.ts`, which `translations.ts` merges into `TranslationKey`. The type checker rejects a key missing from either language.
