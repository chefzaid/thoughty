# Security and Privacy Reference

Thoughty stores private journals, attachments, sessions, and encrypted third-party credentials. This page lists the rules the code enforces and new code must keep. Decisions are in [ADR 0008](./adr/0008-security-authentication-and-owasp-baseline.md) and [ADR 0009](./adr/0009-rate-limiting-and-abuse-controls.md).

## Baseline

- Every API route needs an access token unless marked `@Public()`.
- The global `ValidationPipe` whitelists DTO fields and rejects unknown ones.
- Every query is scoped to the authenticated user. A diary, entry, or attachment the caller does not own answers `404`, including the target diary when creating, moving, or importing entries.
- Passwords use bcrypt. Reset, verification, and 2FA challenge tokens are stored only as SHA-256 hashes.
- In production, API responses carry a per-response nonce CSP with no `unsafe-inline` (`common/security/csp.ts`), and served HTML such as Swagger UI gets the nonce. Do not add `unsafe-inline`.
- The web NGINX config (`thoughty-web/nginx-security-headers.conf`, included for every response including `/assets/`) sends a strict CSP: scripts, styles, fonts, and connections from `'self'` only, images from `'self'`, `data:`, `blob:`, and Google profile pictures, media and frames from `blob:` for attachment previews, `object-src 'none'`, and `frame-ancestors 'none'`. Only style attributes are allowed inline, because the browser's own PDF and text viewers need them. External images in Markdown entries are therefore blocked. It also sends HSTS, `X-Frame-Options: DENY`, and a `Permissions-Policy` that allows only the microphone (memoir recordings). A build with `VITE_GOOGLE_CLIENT_ID` set would also need the Google Identity Services origins added to the CSP.

## Authentication and Sessions

Thoughty accepts two kinds of accounts side by side, in every environment: local accounts (email or username and password, registered in the app) and, in production, Keycloak single sign-on. The sign-in and sign-up pages show both. **Continue with Keycloak** opens the platform's Keycloak sign-in (`https://keycloak.swirlit.dev/oauth2/start`) and returns to the app, which then calls `GET /api/auth/sso` once; a visitor is never sent to Keycloak unasked. Only that route goes through the platform's Keycloak OAuth2 Proxy (the `thoughty-sso` ForwardAuth Middleware on its own ingress), which forwards the Keycloak access token. The rest of `/api` is reachable without Keycloak and authenticates every request itself. The API verifies its RS256 signature against Keycloak's JWKS, plus issuer, expiry, and the `oauth2-proxy` audience, and requires a verified email. It then links the account with the same verified email (which keeps its password, so either sign-in works) or creates one, and issues Thoughty's own tokens. The Middleware only obtains the token; the signature check is the security boundary, so identity headers are never trusted unverified. Signing out of a Keycloak account also ends the Keycloak session; signing out of a local account does not. Google sign-in is optional: the browser sends the Google ID token and the API verifies its RS256 signature against Google's keys, the issuer, the audience (`GOOGLE_CLIENT_ID`, which must match the web's `VITE_GOOGLE_CLIENT_ID`), and expiry, and requires a verified email before it links or creates the account. Without `GOOGLE_CLIENT_ID` Google sign-in answers `503`. Both flows share `auth/services/jwks-key-store.ts`.

- **Access token:** JWT signed with `JWT_SECRET`, 15 minutes by default (`JWT_EXPIRES_IN`).
- **Refresh token:** JWT signed with `REFRESH_SECRET`, valid 7 days. Only its SHA-256 hash is stored, in `refresh_tokens`; each row is a session. Every refresh deletes the presented row and issues a new token, so a token works once and a replayed one answers `401`.
- **Where tokens live:** the refresh token travels only in the `thoughty_refresh_token` cookie (httpOnly, `SameSite=Strict`, `Secure` in production, path `/api/auth`), set by every endpoint that signs in and cleared on logout, account deletion, and a rejected refresh. No response body contains it. The web app keeps the access token in memory and calls refresh on page load. It never uses `localStorage` for tokens and removes keys left there by older versions.
- **Upgrade path:** for a refresh token issued before cookies, refresh still accepts it once in the request body when no cookie is present, then switches the browser to the cookie. This can be removed once those tokens have expired (7 days after the release).
- Users can list sessions (token values are never returned) and revoke one or all others. Logout deletes the presented token. Password change, password reset, and account deletion delete all of them.
- Login answers an unknown, deleted, or password-less account exactly like a wrong password, after the same bcrypt work. Forgot-password returns the same message for every address and does not wait for the mail server. Registration still reports a taken email or username.
- Account deletion signs the writer out at once (local accounts confirm the password). A worker job erases the account and everything it owns after `ACCOUNT_PURGE_AFTER_DAYS` (default 30), see [Data Protection](#data-protection).

**Email verification and 2FA.** Verification tokens last 24 hours. Verified password accounts can enable email 2FA. Login then returns an opaque challenge until the six-digit code is confirmed. Codes are HMAC-SHA-256 values keyed by `TWO_FACTOR_SECRET` (derived from `JWT_SECRET` if unset; use one value across replicas). Challenges expire after 10 minutes and are cleared atomically on success. Disabling 2FA needs the password.

**Password reset.** Reset tokens last one hour and are cleared on use. Forgot-password always returns the same message. Failed emails are logged with the error and user ID only, never the link, so production needs working SMTP.

## Public Surfaces

`@Public()` routes: health, metrics, register, login, 2FA verify and resend, OAuth, SSO, refresh, logout, forgot and reset password, verify email, and the feature-request list. A new public route must state why, which throttle applies, and what it reveals. `/api/metrics` answers only callers on the private network (Prometheus scrapes the pods directly); anyone else, including every request through the ingress, gets `404`.

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
- Counters key on the client IP (`req.ip`), so Express must trust exactly the proxies in front of the API (`TRUST_PROXY`, `common/security/trust-proxy.ts`). swirl-cloud sets `2` (Cloudflare or the HA tunnel, then Traefik, which rewrites `X-Forwarded-For` from anyone else). Unset, production trusts private-network proxies and other environments trust none. If a proxy is added or removed in front of the API, change `TRUST_PROXY`: too few hops makes every client share one counter, too many lets clients choose their own IP.
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

In production the API and worker refuse to start without `CONFIG_ENCRYPTION_SECRET`, or when `JWT_SECRET` or `REFRESH_SECRET` (and `TWO_FACTOR_SECRET`, when set) is missing, an example value, or shorter than 32 characters (`auth/auth-secrets.ts`). Development keeps working defaults.

## Data Protection

- **Encryption at rest:** personal OpenRouter keys and cloud-provider tokens are encrypted with AES-256-GCM using `CONFIG_ENCRYPTION_SECRET`. Other settings are plain text. Personal keys are checked with OpenRouter before storage and shown only as their last five characters.
- **Cloud provider failures:** a refused or failed provider request is logged with the provider, the step and the HTTP status only (`cloud-sync/providers/provider-failure.ts`), and an unreachable provider with the host only (`cloud-operation.ts`). Provider response bodies, which can echo the authorization code, tokens or file details, are never logged or passed on (they are discarded unread, apart from the Dropbox folder check that looks for a conflict), and the error the API returns carries only its code and a fixed message naming the provider.
- **Settings API:** `GET /api/config` returns only user preferences, and `POST /api/config` accepts only an allowlist of preference keys with validated values (`config/dto/config.dto.ts`); credentials, cloud tokens, and sync state cannot be read or written through it.
- **Attachments:** a MIME allowlist (images including SVG, PDF, text, audio) and the 5 MB limit are checked before storage. Objects use random UUID keys in private buckets. The file route serves a file only to the owner of its attachment (anyone else gets `404`), with the stored type from the allowlist, `X-Content-Type-Options: nosniff`, and a safe `Content-Disposition`. Only raster images, audio, and PDF are shown inline; SVG and text are downloads with a sandboxing CSP.
- **Recycle bin:** deleted entries are hidden from every other feature for 30 days, then purged with their revisions, attachments, chat, comments, and likes. Deleting forever purges at once. Storage failures are logged by key and do not stop the purge.
- **Deleted accounts:** an hourly worker job permanently deletes accounts deleted more than `ACCOUNT_PURGE_AFTER_DAYS` ago: first their files in object storage, then the user row, whose foreign keys cascade to everything they own or wrote, including their comments, likes, follows, and feature requests. If any file cannot be deleted, the account is kept and retried on the next run.
- **Data download:** includes recycle-bin entries, revisions, attachment metadata, settings, social and memoir data, and stored mood readings. It leaves out the password hash, session tokens, the personal AI key, cloud tokens and sync internals, and AI chat history.
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

- Every prompt treats journal text as untrusted data: it is wrapped in tagged blocks (`ai/untrusted-content.ts`, which escapes a closing tag inside the text) and the system prompt tells the model to ignore instructions inside them. New prompts must use the same helper.
- Mood readings with clinical labels are discarded. Applying a tag plan does not call the provider again.
- Usage rows store metadata only (model, tokens, cost, time), never prompts or completions.

## Container Images

The production PostgreSQL client image (setup hook and backup CronJob, see [Deployment](./deployment.md#production-desired-state)) is `postgres:18.6-alpine3.24@sha256:10a5c69a83035ab5239f5620d708520e8b28f5aa1f2b20143e6024532edadfb5`, built 2026-10-21. It replaced `18.6-bookworm`, whose Debian 12 packages carry critical findings with no Debian fix (zlib minizip CVE-2023-45853, SQLite CVE-2025-7458, libxml2 CVE-2026-6653) and a Perl finding (CVE-2026-9538); `18.6-trixie` still has the libxml2 one. The Alpine image has no Perl, and its zlib and libxml2 are not affected.

Trivy 0.74.0 (database of 2026-10-26, `--severity CRITICAL,HIGH`, amd64 and arm64) found in it:

- Alpine packages: no critical findings; two high ones fixed in newer Alpine packages (brotli-libs CVE-2026-111497, libcurl CVE-2026-92392), which the next upstream rebuild picks up. Neither the setup hook nor `pg_dump` uses brotli or curl.
- `/usr/local/bin/gosu` (the official image's entrypoint helper, gosu 1.19 built with Go 1.24.6): one critical Go standard library finding (CVE-2025-68121, `crypto/tls` session resumption) and 24 high ones, fixed in newer Go releases. Every official `postgres` variant ships the same binary. Both jobs replace the entrypoint with `/bin/sh` and run as UID 65534, so gosu never runs. Whether to accept this until upstream rebuilds gosu is open in TODO.md (Needs Input).

Recheck before moving the digest: `trivy image --severity CRITICAL,HIGH --platform linux/amd64 docker.io/library/postgres:<tag>@<index digest>` (and `linux/arm64`), or the platform's Grafana **Trivy Security Reports** dashboard. `mirror.gcr.io/library/postgres@<index digest>` serves the same content when Docker Hub's anonymous pull limit is reached.

## Review Checklist

Runtime hardening and scanning are in [Deployment](./deployment.md#delivery-pipeline). For security-sensitive changes, check:

- Does it add a public route, and is its throttle right?
- Does it expose journal data, attachments, settings, or credentials to anyone but the owner?
- Is every query scoped to the user, including referenced diaries and entries?
- Does it send journal content to a third party, and is it in the AI table?
- Does it need a larger body limit or a new upload path?
- Does it add a secret, and how is it rotated?
- Does it change security assumptions enough to need an ADR?
