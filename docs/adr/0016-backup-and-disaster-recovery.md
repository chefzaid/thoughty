# ADR 0016: Define Backup and Disaster Recovery for Journal Data

- Status: Proposed
- Date: 2026-06-05

## Context

Thoughty stores long-lived personal journal data, attachments, account state, encrypted provider configuration, refresh tokens, and cloud sync metadata. A production deployment without tested backups risks permanent user data loss.

The current repository documents deployment and basic verification but does not yet define a complete backup, restore, and disaster recovery model.

## Decision

Before treating a deployment as production-ready for real user journals, define and implement a backup and disaster recovery plan.

The plan should cover:

- PostgreSQL backup cadence, retention, encryption, and storage location
- point-in-time recovery expectations, if supported by the hosting platform
- S3/object-storage backup, versioning, replication, or lifecycle policy
- Vault/secret backup and rotation assumptions
- restore testing cadence
- documented recovery time objective (RTO) and recovery point objective (RPO)
- operator runbooks for database restore, object restore, and partial user recovery

## Rationale

- User exports are valuable but do not replace operator backups.
- PostgreSQL and object storage must be recoverable together because attachments are split between metadata and blobs.
- Untested backups are not reliable backups.
- Recovery objectives force realistic decisions about cost, complexity, and acceptable data loss.

## Consequences

- Production readiness should include restore testing, not only successful deployment.
- Attachment lifecycle changes must consider object-store backup and restore behavior.
- Backup procedures should avoid exposing plaintext secrets or private journal contents unnecessarily.
- Documentation should state the deployment's RTO/RPO honestly.