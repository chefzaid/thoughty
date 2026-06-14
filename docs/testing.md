# Testing Guide

Thoughty uses a layered test strategy: backend Jest tests for API and domain behavior, frontend Vitest tests for React units/components/hooks, and Playwright browser tests for user-facing flows. This guide explains how to run those suites, how the test files are organized, and how to add new tests without making the suite hard to navigate.

## Test Layers

| Layer                    | Location                             | Runner                   | Purpose                                                            |
| ------------------------ | ------------------------------------ | ------------------------ | ------------------------------------------------------------------ |
| Backend unit/integration | `thoughty-server/src/**/*.spec.ts`   | Jest                     | Services, controllers, guards, modules, and backend helpers        |
| Backend e2e              | `thoughty-server/test/*.e2e-spec.ts` | Jest + Supertest         | API-level application behavior through the NestJS app              |
| Frontend unit/component  | `thoughty-web/src/**/*.test.ts(x)`   | Vitest + Testing Library | React components, hooks, utilities, and service adapters           |
| Frontend browser e2e     | `thoughty-web/e2e/**/*.spec.ts`      | Playwright               | User-visible browser flows with deterministic mocked API responses |

## Testing Strategy

Thoughty has three useful testing layers in local development.

### 1. Fast unit and component checks

- Backend: `cd thoughty-server && npm test`
- Frontend: `cd thoughty-web && npm test`

These are the cheapest checks for iterative work.

### 2. Coverage runs

- Full aggregated report: `mask test --coverage` or `npm run coverage`
- Backend only: `cd thoughty-server && npm run test:cov`
- Frontend only: `cd thoughty-web && npm run test:coverage`

The root coverage script runs both coverage suites and prints a summary for backend coverage, frontend coverage, and the average across both.

### 3. End-to-end tests

- Backend e2e: `cd thoughty-server && npm run test:e2e`
- Frontend browser e2e: `cd thoughty-web && npm run test:e2e`

Frontend Playwright tests cover public pages, auth onboarding, journal authoring and lifecycle flows, AI-assisted writing/tagging, stats, diary management, import/export, and navigation using mocked API responses for determinism.

### Practical test guidance

- Run the narrowest relevant suite first.
- Use backend e2e tests when you change routing, auth guards, DTO validation, or integration points.
- Use Playwright when you change navigation, auth UX, journal UX, AI UX, import/export UX, or multi-step browser flows.
- Run the full coverage path before larger merges or release prep.

## Quick Commands

Run commands from the repository root unless the command starts with `cd`.

### Common local checks

```bash
mask test                 # backend Jest + frontend Vitest
mask test --backend       # backend Jest only
mask test --frontend      # frontend Vitest only
mask test --e2e           # frontend Playwright only
mask test --coverage      # aggregated backend + frontend coverage
```

### Direct backend commands

```bash
cd thoughty-server
npm test                  # unit/integration specs in src
npm run test:watch        # watch mode
npm run test:cov          # backend coverage
npm run test:e2e          # backend e2e specs in test/
npm run test:e2e:cov      # backend e2e coverage
npm run lint              # backend lint; currently runs eslint --fix
```

### Direct frontend commands

```bash
cd thoughty-web
npm test                  # Vitest unit/component tests
npm run test:watch        # Vitest watch mode
npm run test:coverage     # frontend coverage
npm run typecheck         # TypeScript check without build
npm run lint              # frontend ESLint
npm run test:e2e          # all Playwright specs
npm run test:e2e:install  # install Chromium for Playwright when needed
```

### Targeted Playwright commands

```bash
cd thoughty-web
npx playwright test e2e/journal/entry-lifecycle.spec.ts
npx playwright test e2e/import-export/portability.spec.ts e2e/diary/management.spec.ts
npx playwright test e2e/journal
npx playwright test --grep "Journal Markdown authoring"
```

Playwright starts the Vite dev server automatically through `thoughty-web/playwright.config.ts`:

- test directory: `thoughty-web/e2e`
- base URL: `http://localhost:5173`
- browser: Chromium
- channel: bundled `chromium`
- traces retained on failure
- screenshots captured on failure

## Frontend E2E Structure

Frontend e2e specs are grouped by feature/domain directory under `thoughty-web/e2e`. Each spec should still be named after the behavior it covers. Avoid generic buckets such as `critical-flows.spec.ts` or `feature-flows.spec.ts`; a directory and file name should tell future contributors what behavior belongs there.

Current e2e feature groups:

| Directory            | Covers                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| `e2e/public/`        | Public landing page and intro transitions                              |
| `e2e/auth/`          | Sign-up and login onboarding into the journal                          |
| `e2e/navigation/`    | Direct routes, browser history, permalinks, and diary return routes    |
| `e2e/journal/`       | Journal authoring, lifecycle, filtering, highlights, and entry actions |
| `e2e/tags/`          | Tag organization and tag rename flows                                  |
| `e2e/ai/`            | AI tag suggestions, automatic tagging, writing help, and chat history  |
| `e2e/stats/`         | Stats totals, activity heatmap, and tag insights                       |
| `e2e/import-export/` | JSON import/export, format settings, and delete-all flows              |
| `e2e/cloud-sync/`    | Cloud uploads, schedules, sync-now flows, and cloud imports            |
| `e2e/diary/`         | Diary create, edit, reorder, default, and delete fallback              |

Current specs by feature group:

| Directory            | Spec file                      |
| -------------------- | ------------------------------ |
| `e2e/public/`        | `intro-page.spec.ts`           |
| `e2e/auth/`          | `onboarding.spec.ts`           |
| `e2e/navigation/`    | `routes.spec.ts`               |
| `e2e/journal/`       | `entry-lifecycle.spec.ts`      |
| `e2e/journal/`       | `entry-reordering.spec.ts`     |
| `e2e/journal/`       | `markdown-authoring.spec.ts`   |
| `e2e/journal/`       | `navigation.spec.ts`           |
| `e2e/journal/`       | `composable-filtering.spec.ts` |
| `e2e/journal/`       | `highlights.spec.ts`           |
| `e2e/journal/`       | `bulk-archive.spec.ts`         |
| `e2e/journal/`       | `revision-history.spec.ts`     |
| `e2e/journal/`       | `visibility-toggle.spec.ts`    |
| `e2e/journal/`       | `favorites.spec.ts`            |
| `e2e/tags/`          | `management.spec.ts`           |
| `e2e/ai/`            | `tag-suggestions.spec.ts`      |
| `e2e/ai/`            | `auto-tagging.spec.ts`         |
| `e2e/ai/`            | `writing-and-chat.spec.ts`     |
| `e2e/stats/`         | `insights.spec.ts`             |
| `e2e/import-export/` | `basic.spec.ts`                |
| `e2e/import-export/` | `portability.spec.ts`          |
| `e2e/cloud-sync/`    | `management.spec.ts`           |
| `e2e/diary/`         | `management.spec.ts`           |

When adding a new e2e spec, place it in the closest existing feature directory. Create a new feature directory only when the scenario is not owned by one of the existing domains.

### E2E support files

The Playwright suite uses in-browser app code with mocked API routes for deterministic tests.

| File                                                    | Purpose                                                                                             |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `thoughty-web/e2e/support/mockApp.ts`                   | Creates a per-test mock app state, seeds auth tokens, and registers API routes                      |
| `thoughty-web/e2e/support/mockApp.shared.ts`            | Shared mock state types, default diaries, cloud fixtures, import/export helpers, and stats builders |
| `thoughty-web/e2e/support/mockApp.route-utils.ts`       | Shared route context and JSON response helpers for the mock API                                     |
| `thoughty-web/e2e/support/mockApp.routes.ts`            | Top-level route registration and dispatch for the mock API                                          |
| `thoughty-web/e2e/support/mockApp.routes.entries.ts`    | Entry collection and mutation handlers for the mock API                                             |
| `thoughty-web/e2e/support/mockApp.routes.reference.ts`  | Stats, AI, diary, and entry-reference handlers for the mock API                                     |
| `thoughty-web/e2e/support/mockApp.routes.cloud-sync.ts` | Cloud-sync handlers with stateful schedules, files, and sync payload capture                        |

Prefer extending the mock support when a scenario needs a realistic backend response. Keep mock behavior minimal and purpose-driven: it should support the browser flow under test, not reimplement the whole backend.

## How to Add Tests

### 1. Choose the right layer

- Use backend Jest tests when changing backend services, controllers, DTO validation, guards, persistence behavior, or cloud/AI server integrations.
- Use frontend Vitest tests when changing a component, hook, utility, reducer-like state transition, or API service adapter.
- Use Playwright when the behavior is route-based, visual/user-driven, or spans multiple UI surfaces such as auth → journal → stats.

### 2. Name files by feature behavior

Good e2e names:

- `journal/attachments-preview.spec.ts`
- `profile/appearance-preferences.spec.ts`
- `cloud-sync/scheduling.spec.ts`

Avoid names that do not say what they contain:

- `critical-flows.spec.ts`
- `feature-flows.spec.ts`
- `misc.spec.ts`

If a file starts covering unrelated areas, split it. A focused file is easier to run, review, and maintain.

### 3. Keep test titles outcome-based

Prefer:

```ts
test('archives selected entries and reveals them through the archived filter', async ({ page }) => {
  // ...
});
```

Avoid:

```ts
test('works', async ({ page }) => {
  // ...
});
```

### 4. Seed only the state needed for the scenario

For Playwright tests, use `setupMockApp(page, options)`:

```ts
const { state } = await setupMockApp(page, {
  startAuthenticated: true,
  initialEntries: [
    {
      id: 101,
      date: '2024-04-18',
      index: 1,
      content: 'Focused entry text',
      tags: ['focus'],
      visibility: 'private',
      diaryId: 1,
    },
  ],
});
```

Keep seed data small and meaningful. If the assertion only needs one entry, do not seed a full journal.

### 5. Assert UI and state when both matter

Playwright tests should prove the user-visible result. When the mock state captures an important payload or mutation, assert that too.

```ts
await expect(page.getByText('Updated entry body')).toBeVisible();
await expect.poll(() => state.entries[0]?.content).toBe('Updated entry body');
```

### 6. Prefer accessible selectors

Use Playwright locators that reflect how users interact with the app:

```ts
await page.getByRole('button', { name: 'Save' }).click();
await page.getByPlaceholder("What's on your mind?").fill('Entry text');
await page.getByLabel('More actions').click();
```

Use CSS selectors for structural UI that has no accessible handle yet, such as a scoped entry card:

```ts
const entry = page.locator('#entry-101');
await entry.getByRole('button', { name: 'Edit' }).click();
```

### 7. Make mocked API additions explicit

When adding a new e2e flow that needs backend behavior:

1. Add any state fields to `mockApp.shared.ts`.
2. Add route handling to the smallest relevant handler in `mockApp.routes.ts`.
3. Track the last request payload when the test needs to verify client behavior.
4. Return realistic response shapes that match the app’s real services.

Example pattern:

```ts
if (pathname === '/api/example' && request.method() === 'POST') {
  state.lastExamplePayload = request.postDataJSON();
  await fulfillJson(route, { success: true });
  return true;
}
```

### 8. Run the narrowest check first

After adding or changing a test:

```bash
cd thoughty-web
npx playwright test e2e/journal/the-specific-file.spec.ts
npm run typecheck
npm run lint
```

For backend changes:

```bash
cd thoughty-server
npm test -- path/or/name.spec.ts
npm run test:e2e
```

Before a larger merge, run the broader suite that matches the scope of the change.

## CI and Browser Notes

- Playwright uses the bundled `chromium` channel locally and in CI.
- In CI, Playwright retries failed tests twice.
- If local browser launch fails, run `cd thoughty-web && npm run test:e2e:install` to provision the bundled `chromium` browser.
- Playwright reuses an existing dev server on port `5173` when one is already running.

## Troubleshooting

### Playwright cannot find the `chromium` project

This project does not define named Playwright projects. Run without `--project=chromium`:

```bash
cd thoughty-web
npx playwright test e2e/journal/entry-lifecycle.spec.ts
```

### A test can pass alone but fail in the full suite

- Make sure the test calls `setupMockApp(page, ...)` before navigation.
- Avoid shared mutable module-level state outside seed constants.
- Keep mock route state per test through the returned `state` object.

### A locator is ambiguous

Use accessible locators with `exact: true` or scope to a region/card:

```ts
await page.getByRole('button', { name: 'Archive', exact: true }).click();

const entry = page.locator('#entry-101');
await entry.getByLabel('More actions').click();
```

### `git diff --check` reports unrelated whitespace

Fix whitespace in the file you changed. If the warning comes from an unrelated pre-existing file, do not mix that cleanup into feature/test changes unless it is part of the task.