# Operations Runbook

How to verify and troubleshoot Thoughty after it is deployed. How it gets deployed is in the [Deployment Guide](./deployment.md).

Commands target production: the `swirl-cloud` profile in the `apps` namespace, with secrets from External Secrets and PostgreSQL shared in `infra`. For the standalone profile, use the `thoughty` namespace, the bundled `deployment/postgres`, and Vault Agent files under `/vault/secrets` instead.

## Runtime Surfaces

| Surface | Location |
|---|---|
| Application | `https://thoughty.swirlit.dev` |
| GitLab project | `https://gitlab.swirlit.dev/swirlit/thoughty` |
| Argo CD | `https://argocd.swirlit.dev/applications/thoughty` |
| SonarQube | `https://sonarqube.swirlit.dev/dashboard?id=swirlit%3Athoughty` |
| Grafana | **Thoughty Overview** dashboard |
| Kibana | **Thoughty — Application Logs** dashboard |

## Health After a Rollout

```bash
kubectl get application thoughty -n infra
kubectl get deployment,pod,ingress,cronjob -n apps | grep thoughty
kubectl get externalsecret -n apps | grep thoughty
kubectl rollout status deployment/thoughty-server -n apps --timeout=120s
kubectl rollout status deployment/thoughty-cloud-sync-worker -n apps --timeout=120s
kubectl rollout status deployment/thoughty-web -n apps --timeout=120s
kubectl exec deployment/thoughty-server -n apps -- wget -qO- http://localhost:3001/api/health
```

Healthy means the expected Argo CD revision is `Synced` and `Healthy`, all three Deployments are available, every External Secret reports `Ready=True`, and `/api/health` returns `{"status":"ok"}`. The public API sits behind Keycloak, so an unauthenticated `curl` of `https://thoughty.swirlit.dev/api/health` returns a login redirect rather than JSON; check health from inside the cluster as above.

## Logs

```bash
kubectl logs deployment/thoughty-server -n apps --tail=200
kubectl logs deployment/thoughty-cloud-sync-worker -n apps --tail=200
kubectl logs deployment/thoughty-web -n apps --tail=200
```

API and worker logs are one JSON object per line. Request logs include `requestId` (taken from `x-request-id` or generated, and echoed in the response header), `method`, `path`, `statusCode`, `latencyMs`, and `userId` when authenticated. They never include request or response bodies, authorization headers, journal content, attachments, AI prompts or responses, or raw reset/verification tokens.

Fluent Bit ships stdout to the shared `kubernetes-logs-*` indices. Use the **Thoughty — Application Logs** Kibana dashboard (API, web, and worker; warnings and errors separated; last 24 hours; 30-second refresh), which the repository provisions with the platform's least-privilege dashboard credential, or the generic **Applications Namespace Logs** dashboard filtered by `app`.

## Metrics and Alerts

`/api/metrics` exposes Prometheus text: process uptime and memory, HTTP request counts and latency sums, database connectivity, cloud sync queue counts by status, the stuck-job count, and `thoughty_feature_usage_total{feature,action,status_family}`. Feature labels come from API route groups, never from user input, so usage can be measured without per-user tracking. Nothing user-identifying is exported.

The platform Prometheus discovers the pod scrape annotations, and Grafana loads the repository's **Thoughty Overview** dashboard from its labeled ConfigMap. Where the Prometheus Operator is available, the optional `infra/k8s/components/monitoring` component adds the `thoughty-alerts` PrometheusRule from [ADR 0015](./adr/0015-observability-baseline.md): API unavailable, high 5xx rate, PostgreSQL connectivity down, worker unavailable, cloud sync failures, and stuck sync jobs.

## Migrations

Argo CD runs the migration hook before rolling out the API and worker. If it fails:

- read the hook job logs and keep them before retrying;
- confirm the External Secrets for the database are `Ready` and the database is reachable;
- confirm the image contains `dist/scripts/migrate.js` and the timestamped migrations;
- inspect the `migrations` table for the last completed version;
- do not restart the worker until the schema matches the deployed code.

To run migrations by hand (standalone: `source /vault/secrets/database && source /vault/secrets/app &&` first):

```bash
kubectl exec deployment/thoughty-server -n apps -- node dist/scripts/migrate.js
```

## Canary Rollouts

With the canary overlay applied (see [Deployment](./deployment.md#canary-infrak8soverlaysswirl-cloud-canary)):

```bash
kubectl rollout status deployment/thoughty-server-canary -n apps --timeout=120s
kubectl rollout status deployment/thoughty-web-canary -n apps --timeout=120s
kubectl get ingressroute thoughty-canary-ingress -n apps
kubectl get traefikservice thoughty-api-rollout thoughty-web-rollout -n apps
```

Smoke-test the canary without shifting traffic. API calls need an authenticated OAuth2 Proxy session; `COOKIE_JAR` is a local cookie file that must never be committed:

```bash
curl --cookie "$COOKIE_JAR" -H 'X-Thoughty-Canary: always' https://thoughty.swirlit.dev/api/health
```

Shift traffic by setting the stable/canary weights (they total 100 and apply per request; API and web are selected independently). Setting the canary weight to `0` stops ordinary canary traffic while the header still reaches it:

```bash
for service in thoughty-api-rollout thoughty-web-rollout; do
  kubectl patch traefikservice "$service" -n apps --type=json \
    -p '[{"op":"replace","path":"/spec/weighted/services/0/weight","value":90},{"op":"replace","path":"/spec/weighted/services/1/weight","value":10}]'
done
```

Persist the intended weights in Git before the next reconciliation. If the canary misbehaves, set its weight to `0`, save logs from both canary Deployments, then remove it with `kubectl delete -k infra/k8s/overlays/swirl-cloud-canary`. Removing the canary restores the stable Ingress routes without touching shared authentication or stable Services.

## Troubleshooting

### Secrets

Missing or wrong secrets show up as startup failures, database authentication errors, provider auth failures, disabled AI features, or token decryption errors. Check `kubectl get externalsecret -n apps` and `kubectl describe externalsecret <name> -n apps` (standalone: list `/vault/secrets` in the pod and test for file presence). Only ever verify presence and variable names; never print values into logs or chat.

### Cloud sync worker

The worker claims due jobs from `cloud_sync_jobs`, holds a renewable lease, and records completion or failure.

```sql
select id, user_id, provider, status, attempt_count, run_at, locked_at, locked_by, last_error
from cloud_sync_jobs order by updated_at desc limit 20;
```

If jobs look stuck, confirm the worker runs the same image as the API, look for `status = 'running'` with an old `locked_at`, and read `last_error` before changing data. Prefer a reviewed recovery script over ad hoc SQL for repeated problems.

### Attachments

Failures can involve PostgreSQL metadata and the object store. Check the S3 endpoint, bucket, region, and credentials; API logs around upload and download; the attachment rows for the affected entry; and whether each `stored_filename` exists in the bucket. `original_filename` is display metadata, never the object key.

### AI and OAuth integrations

AI features need `OPENROUTER_API_KEY` or a personal key saved by the user. Cloud providers need their OAuth client IDs and secrets and redirect URIs that match the deployed URLs. Check API logs for provider HTTP errors, and confirm the UI degrades cleanly when an optional integration is unset.

### Keycloak SSO

An unauthenticated API request should redirect to Keycloak's `swirlit` realm and return to the original URL after login; `GET /api/auth/sso` then exchanges the forwarded Keycloak token for a Thoughty session. If the exchange fails, check the `oauth2-proxy` Deployment, the ForwardAuth Middleware, the issuer, the internal JWKS URL, and the token audience. Never weaken verification or trust identity headers on their own.

## Backup and Recovery

### Objectives

| Objective | Target |
|---|---|
| RPO | 15 minutes for PostgreSQL (WAL archiving or managed PITR); 1 hour for attachments (bucket versioning and replication) |
| RTO | 4 hours for a full restore, including secrets and rollout |
| Retention | 35 daily snapshots plus 7 days of point-in-time logs; attachment versions for at least 35 days |
| Restore drills | Quarterly, in a non-production environment, report kept for 1 year |

### What is protected

- **PostgreSQL** is the source of truth for users, diaries, entries, revisions, settings, sessions, sync jobs, AI chat history and usage, book versions, and attachment metadata. The `postgres-backup` CronJob (`infra/k8s/base/postgres-backup.yaml`) takes a daily custom-format `pg_dump` and uploads it with a SHA-256 checksum; the standalone PostgreSQL also archives WAL through a sidecar. Endpoint, bucket, and prefixes come from the ConfigMap; credentials from `apps/thoughty/backup` (standalone: `secret/thoughty/backup`). The production CronJob stays suspended until those are configured.
- **Attachment blobs** live in S3-compatible storage. The bucket needs versioning, server-side encryption, lifecycle protection against immediate hard deletion, and replication where available.
- **Secrets** must be restorable separately, especially `CONFIG_ENCRYPTION_SECRET`, without which encrypted provider tokens and personal AI keys are unreadable. JWT, refresh, and 2FA secrets must be restorable for controlled recovery and rotatable afterwards.

### Restore procedure

1. Declare the incident and stop the cloud sync worker if corruption, deletion, or replay is possible.
2. Choose the newest safe PostgreSQL restore point and the matching attachment version window.
3. Verify the backup checksum, then restore into an isolated database; never overwrite production in place.
4. Restore or expose the matching attachment versions.
5. Restore secrets, checking presence and names only.
6. Run migrations if the target image needs them.
7. Validate: `/api/health`, the counts below compared with the backup, and at least three sampled attachment downloads.
8. Point the workloads at the restored database and bucket only after validation passes.
9. Rotate credentials if the incident involved exposure or compromise.
10. Write the incident report: timeline, restore point, estimated data loss, validation evidence, and follow-ups.

```sql
select count(*) from users where deleted_at is null;
select count(*) from diaries;
select count(*) from entries;
select count(*) from entry_revisions;
select count(*) from attachments;
select count(*) from cloud_sync_jobs;
select user_id, entry_id, stored_filename from attachments order by updated_at desc limit 20;
```

Every sampled `stored_filename` must exist in the restored bucket. Drills should also export one test user's data through the app and record elapsed time against the RTO and the newest restored write against the RPO.

### Open follow-ups

- Automate the attachment inventory comparison against database metadata.
- Alert on missed backups, failed WAL archiving, and failed restore drills.
- Decide whether production needs a cross-region standby or managed replicas.
