# Operations Runbook

How to check and troubleshoot a deployed Thoughty. Deployment itself is in the [Deployment Guide](./deployment.md). Commands target production (`apps`). For standalone, use namespace `thoughty` and the Vault Agent files in `/vault/secrets`.

| Surface | Location |
|---|---|
| Application | `https://thoughty.swirlit.dev` |
| GitLab | `https://gitlab.swirlit.dev/swirl/thoughty` |
| Argo CD | `https://argocd.swirlit.dev/applications/thoughty` |
| SonarQube | `https://sonarqube.swirlit.dev/dashboard?id=swirl%3Athoughty` |
| Grafana / Kibana | **Thoughty Overview** / **Thoughty — Application Logs** |

## Health Checks

```bash
kubectl get application thoughty -n infra
kubectl get deployment,pod,cronjob,externalsecret -n apps | grep thoughty
kubectl exec deployment/thoughty-server -n apps -- wget -qO- http://localhost:3001/api/health
```

Healthy means: Argo CD `Synced` and `Healthy` at the expected revision, all three Deployments available, every External Secret `Ready=True`, and `/api/health` returning `"status":"ok"`. Check from inside the cluster; public `/api` calls without a session get a login redirect. `/api/health` does not check the database; use `thoughty_database_up`.

Probes on API (`/api/health`) and web (`/`): liveness every 10s with a 5s timeout restarts a pod after 6 failures (about a minute); readiness every 5s with a 3s timeout. The worker has no probes.

## Logs and Metrics

```bash
kubectl logs deployment/<thoughty-server|thoughty-web|thoughty-cloud-sync-worker> -n apps --tail=200
```

API and worker logs are JSON lines. Request logs carry `requestId` (also the `x-request-id` response header), `method`, `path`, `statusCode`, `latencyMs`, and `userId`, for every request under `/api`, unknown routes included (`applyRequestLogging` registers the middleware with Nest 11's named wildcard `{*splat}`, so the API starts without an `Unsupported route path` warning). They never contain bodies, auth headers, journal content, AI text, or tokens: a private share link's path is logged (and counted in the metrics) as `/api/shared/:token…`, and the web NGINX leaves `/s/…` and `/api/shared/…` out of its access log. A proxy in front of the app that logs paths (Traefik access logs, Cloudflare) would record share link tokens, which are secrets: keep such logs off or redact those paths. The Kibana dashboard is imported by the `thoughty-kibana-bootstrap` hook.

`/api/metrics` exports request counts and latency, `thoughty_database_up`, `thoughty_cloud_sync_jobs{status}`, `thoughty_cloud_sync_stuck_jobs` (locked over 15 minutes), `thoughty_feature_usage_total` (no user data), the north-star metric and sign-up funnel (below), and process memory and uptime. Prometheus scrapes the API pods by annotation; the endpoint answers only private-network addresses, so it returns `404` through the public URL. The optional `infra/k8s/components/monitoring` component holds the `thoughty-alerts` PrometheusRule ([ADR 0015](./adr/0015-observability-baseline.md)). Its expressions match the Thoughty pods and Deployments by name, not by namespace, so they work in any namespace. No overlay includes it, because swirl-cloud runs a plain Prometheus without the Prometheus Operator and Argo CD would reject the unknown resource. To alert in production, add the same rules to the platform's Prometheus configuration; on a cluster with the Operator, add the component to the overlay and make sure the API pods are scraped.

### North-star metric and sign-up funnel

The product's north-star metric is **weekly writing days per active writer**: the days on which writers wrote in the last 7 days, divided by the writers who wrote in the last 28 days (0 to 7; it rises when writers come back more often and falls when writers drift away). Both it and the funnel are counts of accounts computed in the database (`WritingEngagementMetricsService`); no entry text, account, date or other per-person value leaves it.

- **A written entry** is one saved on the day it is dated, a day either way allowed for the writer's time zone and late-night writing (`entries.date` within a day of `created_at`). Imports and back-dated entries do not count, entries since moved to the recycle bin do, and accounts being deleted (`users.deleted_at`) are left out everywhere.
- **A writing day** is a date (the writer's day) with a written entry saved in the last 7 days, at most 7 per writer.

| Metric | Meaning |
|---|---|
| `thoughty_weekly_writing_days_per_active_writer` | `thoughty_writing_days_7d` / `thoughty_active_writers{window="28d"}`, 0 when no one wrote |
| `thoughty_writing_days_7d` | writing days in the last 7 days, summed over writers |
| `thoughty_active_writers{window="7d"\|"28d"}` | accounts with a written entry saved in the window |
| `thoughty_sign_up_funnel_accounts{stage}` | accounts created 28 to 56 days ago (each has had its first four weeks): `signed_up` (all of them), `first_entry` and `fifth_entry` (1 and 5 written entries in the first four weeks), `week_four` (a written entry in days 22 to 28 after sign-up); each stage is counted on its own, so `week_four` can include writers below five entries |

Each API pod runs the two queries at most every 15 minutes and serves the cached counts in between (they move over days); while the database cannot answer, the lines are left out instead of reading as zero. Every pod reports the same values, so dashboards take `max`, not `sum`. The **Thoughty Overview** dashboard shows the north-star metric over time and the funnel as shares of `signed_up`.

## Feature Flags

Four flags switch a feature off for everyone without a new image: `ai`, `bookConverter`, `cloudSync` and `publicSharing` ([what each covers](./architecture.md#feature-flags)). While one is off, its routes answer `503 FEATURE_DISABLED` and the web hides it with a short note; nothing stored is changed or deleted, and turning it back on restores the feature as it was (queued cloud syncs run, private links open again, public entries reappear in the feed).

Read the flags the API serves now (`COOKIE_JAR` holds a signed-in session; never commit it):

```bash
curl --cookie "$COOKIE_JAR" https://thoughty.swirlit.dev/api/config/feature-flags
```

Switch one off:

- **In Unleash** (production): turn the toggle off in the `production` environment (below). Each API pod and the worker read it within `FEATURE_FLAG_CACHE_TTL_MS` (60 s by default), and open browsers within a minute more, when their window regains focus (a reload shows it at once). Turning it back on works the same way.
- **With a JSON provider** (`FEATURE_FLAG_PROVIDER=json`, the default when `FEATURE_FLAG_PROVIDER_URL` is set): change the document it serves, e.g. `{"flags": {"ai": false}}`; `FEATURE_FLAG_PROVIDER_TOKEN`, if set, goes as `Authorization: Bearer`.
- **Without a provider**: set `FEATURE_FLAGS: "ai=false"` (comma-separated, `flag=false` or `flag=true`) in `infra/k8s/overlays/swirl-cloud/configmap-patch.yaml`, commit, let Argo CD sync (self-heal reverts a `kubectl edit`), then restart both workloads, since a ConfigMap is read into the environment at start: `kubectl rollout restart deployment/thoughty-server deployment/thoughty-cloud-sync-worker -n apps`. A provider, when set, wins over `FEATURE_FLAGS` for the flags it names, so this is also the value a flag keeps when the provider has no toggle for it.

When the provider cannot be reached, times out (3 s) or answers an error, the API keeps the flags it last read and logs `Feature flag provider unavailable` with the error (never the token); before any answer (after a restart) it uses `FEATURE_FLAGS` and the defaults, every feature on. It tries again once a TTL, not on every request. So an Unleash outage changes nothing for writers until a pod restarts, and then every feature is on, as without a provider.

### Unleash

Production reads its flags from a self-hosted Unleash in `apps` (`infra/k8s/overlays/swirl-cloud/unleash.yaml`): `FEATURE_FLAG_PROVIDER: unleash` and `FEATURE_FLAG_PROVIDER_URL: http://thoughty-unleash:4242/api` in `configmap-patch.yaml`, and a backend token as `FEATURE_FLAG_PROVIDER_TOKEN` in Vault `apps/thoughty/app`. The API asks `GET /api/client/features` with `Authorization: <token>`, `UNLEASH-APPNAME: thoughty-server` and `UNLEASH-INSTANCEID: <pod name>`. Unleash keeps its own data in the `unleash` database on the platform PostgreSQL, created by the `thoughty-unleash-db-setup` hook from Vault `apps/thoughty/unleash` (`DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `UNLEASH_DEFAULT_ADMIN_PASSWORD`); it runs its own migrations at start. It has no Ingress, and its NetworkPolicy lets only the API, its canary and the worker reach it.

First setup, on the control-plane host (the commit that adds Unleash fails the deploy's health wait until step 1 is done, so do it first):

1. Create `apps/thoughty/unleash`: re-run `infra/scripts/configure-gitlab.sh` (or onboarding), which generates the passwords when the path is missing and never overwrites it. Then sync; Unleash starts in waves 2 to 4, after the app.
2. Open the UI: `kubectl port-forward -n apps svc/thoughty-unleash 4242:4242`, then `http://localhost:4242`, user `admin`, password `UNLEASH_DEFAULT_ADMIN_PASSWORD` from Vault (used only when Unleash creates its first user; change it in the UI afterwards, the Vault value then no longer applies).
3. Create the toggles in the `default` project, one per flag, named exactly as the app's flags (case counts): `ai`, `bookConverter`, `cloudSync`, `publicSharing` (type *Kill switch* or *Release*). In the `production` environment enable each one with the standard strategy, or a gradual rollout at 100% (Unleash's default when you enable it): that is the feature on. Disabling the toggle in `production` is the feature off. A toggle that does not exist leaves its flag to `FEATURE_FLAGS` and the defaults (on), so an unfinished setup switches nothing off.
4. Create a backend token: **Admin settings › API access › New API token**, type *Backend* (shown as *Client* in older versions), project `default`, environment `production`. Put it in Vault with the CLI, signed in as for the other values: `vault kv patch secret/apps/thoughty/app FEATURE_FLAG_PROVIDER_TOKEN=-` reads it from stdin, so it stays out of the shell history (never commit it or paste it in a ticket).
5. Let External Secrets refresh `thoughty-app` (hourly, or at once: `kubectl annotate externalsecret thoughty-app -n apps force-sync="$(date +%s)" --overwrite`), then `kubectl rollout restart deployment/thoughty-server deployment/thoughty-cloud-sync-worker -n apps`, since the token is read at start.
6. Check: `kubectl logs deployment/thoughty-server -n apps | grep 'Feature flag provider unavailable'` shows nothing new after a minute; toggle `ai` off, wait a minute, and `GET /api/config/feature-flags` (above) answers `"ai": false`; turn it back on. In Unleash, the toggle's **Metrics** stay empty (the API sends no usage metrics).

Until step 4 is done, the API logs `Feature flag provider unavailable` (`Unleash returned 401`) once a minute per pod and keeps every feature on.

What the API reads: a toggle is on when it is enabled in the token's environment and has no strategy, or an active strategy that is on for everyone, the standard one or a gradual rollout at 100%, without constraints or segments. The API holds one value per flag for all writers, so it cannot evaluate anything that depends on who asks: a rollout below 100%, user IDs, IP addresses, hostnames, custom strategies, constraints and segments do not turn a toggle on (it reads as off unless another strategy is on for everyone). Variants, dependencies between toggles and impression data are ignored, and toggles with other names (another project's, if the token can see them) are ignored too.

Operations: Unleash's `/health` and `/ready` back its probes. Its state is the `unleash` database, covered by the platform PostgreSQL's backups; losing it loses the toggles and tokens, and the API then runs on the defaults until they are created again. To rotate the token, create a new one, put it in Vault, refresh and restart as in step 5, then delete the old one. To update Unleash, take the new tag's index digest (`Docker-Content-Digest` of its manifest, or `digest` from `https://hub.docker.com/v2/repositories/unleashorg/unleash-server/tags/<tag>`), scan it as in [Security](./security.md#container-images), and change `newTag` and `digest` of `unleashorg/unleash-server` in the overlay's `kustomization.yaml` together; read Unleash's release notes first, since it migrates its database at start and a rollback past a migration needs a database restore. To roll Unleash back entirely, revert the commit: the API goes back to `FEATURE_FLAGS` after its restart.

Each refused request is a `503` in `thoughty_http_requests_total`, so the 5xx alert counts them. The web stops sending them once it has read the flags, so only browsers left open from before the change send a few, for at most a minute or two; a 5xx rate that stays up after a flag change is something else.

## Migrations

Production runs the `thoughty-db-migrate` hook before the rollout. If it fails, save its logs, check that the `thoughty-database` secret is ready and the database reachable, and read the `migrations` table. Do not restart the worker until the schema matches the code.

Run by hand (standalone needs this after every deploy):

```bash
kubectl exec deployment/thoughty-server -n apps -- node dist/scripts/migrate.js
kubectl exec deployment/thoughty-server -n thoughty -- sh -c \
  '. /vault/secrets/database && . /vault/secrets/app && node dist/scripts/migrate.js'
```

### Renamed Usernames

Migration `1788134400000-case-insensitive-usernames` makes usernames unique ignoring case. Accounts whose usernames differed only in case were renamed, all but one per name, to `<username>-<id>` ([Data model](data-model.md#usernames-and-addresses)); they still sign in by email. The app tells them nothing and has no way to change a username (the owner's decision of 2026-11-23): the operator tells each one, by email, from this list of the live renamed accounts with their addresses, after the migration has run in production:

```sql
SELECT r.user_id, r.previous_username, r.username, u.email, r.renamed_at
  FROM username_renames r JOIN users u ON u.id = r.user_id
 WHERE u.deleted_at IS NULL
 ORDER BY r.renamed_at, r.user_id;
```

### Accounts Sharing an Address

The same migration lower-cases every account's email. If two accounts have addresses that differ only in case, it stops with `N e-mail address(es) belong to more than one account when compared ignoring case` and changes nothing (the whole pending batch rolls back). No rule can pick the owner, so decide per address before deploying again: find them with `SELECT lower(email), array_agg(id ORDER BY id) FROM users GROUP BY lower(email) HAVING count(*) > 1`, then keep the address on the account its owner uses (usually the verified one, or the one signed in to last) and give the other an address its owner confirms, or, when it is an abandoned duplicate, soft-delete it and move its address aside so the worker purges it (`UPDATE users SET deleted_at = now(), deletion_reason = 'Duplicate address', email = 'duplicate-' || id || '@invalid' WHERE id = …`, after exporting anything worth keeping). Then run the migration again.

### Accounts Without an Email Address

Migration `1790380800000-required-user-email` makes `users.email` required. An account that had none (NULL or blank) gets the placeholder `user-<id>@invalid`, on the reserved `.invalid` domain no mail reaches, and is marked unverified ([Data model](data-model.md#accounts-without-an-address)); the migration never stops on them. Nothing is ever emailed to a placeholder, and at the next sign-in the writer is asked for a real address, which takes effect once they open the link sent to it (a Google or Keycloak account linked to its provider takes the provider's address on its own). Find the accounts still waiting, and those that gave an address not yet confirmed:

```sql
SELECT id, username, auth_provider, pending_email, two_factor_enabled, created_at, updated_at
  FROM users
 WHERE (email LIKE '%@invalid' OR email LIKE '%.invalid') AND deleted_at IS NULL
 ORDER BY id;
```

An account with email two-factor sign-in on cannot receive its code until it has an address, so it cannot sign in: once its owner has proven who they are another way, turn two-factor off for it (`UPDATE users SET two_factor_enabled = false WHERE id = …`) so they can sign in and add one. Rolling the migration back turns the placeholders into NULL again.

## Canary Rollouts

Read the [canary limits](./deployment.md#canary-infrak8soverlaysswirl-cloud-canary) first.

1. Set both image tags, apply, and wait:

   ```bash
   kubectl apply -k infra/k8s/overlays/swirl-cloud-canary
   kubectl rollout status deployment/thoughty-server-canary -n apps
   kubectl rollout status deployment/thoughty-web-canary -n apps
   ```

2. Smoke-test with the override header. `COOKIE_JAR` holds a signed-in session; never commit it.

   ```bash
   curl --cookie "$COOKIE_JAR" -H 'X-Thoughty-Canary: always' https://thoughty.swirlit.dev/api/health
   ```

3. Shift traffic. Weights are stable/canary, total 100, per request. Reapplying the overlay resets them to 100/0.

   ```bash
   for s in thoughty-api-rollout thoughty-web-rollout; do
     kubectl patch traefikservice "$s" -n apps --type=json \
       -p '[{"op":"replace","path":"/spec/weighted/services/0/weight","value":90},{"op":"replace","path":"/spec/weighted/services/1/weight","value":10}]'
   done
   ```

4. To abort, set the canary weight to `0`, save both canary logs, and run `kubectl delete -k infra/k8s/overlays/swirl-cloud-canary`. The stable routes keep working.

## Troubleshooting

| Symptom | Check |
|---|---|
| Startup failure, DB auth or decryption errors | `kubectl describe externalsecret <name> -n apps`; `CONFIG_ENCRYPTION_SECRET` set. Check names only, never print values. |
| Restarts under load | Liveness fails after a minute of slow `/api/health`. Check node CPU and the 500m / 512Mi limits. |
| `02-deploy` timeout | Argo CD status and hook logs. |
| Attachment errors | S3 endpoint, bucket, credentials; each `stored_filename` exists in the bucket. |
| AI or cloud provider errors | `OPENROUTER_API_KEY`; OAuth client IDs, secrets, and redirect URIs. |
| SSO fails ("SSO sign-in did not complete" on the sign-in page) | `oauth2-proxy`, the `thoughty-sso` Middleware on the `thoughty-sso-ingress` route, and the `KEYCLOAK_*` values. Local accounts keep working meanwhile. Never trust identity headers alone. |

The worker runs seven loops, never in API pods:

| Loop | Interval | Error log |
|---|---|---|
| Cloud sync | 60s scan, 5s poll | `Failed to process queued cloud sync jobs` |
| Weekly memoir questions and email | 60s | `Weekly memoir email for user <id> failed` (not retried) |
| "On this day" emails (at most one per writer and local day, only on days with past entries) | 60s | `On this day email for user <id> failed: <error name> <SMTP reply code>` (not retried that day); `Sent <n> On this day emails` after a run that sent some |
| Monthly recap emails (on the 1st of each local month, at most one per writer and local month, skipped for a month with no entries and no past memory) | 60s | `Monthly recap email for user <id> failed: <error name> <SMTP reply code>` (not retried that month); `Sent <n> monthly recap emails` after a run that sent some |
| Year in review emails (on January 1 of each local year, at most one per writer and local year, skipped for a year with no entries) | 60s | `Year in review email for user <id> failed: <error name> <SMTP reply code>` (not retried that year); `Sent <n> year in review emails` after a run that sent some |
| Writing reminder emails (each local day at the writer's hour, at most one per writer and local day, skipped on a day that already has an entry) | 60s | `Writing reminder email for user <id> failed: <error name> <SMTP reply code>` (not retried that day); `Sent <n> writing reminder emails` after a run that sent some (the diaries' own reminders, rows of `diary_writing_reminders`, run in the same worker right after and are counted in it; their failures log `Diary writing reminder email for user <id> failed: …`) |
| Time capsules (opened at their local day and hour, emailed once to a verified address; capsules in the recycle bin wait until restored) | 60s | `Time capsule email for user <id> failed: <error name> <SMTP reply code>` (the capsule is open; the email is not retried); `Sent <n> time capsule emails` after a run that sent some |
| Recycle-bin purge (deleted over 30 days, with files) | hourly | `Failed to empty expired recycle bin entries` |
| Account purge (accounts deleted over `ACCOUNT_PURGE_AFTER_DAYS`, default 30), after removing expired sign-up requests and account activity older than a year | hourly | `Failed to purge deleted account <id>` (retried next run); `Failed to remove expired sign-up requests` or `Failed to remove account activity events older than a year` (the account purge still runs); `Removed <n> expired sign-up requests`, `Removed <n> account activity events older than a year` |

A sync lease older than 15 minutes is requeued on the next scan, or failed after 3 attempts. Inspect before changing data:

```sql
select id, provider, status, attempt_count, locked_at, last_error
from cloud_sync_jobs order by updated_at desc limit 20;
select user_id, next_delivery_at from memoir_programs
where status = 'active' and next_delivery_at <= now() limit 20;
select user_id, next_send_at, last_sent_on from on_this_day_emails
where enabled and next_send_at <= now() limit 20;
select user_id, next_send_at, last_sent_on from monthly_recap_emails
where enabled and next_send_at <= now() limit 20;
select user_id, next_send_at, last_sent_on from year_review_emails
where enabled and next_send_at <= now() limit 20;
select tc.id, tc.user_id, tc.open_at from time_capsules tc join entries e on e.id = tc.entry_id
where tc.opened_at is null and tc.open_at <= now() and e.deleted_at is null limit 20;
```

Memoir, "On this day", monthly recap, year in review, writing reminder or time capsule rows that stay due mean the worker is down or failing (rows of deleted accounts stay due until the account purge removes them, and are never sent). The opt-in email logs carry only the user ID, never the address or entry text; an SMTP error's message is left out because it can quote the address. A capsule opens within a minute of its time, and the journal list shows it open from the next read on every API replica.

## Email Delivery

Production needs working SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`, in Vault `apps/thoughty/app`) for local accounts: sign-up is verify-first and only an emailed link creates the account ([Security](./security.md#authentication-and-sessions)), and password reset, verification resends and email 2FA send mail too. Without it, `POST /api/auth/register` answers `503 EMAIL_DELIVERY_NOT_CONFIGURED` for every address and the sign-up page shows "Email delivery is not set up on this server."; SSO, Google sign-in and existing accounts keep working. Outside production (`NODE_ENV` other than `production`) a server without SMTP signs new accounts in at once instead, for development.

Production sends through **Resend**, the provider Swirl Cloud and Odoo already use, by its SMTP relay with the existing SMTP code (no Resend SDK; Resend's HTTP API is the fallback only if the relay cannot work). The owner sets these in Vault `apps/thoughty/app`; the `thoughty-app` External Secret copies them into the pods' secret within its hour (`refreshInterval: 1h`), and the API and the worker read it at start, so restart both once the secret shows the new values (`kubectl rollout restart deployment/thoughty-server deployment/thoughty-cloud-sync-worker -n apps`). Agents cannot set or deploy them:

| Key | Value |
| --- | --- |
| `SMTP_HOST` | `smtp.resend.com` |
| `SMTP_PORT` | `587` (STARTTLS; the seeded value) or `465` (implicit TLS): Resend serves both and the API supports both. It reads the port as a number and uses implicit TLS on 465 only; a value that is not a port number from 1 to 65535 turns email delivery off, with `SMTP_PORT is not a port number from 1 to 65535: email delivery is off` in the API and worker logs |
| `SMTP_USER` | `resend` |
| `SMTP_PASS` | a Resend API key with **Sending access** only, restricted to the sending domain; it is a secret and lives only in Vault, never in a ConfigMap, `infra/onboarding.json` or the repository |
| `SMTP_FROM` | the sender, e.g. `Thoughty <name@domain>`, on a domain verified in Resend (SPF and DKIM records in its DNS); mail from an unverified domain is refused |

The Contact page's form (`POST /api/contact`) emails each message, as plain text with the visitor as reply-to, to `CONTACT_EMAIL`, a non-secret setting in the `thoughty-config` ConfigMap (`contact@swirlit.dev` in `infra/k8s/base/configmap.yaml` and the Swirl Cloud overlay; the API uses that address too when the setting is unset or blank). It goes through the same SMTP settings and nothing is stored, so a message the mail server refused is lost: the visitor sees "Your message could not be sent" (`502 CONTACT_NOT_SENT`) and the API logs `Contact message not sent: <error name> <SMTP reply code>`. Without SMTP, or with a `CONTACT_EMAIL` that is not an address (logged at start as `CONTACT_EMAIL is not an email address: the Contact form is off`), the form answers `503 CONTACT_NOT_CONFIGURED`. To change the inbox, edit the ConfigMap and restart the API.

To check, register a new local account on production (or ask for a password reset) and look for the email and for the `… email not sent` lines below; Resend's dashboard lists every message it accepted or refused. A new key: create it in Resend, put it in Vault, restart the API and the worker once the secret has it, then revoke the old one.

The API sends sign-up emails in the background, so a mail server that refuses them does not change the answer. A rollout waits for the emails still being sent before the pod stops ([Deployment](./deployment.md#shutdown)). Look for `Sign-up link email not sent: <error name> <SMTP reply code>` and `Sign-up notice email not sent: …` in the API logs; like the opt-in email logs they never carry the address or the link. A writer who gets no email can ask again from the "check your email" step once a minute (at most five emails per address until its request expires after 24 hours). Pending sign-ups are in `sign_up_requests`; a row without a `token_hash` belongs to an address that already has an account:

```sql
select email, token_hash is not null as pending, sent_count, last_sent_at, expires_at
from sign_up_requests order by last_sent_at desc limit 20;
```

## Backup and Recovery

| Objective | Target |
|---|---|
| RPO | 15 minutes for PostgreSQL; 1 hour for attachments |
| RTO | 4 hours |
| Retention | 35 daily dumps, 7 days of WAL, 35 days of attachment versions |
| Drills | quarterly, outside production |

The `postgres-backup` CronJob runs at 02:15 UTC. It uploads `base/thoughty-postgres-<timestamp>.dump` and `.sha256` to `POSTGRES_BACKUP_BUCKET` and never prunes, so set lifecycle rules. Standalone also uploads WAL to `wal/` every minute. Production PostgreSQL point-in-time recovery belongs to the platform. Attachment buckets need versioning, encryption, and delete protection. Keep `CONFIG_ENCRYPTION_SECRET` restorable on its own.

Enable production backups: fill `apps/thoughty/backup`, set `POSTGRES_BACKUP_*` in `configmap-patch.yaml`, remove `suspend: true` from `postgres-backup-patch.yaml`, commit, then test with `kubectl create job --from=cronjob/postgres-backup backup-test -n apps`.

Restore:

1. Stop the worker if data loss can spread; its purge deletes for good. Commit `replicas: 0`, because self-heal reverts `kubectl scale`.
2. Pick a restore point and the matching attachment versions.
3. Download the dump as `thoughty-postgres.dump` (the name the checksum expects) and run `sha256sum -c`.
4. Restore into an isolated database: `pg_restore --no-owner --no-acl -d <db> thoughty-postgres.dump`.
5. Restore attachments and secrets. Run migrations if needed.
6. Compare row counts (`users`, `entries`, `entry_revisions`, `attachments`) and download three attachments.
7. Switch workloads to the restored data only after that passes. Rotate exposed credentials.
8. Record the timeline, restore point, data loss, and evidence.

Follow-ups: automate the attachment inventory check, alert on missed backups and WAL failures, and decide on a cross-region standby.
