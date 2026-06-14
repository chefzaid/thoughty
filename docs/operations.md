# Operations Runbook

This runbook complements the deployment guide. The deployment guide explains how to roll Thoughty out; this document explains how to verify and troubleshoot the system after it is running.

## Runtime Surfaces

| Surface  | Kubernetes workload                     | Notes                                            |
| -------- | --------------------------------------- | ------------------------------------------------ |
| Web      | `deployment/thoughty-web`               | Nginx serving the built React app                |
| API      | `deployment/thoughty-server`            | NestJS API on port `3001`; exposes `/api/health` |
| Worker   | `deployment/thoughty-cloud-sync-worker` | Runs scheduled cloud sync from the server image  |
| Database | `deployment/postgres`                   | PostgreSQL with one persistent volume            |

## First Checks After a Rollout

```bash
kubectl get pods -n thoughty
kubectl get ingress -n thoughty
kubectl rollout status deployment/thoughty-server -n thoughty --timeout=120s
kubectl rollout status deployment/thoughty-cloud-sync-worker -n thoughty --timeout=120s
kubectl rollout status deployment/thoughty-web -n thoughty --timeout=120s
kubectl exec deployment/thoughty-server -n thoughty -- wget -qO- http://localhost:3001/api/health
```

Expected result:

- API replicas are `Ready`.
- Worker is running after database migration has completed.
- Web is serving through the ingress host.
- `/api/health` returns JSON with `status: "ok"`.

## Logs

```bash
kubectl logs deployment/thoughty-server -n thoughty --tail=200
kubectl logs deployment/thoughty-cloud-sync-worker -n thoughty --tail=200
kubectl logs deployment/thoughty-web -n thoughty --tail=200
kubectl logs deployment/postgres -n thoughty --tail=200
```

The current logging model is intentionally modest. For deeper production operations, see ADR 0015 for the proposed observability baseline.

## Migration Troubleshooting

The rollout order should be:

1. deploy or update API
2. wait for API rollout
3. run migrations through the server image
4. deploy or update worker
5. deploy or update web

Manual migration command:

```bash
kubectl exec deployment/thoughty-server -n thoughty -- /bin/sh -c \
  'source /vault/secrets/database && source /vault/secrets/app && npm run db:migrate:dist'
```

If migrations fail:

- check PostgreSQL pod readiness and logs
- verify Vault-injected database secrets exist in the API pod
- verify the server image includes the compiled migration script
- do not start or restart the worker until the schema is compatible with the deployed code
- preserve the failing logs before retrying

## Vault Secret Troubleshooting

Symptoms of missing or incorrect Vault secrets include API startup failures, database authentication errors, cloud provider auth failures, disabled AI features, or token encryption/decryption errors.

Check workload annotations and rendered secret files:

```bash
kubectl describe pod -l app=thoughty-server -n thoughty
kubectl exec deployment/thoughty-server -n thoughty -- ls -la /vault/secrets
kubectl exec deployment/thoughty-server -n thoughty -- /bin/sh -c 'test -f /vault/secrets/database && echo database-secret-present'
kubectl exec deployment/thoughty-server -n thoughty -- /bin/sh -c 'test -f /vault/secrets/app && echo app-secret-present'
```

Do not print secret values into logs or chat. Only verify presence, permissions, and variable names.

## Cloud Sync Worker Troubleshooting

Cloud sync is database-backed. The worker claims due queued jobs, marks them running, and records completion or failure details.

Useful checks:

```bash
kubectl logs deployment/thoughty-cloud-sync-worker -n thoughty --tail=200
kubectl exec deployment/postgres -n thoughty -- /bin/sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select id, user_id, provider, status, attempt_count, run_at, locked_at, locked_by, last_error from cloud_sync_jobs order by updated_at desc limit 20;"'
```

If jobs appear stuck:

- confirm the worker pod is running the same compatible server image as the API
- check whether `locked_at` is old and `status = 'running'`
- inspect `last_error` before changing data
- prefer adding a targeted recovery script over ad hoc SQL updates for repeated recovery needs

## Attachment/Object Storage Troubleshooting

Attachment failures can involve both PostgreSQL metadata and object storage.

Check:

- S3 endpoint, bucket, region, access key, and secret key configuration
- API logs around upload/retrieval endpoints
- attachment metadata rows for the affected user/entry
- whether `stored_filename` exists in the object store

Remember that `original_filename` is display metadata and should not be used as the object key.

## AI and OAuth Integration Checks

AI features depend on `OPENROUTER_API_KEY` and the configured model. Cloud provider integrations depend on provider-specific OAuth client IDs/secrets and valid redirect configuration.

For integration failures:

- verify the relevant environment variables are wired in Vault or build args
- check provider redirect URIs against the deployed frontend/backend URLs
- inspect API logs for provider-specific HTTP errors
- confirm user-facing behavior degrades cleanly when optional integrations are unset

## Backup and Recovery

This plan defines the minimum production backup and restore model for Thoughty user data. It covers PostgreSQL journal data, attachment objects, encrypted integration settings, and the secrets needed to make restored data usable.

### Recovery Objectives

| Objective             | Target                                                   | Notes                                                                                                                                             |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| RPO                   | 15 minutes for PostgreSQL, 1 hour for attachment objects | PostgreSQL should use WAL archiving or managed point-in-time recovery. Object storage should use versioning plus lifecycle-protected replication. |
| RTO                   | 4 hours for full service restore                         | Includes database restore, object-store availability, secret restoration, and application rollout.                                                |
| Restore drill cadence | Quarterly                                                | Run in a non-production namespace or environment using production-shaped data.                                                                    |
| Backup retention      | 35 daily snapshots plus 7 days of point-in-time logs     | Longer retention may be required by policy, but shorter retention is not acceptable for production user journals.                                 |

### Data to Protect

PostgreSQL is the source of truth for users, diaries, entries, revisions, tags, settings, refresh tokens, cloud sync jobs, AI chat history, attachment metadata, and encrypted provider tokens stored in settings.

Required PostgreSQL backup controls:

- automated daily logical or physical snapshots
- continuous WAL archiving, or managed PITR with an equivalent recovery window
- backup encryption at rest
- restore access restricted to operators with production data approval
- restore tests that verify entry counts, user counts, attachment metadata counts, and a sample login-free data integrity query

Attachment blobs live outside PostgreSQL in S3-compatible storage.

Required object-storage backup controls:

- bucket versioning enabled
- server-side encryption enabled
- lifecycle rules that prevent accidental immediate hard deletion
- cross-zone or cross-region replication for production buckets when available
- periodic inventory or listing comparison against the `attachments.stored_filename` values in PostgreSQL

Restored user data may be unreadable without matching secrets.

Required secret recovery controls:

- Vault recovery process documented and tested separately from application restore
- `CONFIG_ENCRYPTION_SECRET` backed up through the secret-management platform
- JWT and refresh secrets restorable for controlled recovery, with a planned rotation option after incident containment
- cloud provider client secrets and S3 credentials restorable or quickly recreatable
- backup material never copied into issue comments, chat, or application logs

### Backup Schedule

| Resource                                   | Cadence                                         | Retention                      | Owner             |
| ------------------------------------------ | ----------------------------------------------- | ------------------------------ | ----------------- |
| PostgreSQL base backup or managed snapshot | Daily                                           | 35 days                        | Platform/operator |
| PostgreSQL WAL/PITR logs                   | Continuous                                      | 7 days                         | Platform/operator |
| Attachment bucket versioning               | Continuous                                      | 35 days minimum                | Platform/operator |
| Attachment inventory check                 | Daily                                           | 14 reports                     | Platform/operator |
| Vault/secrets recovery export              | Per secret-management policy and after rotation | Current plus previous rotation | Platform/operator |
| Restore drill report                       | Quarterly                                       | 1 year                         | Engineering lead  |

### Restore Runbook

1. Declare the incident scope and freeze destructive jobs.
   Stop the cloud sync worker first if corruption, deletion, or replay risk is suspected.

2. Choose the restore point.
   Pick the latest safe PostgreSQL PITR timestamp and the matching attachment object-storage version window.

3. Restore PostgreSQL into an isolated database.
   Do not overwrite production in place until the restored data passes validation.

4. Restore or expose attachment object versions.
   Confirm sampled `stored_filename` values from PostgreSQL exist in the object store.

5. Restore required secrets.
   Verify secret presence and variable names only; do not print values.

6. Run migrations against the restored database if the target application image requires them.
   Use the same migration command documented in `docs/deployment.md`.

7. Validate the restored environment.
   Check `/api/health`, user counts, diary counts, entry counts, attachment metadata counts, and a small sample of attachment downloads.

8. Promote or cut over.
   Point application workloads at the restored database and bucket only after validation passes.

9. Rotate sensitive credentials when needed.
   If secrets were exposed or the incident involved credential compromise, rotate them before reopening normal access.

10. Record the incident report.
    Include timeline, restore point, data loss estimate, validation evidence, follow-up tasks, and owner.

### Restore Validation Queries

Run read-only checks against the restored database:

```sql
select count(*) as users_count from users where deleted_at is null;
select count(*) as diaries_count from diaries;
select count(*) as entries_count from entries;
select count(*) as revisions_count from entry_revisions;
select count(*) as attachments_count from attachments;
select count(*) as cloud_jobs_count from cloud_sync_jobs;
```

For attachment sampling:

```sql
select user_id, entry_id, stored_filename, original_filename
from attachments
order by updated_at desc
limit 20;
```

Every sampled `stored_filename` should exist in the restored object store.

### Drill Checklist

- Restore a PostgreSQL backup into a non-production namespace.
- Restore or mount a non-production copy of attachment objects.
- Start API with restored secrets and database settings.
- Confirm `/api/health` returns `ok`.
- Run the validation queries above and compare against source backup metadata.
- Download at least three sampled attachments.
- Export one test user's data through the application endpoint.
- Document elapsed time against the RTO and the newest restored write against the RPO.

### Open Follow-Ups

- Automate PostgreSQL backup creation in deployment infrastructure.
- Automate attachment inventory comparison against database metadata.
- Add alerting for missed backups, failed WAL archiving, and failed restore drills.
- Decide whether production requires cross-region standby infrastructure or managed database replicas.
