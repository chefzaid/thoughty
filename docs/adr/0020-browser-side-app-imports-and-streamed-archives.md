# ADR 0020: Read Other Apps' Exports in the Browser and Stream the Full Export

- Status: Accepted
- Date: 2026-10-19

## Context

People switching from Day One or Journey bring years of entries with photos and recordings, often several gigabytes in one ZIP file. The ingress accepts at most 10 MB per request, attachments are capped at 5 MB, and JSON bodies at 1 MB outside the import routes. An import also has to survive a closed tab or a lost connection without creating duplicates. In the other direction, a full export with attachments can be larger than the API pod should hold in memory.

## Decision

- **Parse exports in the browser.** The web app reads the ZIP's central directory with `Blob.slice` and inflates one file at a time with the native `DecompressionStream`, so neither the browser nor the server ever holds the whole archive. No third-party ZIP library is added. Day One JSON and Journey's per-entry JSON (with HTML converted to Markdown in an inert `DOMParser` document) are mapped to Thoughty entries client-side.
- **Send small, idempotent batches.** `POST /api/io/import/entries` takes up to 200 entries; each carries its source ID, stored as `entries.import_ref` (`dayone:<uuid>`) with a unique index per user. Entries already imported are returned with their entry ID and attached file names instead of being created again, so running the same import twice continues where it stopped.
- **Upload media separately.** `POST /api/io/import/attachments` takes up to 8 files (about 8 MB) per request, validates every file and entry ownership before storing any, and reuses the attachment allowlist and size limit. Photos over 5 MB, and HEIC or TIFF when the browser can decode them, are re-encoded as JPEG in the browser; videos are left out.
- **Throttle by request, not by file.** Both endpoints have their own `importWrite` limit (300 requests per 15 minutes); the client waits out `429` responses using `Retry-After`.
- **Imported entries are private** whatever the target diary's default, because entries from private journaling apps were never written for an audience.
- **Stream the Markdown export.** `GET /api/io/export?format=zip` writes a ZIP as it goes: one Markdown file per entry (YAML front matter, then the text and links to attachments), with the attachments beside them, fetched from object storage one at a time. The writer is a small store-and-deflate ZIP writer on Node's `zlib` (CRC-32, ZIP64 past 4 GB), and it stops when the client disconnects.

## Consequences

- Imports put no large-body load on the ingress or the API, and nothing outside the entries and their files leaves the device; a stopped import resumes by importing the same file again.
- The browser does the parsing work: very old browsers without `DecompressionStream('deflate-raw')` cannot import ZIP exports.
- Supporting another app means adding a parser in the web app; the import endpoints stay source-agnostic apart from the `source` name in `import_ref`.
- Export memory stays bounded by the entry list plus one attachment, but a full archive holds the HTTP connection for as long as the download takes.
