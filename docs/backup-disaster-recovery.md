# Backup and Disaster Recovery Plan

This plan defines the minimum production backup and restore model for Thoughty user data. It covers PostgreSQL journal data, attachment objects, encrypted integration settings, and the secrets needed to make restored data usable.

## Recovery Objectives

| Objective | Target | Notes |
|-----------|--------|-------|
| RPO | 15 minutes for PostgreSQL, 1 hour for attachment objects | PostgreSQL should use WAL archiving or managed point-in-time recovery. Object storage should use versioning plus lifecycle-protected replication. |
| RTO | 4 hours for full service restore | Includes database restore, object-store availability, secret restoration, and application rollout. |
| Restore drill cadence | Quarterly | Run in a non-production namespace or environment using production-shaped data. |
| Backup retention | 35 daily snapshots plus 7 days of point-in-time logs | Longer retention may be required by policy, but shorter retention is not acceptable for production user journals. |

## Data to Protect

### PostgreSQL

PostgreSQL is the source of truth for:

- users, diaries, entries, revisions, tags, settings, refresh tokens, cloud sync jobs, and AI chat history
- attachment metadata, including generated object keys
- encrypted provider tokens stored in settings

Required backup controls:

- automated daily logical or physical snapshots
- continuous WAL archiving, or managed PITR with an equivalent recovery window
- backup encryption at rest
- restore access restricted to operators with production data approval
- restore tests that verify entry counts, user counts, attachment metadata counts, and a sample login-free data integrity query

### Attachment Object Storage

Attachment blobs live outside PostgreSQL in S3-compatible storage.

Required backup controls:

- bucket versioning enabled
- server-side encryption enabled
- lifecycle rules that prevent accidental immediate hard deletion
- cross-zone or cross-region replication for production buckets when available
- periodic inventory or listing comparison against the `attachments.stored_filename` values in PostgreSQL

### Secrets and Encryption Keys

Restored user data may be unreadable without matching secrets.

Required backup controls:

- Vault recovery process documented and tested separately from application restore
- `CONFIG_ENCRYPTION_SECRET` backed up through the secret-management platform
- JWT and refresh secrets restorable for controlled recovery, with a planned rotation option after incident containment
- cloud provider client secrets and S3 credentials restorable or quickly recreatable
- backup material never copied into issue comments, chat, or application logs

## Backup Schedule

| Resource | Cadence | Retention | Owner |
|----------|---------|-----------|-------|
| PostgreSQL base backup or managed snapshot | Daily | 35 days | Platform/operator |
| PostgreSQL WAL/PITR logs | Continuous | 7 days | Platform/operator |
| Attachment bucket versioning | Continuous | 35 days minimum | Platform/operator |
| Attachment inventory check | Daily | 14 reports | Platform/operator |
| Vault/secrets recovery export | Per secret-management policy and after rotation | Current plus previous rotation | Platform/operator |
| Restore drill report | Quarterly | 1 year | Engineering lead |

## Restore Runbook

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

## Restore Validation Queries

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

## Drill Checklist

- Restore a PostgreSQL backup into a non-production namespace.
- Restore or mount a non-production copy of attachment objects.
- Start API with restored secrets and database settings.
- Confirm `/api/health` returns `ok`.
- Run the validation queries above and compare against source backup metadata.
- Download at least three sampled attachments.
- Export one test user's data through the application endpoint.
- Document elapsed time against the RTO and the newest restored write against the RPO.

## Open Follow-Ups

- Automate PostgreSQL backup creation in deployment infrastructure.
- Automate attachment inventory comparison against database metadata.
- Add alerting for missed backups, failed WAL archiving, and failed restore drills.
- Decide whether production requires cross-region standby infrastructure or managed database replicas.
