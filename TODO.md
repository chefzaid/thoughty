# Feature Backlog

Worked through with the [coding agent loop](https://github.com/chefzaid/agents/blob/main/CODING_AGENT.md): open bugs first, then answered questions, then the simplest open task.

## Bugs to fix

Bugs, failing checks, security findings and code smells found while working on another task. Each entry names the file or area, what is wrong, and how to reproduce it.

- [x] Flaky e2e test `thoughty-web/e2e/navigation/routes.spec.ts` › "supports authenticated deep links and browser history across app views" fails about 1 run in 10, on `main` before any change too: after clicking **Tags**, `getByRole('heading', { name: /Tags/i })` also matches the Stats page's "Top Tags" and "Top Tags by Year" headings while Stats is still on screen (strict mode violation). Reproduce: `npx playwright test e2e/navigation/routes.spec.ts -g "across app views" --repeat-each 20`. *(found by: Coding Agent)* Fixed on 2026-10-26: a test race, not an app bug. React Router renders route changes as transitions, so the URL updates while Stats is still on screen; the test now waits for each page's exact level-1 title and checks the other page's title is gone.
- [x] Flaky e2e test `thoughty-web/e2e/navigation/routes.spec.ts` › "shows a toast for a missing journal permalink" fails about 1 run in 50: the "Entry not found" alert is not found within 10 seconds while the journal is shown. Reproduce: `npx playwright test e2e/navigation/routes.spec.ts e2e/auth --repeat-each 4` a few times. *(found by: Coding Agent)* Fixed on 2026-10-26: a test race. The journal looks the entry up twice (again once the profile's page size arrives, dropping the first answer), but the test held only one lookup, so when the second came in after the release it stayed held forever and no toast appeared. The test now holds every lookup and answers them all once the clock is paused.
- [ ] Container image findings in the PostgreSQL helper image: the `postgres-backup` CronJob and the database setup Job (`infra/k8s/base/postgres-backup.yaml`, `infra/k8s/overlays/swirl-cloud/database-setup-job.yaml`, digest set in the overlay kustomization) render `postgres:18.6-bookworm@sha256:b939b3851e2c…` is an amd64-only build from 2026-08-13; the tag now points to `sha256:bbf83594798e…` (rebuilt 2026-10-21) and the platform runs `sha256:3725f4e2499e…` (2026-09-19). The 2026-10-04 platform Trivy scan found critical Debian bookworm findings in this image (Perl, zlib minizip) with no Debian fix; the platform accepted them for its own PostgreSQL until 2026-11-04 ([swirl-cloud security](https://github.com/chefzaid/swirl-cloud/blob/main/docs/security.md#vulnerability-triage)), not for this repository. Recheck on the platform's Grafana **Trivy Security Reports** dashboard or with `trivy image --severity CRITICAL <image>`, then move to the current digest or a variant without the affected packages, or record an exception here. *(found by: Infra Agent, swirl-cloud TODO §21)*
- [x] `thoughty-web/src/hooks/useEntryNavigation.ts` (permalink effect): opening `/journal?entry=<id>` sent `GET /api/entries/by-date?id=<id>` twice, first with the default page size before the profile config loaded, then again when `getLimit` changed; the first answer was discarded. *(found by: Coding Agent)* Fixed on 2026-10-26: `useConfig` now reports `configLoaded` and the permalink lookup waits for it, so one request is sent with the user's page size. The effect also stopped resetting the page once a permalink had landed, which had sent permalinks to entries past page 1 back to page 1.
- [x] `thoughty-web/src/hooks/useEntriesState.ts` (entries list query): signing in to the journal fetches `GET /api/entries` with the default `limit=10` before the profile config loads, then again with the user's page size, and on a permalink a third time after the archive filter is reset; the earlier answers are thrown away. Reproduce: set `entriesPerPage` to 2 in the e2e mock config, open `/journal?entry=<id>` and log `page.on('request')` for `/api/entries?`: `limit=10` requests appear before the `limit=2` ones. *(found by: Coding Agent)* Fixed on 2026-10-26: the list query stays disabled until the config has loaded (or failed, then the default 10 is used at once), the default or route diary is applied, and on a permalink until its lookup has landed (the landed permalink now lives in `useEntries`). The journal now sends one list request on first load (it also used to re-ask when the default diary was picked) and one on a permalink, already on the entry's page; `e2e/journal/list-requests.spec.ts` counts them.
- [x] e2e mock API (`thoughty-web/e2e/support/mockApp.routes.entries.ts`) has no route for `GET /api/entries/:id/backlinks`, so the request falls through to the Vite proxy and logs `http proxy error ... ECONNREFUSED 127.0.0.1:3001` (seen in `e2e/journal/recycle-bin.spec.ts`, entries 501-505); tests pass but the backlinks panel gets a failed request instead of mock data. Reproduce: run the full e2e suite and look for `/backlinks` proxy errors in the web server output. *(found by: Coding Agent)* Fixed on 2026-10-26: the mock now answers `GET /api/entries/:id/backlinks` (`e2e/support/mockApp.backlinks.ts`) with the API's `{ backlinks }` shape, computed like the server from the other live entries' `[[date]]`, `[[date#n]]` and legacy `entry(date--n)` references, in journal order, across diaries, leaving out the recycle bin and answering 404 for an entry that is not in the journal; `e2e/journal/backlinks.spec.ts` covers the panel. The diagnosis was off: the catch-all already answered the request with `{ success: true }` (no backlinks), and the ECONNREFUSED lines come from requests still unanswered when a test ends (see the entry below). With real backlinks, axe found the panel's link count below WCAG AA contrast in both themes (`EntryViewModeSections.tsx`), fixed to the card footer's colors. Logging every request that reached the catch-all over a full run found one other unmocked path, `GET /api/ai/models`, now answered with an OpenRouter-style `{ id, name }` list sorted by name (`e2e/ai/model-picker.spec.ts`). `e2e/journal/navigation.spec.ts` now scopes its last check to the source card, since the target's backlinks panel quotes the same text while the diary switch renders.
- [ ] e2e harness (`thoughty-web/e2e/support/mockApp.routes.ts`, `registerMockAppRoutes`): a request the app sends just before a test ends, while its `page.route` handler has not answered yet, is released to the network when the context closes and reaches the Vite dev server, which proxies it to `localhost:3001` and logs `http proxy error: /api/... ECONNREFUSED` (about 30 a run, on mocked paths such as backlinks, `/api/config`, `/api/stats`, `/api/review`, `/api/entries/feed`). Tests still pass, but the log noise hides real misses, and with a local API on port 3001 those requests would reach it. Reproduce: a spec whose route handler for `/api/entries/<id>/backlinks` waits 3 s before `route.fallback()` and ends once the request is seen logs the proxy error for it; or run the full suite with `DEBUG=pw:webserver`. Possible fixes: an auto fixture that waits for the page's pending `/api` requests (or calls `page.unrouteAll({ behavior: 'wait' })`) before teardown, or point the e2e dev server's proxy at a closed target that answers 503 without logging. *(found by: Coding Agent)*
- [x] `thoughty-web/src/components/EntriesList/EntryViewModeSections.tsx` (`EntryHistorySection`): the "no revisions" text and each revision's timestamp use `text-gray-500` in dark and `text-gray-400` in light, the same pair axe flagged as below WCAG AA contrast on the backlinks count (fixed there); the "..." loading text uses `text-gray-500` in both themes. No axe scan opens the history panel, so it goes unnoticed. Reproduce: in `e2e/accessibility/journal.spec.ts`, open an entry's history (with and without revisions) and run the same axe scan. *(found by: Coding Agent)* Fixed on 2026-10-26: the empty text, the loading text, the revision numbers and their timestamps now share the card footer and backlinks count colors (`text-gray-400` dark, `text-gray-500` light) through one `mutedTextClass` helper in that file, which high contrast keeps as is. `e2e/accessibility/journal.spec.ts` now scans the open history panel empty and with revisions in both themes, with and without high contrast (it failed on these texts before the fix), and a unit test checks the colors in both themes.
- [x] Backlinks panel count is not pluralized: an entry with one backlink shows "1 links" (French "1 liens"), from `backlinksCount` in `thoughty-web/src/utils/translations.ts`. Other counts use a singular key (`tagUsageCount` / `tagUsageCountOne`). Reproduce: `e2e/journal/backlinks.spec.ts` seeds entries with one backlink each. *(found by: Coding Agent)* Fixed on 2026-10-26: a `backlinksCountOne` key ("1 link" / "1 lien") is shown for a single backlink, following the `tagUsageCountOne` pattern; unit tests cover 1, 2 and 3 in English and French, and `backlinks.spec.ts` checks "1 link" and "2 links".
- [ ] Possible flake in `thoughty-web/e2e/accessibility/journal.spec.ts` › "light high contrast entry cards, search highlights, and every filter set": failed once in about 150 runs (with `navigation.spec.ts` and `entry-navigation-scroll.spec.ts`, `--repeat-each 3`), after the mock started returning backlinks; the axe details were not kept, and 48 runs of that test alone plus two more mixed runs and a full suite passed. Reproduce: `npx playwright test e2e/accessibility/journal.spec.ts -g "entry cards" --repeat-each 30 --reporter=line` and read the reported violation. *(found by: Coding Agent)* The dark variant ("dark entry cards, search highlights, and every filter set") also failed once in a full e2e run on 2026-10-26 and passed when the file was run again (the output was overwritten by the rerun).
- [x] `thoughty-web/src/components/EntriesList/EntryViewModeSections.tsx` (entry card footer): the word count is not pluralized, so a one-word entry shows "1 words" (French "1 mots"), from `entryWordCount` in `thoughty-web/src/utils/translations.ts`. Reproduce: save an entry whose content is a single word and read the card footer. *(found by: Coding Agent)* Fixed on 2026-10-26: an `entryWordCountOne` key ("1 word" / "1 mot") is shown for a one-word entry, following the `backlinksCountOne` pattern; unit tests cover 1, 2 and 3 words in English and French, and `e2e/journal/entry-lifecycle.spec.ts` edits an entry down to one word and checks "1 word".
- [x] `thoughty-web/src/components/Stats/StatsActivityHeatmap.tsx` (heatmap cell labels): the cell `aria-label` and `title` are built in hardcoded English (`'1 entry'`, `` `${count} entries` ``, `"... on <date>"`), so French users hear and see English text. Reproduce: switch the profile language to French, open Stats and hover a heatmap day. *(found by: Coding Agent)* Fixed on 2026-10-26: each day reads `statsHeatmapDay_one` / `_other` ("1 entry on Apr 19, 2024", "2 entrées le 18 avr. 2024", and "0 entrée" in French, which counts zero as singular) through a new shared `utils/pluralPhrase.ts`, with the date, month and weekday labels in the profile language like the mood panel (they used the browser's locale), passed down from `Stats`. Unit tests cover 0, 1 and 2 in both languages and `e2e/stats/insights.spec.ts` checks the labels in English and French.
- [x] Counts without a singular form and hardcoded English text in `thoughty-web/src` (found while grepping after the heatmap fix). Reproduce each by reaching the screen with a count of 1 (or 0 in French, which counts zero as singular), or in French for the English text. *(found by: Coding Agent)*
  - Counts that read "1 entries" / "1 entrées" (or similar) and have no singular form, in `utils/translations.ts` unless named: `statsMoodMonthPoint`, `statsMoodWeekdayRow`, `statsFeelingRow` (`translations.mood.ts`, `Stats/StatsMoodPanel.tsx` labels); `reviewAverageWords` (`translations.review.ts`, `YearReview/YearReviewHero.tsx`); `journalRetagApplied`, `journalRetagScanCount` (total), `journalRetagSelected` (`TagManagerPage/JournalRetagReview.tsx`); `deleteTagConfirm` (`TagManagerPage/TagManagerPage.tsx`, a tag used once); `correlationEntriesAnalyzed`, `sharedEntryCount` (`Stats/StatsCorrelationGraph.tsx`); `importSuccess` (imported and skipped, `ImportExport/ImportExport.tsx`); `bookVersionCounts`, `bookVersionChanges` (`ImportExport/ImportExportBookSection.tsx`); `duplicateScanCount` (`DuplicateReview/DuplicateReview.tsx`); `bulkDeleteMessage` (`routes/AuthenticatedAppLayout.tsx`, one selected entry); French only: `feedCount` ("1 entrées affichées sur 1", `FeedPage/FeedPage.tsx`), `bulkSelected` ("{count} sélectionné(s)", `EntriesList/EntriesList.helpers.tsx`), `appImportMoreFailed` ("…et 1 autres", `translations.appImport.ts`, `ImportExport/appImport/AppImportPanel.tsx`). `utils/pluralPhrase.ts` with `<key>_one` / `<key>_other` keys fits these; `RecycleBin/recycleBinFormat.ts`, `YearReview/yearReviewFormat.ts` and `FocusMode/focusModeSession.ts` each repeat its `Intl.PluralRules` logic inline and could delegate to it.
  - Hardcoded English: `aria-label="Close modal"` (`ConfirmModal/ConfirmModal.tsx:37`, `AiChatModal/AiChatModal.tsx:152`); `aria-label="Toggle visibility"` (`DiaryManager/DiaryManager.tsx:291`, `:371`); `` aria-label={`Remove ${tag} tag`} `` (`TagBadge/TagBadge.tsx:130`); `` title={`Navigate to entry on ${date}...`} `` (`EntryContentRenderer/EntryContentRenderer.tsx:230`); `alt="Preview"`, `aria-label="Zoom"` and the sr-only "Zoom" (`ProfilePictureEditor/ProfilePictureEditor.tsx:261`, `:271`, `:282`); `alt="Profile"` (`ProfilePage/ProfileHeaderCard.tsx:64`); `alt="UK Flag"` / `alt="French Flag"` (`ProfilePage/AppearanceSection.tsx:125`, `:133`); the `Create "{inputValue}"` and "No tags found" options (`TagPicker/TagPicker.tsx:175`, `:181`); the caption track `label="No captions available"` (`AttachmentPreview/AttachmentPreviewContent.tsx:72`, `MemoirPage/MemoirAnswerForm.tsx:147`); `setError('Cannot delete the default diary')` (`DiaryManager/DiaryManager.tsx:151`) and `setError('Failed to load statistics')` (`Stats/Stats.tsx:107`), both shown on screen. The fallback error messages in `services/api/*.ts` (for example `diariesService.ts` "Failed to create diary", `aiService.ts` "Could not save API key") and `contexts/AuthContext.tsx` ("Login failed", ...) are English too; check which of them reach the screen.
  - Fixed on 2026-10-26: every listed count now reads `<key>_one` / `<key>_other` through `utils/pluralPhrase.ts` in English and French ("1 entry", "1 entrée sélectionnée", "…et 1 autre", "0 doublon ignoré"), with the count in the reader's number format; sentences with two counts (`importSuccess`, `bookVersionCounts`, `bookVersionChanges`) fill each from its own pair, and the scan counts follow the total. `recycleBinFormat.ts`, `yearReviewFormat.ts` and `focusModeSession.ts` delegate to `pluralPhrase`, and the earlier `backlinksCountOne`, `entryWordCountOne` and `tagUsageCountOne` keys became `_one`/`_other` pairs, so the app has one plural pattern; a unit test fails on a `_one` key without its `_other` or on a `*One` key. `BulkActionBar` moved out of `EntriesList.helpers.tsx` (517 lines) into its own file. The listed aria-labels, titles, alt texts, TagPicker options, caption track labels and the diary and stats errors are translated; `ConfirmModal` now requires `t`, since the journal's delete modals passed none and showed "Cancel" / "Delete" in French, `TagPicker` lost its English "Add tags..." default, and the flags beside the language names have `alt=""`. The API fallbacks that reach the screen (diaries, pin and task updates, the AI key and journal retag, the app import, sign-in, sign-up, two-factor, Google sign-in, password change, reset email and account deletion) are now translation keys that the screen shows through `t`, which passes the API's own message through; the others (feed, memoir, recycle bin, review, feature requests, AI usage, email verification, reset password) never reach the screen and stay English. Unit tests cover each in both languages, and `e2e/journal/bulk-archive.spec.ts` checks "1 sélectionnée" and the one-entry delete message in French; docs/development.md describes both patterns.
- [ ] `thoughty-web/src/utils/translations.ts` is about 3,100 lines, far over the 500-line rule: every core key's type, English and French text live in one file, so each change touches a huge diff and merge conflicts are frequent. Several features already have their own files (`translations.mood.ts`, `translations.review.ts`, `translations.recycleBin.ts`, ...). Split the rest the same way by feature (journal and entries, stats, import/export and book, auth and profile, diaries, tags, feed and social, AI), each with its key type and `en`/`fr` maps merged in `translations.ts`, keeping every key name unchanged. Reproduce: `wc -l thoughty-web/src/utils/translations.ts`. *(found by: Coding Agent)*
- [x] Web source files over the 500-line rule besides `translations.ts`: split along their responsibilities with the original modules kept as entry points, so importers are unchanged. `contexts/AuthContext.tsx` composes `useAuthSession` (access token, refresh, `authFetch`, session restore, logout), `useSignInActions` (register, password and two-factor login, Google) and `useAccountActions` (password, email verification, account deletion); `services/api/aiService.ts` composes `aiWritingService` (tags, rephrasing, summaries, inspiration, chat), `aiJournalService` (duplicates, semantic search, journal retag) and `aiAccountService` (models, OpenRouter key, usage), with the types in `aiTypes.ts`; `components/CloudSync/CloudSync.tsx` renders the provider cards from the `useCloudSync` hook with `CloudScheduleSection` and `CloudFilesSection`; `hooks/useEntryActions.ts` re-exports `useEntryForm`, `useEntryEdit`, `useDeleteModal` and `useBulkSelect` from their own files; `utils/appShellProps.ts` re-exports the public page props from `publicShellProps.ts`. Unit tests cover the new hooks and sections. *(found by: Coding Agent)*
- [ ] Server source files over the 500-line rule (`thoughty-server/src`, specs and migrations excluded): `common/utils/file-converter.util.ts` (736), `modules/auth/services/auth.service.ts` (694), `modules/entries/dto/entries.dto.ts` (670), `common/utils/book-converter.util.ts` (510), `modules/entries/entries-query.service.ts` (510). Split each along its responsibilities (for example the converter per format, the auth service into session, password and account parts, the entries DTOs per operation) without changing the API. Reproduce: `find thoughty-server/src -name '*.ts' ! -name '*.spec.ts' ! -path '*/migrations/*' | xargs wc -l | awk '$1>500'`. *(found by: Coding Agent)*
- [x] Entry hook messages in English and French: the writing form keeps its error as a translation key that `EntryForm` shows with `t` (`useEntryForm.ts`, `useEntryTagSuggestions.ts`), and `useEntryEdit`, `useDeleteModal`, `useBulkSelect` and the rephrase action of `useAppShellModel` report failures through the `Notifier` of `hooks/useAppNotice.ts` instead of `alert()`, shown by `AuthenticatedAppLayout` in a toast with `role="alert"`. The keys are in `utils/translations.entryActions.ts`; the bulk rephrase summary counts each outcome with `pluralPhrase` ("1 updated, 2 failed", « 1 mise à jour, 2 en échec »). Unit tests in both languages and `e2e/journal/entry-action-messages.spec.ts` cover them. *(found by: Coding Agent)*
- [x] English left in the web app after the plural and hardcoded-text fix: the AI chat transcript download is built with `t` and follows the profile language (French transcript with « Transcription du chat IA », « Tags : aucun », « Utilisateur : »...); the writing and edit tag pickers use their own `tagPickerPlaceholder` key instead of trimming `filterTagsPlaceholder`; the empty caption tracks take `srcLang` from `t('languageCode')`; and French `previewAttachment` reads « Aperçu » (a scan of the French translations for other missing accents or cedillas found none). Unit tests in both languages and a French transcript e2e. *(found by: Coding Agent)*
- [ ] API error messages are English sentences (`thoughty-server`, for example "Invalid or expired verification code." from `auth/services/two-factor.service.ts`), and the web app shows them as they are when the API sends one, so French users read English for server-side errors; only the fallbacks for errors without a message are translated. Reproduce: switch to French, sign in to an account with two-factor authentication and enter a wrong code. A fix would have the API send a stable error code with each message (or the web map the known messages to keys) and translate it. *(found by: Coding Agent)*
- [x] No browser dialogs left in the web app: a failed pin toggle or task tick in `hooks/useEntriesState.ts` is reported through the `Notifier` of `hooks/useAppNotice.ts` in the app's notice toast (falling back to `pinUpdateFailed` / `taskUpdateFailed` when the API sends no message), `components/AttachmentUpload/AttachmentUpload.tsx` lists each file it turned away (wrong type or over 5 MB) under the attach button in a `role="alert"` block that the button points to with `aria-describedby` (« setup.exe : Ce type de fichier n'est pas autorisé… »), and deleting a diary (`DiaryManager`) asks in the app's `ConfirmModal`, which names the diary, instead of `confirm()`. ESLint's `no-alert` rule now guards `thoughty-web`. Unit tests in both languages, `e2e/journal/attachment-upload-errors.spec.ts` (with an accessibility scan), new pin and task cases in `e2e/journal/entry-action-messages.spec.ts`, and the diary delete dialog in `e2e/diary/management.spec.ts` cover them. *(found by: Coding Agent)*
- [x] **Save template** in `thoughty-web/src/components/EntryForm/EntryForm.tsx` now asks for the name in the app's own modal dialog, `EntryForm/TemplateNameDialog.tsx`, instead of the browser's `prompt()`: a labelled name field that takes focus, Save and Cancel, Escape or the backdrop to cancel, and focus back on **Save template** afterwards (through the shared `hooks/useDialogFocus.ts`). An empty or blank name is refused with « Saisissez un nom pour le modèle. » / "Enter a name for the template." under the field (`role="alert"`, `aria-invalid`, `aria-describedby`), the name is trimmed, and Save shows "Saving..." and ignores a second press while the template is saved. The strings are in `utils/translations.entryTemplates.ts` (the old `templateNamePrompt` key became `templateNameLabel`), and the `eslint-disable-next-line no-alert` is gone, so the web app has no exception to the rule. The server has no limit on a template's name (only the 500,000-character cap on the whole `entryTemplates` setting), so the field has none either; see Needs Input. Unit tests (`TemplateNameDialog.test.tsx`, `EntryForm.templates.test.tsx`, split out of the 500-line `EntryForm.test.tsx`) and `e2e/journal/entry-templates.spec.ts` (save with a name, Escape and Cancel, the empty-name error, French, and an axe scan of the dialog in both themes). *(found by: Coding Agent)*
- [x] `thoughty-web/src/services/api/base.ts` (`readApiErrorMessage`): an error response without a usable message (JSON such as `{}` or `{"statusCode":503}`, an empty body, or an HTML page) now gives the caller's translated fallback, such as `taskUpdateFailed`, instead of the raw body. NestJS's `message` (string or list) is read before its `error` status name, so `{ message: 'You can pin at most 3 entries.', error: 'Bad Request' }` shows the message. *(found by: Coding Agent)*
- [x] `thoughty-web/src/components/AttachmentUpload/AttachmentUpload.tsx`: the kind and size line of an attachment card ("Text · 12 B") now uses the shared `mutedTextClass` (moved from `EntriesList/EntryViewModeSections.tsx` to `utils/tintedText.ts`, built on the gray tint: `text-gray-400` in the dark theme, `text-gray-600` in the light one, which also holds on the light theme's gray-100 card), so it passes the WCAG AA colour-contrast check in both themes and with high contrast; entry history and card counts use the same helper. A unit test checks the class per theme, and `e2e/journal/attachment-upload-errors.spec.ts` runs an axe scan with a pending `.txt` file attached in both themes, with and without high contrast. *(found by: Coding Agent)*
- [x] `thoughty-web/src/utils/translations.ts` (`getTranslation`): parameters are now inserted by `fillTranslationParams` (`utils/translationParams.ts`), one pass with a replacer function, so `$&`, `$1`, `$$`, `$'` or `` $` `` in a value (a file named `a$&b.pdf`) are shown as written, a value is never filled in again as a placeholder, and a placeholder used twice is filled both times. `pluralPhrase` goes through `getTranslation`, and the hand-written `t` mocks in five component tests reuse the helper. Unit tests cover each pattern in `getTranslation`, `pluralPhrase` and the helper. *(found by: Coding Agent)*
- [x] `thoughty-web/src/components/ConfirmModal/ConfirmModal.tsx` is now a modal `role="alertdialog"` with `aria-modal`, named by its title (`aria-labelledby`) and described by its message (`aria-describedby`). It reuses the shared `hooks/useDialogFocus.ts`: focus moves to Cancel when it opens, Tab and Shift+Tab stay inside, Escape cancels wherever focus is, and focus returns to the button that opened it; the backdrop is a pointer-only target (`aria-hidden`, out of the tab order). Unit tests cover the semantics, focus in, trap, restore and Escape, and `e2e/diary/confirm-dialog.spec.ts` cancels and confirms a diary deletion with the keyboard alone and runs an axe scan of the open dialog in both themes. *(found by: Coding Agent)*
- [x] `thoughty-web/src/hooks/useConfigState.ts` (`updateConfig`): a failed settings save (network error or a non-2xx answer) still puts the previous settings back, and now resolves `false` (`true` once saved). `useAppShellModel` wraps it with `useReportedConfigUpdate` (`saveConfig`), which says « Vos paramètres n'ont pas pu être enregistrés : les précédents sont rétablis. Réessayez. » / "Your settings could not be saved, so the previous ones are back. Try again." (`settingsSaveFailed`) in the app's notice toast. The profile and tag pages get `saveConfig` and show their "Settings saved" message only after a save (the tag page also keeps a new tag's name and skips its follow-up steps), and deleting a template keeps it selected when that failed. The template name dialog stays open with the name, says « Le modèle n'a pas pu être enregistré. Réessayez. » / "The template could not be saved. Try again." (`templateSaveFailed`) under the field, and puts focus back in it (the toast would sit behind the modal); it and the background tag-color sync use the quiet `updateConfig`. Unit tests (`useConfigState.test.ts`, `useAppShellModel.test.tsx`, `appShellProps.test.tsx`, `TemplateNameDialog.test.tsx`, `EntryForm.templates.test.tsx`, `ProfilePage.test.tsx`, `TagManagerPage.test.tsx`) and `e2e/profile/settings-save-errors.spec.ts` (a refused theme save on the profile with the theme put back, the French message after a network error, and a failed then retried template save). *(found by: Coding Agent)*
- [ ] `thoughty-web/src/hooks/useAppShellEffects.ts` (tag color sync): while settings cannot be saved, the effect that gives new tags a color retries without end. When its `updateConfig` fails, `useConfig` puts the previous settings object back, the `config` dependency changes, the effect runs again, finds the same tags without a color and posts `POST /api/config` again, one request after another for as long as the API refuses or is unreachable. Reproduce: sign in with an entry whose tag has no color in `tagMetadata`, make `POST /api/config` fail (block it in the dev tools' network panel), open the journal and watch the network panel fill with config saves. A fix could remember the metadata it last tried (or stop after a failure until the tags change). *(found by: Coding Agent)*
- [ ] Other modals in `thoughty-web` do not use the shared `hooks/useDialogFocus.ts` and miss parts of the modal keyboard pattern: `components/AiChatModal/AiChatModal.tsx` has no `role="dialog"`, `aria-modal` or `aria-labelledby`, does not keep Tab inside or return focus on close, and Escape only works while its backdrop button has focus; `components/AttachmentPreview/AttachmentPreviewDialog.tsx` and `components/ProfilePictureEditor/ProfilePictureEditor.tsx` render `<dialog open>` (not modal: no `aria-modal`, `onCancel` never fires so Escape does nothing), and neither moves focus in, keeps it there, or returns it; `components/EntriesList/EntrySummaryDialog.tsx` moves focus in and closes on Escape but lets Tab leave the dialog and does not return focus; `components/TagManagerPage/JournalRetagReview.tsx` hand-rolls the same trap and restore as the hook (duplicated logic). Move each onto `useDialogFocus` (keeping JournalRetagReview's "no Escape while applying" rule) with the dialog role, `aria-modal` and a label. Reproduce: open an entry's AI chat (or an attachment preview, the profile picture editor, an entry summary) with the keyboard, press Tab repeatedly and see focus reach the page behind, then press Escape. *(found by: Coding Agent)*

## Needs Input

Parts of tasks that cannot advance without the owner's decision or information. Only the part needing input is set aside here; the rest of the task keeps moving. Answer under the item, and the next agent run applies the answer and removes the entry.

- [ ] Should entry template names have a maximum length? The server stores custom templates as one JSON string in the `entryTemplates` setting (`thoughty-server/src/modules/config/dto/config.dto.ts`, capped at 500,000 characters in total) and checks no field inside it, so today a name can be any length, and the new name dialog accepts any non-blank name. Options: (a) keep no per-name limit; (b) a limit such as 100 characters (entry titles use `MAX_ENTRY_TITLE_LENGTH`, 200), enforced by the name field (`maxLength` and a message) and by the server, which would parse and validate `entryTemplates` (name, content, tags, visibility, format) when the setting is saved. *(task: Bugs to fix › Save template asks for the name with `prompt()`; asked by: Coding Agent)*
  - Answer:

## Core Journaling

- [x] Create, edit, and delete entries, with a date picker that also accepts manual input and defaults to today
- [x] Pagination with a configurable number of entries per page (10 by default) and a go-to-page box
- [x] Year/month jump control to go to the first entry of a year or month without paging manually
- [x] Date filter that only offers dates that actually contain entries (empty dates greyed out)
- [x] Public/private visibility per entry, with a visibility filter
- [x] Cross-referencing between entries ("entry (yyyy-mm-dd)" or "entry (yyyy-mm-dd--X)") with clickable links and back/forth navigation
- [x] Markdown support for entry content rendering and editing
- [x] Revision history per entry: previous versions are kept on edit and can be viewed or deleted
- [x] Mark entries as Favorite, with a favorites filter and a dedicated Favorites journal view
- [x] Archive and unarchive entries to keep the journal organized without deleting old thoughts
- [x] Bulk operations on entries (multi-select for bulk delete, bulk tag change, bulk visibility toggle, bulk archive/unarchive, bulk move between diaries, and bulk AI rephrase)
- [x] Drag-and-drop reordering of same-day entries with automatic renumbering
- [x] Entry attachments with media upload, S3-compatible storage, and in-place previews for image, audio, PDF, and text files (larger previews open in a dedicated dialog)
- [x] Permalink and Share button for each entry to bookmark or share specific thoughts
- [x] Search with result highlighting of the matching text
- [x] Random thought of the day / "On this day X years ago"
- [x] Text-to-speech reading of entries, with language-aware voice selection, preview, and optional reading of entry dates
- [x] Write box that adapts to the content on the fly, and a "More actions" menu to declutter the buttons next to entries
- [x] Journal filter bar grouped into search, filters, and tools (Highlights and Find duplicates), wrapping cleanly on small screens
- [x] Delete all entries at once to start a fresh journal
- [x] Entry templates (e.g. gratitude journal, daily reflection, meeting notes) that users can create and pick when writing a new entry
- [x] Richer built-in templates for life, philosophy, and emotions (morning intentions, weekly review, decision notes replacing meeting notes, rant it out, worry check, philosophical musing, life check-in, values reflection, letters to a future self or unsent letters, dream log)
- [x] Composer and entry editor can be resized in height by dragging while still growing with their content
- [x] Consistent composer buttons: AI actions share one style (Auto Tag, Rephrase, Get Inspired), and Save, Save template, and Reset Filters carry icons
- [x] Word count and estimated reading time displayed per entry, with averages added to stats
- [x] Pinned entries that always show at the top of the list regardless of date sorting limited to a configurable number of pinned entries
- [x] Backlinks panel showing which entries reference the current one (bidirectional linking like Obsidian/Roam)
- [x] Keyboard shortcuts for common actions (Ctrl+N new entry, Ctrl+/ focus search, Esc close modals, arrow keys for pagination)
- [x] Profile and identity verification of accounts with public entries (e.g. verified badge for confirmed email, or even KYC for public figures)

## Tags & Diaries

- [x] Tag pick list when writing and when filtering, with the ability to add new tags on the fly
- [x] Enhanced tags management with custom tag colors and optional categories with category-aware sorting (a random color is assigned to newly created and imported tags)
- [x] Whole-journal tag rename that updates every entry instead of creating parallel old/new variants
- [x] Full tag management (CRUD) in the Tags view: create tags before any entry uses them (offered in the composer and editor pickers), per-tag entry counts, rename, recolor/categorize, and delete a tag from every entry after confirmation
- [x] Tags and themes unified into a single tag concept (no separate "theme tags")
- [x] Composable filtering: full-text search, multi-tag, date, visibility, archive state, and diary scope can all be combined
- [x] Multiple diaries across all features, with reordering (drag or keyboard), renaming, emoji icons, accent colors, per-diary default visibility, and a configurable default diary
- [x] Safe diary deletion: entries move to the default diary, and the default diary itself cannot be deleted

## Profile, Settings & Auth

- [x] Authentication and registration with email and password, plus Google OAuth login with account linking (login accepts email or username, with access/refresh token sessions)
- [x] Forgot-password email flow and password change with current-password verification (refresh tokens are invalidated when credentials change)
- [x] Profile with full name, display name, bio, birthday, and avatar upload with crop, zoom, and reposition
- [x] Interface language selection, with English and French implemented
- [x] Settings popup transformed into a full profile page with dedicated sections
- [x] Dark/light theme as a flip switch
- [x] Font customization (type, size, color) with live preview in Appearance settings
- [x] Delete account
- [x] Stay on the profile page after saving settings, with a success toast
- [x] Routes and paths for each view (Journal, Stats, Profile, Tags, etc.)

## Stats

- [x] Counts of entries per year and per month/year with graphs
- [x] Tag stats per periods of time with graphs
- [x] Journaling activity heatmap (GitHub-style contribution grid) in the stats page
- [x] Totals and averages, top tags, year-by-year tag trends, and diary scoping carried into stats

## Import / Export & Cloud Sync

- [x] Converter from the journal text file to the database and back (import/export)
- [x] Fully parameterized file format (date prefix/suffix, date format, entry separator, same-day entry separator, tag prefix/suffix/separator, etc.)
- [x] TXT, JSON, and Markdown import/export formats (export also supports PDF, EPUB, and HTML grouped by month)
- [x] Optional visibility field in exports (`--[public/private]` after the tags), off by default; imports use the target diary's default visibility
- [x] Export filename built from the diary name plus the export date, with defined behavior for All Diaries
- [x] Cloud sync of the journal with the main cloud providers (OneDrive, Google Drive, ...)
- [x] Scheduled background sync through a queue and worker instead of manual one-off exports
- [x] Preview-first import with automatic format detection, duplicate detection with optional skipping, and a report of imported/skipped entries
- [x] Text imports up to the advertised 5 MB reach the server (the import routes accept larger JSON bodies than the rest of the API)
- [x] Download of all user data (GDPR)
- [x] CSV export for entries and stats data

## Website

- [x] Intro page showcasing the app features with links to login / sign up
- [x] Footer with Privacy, Terms, and Contact entry points, responsive layout, and a back-to-top control
- [x] More detailed landing page with features presentation, screenshots, and sign up call to action
- [x] Presentation page as the main entry: `https://thoughty.swirlit.dev` (the platform Homepage tile, the README, and the GitLab environment link) opens the presentation page for every visitor instead of the journal. Signed-in users get an **Open your journal** button there.
- [x] Presentation page rewritten around the positioning ("a private journal that becomes your life story") and today's features: journal, guided memoir, books, look back, privacy and AI, Day One and Journey imports, with product illustrations in both themes and languages, a section navigation, and the footer links; the public pages now use the logo's violet palette. *(2026-10-26)*
- [x] About page with the story behind Thoughty, the mission, and the team
- [x] Terms of Service and Privacy Policy pages
- [x] Contact and support page with a form to submit inquiries and a How To guides / FAQ section
- [x] Feedback and feature request page for users to submit their ideas and upvote existing ones
- [x] Blog section for updates, tips, and journaling inspiration
- [ ] Admin console for app settings and AI model management (define and change AI models for each AI task type, monitor usage, and manage user access to AI features, ban abusive users, etc.)

## AI

- [x] Suggest tags from the written text and auto-tag entries, with a configurable max number of tags per entry (one "Auto Tag" action suggests both concrete subjects and broader themes)
- [x] Fix writing errors and style: rephrase an existing entry with selectable modes (grammar/form only, slight style enhancement, complete rewrite)
- [x] Pass a thought to AI for analysis or further discussion (entry chat)
- [x] AI chat history, with the option to export chats as text files
- [x] Tone and mood analysis of entries
- [x] Guess the file format automatically when importing a journal file (solved with heuristic detection in the import preview, no AI needed)
- [x] Deduplicate similar entries talking about the same subject with the same conclusion
- [x] Search entries by meaning or idea instead of keywords (semantic search)
- [x] Subjects discussed stats (analyzed by AI)
- [x] Personality analysis through the choice of words and subjects of all entries or a chosen subset of them
- [ ] AI chats social features, like sharing a chat to your feed for your followers to see and interact with (a chat that starts from a public thought)
- [x] Possibility to provide your own API key (OpenRouter) to use AI features with your own token, and a usage dashboard to monitor your token consumption and costs
- [x] Graph of insights and correlations from all entries, to discover patterns and connections between them, do the same for tags
- [x] Transcription from an Audio note
- [ ] Ability to read PDF and ePub files, annotate them, then export these annotations as thoughts in a specific general or specific Journal
- [x] Use different models for different tasks, to optimize token consumption parameterized in the AI settings
- [x] "Get Inspired": one deep reflective question based on the user's most used and most recent tags (only tag names and counts are sent to the AI), replacing the earlier list of history-based writing prompts
- [x] Summaries of long entries, with the option to include or exclude certain details
- [x] AI-generated tags that are more abstract or thematic, to complement the user-defined tags (merged into the single Auto Tag action)
- [x] Auto-theme and re-tag the whole journal: scan all entries, generate a list of discussed themes, group them into the smallest set of tags that still accurately tags each entry, then tag or re-tag entries with the appropriate ones

## Book Converter

- [x] Based on tags to create chapters (with chapter ordering, tag filtering, date range, and untagged chapter options)
- [x] Connect the entries to form a chapter (AI weaves the thoughts into flowing prose with transitions, staying strictly on script; a plain chronological mode is available without AI, and the plain list lives in the normal export)
- [x] Do the same for the rest of tags (multi-tag entries can appear in every tag chapter or only the first)
- [x] PDF and ePub format export (plus HTML and Markdown outputs, title page, table of contents with chapter page numbers, centered page footers, and an outline preview; normal export also gained PDF, EPUB, and HTML formats grouped by month)
- [x] Versioning of the book, with the possibility to update it with new entries and chapters
- [x] Custom cover page (image upload and color themes)
- [x] AI-generated chapter introductions and summaries
- [x] Yearbook mode: one chapter per year or month instead of per tag
- [x] Upload the generated book directly to a connected cloud provider
- [x] Embed entry attachments (images) in the generated book
- [x] Fix the UI alignment and styling of the book converter page, and add a progress bar for the generation process
- [x] Modes of AI weaving: strict (only use the content of the entries) vs creative (use the content as a base but add more details and transitions for a more engaging read)

## Social Features

- [x] Feed that shows public entries from other users with infinite scroll and to preview your own public entries
- [ ] Feed text-to-speech: read a single entry aloud or continue reading from that entry onward, matching the Journal's reading controls
- [x] Allow users to follow other users
- [x] Comments on public entries
- [x] Likes for entries and comments
- [ ] Chatting and messaging between users, with one-to-one and group conversations
- [ ] Discuss button offers two choices: "With AI" for the existing entry AI chat, and "With Someone" using the planned user chat feature (depends on chat implementation)
- [ ] Notifications for messages, comments, likes, new followers
- [x] Leaderboard for most active users, most liked entries, most commented entries
- [x] Badges for achievements and karma points
- [x] Feature requests and voting system for new features
- [ ] Report a public thought (for example a call for violence): the author is first asked to make it private, then temporarily banned if they don't comply, then permanently banned after repeated offenses. Entries already carry a moderation status (visible, hidden, under review, removed) that the feed respects, but nothing lets users report an entry or changes that status yet
- [ ] Show thoughts to a selected few users instead of whole public

## Security

- [x] SSL and HTTPS support for secure communication
- [x] Complete the email verification flow (User entity has emailVerified field but no verification endpoint or email is implemented)
- [x] Add 2FA authentication
- [x] Allow users to see and manage active sessions (logout from other sessions)
- [x] Spam and bots protection on sign up and login forms
- [x] Rate limiting and prevent DDOS from too much data sent
- [x] Content Security Policy hardening (replace unsafe-inline with nonces)
- [x] Entries can only be created in or imported into diaries the writer owns (any other diary answers 404)
- [x] Google sign-in verifies the Google ID token on the server (signature, issuer, audience, expiry, verified email) instead of trusting the email sent by the browser
- [x] Refresh tokens stored only as hashes, rotated on every refresh, and kept in an httpOnly cookie; the access token stays in memory instead of `localStorage`
- [x] Login answers deleted and password-less accounts like a wrong password; production refuses missing or example signing secrets
- [x] Attachment files served only to their owner, with safe content types and SVG and text as sandboxed downloads
- [x] Settings API returns and accepts only user preferences, never cloud tokens or sync state; the data download leaves tokens out
- [x] Rate limits keyed on the real client IP behind the ingress (`TRUST_PROXY`)
- [x] Strict Content Security Policy and HSTS on the web app
- [x] Deleted accounts erased with all their data and files after 30 days
- [x] Every AI prompt treats journal text as untrusted data
- [ ] Remove the body refresh-token upgrade path once tokens issued before the cookie change have expired (7 days after the release that added it)
- [ ] Registration still reveals whether an email or username is taken; move to a verify-first sign-up to close it
- [ ] Production alerts: add the `thoughty-alerts` rules to the platform's Prometheus, which has no Prometheus Operator to load the PrometheusRule component

## Tests

- [x] Playwright end-to-end tests for critical user flows (sign up, login, create/edit/delete entry, view stats), with documentation on how tests are structured and how to add new ones
- [x] Code coverage kept above 80% with tests added for uncovered critical paths
- [x] Load testing and performance benchmarking for API endpoints and database queries
- [x] Crash testing and chaos engineering to identify weaknesses and improve resilience

## Technical Improvements

- [x] Full TypeScript migration of the frontend and the backend (NestJS with TypeORM)
- [x] React 19 migration using modern features (hooks, context API)
- [x] Debloat of big files and components (500+ LOC split into smaller, maintainable modules)
- [x] DevContainer with Docker for the development environment
- [x] Health check endpoint for Kubernetes probes
- [x] Swagger/OpenAPI documentation for the API
- [x] Mask commands to run and test the app easily, including nuking the DB and reseeding test data
- [x] Development seed covering every feature: daily entries since 2016 across five diaries, cross-references, revisions, duplicates to find, moderated and deleted community users for the feed, sessions, feature requests, and attachments
- [x] Documentation restructured into a docs directory (architecture, development setup, deployment, testing, features)
- [x] Caching of frequent requests (public entries, feed)
- [x] Distributed rate limiting with Redis for multi-replica deployments
- [x] Calibrate existing rate limiting on API endpoints to prevent abuse without being too restrictive
- [x] Backup and disaster recovery plan for user data
- [x] Improve error handling and user feedback for better UX
- [x] App-wide cleanup pass: removed dead components, barrel files, unused dependencies, unused translation keys and CSS, and fixed layout, theme, i18n, and loading-flicker bugs found in a full UI tour
- [ ] Use WebSockets for real-time updates on public entries and messages
- [x] Implement lazy loading for components and routes to improve initial load time
- [ ] Feature flags to enable/disable features without redeploying, using a third-party service. The server already serves flags (`ai`, `bookConverter`, `cloudSync`, `publicSharing`) at `GET /api/config/feature-flags`, from an external provider or defaults, but neither the web app nor any server module reads them yet, so no feature can be switched off
- [x] Check that OpenAPI documentation is up to date and complete for all endpoints, and add examples for request and response bodies
- [x] Ensure that all API endpoints are effectively used in the UI (either the app or the admin console). Implement the frontend that would use them if necessary, or remove the endpoints.

## Monitoring and Observability

- [x] Add logging for critical actions and errors for better debugging and structured JSON logging for observability and request tracing
- [x] Set up monitoring and alerting for server health and performance
- [x] Usage and stats of the app and features (telemetry to understand which features are used the most and how users interact with the app, to prioritize future development and improvements)

## Deployment and CI/CD

- [x] Dockerfiles for client and server, Kubernetes deployment manifests, and deployment config files
- [x] Create GitLab CI pipeline for automated testing, building, and deployment to environments (staging, production)
- [x] Configure jobs in CI pipeline to run tests on every pull request and before merging to main branch
- [x] Configure job in CI pipeline to run Playwright tests on a schedule (e.g. daily) to catch any regressions
- [x] Modify deployment configuration to use the existing server infrastructure, and document the prerequisites and deployment process
- [x] CI pipeline for automated dependency vulnerability scanning (npm audit, Dependabot/Renovate)
- [x] Blue-green or canary deployment strategy for zero-downtime releases
- [x] Probes that tolerate a loaded node: every probe waited Kubernetes' 1-second default, so on swirl-cloud's loaded node (2026-10-23: load 114, swap full) working containers were restarted. Liveness probes now wait 5 seconds and fail for a minute before a restart, readiness probes wait 3 seconds, and the standalone PostgreSQL probe no longer passes an unexpanded `$(POSTGRES_USER)` (a probe command expands only literal `env` values)

## Database

- [x] Migrate journal storage from a flat text file to a relational database accessed through an ORM
- [x] Optimize hot database queries across services
- [x] Optimize database for better performance (ongoing)
- [x] Convert the current idempotent SQL migration script into versioned migration files when the schema-change workflow needs stricter ordering/history
- [x] Database connection pooling configuration in TypeORM data source
- [x] Database read replicas for scaling read-heavy queries (stats, feed, search)
- [x] Automated database backups with point-in-time recovery

## Accessibility

- [x] Full accessibility audit and remediation (aria-labels, screen reader support, skip-to-content links, focus management)
- [x] High contrast mode and adjustable font sizes
- [x] Keyboard-only navigation support for all interactive elements
- [ ] Add other languages support (i18n) for the UI (Spanish, Italian, German, etc. — English and French are already implemented)

## Future Apps

- [ ] Mobile app version for iOS and Android with offline mode for journaling without internet connection and sync once connected
- [ ] Desktop app with offline mode for journaling without internet connection and sync once connected

## Life ERP

- [ ] Life metrics tracker for happiness, mood, health, sleep, energy, social time, productivity, habits, and custom numeric/text metrics
- [ ] Finance tracker for expenses, income, budgets, savings goals, recurring bills, and subscription inventory with renewal reminders
- [ ] Health and wellness journal extensions for symptoms, medication, appointments, exercise, nutrition, and weight or body metrics
- [ ] Social relationship tracker for people, last contact dates, notes, important dates, follow-up reminders, and relationship health trends
- [ ] Productivity and task tracker for goals, projects, recurring routines, focus sessions, and weekly reviews linked back to journal entries
- [ ] Dashboard that correlates journal activity, mood, tags, life metrics, finances, health, socials, and productivity over time
- [ ] AI insights that surface patterns, correlations, risks, and suggestions across journals and life metrics while respecting privacy controls
- [ ] Import paths for existing spreadsheets and folder exports, including CSV templates for finances, subscriptions, health logs, and mood tracking
- [ ] Fine-grained permissions and visibility so Life ERP data can stay private even if selected thoughts become public

## Product Direction (added 2026-10-04)

Thoughty already covers a broad private journal: writing, diaries, tags, AI help, insights, a book converter, sync and a small public feed. On features alone it competes with every mass-market journaling app. The niche to own is **the private journal that becomes your life story**: writing stays private by construction, AI only ever sees what the writer approves, and the journal turns into printed books, guided memoirs and a legacy for family. Coaches and therapists get a separate tier to guide their clients' journaling without seeing more than each client shares.

Customers: people who journal seriously or want a memoir (premium subscription and printed books), families who give a "tell your story" memoir to a parent or grandparent (gift purchases), and coaches and therapists (per-practitioner plan).

Differentiators, each covered below:

1. Zero-knowledge diaries: entries and attachments encrypted on the device; AI runs locally or only on text sent with explicit consent.
2. From journal to printed book: the book converter ends with a hardcover delivered home.
3. Guided memoir: weekly questions, answers become chapters, relatives can contribute.
4. Legacy: chosen diaries pass to chosen people after a verified event.
5. A practitioner tier hosted to health-data standards.

### Privacy and Trust

- [ ] **ADR — end-to-end encryption:** optional zero-knowledge diaries with keys derived on the device (passphrase plus recovery key); entries, revisions, attachments and books encrypted client-side. Decide how search, stats, feed, sync, books and AI work on an encrypted diary (on-device index, local model, explicit per-request decryption) and which features stay unavailable. Users choose per diary.
- [ ] Recovery for encrypted diaries: a recovery key and optional trusted-contact recovery; state clearly before enabling that losing both loses the diary.
- [ ] AI privacy mode per diary: off, local model only (LLM processing on the device or the user's own machine), or cloud model with per-request consent, showing exactly what text leaves the device before it is sent.
- [ ] Transparency page: what is stored, where (EU), which processors receive data (AI, payments, email, printing), retention, and a yearly report of authority data requests.
- [ ] External penetration test before launching paid plans, and a published vulnerability disclosure policy with `security.txt`.

### Books and Memoir

- [ ] Printed books: send the generated book to a print-on-demand partner (hardcover or softcover, sizes), with print-ready interior and cover (bleed, margins, embedded fonts, image resolution checks), a price quote, checkout and order tracking.
- [x] Guided memoir program: a series of questions (childhood, family, work, places, lessons) delivered weekly by email or notification; answers by text or voice (using transcription) become entries in a memoir diary, with progress toward a finished book.
- [ ] Gift purchases: buy a memoir program or a printed book for someone else, with a gift message and invitation; the giver sees only what the writer chooses to share.
- [ ] Family contributions: invited relatives add memories and photos to a memoir diary, published only after the owner approves each one.
- [ ] Memoir interview mode: AI follow-up questions that deepen an answer, grounded strictly in what the writer said (same rules as book weaving).
- [x] Year in review: a yearly recap (entries, words, top tags, mood arc, highlights) kept private or shared, and printable as a booklet.

### Legacy

- [ ] Legacy contacts: the user names people and the diaries or books each may receive. After a configurable inactivity period, repeated check-ins to the user, and verification by the contacts, the selected content is released; any sign of life cancels the process. Document how deceased users' data is handled.

### Practitioner Tier

- [ ] **ADR — practitioner accounts:** practices with practitioners and linked clients. A client shares chosen entries or diaries and can revoke at any time; practitioners never see anything else.
- [ ] Journaling programs: practitioners assign prompts and templates on a schedule; clients receive reminders; completion is visible to the practitioner.
- [ ] Session preparation: with the client's consent, an AI summary of entries shared since the last session and the mood trend; practitioner notes stay separate and private to the practitioner.
- [ ] Health-data hosting: journaling shared for therapy follow-up is health data, and hosting it on behalf of practitioners in France requires HDS-certified hosting. Settle hosting and processors before launching the tier; such data never trains models and goes only to approved processors.
- [ ] Practitioner billing per seat, with client accounts included.

### Commercial Foundation

- [ ] Payments: choose a payment provider with EU VAT handling for digital services (one-stop shop) or a merchant of record, plus app-store billing once mobile apps ship. Then connect the Profile subscription page to it: the page exists, but today the plan is a plain setting picked from a dropdown, the billing history is generated from the current date, and the payment method defaults to a sample "Card ending 4242"; it needs real plan changes, invoices, payment method updates and cancellation.
- [ ] Plans and entitlements enforced server-side: free (core journal, AI with the user's own key), premium (encryption, AI quota, books, unlimited diaries), memoir and gift, practitioner, with a free trial of premium. AI features without the user's own key are premium only. The admin console reads and changes them.
- [x] Importers from other journaling apps (Day One and Journey exports), and a full export as a Markdown folder with attachments.
- [ ] Opt-in lifecycle emails (welcome, trial ending, writing streaks, year in review) that respect notification preferences.
- [ ] Help center and support tickets with response targets per plan; a status page for paid users.

## Market and Growth (added 2026-10-23)

The market splits three ways, and no product spans all of them. Everyday journals (Day One, Journey, Diarium) are strong on capture, sync and media but stop at a bookshelf of entries. AI journals (Rosebud, Reflection, Mindsera, Life Note) sell coaching and insight, send everything to a cloud model, and rarely end in anything tangible. Life-story services (Storyworth, Remento, Storii) are bought as gifts around $99 a year for weekly questions and one hardcover, but they are a one-year project with no journal before or after it. Thoughty already holds all three in one record (journal, guided memoir, book converter), so the job now is to sell that combination clearly, close the capture gaps that make people stay with Day One, and make the memoir usable by the older people it is often bought for.

### Positioning and Go-to-Market

- [ ] One-line positioning used on the landing page, store listings and emails ("a private journal that becomes your life story"), with the landing page reorganized around the three entry points: journal, memoir, and gift. The landing page uses it since 2026-10-26, organized around journal, memoir, and book; store listings, emails, and a gift entry point (once the gift flow exists) remain.
- [ ] Comparison pages against Day One, Storyworth and Rosebud that are factual and kept current (privacy, AI handling, export, printed book, price), each ending in the matching importer or the memoir start page.
- [ ] Pricing anchored to the market: premium journal near Day One Premium's yearly price, and a memoir gift that includes a year of questions and one printed book near Storyworth and Remento, so the gift is an easy like-for-like choice with a lifelong journal on top.
- [ ] Launch market decision: start with France and the EU (French and English already done, EU hosting and GDPR as a selling point, HDS matters there for the practitioner tier), then pick the next language by demand rather than adding several at once.
- [ ] Decide the role of the public feed. Followers, likes, a leaderboard and karma pull against the "private by construction" message; options are to keep it opt-in and hidden for new accounts, or to reposition sharing toward family and chosen people (see "Show thoughts to a selected few users"). Record the decision in an ADR.
- [ ] Seasonal gift campaigns (Mother's Day, Father's Day, Christmas) with a scheduled delivery date for the gift invitation, since memoir gifts sell around those dates.
- [ ] Referral and gift-back loop: a memoir writer who finishes a book can offer a discounted program to someone else; a journal user gets a free month for each paying referral.
- [ ] Public, indexable pages for the memoir questions and the built-in templates (for example "52 questions to ask your parents"), linking into sign-up, to grow organic traffic beyond the blog.

### Activation and Retention

- [ ] First-run onboarding that asks what the writer is here for (daily journal, life story, a gift, coming from another app) and lands them in the right place: a first template, the memoir start page, the gift flow, or the Day One or Journey importer.
- [ ] Define and track a north-star metric (weekly writing days per active writer) plus the funnel from sign-up to first entry, to fifth entry, to week four, using the existing telemetry, with privacy-safe counts only and no entry text.
- [ ] Recurring journaling reminders and writing prompts at a user-configured time: installable PWA with web push and an optional email nudge on the web today, then app notifications once the native apps ship.
- [ ] Gentle streaks and a "pick up where you left off" prompt after a gap, without guilt-driven copy; streaks already exist as badges and can feed this.
- [ ] Monthly private recap email (opt-in): entries written, a memory from that month in past years, and a link back, as the low-cost sibling of the year in review.

### Capture

- [ ] PWA with offline drafts and a share target (share text, links and photos from the phone into a new entry), as the fast path to mobile before native apps.
- [ ] Write by email: a private address per user (or reply to a memoir question email) that turns the message and its attachments into an entry; this is how many older memoir writers will answer.
- [ ] Optional location and weather on entries, with a map view of where entries were written; off by default and stripped from exports and books unless chosen. Day One and Journey users expect it and their imports already carry it.
- [ ] Shared diaries with co-writers (a couple's or family diary), each entry keeping its author, separate from public visibility and from the memoir family contributions.

### Memoir for Older Writers

- [ ] Phone answering: the writer calls a number or receives a scheduled call, hears the question and records the answer, which becomes a transcribed entry with the recording attached. Voice-first is the main reason families choose Remento and Storyworth's call-in option.
- [ ] Simple memoir mode: a large-text, single-question screen with one record button and no journal chrome, usable by someone who will never open the rest of the app.
- [ ] Custom questions from the gift giver or family, mixed into the weekly schedule, and a larger question bank by theme (migration, careers, faith, war and history, parenthood).
- [ ] Photo prompts: upload an old photo and answer "what is happening here?", with the photo placed next to the answer in the book.
- [ ] Voice in the printed book: a QR code beside each spoken answer that plays the original recording from a private, long-lived link, tied to the legacy settings.

### AI That Fits the Privacy Promise

- [ ] Whole-journal semantic index (embeddings stored per user, for example with pgvector) so meaning search, duplicates and insights cover every entry instead of the newest 100 or 40, and so "ask your journal" questions can cite the entries they draw on.
- [ ] Safety guidance: when entries or chats contain signs of crisis or self-harm, show local support resources and never let the AI act as a therapist; required before the practitioner tier and expected of any AI journal.
- [ ] Clear AI cost model per plan: measure cost per active user per feature from the usage data already collected, and use it to set quotas and to choose the default per-task models.

### Books

- [ ] Book design themes (typography, margins, chapter openers, photo layouts) previewed before printing, so the printed book feels designed rather than exported.
- [ ] Order more copies of any saved book version for family, with one shipping address per copy.

## Feature Roadmap (added 2026-10-23)

Concrete product features that build on what exists. Each one fills a gap visible in the current code or in what writers coming from Day One and Journey expect.

### Writing

- [x] Recycle bin: deleted entries (one at a time, in bulk, or with "delete all entries") are kept for 30 days, hidden everywhere else, and can be restored to their diary or deleted forever from the bin, which then removes their files too. Diaries still move their entries to the default diary when deleted, and attachments are kept and restored with their entry rather than on their own.
- [x] Optional entry title and time of day. Entries and their revisions have an optional one-line title and time of day, set in the composer and editor (with a **Now** shortcut). Titles are searched with the weight of tags and highlighted, and show in the journal, feed, highlights, recycle bin, share text, every export (TXT title on the header line or the first line, a saved setting), imports including Day One and Journey, the Markdown folder front matter, and book headings. A day lists untimed entries first in their manual order, then timed entries by time. Times never renumber entries, so `[[date#n]]` links stay put, and drag reordering moves only the untimed entries among their own numbers.
- [x] Mood check-in on each entry: an optional five-point mood (Very low to Very good, labelled, with the emoji as decoration) and up to ten feeling words, curated in English and French or typed, set in the composer and editor, kept in revisions, and shown on entry cards. The journal filters by mood level, any mood, or none. Moods go through JSON, Markdown, the Markdown folder front matter, CSV, and TXT (`--{mood:4}--{feelings:…}`, written only when set, so older files round-trip), and Journey's mood is imported (Day One exports carry none). Stats show the mood over time, by weekday, and the most frequent feelings, per diary, without AI. The year in review draws its mood arc from recorded moods without AI when there are any, labelled as such, and keeps the AI reading for other years. Moods never reach the public feed or share text. Later: the Life ERP metrics.
- [ ] Server-side draft autosave, so a draft started on one device continues on another, with a warning before leaving unsaved text.
- [x] Focus mode: a full-screen, distraction-free view for the composer and the entry editor (button next to **MD**, or `Ctrl+Shift+F`), with typewriter scrolling that keeps the caret's line near the middle, a live word count, and an optional session word goal with a quiet progress bar that counts only the words written in the session. Esc, **Done**, or the shortcut leave it without losing the draft. It uses the writer's font settings, follows the themes, high contrast, and reduced motion, keeps focus inside like the other dialogs, and is in English and French.
- [ ] Writing goals per diary (entries per week or words per day), shown on the activity heatmap and in stats.
- [ ] Time capsules: an entry sealed until a chosen date, then delivered by email and shown in Highlights. The "letter to my future self" template exists, but nothing delivers the letter yet.
- [ ] Inline images: place an attachment inside the Markdown text instead of only below the entry, carried through to exports and books.
- [ ] Video attachments with a size limit and a poster frame. The Day One and Journey importers currently leave videos out.
- [x] Markdown task lists: `- [ ]` and `- [x]` items in Markdown entries render as labelled checkboxes that can be ticked from the journal view, by mouse or keyboard. Each tick is saved through `PATCH /api/entries/:id/tasks`, which changes only that line under a row lock and keeps one revision for a run of ticks within ten minutes. Read-only views (feed, highlights) show static boxes, books and document exports keep the text form, and the formatting toolbar and a new inline Markdown help offer task lists in English and French. Plain-text entries are unaffected.
- [ ] Live dictation in the composer. Transcription currently works only on attached audio files.

### Search and Revisit

- [x] Full-text search: the `ILIKE` match is replaced by PostgreSQL full-text search over content and tags (a generated `tsvector` indexed in English and French with accents ignored, and a per-writer GIN index), with "exact phrases", `-` exclusions, `OR`, prefix matching on the last word, best-match ranking with a date-order switch, server-side highlights of stemmed words and phrases, and operator help in English and French, so search stays fast on journals that span decades.
- [ ] Saved searches: save any combination of filters (for example favorites tagged "family" in 2019) as a named view in the journal.
- [ ] Calendar view: a month grid with the entries of each day, next to the list view.
- [ ] Life eras: named date ranges ("University", "The Paris years") usable as filters, as book chapters, and as context for memoir answers.
- [ ] People: mention someone with `@name` in an entry, then see every entry about that person. This is a light first step toward the Life ERP relationship tracker.
- [ ] On This Day by email (opt-in), since Highlights only exists inside the app.

### Organization and Sharing

- [ ] Per-diary settings: a default template, a reminder schedule, and an optional PIN lock as a first step before full end-to-end encryption.
- [ ] Private share links for a single entry or a book version: a link with an expiry date that can be revoked, so one person can read an entry without making it public in the feed.
- [ ] Share an entry as an image card (quote, date and theme colors) for people who post outside the app.

### Books

- [ ] Book from hand-picked entries or a saved search, not only from tags or years.
- [ ] Book preview in the browser, page by page, before downloading or printing.

### AI

- [ ] Weekly reflection (opt-in): a private summary of the past week's entries with recurring themes and one question for the week ahead, using the same consent rules as the other AI features.
- [ ] Chat across entries: discuss a set of entries (a tag, an era, a date range) instead of a single one, with citations back to each source entry.

### Integrations

- [ ] Calendar import (ICS or Google Calendar) to show the day's events next to an entry and to suggest what to write about.
- [ ] Personal access tokens with scopes for a small public API, so power users can create entries from iOS Shortcuts, Zapier or scripts.
