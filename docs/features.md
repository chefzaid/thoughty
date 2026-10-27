# Features

Thoughty is a privacy-focused journal built around dated entries. Writing, tags, diaries, search, stats, AI help, books, and sync all work on the same entry record. The implemented and planned backlog is in [TODO.md](../TODO.md).

```mermaid
flowchart LR
	Capture[Write, import, or answer memoir questions] --> Organize[Diaries, tags, moods, visibility]
	Organize --> Revisit[Search, filters, highlights, history]
	Revisit --> Understand[Stats, insights, year in review]
	Organize --> Share[Export, books, cloud sync, public feed]
	Capture --> Assist[AI tagging, rephrasing, inspiration, chat]
```

## Writing and Entries

- **Composer.** Write in plain text or Markdown, with a formatting toolbar, inline help, and live preview. The box grows with the text and can be resized. The date defaults to today and can be changed to backdate an entry.
- **Optional details.** Each entry can have a one-line title (up to 200 characters), a time of day, a mood from 1 (very low) to 5 (very good), and up to ten feeling words, picked from a curated list or typed.
- **Templates.** Thirteen built-in templates (gratitude, daily reflection, weekly review, decision notes, worry check, dream log, and others), plus your own templates saved from a draft: **Save template** asks for a name in a small dialog (a blank name is refused) and keeps the draft's text, tags, visibility and format. If the template cannot be saved, the dialog stays open with the name and says so, so you can try again.
- **Focus mode.** A full-screen, distraction-free editor (`Ctrl+Shift+F`) with typewriter scrolling, a live word count, and an optional word goal for the session.
- **Task lists.** In Markdown entries, `- [ ]` and `- [x]` items show as checkboxes you can tick from the journal without opening the editor.
- **Several entries per day.** Entries are numbered within their day. Untimed entries come first in the order you set by dragging, then timed entries by time. Adding or changing a time never renumbers an entry, so links stay valid.
- **Cross-references.** `[[2024-01-15]]` or `[[2024-01-15#2]]` links to another entry. Each entry lists the entries that link to it (backlinks).
- **Entry actions.** Edit, favorite, pin, change visibility, listen, chat, rephrase, summarize, view history, archive, share, and delete. Sharing uses the browser share sheet or copies a permalink. Opening a permalink (`/journal?entry=<id>`) clears the journal filters and opens the page that holds the entry at your page size, or shows a notice when the entry no longer exists.
- **Entry states.** Public or private visibility, favorites, archive, and pinned entries kept at the top (up to a limit you set).
- **Revision history.** Every edit keeps the previous version, which you can view or delete.
- **Attachments.** Images, audio, PDFs, and text files up to 5 MB each, stored in S3-compatible storage and previewed inline. A file of another type or over the limit is not attached, and the form says which file and why next to the attach button. Audio notes can be transcribed with AI.
- **Bulk mode.** Select many entries to delete, archive, change visibility, add tags, move to another diary, or rephrase with AI. A bulk rephrase that leaves some entries unchanged or fails on some ends with a notice that counts each. A failed save, delete, or bulk action shows a notice in the profile language.
- **Recycle bin.** Deleted entries stay in the recycle bin for 30 days, hidden from everything else. Restore them to their diary with their revisions and files, or delete them forever. After 30 days they are removed for good.
- **Reading aids.** Word count and reading time on each entry, and text-to-speech with a choice of voice.
- **Navigation.** Pagination with a configurable page size, a year and month jump control, and keyboard shortcuts:
  - `Ctrl+N` new entry
  - `Ctrl+/` focus search
  - `Ctrl+Shift+F` focus mode
  - `Esc` close dialogs
  - Left and right arrows change page

## Diaries

- Separate diaries for different writing streams, each with a name, emoji, color, and default visibility.
- An **All Diaries** view, and a default diary for quick capture.
- The selected diary scopes the journal, stats, AI features, import and export, and books.
- Deleting a diary asks first in a dialog that names it, then moves its entries to the default diary. Confirmation dialogs (diaries, tags, entries, comments, the recycle bin, stopping the memoir) take focus on Cancel, keep the keyboard inside, close with `Esc`, and return focus to the button that opened them. The default diary cannot be deleted.

## Tags, Search, and Filters

- **Tags** are the one way to organize entries, for both concrete subjects and broad themes. They autocomplete when writing and filtering, and new ones can be typed inline. An entry needs at least one tag unless automatic tagging is on.
- **Tags page.** Create, rename (across the whole journal), recolor, categorize, and delete tags, with an entry count for each. AI can also propose a compact tag set for the whole journal, which you review before it is applied (see [AI Assistance](#ai-assistance)).
- **Filters.** Search, tags, date, visibility, archive state, favorites, and mood all combine with each other and with the diary scope. The date picker only offers dates that have entries.
- **Keyword search.** Full-text search over titles, text, and tags in English and French. It matches other forms of a word, ignores accents, and supports `"exact phrases"`, `-exclusions`, and `OR`. Results come best match first (or newest first) with the matches highlighted. Search stays fast on very large journals (see [Search Performance](./data-model.md#search-performance-on-a-large-journal)).
- **Meaning search.** Find entries by idea instead of keywords, using AI.
- **Saved searches.** Save any combination of search, filters, and diary under a name (for example favorites tagged "family" in the Personal diary), then show it again in one click from **Saved searches** in the filter bar. Searches can be renamed or deleted (after a confirmation), up to 50 per account. The journal address names the search on screen (`/journal?diary=2&view=4`), so it can be bookmarked or opened on another device, and drops it as soon as a filter changes; a link to a search that was deleted says so. A saved meaning search runs again when it is shown. Saved searches are included in the data download.
- **Calendar view.** A **List / Calendar** switch above the journal shows the entries as a month grid instead of the list. Weeks start on Monday, month and weekday names follow the app language, and today is marked. Each day names up to three entries (title, else the first words, with the time and a mood emoji when set) and counts the rest (`+2`); on a phone the days show dots instead. The grid follows the diary scope and every filter (search, meaning search, tags, visibility, archive state, favorites, mood); the date filter picks the month and marks its day. Move between months and years with the buttons, a year menu, or **Today**. With the keyboard, the grid is one tab stop: arrow keys move by day and week, Home and End go to the start or end of the week, Page Up and Page Down change the month (with Shift, the year). Clicking a day, or Enter on it, shows that day in the list (as the date filter, keeping the other filters); clicking an entry opens it in the list through its permalink. The journal address keeps the layout and month (`/journal?diary=2&layout=calendar&month=2026-10`), so a month can be bookmarked; Back returns from the list to the calendar. Entries in the recycle bin never appear.

## Highlights and Insights

- **Highlights.** A random entry to rediscover, and **On This Day** entries from past years.
- **Stats.** Totals and averages, entries per year and month, top tags overall and per year, and an activity heatmap whose days give their entry count and date in the interface language. Its weeks run from Monday. Everything follows the selected diary. Each bar chart is an image named by its title and described by its values ("2025: 2 entries; 2026: 3 entries"), and **Show as table** swaps it for a table of the same values. The heatmap is one keyboard stop (an ARIA grid): the arrows move by a day (up and down) or a week (left and right), Home and End go to the week's Monday and Sunday (with Ctrl, the map's first and last day), Page Up and Page Down by a month (with Shift, a year), and Enter, Space or a click opens the day in the journal; the active day is ringed and named under the map. Keeping the days out of the tab order keeps the year compact while the grid is the large target.
- **Writing goals.** Each diary can have one optional goal, set in **Manage Diaries** when creating or editing it: a number of entries per week (1 to 50, weeks from Monday to Sunday) or of words per day (10 to 10,000). The diary list names each goal ("Goal: 3 entries a week"). Stats for a diary show this week's or today's progress with a bar ("2 of 3 entries this week"), whether the goal is met, the current streak of weeks or days that met it (a week or day still in progress does not break it), and the best streak. The activity heatmap marks the days that met a daily goal with a ring and a dot, and the weeks that met a weekly goal with a check under their column; each day's name says so too ("2 entries on Jan 15, 2024, weekly goal met"), and the legend explains the mark. Days are the writer's own: the app sends its local date, and entries dated later are left out. With **All diaries**, Stats lists each diary's goal and progress side by side, or explains that goals are set per diary. Deleting a diary removes its goal; its entries then count towards the default diary's goal. Goals are part of the data download.
- **Moods.** Average mood over time and by weekday, and the feelings you name most, computed from the moods you recorded, without AI.
- **Connections graph.** The strongest links between entries and between tags, based on shared tags and computed without AI.
- **AI insights.** Mood, tone, and recurring subjects, and a writing-tendency analysis (see [AI Assistance](#ai-assistance)).
- **Year in review** (`/review`). One year of writing compared with the year before: entries, words, writing days, longest streak, top and new tags, and moments worth rereading. The mood arc comes from your recorded moods, or from an AI reading of sample entries if you ask for it. The review is private. You can post an editable summary as a public entry or print it as a booklet.

## Import, Export, and Books

- **Export** to TXT, JSON, Markdown, or CSV, or to PDF, EPUB, or HTML documents grouped by month. Exports can be scoped to a diary and can include visibility. A refused export says why in the reader's language (for example, the diary is gone) instead of downloading nothing.
- **Markdown folder export.** A ZIP with one Markdown file per entry, organized by diary and year, with front matter and attachments. It opens as is in editors such as Obsidian.
- **Import** TXT, JSON, or Markdown files up to 5 MB. The format is detected automatically, and a preview flags duplicates before anything is saved. When the API turns a file down (too large, too many entries for one import, or the diary is gone), the preview or the import says why in the reader's language instead of a generic failure, and the preview stays so the import can be tried again. The TXT layout (date format, separators, tag brackets) is configurable and reused for export; a refused save of it shows the API's reason.
- **Day One and Journey.** Import their exports with titles, tags, favorites, Journey moods, and photos and recordings as attachments. Each journal can go into a diary of the same name. Videos are left out, and photos over 5 MB are scaled down. Importing the same file again skips entries already there.
- **Danger zone.** Move every entry in the current scope to the recycle bin, after a confirmation. A refusal shows the API's reason rather than a generic failure.

### Book converter

- Turns a diary or the whole journal into a book, with one chapter per tag, or one per year or month in yearbook mode.
- With AI, each chapter's entries are woven into flowing first-person prose. **Strict** mode adds nothing that is not in the entries. **Creative** mode may add light transitions and texture but never invents major events. Without AI, chapters list the entries in date order.
- Optional AI chapter introductions and summaries.
- Options include chapter order, date range, which tags become chapters, an untagged chapter, entry dates, and a table of contents.
- Covers use a color theme and an optional PNG or JPEG image up to 2 MB. Entry images can be embedded (up to 5 MB each and 25 MB per book).
- Output as PDF, EPUB, HTML, or Markdown. Archived entries are left out.
- **Preview Chapters** shows the outline without using AI.
- **Versions.** Save the book, then save later versions from newer entries. Every version stays downloadable.
- Books can be uploaded straight to a connected cloud provider.

## Guided Memoir

A program that turns the journal into a life story, at `/memoir`.

- Fifty-two questions in seven life chapters (childhood, growing up, family, love and friendship, work, places, and lessons), in English and French.
- One new question a week on the weekday you choose, at 9:00 local time, optionally by email (verified addresses only). You can answer any question at any time.
- Answers are private Markdown entries in a memoir diary, tagged by chapter, so the book converter makes one chapter per life chapter.
- Answer by text or by voice: record in the browser (up to 15 minutes) or upload a recording (up to 5 MB). With AI, a recording can be transcribed into editable text.
- Progress shows questions answered, words, estimated pages, and chapters started, with a shortcut to turn the memoir into a book.
- Pause, change settings, or stop at any time. Stopping keeps every answer.

## Cloud Sync

- Connect Google Drive, OneDrive, and Dropbox.
- Upload an export, browse and download provider files, and import journal files from the cloud.
- Scheduled sync every 6 hours, 12 hours, day, or week (skipped when nothing changed), plus a manual **Sync Now**.
- A refused connection, upload, file list, download or import, schedule change, or sync says why in the reader's language, such as « La connexion à ce service cloud a expiré. Veuillez le reconnecter. » when the provider's access ran out, and falls back to a generic failure message when the API gives no reason.
- When the provider itself fails, the API answers with a code rather than a bare server error: a sign-in code the provider turns down reads as « Le service cloud n’a pas accepté cette connexion. Veuillez vous reconnecter. », a revoked or expired access token as the expired connection above, and a provider that is down, slow, or refuses for another reason as a 502 « Le service cloud n’a pas pu traiter cette demande. Veuillez réessayer plus tard. ». Only a refused refresh token disconnects the account; a provider outage or a server credential problem during a refresh leaves it connected.

## Social

- **Feed.** Other users' public entries with infinite scroll, a tab for authors you follow, and a preview of your own public entries. Private, archived, moderated, and deleted content never appears, and moods are never shown.
- **Listening to the feed.** Each feed entry has the Journal's listen button: read that entry aloud, or read on from it through the following entries, loading the next pages as the infinite scroll does until the feed ends. It uses your chosen voice and the read-dates setting from Profile, reads the title with the text, and picks an English or French voice from the language each entry appears to be written in. Reading stops when you press stop, switch feed tabs, or leave the feed. The button and its menu work from the keyboard (Enter to open, arrow keys, Escape to close) and tell screen readers whose entry they read and whether it is playing.
- **Follows, comments, and likes.** Follow authors, comment on public entries (up to 1,000 characters), and like entries and comments. You can remove comments on your own entries.
- **Leaderboard.** The ten most active writers and the most liked and most commented entries, for the week, month, year, or all time.
- **Achievements.** A private Profile section with your karma and ten badges, such as writing streaks and likes received.
- **Feature requests.** A public board of ideas. Signed-in users can submit ideas and vote.

## AI Assistance

All AI features are optional and run through OpenRouter. A deployment can provide a shared key, or you can add your own key in Profile, which then takes precedence. Profile shows a 30-day usage dashboard with tokens and costs. You can pick a default model and a different model per task. What each feature sends to the provider is listed in [Security](./security.md#ai-privacy).

- **Auto Tag.** Suggests subject and theme tags for a draft. With an automatic tag limit above 0, entries are also tagged on save.
- **Get Inspired.** Asks one reflective question based on your tags. Only tag names and counts are sent, never entry text.
- **Rephrase.** Rewrites a draft or entry: grammar only, light polish, or full rewrite.
- **Summaries.** Summarizes a long entry, optionally focusing on or leaving out details you name.
- **Entry chat.** Discuss an entry with AI. Chats are saved and can be exported as text, written in the profile language.
- **Meaning search.** Searches the 100 newest entries in scope by idea and returns the top 20.
- **Find duplicates.** Looks for entries that repeat the same subject and conclusion among the 40 newest in scope.
- **Organize journal tags.** Proposes up to 12 tags for the 300 newest entries, up to three each. You review every change before it is saved.
- **Insights.** Mood, tone, and subjects of the 40 newest entries in scope, and a writing-tendency analysis that sends only aggregate numbers. Results are not clinical.
- **Audio transcription.** Turns an audio attachment into text.
- **Books and the year in review.** Chapter weaving, introductions, and the optional mood reading.

## Accounts and Preferences

- **Sign-in.** Register and sign in with an email or username and password, or choose **Continue with Keycloak** for the shared single sign-on in production. A Keycloak sign-in with the same verified email links to the existing account, which keeps its password. Google sign-in is available when configured.
- **Security.** Email verification, optional two-factor codes by email, password change and reset, active session management, and account deletion. A deleted account is signed out at once and erased with everything in it within 30 days.
- **Profile.** Name, display name, bio, birthday, gender, and an avatar with crop and zoom. Confirmed accounts get a verified badge.
- **Data.** Download all your data as JSON.
- **Subscription.** A placeholder page. The plan is a saved setting with no payment behind it, and the billing history and payment method are sample data until a payment provider is connected.
- **Appearance.** Light or dark theme, high contrast, font family, size, and color, entries per page, and the pinned-entry limit.
- **Saving settings.** A change shows at once. If it cannot be saved (the API refuses it or cannot be reached), the previous settings come back and a notice says so; the profile and tag pages then show no "saved" message. A new tag's color, which the app saves on its own, is tried once and saved again when the tags or the settings next change.
- **Languages.** English and French.

## Accessibility and Experience

- Skip links, clear landmarks, and focus moved to the content on every page change.
- Every page is scanned with Axe against WCAG 2.2 A and AA in both themes as part of the end-to-end tests, and the journal also with high contrast.
- Every control works with the keyboard, including diary and entry reordering.
- Every modal dialog (confirmations, the AI chat, attachment previews, the entry summary, the profile picture editor, the journal retag review, duplicate review, the template name, highlights, and Focus mode) takes focus when it opens, keeps Tab inside (also when leaving a previewed PDF or text file), closes with `Esc` wherever focus is, and returns focus to the control that opened it. When one dialog opens over another, `Esc` closes only the top one.
- The same features on desktop and phone, with controls that wrap instead of scrolling off-screen.
- Destructive actions ask for confirmation, and long operations show progress.
- Every visitor, signed in or not, lands on the presentation page at `/`. It presents the journal, the guided memoir, books, the look back (stats, moods, year in review), privacy and AI, imports, and the other features in English and French, with **Start your journal**, **Sign Up**, and **Sign In** when signed out and **Open your journal** when signed in. About, Blog, Privacy, Terms, Contact, and Feedback pages are public too and share its colors.

## Future Direction: Life ERP

Thoughty may grow into a personal ERP while keeping its privacy and entry-centered design: life metrics and habits, finances, health, relationships, productivity, and dashboards that relate them to the journal. The backlog is in [TODO.md](../TODO.md#life-erp).
