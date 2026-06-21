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
- [x] Delete all entries at once to start a fresh journal
- [x] Entry templates (e.g. gratitude journal, daily reflection, meeting notes) that users can create and pick when writing a new entry
- [x] Word count and estimated reading time displayed per entry, with averages added to stats
- [x] Pinned entries that always show at the top of the list regardless of date sorting limited to a configurable number of pinned entries
- [x] Backlinks panel showing which entries reference the current one (bidirectional linking like Obsidian/Roam)
- [x] Keyboard shortcuts for common actions (Ctrl+N new entry, Ctrl+/ focus search, Esc close modals, arrow keys for pagination)
- [x] Profile and identity verification of accounts with public entries (e.g. verified badge for confirmed email, or even KYC for public figures)

## Tags & Diaries

- [x] Tag pick list when writing and when filtering, with the ability to add new tags on the fly
- [x] Enhanced tags management with custom tag colors and optional categories with category-aware sorting (a random color is assigned to newly created and imported tags)
- [x] Whole-journal tag rename that updates every entry instead of creating parallel old/new variants
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
- [x] Configurable AI API key (OpenRouter) to use AI features with your own token
- [x] Delete account
- [x] Stay on the profile page after saving settings, with a success toast
- [x] Routes and paths for each view (Journal, Stats, Profile, Tags, etc.)

## Stats

- [x] Counts of entries per year and per month/year with graphs
- [x] Tag stats per periods of time with graphs
- [x] Journaling activity heatmap (GitHub-style contribution grid) in the stats page
- [x] Tone and mood analysis of entries (AI)
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
- [x] Download of all user data (GDPR)
- [x] CSV export for entries and stats data

## Website

- [x] Intro page showcasing the app features with links to login / sign up
- [x] Footer with Privacy, Terms, and Contact entry points, responsive layout, and a back-to-top control
- [x] More detailed landing page with features presentation, screenshots, and sign up call to action
- [x] Subscription management page for users to manage their subscription, see billing history, and update payment method in Profile page
- [ ] Subscription-based access to premium features, with a free trial period and a freemium tier with limited features to attract new users
- [x] About page with the story behind Thoughty, the mission, and the team
- [x] Terms of Service and Privacy Policy pages
- [x] Contact and support page with a form to submit inquiries and a How To guides / FAQ section
- [x] Feedback and feature request page for users to submit their ideas and upvote existing ones
- [x] Blog section for updates, tips, and journaling inspiration
- [x] Email validation flow for account security (password reset via email already works)
- [ ] Admin console for app settings and AI model management (define and change AI models for each AI task type, monitor usage, and manage user access to AI features, ban abusive users, etc.)

## AI

- [x] Suggest tags from the written text and auto-tag entries, with a configurable max number of tags per entry
- [x] Fix writing errors and style: rephrase an existing entry with selectable modes (grammar/form only, slight style enhancement, complete rewrite)
- [x] Pass a thought to AI for analysis or further discussion (entry chat)
- [x] AI chat history, with the option to export chats as text files
- [x] Tone and mood analysis of entries
- [x] Guess the file format automatically when importing a journal file (solved with heuristic detection in the import preview, no AI needed)
- [ ] Deduplicate similar entries talking about the same subject with the same conclusion
- [ ] Search entries by meaning or idea instead of keywords (semantic search)
- [ ] Subjects discussed stats (analyzed by AI)
- [ ] Personality analysis through the choice of words and subjects of all entries or a chosen subset of them
- [ ] AI features should be locked behind a paywall with a free trial (except if own API token is provided)
- [ ] AI chats social features, like sharing a chat to your feed for your followers to see and interact with (a chat that starts from a public thought)
- [ ] Possibility to provide your own API key to use AI features with your own token, and a usage dashboard to monitor your token consumption and costs
- [ ] Local LLM processing for privacy
- [ ] Graph of insights and correlations from all entries, to discover patterns and connections between them, do the same for tags
- [ ] Transcription from an Audio note
- [ ] Ability to read PDF and ePub files, annotate them, then export these annotations as thoughts in a specific general or specific Journal
- [x] Use different models for different tasks, to optimize token consumption
- [ ] AI-generated writing prompts based on the user's journaling history and interests, to inspire new entries and reflections
- [ ] Summaries of long entries, with the option to include or exclude certain details

- [ ] AI-generated tags that are more abstract or thematic, to complement the user-defined tags and provide different ways to organize and explore the journal
- [ ] Auto-theme and re-tag the whole journal: scan all entries, generate a list of discussed themes, group them into the smallest set of tags that still accurately tags each entry, then tag or re-tag entries with the appropriate ones

## Book Converter

- [x] Based on tags to create chapters (with chapter ordering, tag filtering, date range, and untagged chapter options)
- [x] Connect the entries to form a chapter (AI weaves the thoughts into flowing prose with transitions, staying strictly on script; a plain chronological mode is available without AI, and the plain list lives in the normal export)
- [x] Do the same for the rest of tags (multi-tag entries can appear in every tag chapter or only the first)
- [x] PDF and ePub format export (plus HTML and Markdown outputs, title page, table of contents with chapter page numbers, centered page footers, and an outline preview; normal export also gained PDF, EPUB, and HTML formats grouped by month)
- [ ] Versioning of the book, with the possibility to update it with new entries and chapters
- [ ] Custom cover page (image upload, color themes)
- [ ] AI-generated chapter introductions and summaries
- [x] Yearbook mode: one chapter per year or month instead of per tag
- [ ] Upload the generated book directly to a connected cloud provider
- [ ] Embed entry attachments (images) in the generated book
- [x] Fix the UI alignment and styling of the book converter page, and add a progress bar for the generation process
- [x] Modes of AI weaving: strict (only use the content of the entries) vs creative (use the content as a base but add more details and transitions for a more engaging read)

## Social Features

- [ ] Feed that shows public entries from other users with infinite scroll and to preview your own public entries
- [ ] Allow users to follow other users
- [ ] Comments on public entries
- [ ] Likes for entries and comments
- [ ] Chatting and messaging between users
- [ ] Notifications for messages, comments, likes, new followers
- [ ] Leaderboard for most active users, most liked entries, most commented entries
- [ ] Badges for achievements and karma points
- [ ] Feature requests and voting system for new features
- [ ] Add a way to report a public thought (call for violence) and ban the user if needed
- [ ] The user is first prompted to make the thought private, then temporarily banned if they don't comply, then permanently banned after repeated offenses
- [ ] Show thoughts to a selected few users instead of whole public

## Security

- [x] SSL and HTTPS support for secure communication
- [x] Complete the email verification flow (User entity has emailVerified field but no verification endpoint or email is implemented)
- [ ] Add 2FA authentication
- [ ] Allow users to see and manage active sessions (logout from other sessions)
- [ ] Spam and bots protection on sign up and login forms
- [ ] Rate limiting and prevent DDOS from too much data sent
- [x] Content Security Policy hardening (replace unsafe-inline with nonces)

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
- [x] Documentation restructured into a docs directory (architecture, development setup, deployment, testing, features)
- [ ] Caching of frequent requests (public entries, feed)
- [ ] Distributed rate limiting with Redis for multi-replica deployments
- [x] Calibrate existing rate limiting on API endpoints to prevent abuse without being too restrictive
- [x] Backup and disaster recovery plan for user data
- [ ] Improve error handling and user feedback for better UX
- [ ] Use WebSockets for real-time updates on public entries and messages
- [x] Implement lazy loading for components and routes to improve initial load time
- [ ] Implement feature flags to enable/disable features without redeploying, using a third-party service
- [ ] Check that OpenAPI documentation is up to date and complete for all endpoints, and add examples for request and response bodies

## Monitoring and Observability

- [x] Add logging for critical actions and errors for better debugging and structured JSON logging for observability and request tracing
- [x] Set up monitoring and alerting for server health and performance
- [x] Usage and stats of the app and features (telemetry to understand which features are used the most and how users interact with the app, to prioritize future development and improvements)

## Deployment and CI/CD

- [x] Dockerfiles for client and server, Kubernetes deployment manifests, and deployment config files
- [x] Create Jenkins pipeline for automated testing, building, and deployment to environments (staging, production)
- [x] Configure jobs in CI pipeline to run tests on every pull request and before merging to main branch
- [x] Configure job in CI pipeline to run Playwright tests on a schedule (e.g. daily) to catch any regressions
- [ ] Modify deployments configuration to use existing DS-Cluster infrastructure, and document the prerequisites and deployment process in docs
- [x] CI pipeline for automated dependency vulnerability scanning (npm audit, Dependabot/Renovate)
- [ ] Blue-green or canary deployment strategy for zero-downtime releases

## Database

- [x] Migrate journal storage from a flat text file to a relational database accessed through an ORM
- [x] Optimize hot database queries across services
- [ ] Optimize database for better performance (ongoing)
- [ ] Convert the current idempotent SQL migration script into versioned migration files when the schema-change workflow needs stricter ordering/history
- [x] Database connection pooling configuration in TypeORM data source
- [ ] Database read replicas for scaling read-heavy queries (stats, feed, search)
- [ ] Automated database backups with point-in-time recovery

## Accessibility

- [ ] Full accessibility audit and remediation (aria-labels, screen reader support, skip-to-content links, focus management)
- [x] High contrast mode and adjustable font sizes
- [x] Keyboard-only navigation support for all interactive elements
- [ ] Add other languages support (i18n) for the UI (Spanish, Italian, German, etc. — English and French are already implemented)

## Future Apps

- [ ] Mobile app version for iOS and Android with offline mode for journaling without internet connection and sync once connected
- [ ] Desktop app with offline mode for journaling without internet connection and sync once connected
- [ ] Recurring journaling reminders and writing prompts via app notifications at a user-configured time

## Life ERP

- [ ] This project could evolve into a Personal ERP
- [ ] Personal document vault to replace scattered OneDrive folders, with private files, folder/tag organization, OCR/search, attachment reuse, and exportable archives
- [ ] Life metrics tracker for happiness, mood, health, sleep, energy, social time, productivity, habits, and custom numeric/text metrics
- [ ] Finance tracker for expenses, income, budgets, savings goals, recurring bills, and subscription inventory with renewal reminders
- [ ] Health and wellness journal extensions for symptoms, medication, appointments, exercise, nutrition, and weight or body metrics
- [ ] Social relationship tracker for people, last contact dates, notes, important dates, follow-up reminders, and relationship health trends
- [ ] Productivity and task tracker for goals, projects, recurring routines, focus sessions, and weekly reviews linked back to journal entries
- [ ] Dashboard that correlates journal activity, mood, tags, life metrics, finances, health, socials, and productivity over time
- [ ] AI insights that surface patterns, correlations, risks, and suggestions across journals and life metrics while respecting privacy controls
- [ ] Import paths for existing spreadsheets and folder exports, including CSV templates for finances, subscriptions, health logs, and mood tracking
- [ ] Fine-grained permissions and visibility so Life ERP data can stay private even if selected thoughts become public
- [x] Needs to detail the features once the main subject (journaling) is complete
