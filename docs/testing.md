# Testing Guide

Thoughty has three test layers: backend Jest tests, frontend Vitest tests, and Playwright browser tests against a mocked API. This guide covers how to run them, how they are organized, and how to add tests. How CI runs them is described in the [Delivery Pipeline](./deployment.md#delivery-pipeline).

## Layers

| Layer | Location | Runner | Use it for |
|---|---|---|---|
| Backend unit/integration | `thoughty-server/src/**/*.spec.ts` | Jest | services, controllers, guards, DTO validation, persistence, AI and cloud integrations |
| Backend e2e | `thoughty-server/test/*.e2e-spec.ts` | Jest + Supertest | routing, guards, and validation through the full Nest app |
| Frontend unit/component | `thoughty-web/src/**/*.test.ts(x)` | Vitest + Testing Library | components, hooks, utilities, API service adapters |
| Browser e2e | `thoughty-web/e2e/**/*.spec.ts` | Playwright | user flows that span routes or surfaces, accessibility |

Run the narrowest relevant suite first, and the broader suites before merging larger changes.

## Commands

From the repository root:

```bash
mask test                 # backend Jest + frontend Vitest
mask test --backend       # backend only
mask test --frontend      # frontend only
mask test --e2e           # Playwright only
mask test --coverage      # both coverage suites plus a combined summary (also: npm run coverage)
```

Backend (`cd thoughty-server`):

```bash
npm test                  # unit/integration specs (add a path or name to narrow)
npm run test:watch
npm run test:cov          # coverage
npm run test:e2e          # e2e specs in test/
npm run lint              # ESLint (applies --fix)
```

Frontend (`cd thoughty-web`):

```bash
npm test                  # Vitest
npm run test:watch
npm run test:coverage
npm run typecheck
npm run lint
npm run api:usage         # fails if the frontend stops calling a documented product endpoint
npm run test:e2e          # all Playwright specs
npm run test:e2e:install  # install the bundled Chromium
npx playwright test e2e/journal                            # one directory
npx playwright test e2e/tags/management.spec.ts            # one file
npx playwright test --grep "Journal Markdown authoring"    # by title
```

Both coverage suites write `coverage/lcov.info` in their application directories for SonarQube; colocated `.spec.ts`, `.test.ts`, and `.test.tsx` files are classified as tests. The project target is 80% coverage.

## Browser Tests

Playwright (`thoughty-web/playwright.config.ts`) starts the Vite dev server on port `5173` (or reuses a running one) and runs headless Chromium using the bundled `chromium` channel. There are no named projects, so do not pass `--project`. Traces and screenshots are kept on failure, and CI retries failed tests twice.

The browser never reaches a real backend: every `/api` call is answered by the mock app in `e2e/support`. Specs are grouped by feature:

| Directory | Covers |
|---|---|
| `accessibility/` | Axe WCAG A/AA scans of every route in both themes, skip links, focus on route change, key dialogs |
| `public/` | landing page and the feature-request board |
| `auth/` | sign-up and login onboarding, two-factor authentication |
| `navigation/` | direct routes, browser history, permalinks, diary return routes |
| `journal/` | authoring, Markdown, lifecycle, reordering, filtering, favorites, visibility, bulk archive, history, highlights, audio transcription |
| `tags/` | tag create, count, rename, delete, and journal tag organization |
| `ai/` | Auto Tag, automatic tagging, Get Inspired, rephrasing, summaries, chat, meaning search, duplicates, personal API keys |
| `stats/` | totals, heatmap, and tag insights |
| `import-export/` | import/export formats, format settings, delete-all, books, book versions and cloud upload |
| `cloud-sync/` | uploads, schedules, Sync Now, cloud imports |
| `diary/` | create, edit, reorder, default, delete fallback |
| `social/` | public feed eligibility, pagination, owner preview, mobile layout, following and unfollowing authors |

Put a new spec in the closest existing directory and name it after the behavior it covers (`journal/attachments-preview.spec.ts`, not `critical-flows.spec.ts`). Split a file once it covers unrelated behavior.

### Mock API

| File | Purpose |
|---|---|
| `mockApp.ts` | `setupMockApp(page, options)`: per-test state, auth tokens, route registration |
| `mockApp.shared.ts` | state types and defaults, diaries, cloud fixtures, import/export helpers |
| `mockApp.stats.ts` | stats response builders |
| `mockApp.route-utils.ts` | route context and `fulfillJson` |
| `mockApp.routes.ts` | dispatch, auth, config, and feature-request routes |
| `mockApp.routes.entries.ts` | entries and tags |
| `mockApp.routes.io.ts` | import/export and book routes |
| `mockApp.routes.social.ts` | public feed scopes and follows |
| `mockApp.routes.reference.ts` | stats, AI, diaries, entry references |
| `mockApp.routes.ai-credentials.ts` | personal OpenRouter key and usage |
| `mockApp.routes.cloud-sync.ts` | stateful cloud schedules, files, and sync payloads |

When a flow needs new backend behavior: add state fields to `mockApp.shared.ts`, handle the route in the smallest relevant file, record the last request payload if the test must assert on it, and return the same response shape as the real API. Keep the mock minimal; it supports the flows under test and does not reimplement the backend.

## Writing Tests

Seed only what the scenario needs:

```ts
const { state } = await setupMockApp(page, {
  startAuthenticated: true,
  initialEntries: [
    { id: 101, date: '2024-04-18', index: 1, content: 'Focused entry', tags: ['focus'], visibility: 'private', diaryId: 1 },
  ],
});
```

Assert the visible result, and the captured state when the request matters:

```ts
await expect(page.getByText('Updated entry body')).toBeVisible();
await expect.poll(() => state.entries[0]?.content).toBe('Updated entry body');
```

Guidelines:

- Name tests by outcome (`'archives selected entries and reveals them through the archived filter'`, not `'works'`).
- Prefer accessible locators (`getByRole`, `getByLabel`, `getByPlaceholder`); scope to a card such as `page.locator('#entry-101')` when a name is ambiguous, or pass `exact: true`.
- Call `setupMockApp` before navigating, keep state in the returned `state` object, and avoid module-level mutable state; tests run in parallel.
- Frontend unit tests usually pass an identity translator (`t = (key) => key`), so assert on translation keys rather than English text.

## Performance and Resilience Checks

Both scripts run against a live API and database; do not point them at production without an operator's approval.

`cd thoughty-server && npm run benchmark` measures HTTP endpoints and key PostgreSQL queries and prints CSV-style results:

| Variable | Default | Purpose |
|---|---|---|
| `BENCHMARK_BASE_URL` | `http://localhost:3001` | API origin |
| `BENCHMARK_ENDPOINTS` | `/api/health,/api/metrics` | comma-separated GET paths |
| `BENCHMARK_REQUESTS` / `BENCHMARK_CONCURRENCY` | `100` / `10` | requests per target and concurrent workers |
| `BENCHMARK_AUTH_TOKEN` | unset | bearer token for protected paths |
| `BENCHMARK_DB_RUNS` | `10` | runs per database query |
| `BENCHMARK_SKIP_HTTP` / `BENCHMARK_SKIP_DB` | unset | set to `true` to skip a part |

`cd thoughty-server && npm run chaos:check` sends malformed JSON, missing routes, and unauthenticated private requests and expects controlled errors, runs a failing SQL statement to prove the pool recovers, and confirms `/api/health` still returns `200`. It exits non-zero if anything does not recover. Options: `CHAOS_BASE_URL`, `CHAOS_TIMEOUT_MS` (default `5000`), `CHAOS_SKIP_HTTP`, `CHAOS_SKIP_DB`.
