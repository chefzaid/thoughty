# Operations Runbook

This runbook complements the deployment guide. The deployment guide explains how to roll Thoughty out; this document explains how to verify and troubleshoot the system after it is running.

## Runtime Surfaces

| Surface | Kubernetes workload | Notes |
|---------|---------------------|-------|
| Web | `deployment/thoughty-web` | Nginx serving the built React app |
| API | `deployment/thoughty-server` | NestJS API on port `3001`; exposes `/api/health` |
| Worker | `deployment/thoughty-cloud-sync-worker` | Runs scheduled cloud sync from the server image |
| Database | `deployment/postgres` | PostgreSQL with one persistent volume |

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

The repository does not yet define a complete production backup and disaster recovery implementation. Until ADR 0016 is implemented, treat production readiness as incomplete for long-lived user data.

At minimum, a production deployment should define:

- PostgreSQL backup cadence and retention
- restore testing process
- object-storage backup/versioning policy
- secret backup/rotation process
- recovery time objective (RTO) and recovery point objective (RPO)