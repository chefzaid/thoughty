# ADR 0024: Private Share Links Read Without an Account

- Status: Accepted
- Date: 2026-10-28

## Context

Writers want one person to read one entry, or download one saved book version, without making it public in the feed and without that person needing an account. Until now every way to read a journal needed the owner's session, and the only public content was the moderated feed ([ADR 0013](./0013-public-social-content-and-moderation.md)). A link a writer sends by message or email will be pasted, forwarded and kept in browser history, so it must be as hard to guess as a session, stop when the writer wants, and reveal nothing else of the account.

Options considered:

- **A signed token (HMAC or JWT) carrying the target and expiry.** No table, but it cannot be revoked one by one, cannot count views, and survives the entry going to the recycle bin unless every read re-checks everything anyway.
- **Guest accounts or email invitations.** Strong identity, but the reader must sign up or receive mail, which is not what "send a link to my sister" is.
- **A random token stored as a hash, checked against the database on every request.** Revocable, countable, and each check sees the entry's current state.

## Decision

- **Random tokens, stored hashed.** A link token is 32 bytes from the operating system's secure random source, written as 43 base64url characters, and only its SHA-256 is kept (`share_links.token_hash`, unique), as for refresh tokens. The token is shown once, in the answer that makes it; the web builds `https://<host>/s/<token>` in the browser.
- **Every link expires and can be revoked.** An expiry from one hour to a year (and a day) ahead is required; an optional view limit counts openings of the entry or downloads of the book. Revoking deletes the row. A writer has at most 100 unexpired links.
- **The database ends links that must end.** A trigger deletes an entry's links when it goes to the recycle bin or is sealed as a time capsule, and foreign keys delete them with the entry, the book version or the account. The read query also checks the account, the entry and the expiry, so either line alone keeps a hidden entry unreadable.
- **One public read surface, apart from the app.** `GET /api/shared/:token`, `…/file` and `…/attachments/:id[/poster]` are the only routes a reader calls; they are `@Public()`, throttled, and answer every refusal with the same `404 SHARE_LINK_NOT_FOUND`. Files go through a token-scoped route that serves only the shared entry's attachments by ID, never the owner's file route or a storage key. The reader sees the date, title, text and files, and the mood and tags only if the writer chose so.
- **A page without the app.** `/s/<token>` is rendered by `main.tsx` before the app shell: no session, router, refresh call or navigation, `noindex` and `no-referrer` set by NGINX and the page, and no access log line with the token.

## Consequences

- Private journal text can now leave the account through a URL. Anyone holding a live link reads it; the writer's protections are the expiry, the view limit and revocation, and the dialog says so.
- Tokens live in URLs, so they reach browser history, and any proxy access log in front of the app that records paths. The app's own request log, metrics and web NGINX log leave them out; proxies the deployment adds must do the same.
- A new table, `share_links`, and a trigger on `entries`; the data download lists links without their tokens.
- Opening an entry counts a view and changes a row, so the read route is not cacheable; it sends `Cache-Control: no-store`.
