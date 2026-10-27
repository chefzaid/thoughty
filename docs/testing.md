# Testing Guide

Thoughty has three test layers: backend Jest tests, frontend Vitest tests, and Playwright browser tests against a mocked API. How CI runs them is in the [Delivery Pipeline](./deployment.md#delivery-pipeline).

## Layers

| Layer | Location | Runner | Use it for |
|---|---|---|---|
| Backend unit | `thoughty-server/src/**/*.spec.ts` | Jest | services, controllers, guards, DTOs, integrations |
| Backend PostgreSQL | `thoughty-server/src/**/*.integration.spec.ts` | Jest, real PostgreSQL | SQL behavior such as search, recycle bin, cloud sync leases |
| Backend e2e | `thoughty-server/test/*.e2e-spec.ts` | Jest + Supertest | routing, guards, and validation through the full app |
| Frontend unit | `thoughty-web/src/**/*.test.ts(x)` | Vitest + Testing Library | components, hooks, utilities, API adapters |
| Browser e2e | `thoughty-web/e2e/**/*.spec.ts` | Playwright | user flows, accessibility |

Run the narrowest suite first and the broader ones before you merge a larger change.

## Organizing Specs

Spec files keep to the 500-line rule too. One that outgrows it is split by the behaviour it covers into `<unit>.<area>.spec.ts` on the server or `<unit>.<area>.test.ts(x)` on the web (for example `io.service.export.spec.ts` and `io.service.import.spec.ts`, or `useEntryActions.edit.test.ts` and `useEntryActions.bulk.test.ts`), each keeping the original top-level `describe` so the full test names stay the same. Setup the parts share (the unit under test over its mocks, fixtures, mocked module factories) goes in a `<unit>.test-helpers.ts` beside them, `.tsx` when it holds stand-in components. Both coverage reports leave `*.test-helpers.*` out (Jest's `collectCoverageFrom`, Vitest's `coverage.exclude`), the server build excludes them, and ESLint lets a `.test-helpers.tsx` export components beside fixtures. Vitest hoists `vi.mock` above the imports, so a spec reads a shared mock from its helper inside the factory: `vi.mock('../services/api', async () => (await import('./useAppState.test-helpers')).apiModuleMock());`.

## Commands

| Command (repository root) | Runs |
|---|---|
| `mask test` | backend Jest and frontend Vitest (`--backend` or `--frontend` for one) |
| `mask test --e2e` | Playwright only |
| `mask test --coverage` / `npm run coverage` | both coverage suites and a combined summary |

| Command (`thoughty-server`) | Runs |
|---|---|
| `npm test` | Jest specs; add a path or name to narrow |
| `npm run test:watch` / `npm run test:cov` | watch mode / coverage |
| `npm run test:e2e` | `test/` specs. They boot the full app, so start the Compose `db` and run `npm run migrate` first. |
| `npm run lint` | ESLint, applying fixes |

| Command (`thoughty-web`) | Runs |
|---|---|
| `npm test` | Vitest |
| `npm run test:watch` / `npm run test:coverage` | watch mode / coverage (fails below the thresholds in `vitest.config.ts`) |
| `npm run typecheck` / `npm run lint` | type check (the app, then `e2e/` with `e2e/tsconfig.json`) / ESLint |
| `npm run api:usage` | fails if the frontend stops calling a documented endpoint |
| `npm run test:e2e:install` | install the bundled Chromium (once) |
| `npm run test:e2e` | all Playwright specs |
| `npx playwright test e2e/journal` | one directory; also takes a file or `--grep "<title>"` |

CI reports whether the combined line coverage of both apps reaches 80%, without blocking. Both suites write `coverage/lcov.info` for SonarQube.

## PostgreSQL Integration Specs

The `*.integration.spec.ts` files run only when `THOUGHTY_PG_TEST_URL` is set, so `npm test` and CI skip them. The URL must name the database `thoughty_ha_test` on `localhost` or `127.0.0.1`; any other URL fails the run.

Each suite gets its own database. `createPostgresTestDatabase` (in `src/database/postgres-test-database.test-helpers.ts`) creates `thoughty_ha_test_<pid>_<random>` from the URL, applies the migrations, and drops the database when the suite calls `drop()`. Suites share no tables, so they run in parallel. The role needs `CREATEDB`. A killed run can leave a `thoughty_ha_test_*` database behind; drop it by hand.

Run them against a throwaway Docker PostgreSQL (needs Docker and `python3`):

```bash
infra/scripts/test-cloud-sync-postgres.sh
```

Or against the Compose database, after you create the base database once:

```bash
docker compose -f infra/compose/compose.yaml exec db createdb -U postgres thoughty_ha_test
cd thoughty-server
THOUGHTY_PG_TEST_URL=postgresql://postgres:password@127.0.0.1:5432/thoughty_ha_test npm test -- integration.spec
```

A new spec wraps its suite in `describePostgres`, calls `createPostgresTestDatabase` in `beforeAll` (with `POSTGRES_SETUP_TIMEOUT_MS`), calls `drop()` in `afterAll`, and empties its tables in `beforeEach` (for example `TRUNCATE users RESTART IDENTITY CASCADE`).

## Frontend Unit Tests

Vitest uses `jsdom` with `src/test/setup.ts` and runs each file in its own thread, so mocks and DOM never leak between files. Helpers live in `src/test/`. Tests that need real `Blob` streams or `CompressionStream` add `// @vitest-environment node`. Unit tests usually pass an identity translator (`t = (key) => key`), so assert on translation keys, not English text.

A message that hides itself after a while should be tested with fake timers, not by waiting: a real timer only fires if the test lives long enough, which makes coverage move between identical runs. Plain `vi.useFakeTimers()` also fakes `setImmediate`, which React's scheduler runs effects on, and Testing Library's `findBy*`/`waitFor` wait on `setTimeout`, so both stall under it. For a component that loads data before the message appears, fake only `setTimeout`/`setInterval` with `shouldAdvanceTime: true`, wait for one real `setImmediate` after the message shows so its countdown has started, and leave a margin for the wall-clock drift (`ImportExport.importMessage.test.tsx`). A component that renders at once can use plain fake timers (`AutoDismiss.test.tsx`).

The same goes for a request an effect starts on mount and drops once it is stale (the component unmounted, the selection changed, or a newer answer won): whether a quick test sees the answer before it ends depends on the machine, so each side of the stale check is covered or not by chance. Test the effect with requests the test answers itself, in the order it chooses (a deferred promise per request), and let the answer settle before checking (`useImportExportBook.test.ts`: the selected diary's versions, a diary changed while loading, a version saved while loading, an unmount, a refusal and a network failure). The other tests that render the component then no longer decide the coverage of those lines.

## Browser Tests

Playwright starts the Vite dev server on port `5173` (or reuses a running one) and runs headless Chromium. There are no named projects, so do not pass `--project`. Traces and screenshots are kept on failure, and CI retries a failed test twice.

The mock app in `e2e/support` answers every `/api` call, so you need no API server or database. Specs are grouped by feature: `accessibility`, `ai`, `auth`, `cloud-sync`, `diary`, `import-export`, `journal`, `memoir`, `navigation`, `public`, `social`, `stats`, and `tags`, plus `harness` for the test setup itself. Put a new spec in the closest directory and name it after its behavior (`journal/attachments-preview.spec.ts`, not `critical-flows.spec.ts`).

Specs import `test` and `expect` from `e2e/support/test.ts`, not from `@playwright/test` (ESLint rejects importing `test` from there). Its `context` fixture keeps every `/api` request inside the browser. A context route answers an `/api` request no mock route takes (a spec that unroutes the mock) with `503` and `{ message: 'No e2e mock answers <METHOD> <path>' }`. At teardown it moves every page to `about:blank`, which cancels requests still waiting on a route handler. Without that step Chromium sends those requests to the network when the context closes, and the dev server proxies them to `localhost:3001` (the API, if one is running locally). `harness/api-isolation.spec.ts` leaves such a request pending, then checks that its local server got no requests.

### Accessibility

`e2e/accessibility/` runs axe (`@axe-core/playwright`) with the WCAG 2.0, 2.1, and 2.2 A and AA tags. `routes.spec.ts` scans every route in both themes and checks skip links, focus on route change, and key dialogs. `journal.spec.ts` scans the journal, search, filters, revision history (empty and with revisions), composer, and editor in both themes and with high contrast. `modal-dialogs.spec.ts` drives the AI chat, the attachment preview, and the entry summary with the keyboard alone (focus in, Tab trap, Escape, focus back on the opener) and scans the chat and the preview in both themes. Feature specs such as `journal/focus-mode.spec.ts`, `journal/calendar-view.spec.ts` (the month grid after keyboard moves, and empty), and `stats/writing-goals.spec.ts` (the goal panel and the marked activity map in both themes) scan their own surfaces, `accessibility/stats.spec.ts` scans Stats with entries (charts, their data tables, and the activity map after keyboard moves) in both themes and with high contrast and checks the charts' names and descriptions and the map's keys, and `journal/attachment-upload-errors.spec.ts` scans the composer with a pending attachment card in both themes and with high contrast. Give a new page or dialog a scan with the same tags, and report each node's `failureSummary` with its target, as `journal.spec.ts` does, so a failure keeps the measured colors and ratio.

### Mock API

`setupMockApp(page, options)` in `e2e/support/mockApp.ts` sets up per-test state, auth, and routes. State types are in `mockApp.shared.ts` and the default fixtures in `mockApp.defaults.ts`, and routes are split by feature into `mockApp.routes.*.ts`. For new backend behavior, add state fields to `mockApp.shared.ts`, handle the route in the closest routes file, record the request if the test asserts on it, and return the real API's response shape. Keep the mock minimal; it does not reimplement the backend.

Mock answers must match the API exactly. `fulfillJson` checks every answer against the response schema `thoughty-server/openapi/openapi.json` documents for that method, path and status (`mockApp.contract.ts`): a missing required field, a field the API never sends (such as `is_default` for `isDefault`), a wrong type, an unexpected `null` or a value outside an enum is recorded, and the `context` fixture fails the test at teardown with the list. Every JSON success response has a schema (`swagger.examples.spec.ts` fails for one without, apart from the six file downloads: `GET /api/config/download-data`, `/api/io/export`, `/api/attachments/file/{filename}`, `/api/books/versions/{versionId}/download`, and `GET`/`POST /api/books/export`); error statuses without a schema are not checked. A spec that answers a route itself with `page.route` uses the same helpers, `fulfillJson` or `fulfillApiError` (`mockApp.route-utils.ts`), so its answer is checked too. The exceptions answer no JSON: file bodies (attachment images, audio and text in `accessibility/modal-dialogs.spec.ts` and `journal/audio-transcription.spec.ts`), a refused connection (`route.abort`), and `harness/api-isolation.spec.ts`, which holds requests unanswered. Build fixtures from the generated types so drift also fails `npm run typecheck`: `mockDiary()` (`mockApp.diaries.ts`) makes a `DiaryResponseDto`, `toEntryResponse()` an `EntryResponseDto`, and `state.user` is an `AuthUserDto`. Unit tests build diaries with `makeDiary()` from `src/test/diaryFixture.ts`. `harness/mock-contract.spec.ts` covers the check itself. Derived answers follow the server's rules where a spec relies on them: `mockApp.search.ts` reads the search syntax (phrases, `-` exclusions, prefixes), and `mockApp.backlinks.ts` finds the entries whose `[[date]]`, `[[date#n]]`, or `entry(date--n)` references point at an entry, leaving out the recycle bin. `mockApp.routes.calendar.ts` answers the calendar month with the list's filters (`getFilteredEntries`), in day order. `mockApp.goals.ts` measures diary writing goals for `/api/stats` up to the `today` the app sends, with Monday-to-Sunday weeks.

## Writing a Browser Test

Seed only what the scenario needs. Assert the visible result, and the captured state when the request matters:

```ts
const { state } = await setupMockApp(page, {
  startAuthenticated: true,
  initialEntries: [
    { id: 101, date: '2024-04-18', index: 1, content: 'Focused entry', tags: ['focus'], visibility: 'private', diaryId: 1 },
  ],
});
// navigate and act, then:
await expect(page.getByText('Updated entry body')).toBeVisible();
await expect.poll(() => state.entries[0]?.content).toBe('Updated entry body');
```

- Name tests by outcome (`'archives selected entries and reveals them through the archived filter'`, not `'works'`).
- Prefer `getByRole`, `getByLabel`, and `getByPlaceholder`. Scope to a card (`page.locator('#entry-101')`) or pass `exact: true` when a name is ambiguous. A name matches any accessible name that contains it, so a toolbar button named after a filter (**Favorites**) also matches a card's **Add to favorites** while the list still shows the previous results; that race made `journal.spec.ts` fail about once in fifteen runs on four busy workers.
- Call `setupMockApp` before you navigate. Keep state in the returned `state`, not in module variables; tests run in parallel.
- Never race a message that hides itself. Install `page.clock` before you navigate, pause it before the action, assert, then `page.clock.runFor(...)` to check that it hides. See `e2e/tags/management.spec.ts`.

## Performance and Resilience Checks

These `thoughty-server` scripts hit a live API and database. Do not point them at production without an operator's approval.

- `npm run benchmark` times HTTP endpoints and key queries. It reads `BENCHMARK_BASE_URL` (default `http://localhost:3001`), `BENCHMARK_ENDPOINTS` (default `/api/health,/api/metrics`), `BENCHMARK_REQUESTS`, `BENCHMARK_CONCURRENCY`, `BENCHMARK_AUTH_TOKEN`, `BENCHMARK_DB_RUNS`, `BENCHMARK_SKIP_HTTP`, and `BENCHMARK_SKIP_DB`.
- `npm run chaos:check` sends bad requests and a failing SQL statement, then checks that `/api/health` still returns `200`. It exits non-zero if anything does not recover. It reads `CHAOS_BASE_URL`, `CHAOS_TIMEOUT_MS`, `CHAOS_SKIP_HTTP`, and `CHAOS_SKIP_DB`.
