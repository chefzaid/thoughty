# ADR 0011: Store Attachments as Metadata in PostgreSQL and Blobs in S3-Compatible Object Storage

- Status: Accepted
- Date: 2026-05-27

## Context

Thoughty supports file attachments on entries, including inline preview and later retrieval. Those files are binary payloads with different storage needs than ordinary relational fields. The system also needs local-development parity with production-like behavior, which rules out designs that only work with a single cloud vendor.

## Decision

Split attachment handling into relational metadata plus S3-compatible blob storage.

- Persist attachment metadata in PostgreSQL.
- Store actual file contents in S3-compatible object storage.
- Use MinIO-compatible defaults for local development.
- Keep the storage key separate from the original filename by generating a UUID-based stored filename.
- Load uploaded files in memory during request handling, then write them to object storage after validation.
- Allow only a defined MIME-type allowlist and enforce a `5MB` maximum file size.
- Serve files through the application endpoint and sanitize requested filenames before object retrieval.

## Rationale

- Blob storage is a better fit than relational large-object storage for portability, operational simplicity, and parity between local and deployed environments.
- Metadata still belongs in the database because ownership, entry linkage, MIME type, and created-at information are part of the domain model.
- S3 compatibility keeps the design vendor-neutral enough to work with local MinIO and production object stores.
- Separating original and stored filenames reduces collision risk and prevents the original upload name from becoming the object key.

## Consequences

- Attachment retrieval depends on both database integrity and object-store availability.
- The application becomes responsible for orphan prevention and cleanup behavior across relational and object-storage layers.
- The current model favors small-to-medium entry attachments. Larger media-heavy workflows would likely require different streaming and upload patterns.
- File-type and file-size restrictions are part of the architecture, not only a UI concern.