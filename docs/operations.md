# Operations Runbook

How to check and troubleshoot a deployed Thoughty. Deployment itself is in the [Deployment Guide](./deployment.md). Commands target production (`apps`). For standalone, use namespace `thoughty` and the Vault Agent files in `/vault/secrets`.

| Surface | Location |
|---|---|
| Application | `https://thoughty.swirlit.dev` |
| GitLab | `https://gitlab.swirlit.dev/swirlit/thoughty` |
| Argo CD | `https://argocd.swirlit.dev/applications/thoughty` |
| SonarQube | `https://sonarqube.swirlit.dev/dashboard?id=swirlit%3Athoughty` |
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

API and worker logs are JSON lines. Request logs carry `requestId` (also the `x-request-id` response header), `method`, `path`, `statusCode`, `latencyMs`, and `userId`. They never contain bodies, auth headers, journal content, AI text, or tokens. The Kibana dashboard is imported by the `thoughty-kibana-bootstrap` hook.

`/api/metrics` exports request counts and latency, `thoughty_database_up`, `thoughty_cloud_sync_jobs{status}`, `thoughty_cloud_sync_stuck_jobs` (locked over 15 minutes), `thoughty_feature_usage_total` (no user data), and process memory and uptime. Prometheus scrapes the API pods by annotation; the endpoint answers only private-network addresses, so it returns `404` through the public URL. The optional `infra/k8s/components/monitoring` component holds the `thoughty-alerts` PrometheusRule ([ADR 0015](./adr/0015-observability-baseline.md)). Its expressions match the Thoughty pods and Deployments by name, not by namespace, so they work in any namespace. No overlay includes it, because swirl-cloud runs a plain Prometheus without the Prometheus Operator and Argo CD would reject the unknown resource. To alert in production, add the same rules to the platform's Prometheus configuration; on a cluster with the Operator, add the component to the overlay and make sure the API pods are scraped.

## Migrations

Production runs the `thoughty-db-migrate` hook before the rollout. If it fails, save its logs, check that the `thoughty-database` secret is ready and the database reachable, and read the `migrations` table. Do not restart the worker until the schema matches the code.

Run by hand (standalone needs this after every deploy):

```bash
kubectl exec deployment/thoughty-server -n apps -- node dist/scripts/migrate.js
kubectl exec deployment/thoughty-server -n thoughty -- sh -c \
  '. /vault/secrets/database && . /vault/secrets/app && node dist/scripts/migrate.js'
```

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
| SSO fails ("Keycloak sign-in did not complete" on the sign-in page) | `oauth2-proxy`, the `thoughty-sso` Middleware on the `thoughty-sso-ingress` route, and the `KEYCLOAK_*` values. Local accounts keep working meanwhile. Never trust identity headers alone. |

The worker runs six loops, never in API pods:

| Loop | Interval | Error log |
|---|---|---|
| Cloud sync | 60s scan, 5s poll | `Failed to process queued cloud sync jobs` |
| Weekly memoir questions and email | 60s | `Weekly memoir email for user <id> failed` (not retried) |
| "On this day" emails (at most one per writer and local day, only on days with past entries) | 60s | `On this day email for user <id> failed: <error name> <SMTP reply code>` (not retried that day); `Sent <n> On this day emails` after a run that sent some |
| Monthly recap emails (on the 1st of each local month, at most one per writer and local month, skipped for a month with no entries and no past memory) | 60s | `Monthly recap email for user <id> failed: <error name> <SMTP reply code>` (not retried that month); `Sent <n> monthly recap emails` after a run that sent some |
| Recycle-bin purge (deleted over 30 days, with files) | hourly | `Failed to empty expired recycle bin entries` |
| Account purge (accounts deleted over `ACCOUNT_PURGE_AFTER_DAYS`, default 30) | hourly | `Failed to purge deleted account <id>` (retried next run) |

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
```

Memoir, "On this day" or monthly recap rows that stay due mean the worker is down or failing (rows of deleted accounts stay due until the account purge removes them, and are never sent). The opt-in email logs carry only the user ID, never the address or entry text; an SMTP error's message is left out because it can quote the address.

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
