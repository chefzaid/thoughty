# Security and Privacy Reference

Thoughty stores private journals, attachments, sessions, and encrypted third-party credentials. This page lists the rules the code enforces and new code must keep. Decisions are in [ADR 0008](./adr/0008-security-authentication-and-owasp-baseline.md) and [ADR 0009](./adr/0009-rate-limiting-and-abuse-controls.md).

## Baseline

- Every API route needs an access token unless marked `@Public()`.
- The global `ValidationPipe` whitelists DTO fields and rejects unknown ones.
- Every query is scoped to the authenticated user. A diary or entry the caller does not own answers `404`, including the target diary when creating, moving, or importing entries.
- Passwords use bcrypt. Reset, verification, and 2FA challenge tokens are stored only as SHA-256 hashes.
- In production, API responses carry a per-response nonce CSP with no `unsafe-inline` (`common/security/csp.ts`), and served HTML such as Swagger UI gets the nonce. Do not add `unsafe-inline`. The web NGINX config sets `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`, but no CSP.

## Authentication and Sessions

In production, the ingress sends every `/api` request through the platform's Keycloak OAuth2 Proxy, which forwards the Keycloak access token to `GET /api/auth/sso`. The API verifies its RS256 signature against Keycloak's JWKS, plus issuer, expiry, and the `oauth2-proxy` audience, and requires a verified email. It then links or creates the local user and issues Thoughty's own tokens. Identity headers are never trusted unverified. Local development uses email or username with a password, and optional Google sign-in.

- **Access token:** JWT signed with `JWT_SECRET`, 15 minutes by default (`JWT_EXPIRES_IN`).
- **Refresh token:** JWT signed with `REFRESH_SECRET`, valid 7 days, and stored in `refresh_tokens`. Each stored token is a session. Refresh needs a matching row and does not rotate the token.
- The web app keeps both tokens in `localStorage`.
- Users can list sessions (token values are never returned) and revoke one or all others. Logout deletes the presented token. Password change, password reset, and account deletion delete all of them.
- Account deletion is a soft delete (local accounts confirm the password). The account can no longer sign in; its content stays in the database.

**Email verification and 2FA.** Verification tokens last 24 hours. Verified password accounts can enable email 2FA. Login then returns an opaque challenge until the six-digit code is confirmed. Codes are HMAC-SHA-256 values keyed by `TWO_FACTOR_SECRET` (derived from `JWT_SECRET` if unset; use one value across replicas). Challenges expire after 10 minutes and are cleared atomically on success. Disabling 2FA needs the password.

**Password reset.** Reset tokens last one hour and are cleared on use. Forgot-password always returns the same message. Failed emails are logged with the error and user ID only, never the link, so production needs working SMTP.

## Public Surfaces

`@Public()` routes: health, metrics, register, login, 2FA verify and resend, OAuth, SSO, refresh, logout, forgot and reset password, verify email, and the feature-request list. A new public route must state why, which throttle applies, and what it reveals.

Social features need a session and share one rule (`modules/social/public-feed-visibility.ts`): an entry is visible only if it is `public`, has `moderation_status = 'visible'`, is not archived or in the recycle bin, and its author is not deleted. Follows, comments, and likes on anything else answer `404`.

- `moderation_status` is platform-controlled. No entry DTO may accept it.
- The feed returns at most 20 entries per page and leaves out mood and feelings. Authors show only `id`, `username`, `avatarUrl`, and follow state. Followers are counted, never listed.
- Self-follows and self-likes answer `400`. Comments are at most 1,000 characters and render as escaped text.
- The leaderboard counts only visible content. Achievements are returned only to their owner.

## Abuse Controls

Rate limits (`thoughty-server/src/common/rate-limit.constants.ts`):

| Policy | Limit | Applies to |
|---|---|---|
| Default | 100 per 15 min | every route except health and metrics |
| Auth attempts | 5 per 15 min | register, login, OAuth, 2FA verify and resend |
| Token refresh | 30 per 15 min | refresh |
| Password recovery | 3 per hour | forgot password, reset password, verify email |
| Account security | 5 per hour | password change, verification resend, 2FA changes, session revocation, account deletion |
| Social writes | 30 per 15 min | follows, comments, likes |
| Import writes | 300 per 15 min | app-import batches (`/api/io/import/entries`, `/api/io/import/attachments`) |

- Counters use Redis when `REDIS_URL` or `REDIS_HOST` is set, and fall back to in-process counters if Redis fails.
- Counters key on the client IP. Behind an ingress, check the trusted-proxy and client-IP path before relying on per-client limits.
- Register and login reject requests that fill the hidden `website` bot-trap field.
- Body limits (`common/security/request-payload-limits.ts`): JSON `1mb` and forms `256kb`, set with `REQUEST_BODY_LIMIT`, `REQUEST_JSON_BODY_LIMIT`, and `REQUEST_FORM_BODY_LIMIT`. Only `/api/io/preview` and `/api/io/import/*` accept JSON up to `8mb` (`REQUEST_IMPORT_BODY_LIMIT`), so a 5 MB text import fits once escaped. The ingress caps bodies at 10 MiB.
- Uploads take one file of at most 5 MB and one scalar field, with no nested field names (`common/multipart-limits.ts`). App-import file batches take up to 8 files.
- Search is capped at 500 characters and uses bound parameters only.
- Client input the database rejects answers `400` (`DatabaseInputExceptionFilter`).

## Secrets

Production secrets live in Vault and reach the cluster through External Secrets (`infra/k8s/overlays/swirl-cloud/external-secrets.yaml`). The standalone profile uses [Vault Agent](./standalone-vault.md). Nothing secret is committed. Setup and rotation: [Deployment](./deployment.md#configuration-and-secrets).

- `JWT_SECRET`, `REFRESH_SECRET`, `TWO_FACTOR_SECRET`
- `CONFIG_ENCRYPTION_SECRET`: the most sensitive value. Leaking it exposes stored provider tokens and AI keys; losing it makes them unreadable.
- PostgreSQL and backup credentials, S3 keys, the optional shared `OPENROUTER_API_KEY`, cloud-provider OAuth client secrets, and SMTP credentials

The signing secrets have development defaults in code. Only `CONFIG_ENCRYPTION_SECRET` is enforced at production startup, so set every value.

## Data Protection

- **Encryption at rest:** personal OpenRouter keys and cloud-provider tokens are encrypted with AES-256-GCM using `CONFIG_ENCRYPTION_SECRET`. Other settings are plain text. Personal keys are checked with OpenRouter before storage, shown only as their last five characters, and left out of `GET /api/config` and the data download. Cloud tokens appear in both as ciphertext.
- **Attachments:** a MIME allowlist (images including SVG, PDF, text, audio) and the 5 MB limit are checked before storage. Objects use random UUID keys in private buckets. The file route needs a session but does not check ownership; it relies on the unguessable key.
- **Recycle bin:** deleted entries are hidden from every other feature for 30 days, then purged with their revisions, attachments, chat, comments, and likes. Deleting forever purges at once. Storage failures are logged by key and do not stop the purge.
- **Data download:** includes recycle-bin entries, revisions, attachment metadata, settings, social and memoir data, and stored mood readings. It leaves out the password hash, session tokens, the personal AI key, and AI chat history.
- **App imports:** Day One and Journey exports are parsed in the browser ([ADR 0020](./adr/0020-browser-side-app-imports-and-streamed-archives.md)). Journey HTML goes through an inert `DOMParser` that keeps only text, basic formatting, and `http`, `https`, or `mailto` links. Imported entries are private and go only to the writer's own diaries. A batch holds at most 200 entries and is saved in one transaction. Every file is checked before any is stored.
- **Markdown export:** streams one attachment at a time, re-checks the 5 MB limit, and builds paths from sanitized names.
- **Memoir:** answers are private entries. Weekly emails go only to verified addresses of live accounts and contain the question and a link, never journal text.
- **Year in review:** computed on request and never public. Sharing posts only the text the writer edited, without tags unless chosen.

## AI Privacy

AI is optional and uses OpenRouter. A user's personal key, when set, replaces the shared key for all of their requests.

| Feature | What is sent |
|---|---|
| Rephrase | the draft, up to 10,000 characters |
| Auto Tag | the draft, up to 10,000 characters, and its current tags |
| Entry chat | the entry, up to 10,000 characters, and up to 50 messages. Chats are stored per entry. |
| Entry summary | one owned entry, plus the writer's include and exclude notes |
| Get Inspired | tag names and counts from the 200 newest entries. No entry text. |
| Stats mood, tone, subjects | each time stats load with a key available: the 40 newest entries, with date, tags, and up to 1,200 characters each |
| Writing tendencies | aggregate word, subject, and writing metrics. No entry text. |
| Duplicate review | the 40 newest entries, up to 400 characters each |
| Meaning search | the query and the 100 newest entries, up to 1,200 characters each |
| Organize tags | the 300 newest entries, up to 400 characters each |
| Year mood arc | on request: up to 5 entries per month, 600 characters each. The reading is stored. |
| Book weaving | on by default in book export (strict or creative): the date and full text of each chapter's entries, in parts of about 20,000 characters. No images. |
| Book chapter framing | when chosen: each chapter's dates and text, cut to 20,000 characters, for the introduction and summary |
| Audio transcription | the one selected audio attachment, up to 5 MB |

- Auto Tag, summary, Get Inspired, duplicate review, and tag organization tell the model to ignore instructions in entry text or tags. The other prompts do not yet. New prompts must.
- Mood readings with clinical labels are discarded. Applying a tag plan does not call the provider again.
- Usage rows store metadata only (model, tokens, cost, time), never prompts or completions.

## Review Checklist

Runtime hardening and scanning are in [Deployment](./deployment.md#delivery-pipeline). For security-sensitive changes, check:

- Does it add a public route, and is its throttle right?
- Does it expose journal data, attachments, settings, or credentials to anyone but the owner?
- Is every query scoped to the user, including referenced diaries and entries?
- Does it send journal content to a third party, and is it in the AI table?
- Does it need a larger body limit or a new upload path?
- Does it add a secret, and how is it rotated?
- Does it change security assumptions enough to need an ADR?
