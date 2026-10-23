# Feature Backlog

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

- [ ] One-line positioning used on the landing page, store listings and emails ("a private journal that becomes your life story"), with the landing page reorganized around the three entry points: journal, memoir, and gift.
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
