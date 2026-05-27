# ADR 0008: Establish a Secure-by-Default Authentication and OWASP Baseline

- Status: Accepted
- Date: 2026-05-27

## Context

Thoughty stores personal journal content, attachments, user profile data, password hashes, refresh tokens, and encrypted third-party provider tokens. It also exposes public authentication flows, password recovery, file-serving endpoints, OAuth connections, and cloud-sync integrations.

The security posture therefore needs to be more deliberate than a generic CRUD API, even though the product is not implementing a full enterprise identity platform.

## Decision

Adopt a secure-by-default baseline centered on explicit public-route opt-outs, bearer-token authentication, validated inputs, sanitized user-controlled fields, and careful handling of secrets and recovery flows.

### Authentication model

- Apply JWT authentication globally through `APP_GUARD`.
- Let that global auth guard compose with the separate global throttling guard documented in ADR 0009; both apply at the application boundary rather than replacing one another.
- Allow unauthenticated access only through explicit `@Public()` annotations.
- Use access tokens for request authentication and persisted refresh tokens for session continuation.
- Revoke stored refresh tokens when passwords change, passwords reset, or accounts are deleted.
- Support both local auth and OAuth sign-in, with account linking when an OAuth identity matches an existing email.
- Reject local signup when the email is already registered, including cases where the existing account was first created through OAuth.

### Credential and recovery handling

- Hash local passwords with bcrypt.
- Hash password-reset tokens before storage instead of persisting raw reset secrets.
- Return a generic success message from forgot-password flows to reduce email-enumeration risk.
- Soft-delete accounts and block deleted users from future login or token refresh.

### Input and data handling

- Enforce DTO whitelisting and non-whitelisted field rejection through Nest's global validation pipe.
- Sanitize user-controlled text fields with the XSS sanitizer used by `sanitizeString`.
- Sanitize attachment filenames before file retrieval to reduce path-traversal risk.
- Encrypt cloud provider access and refresh tokens at rest with AES-256-GCM derived from `CONFIG_ENCRYPTION_SECRET`.

### HTTP and platform hardening

- Use Helmet for baseline HTTP hardening.
- Keep CORS explicit and environment-driven.
- Use a deny-by-default API authorization posture, with `/api/health` and selected auth flows marked public on purpose.
- Keep secrets out of source control and expect production secret delivery through Vault-backed environment injection.

## OWASP-Oriented Interpretation

This decision is a practical baseline, not a claim of complete coverage. It directly addresses the most relevant categories for the current product shape.

- Broken access control: global auth guard plus user-scoped repository queries and explicit public-route metadata
- Cryptographic failures: bcrypt for passwords, hashed reset tokens, encrypted cloud provider tokens, secret delivery through environment/Vault
- Injection and XSS risks: DTO validation, sanitization utilities, filename sanitization, and typed query composition through TypeORM/query builders
- Identification and authentication failures: refresh-token revocation, deleted-account blocking, OAuth/local separation, generic forgot-password responses
- Security misconfiguration: Helmet, controlled CORS, explicit route prefixing, and documented secret wiring

## Rationale

- Journal data is sensitive enough that the application should default to protected routes and explicit escape hatches.
- The product needs secure practical controls more than abstract security-framework completeness.
- Soft deletion and token revocation better match the product's account lifecycle than hard-delete-only behavior.
- Cloud provider credentials are materially more sensitive than ordinary preferences and should not be stored as plaintext settings.

## Consequences

- Security-sensitive changes should be reviewed against this ADR instead of being treated as isolated implementation details.
- Public endpoints are architectural exceptions and should remain few and deliberate.
- The current posture is a baseline, not an endpoint. Cluster-wide throttling, deeper auditability, CSP tightening, and broader operational monitoring can still be improved later.
- The application deliberately avoids cookie-session assumptions; bearer tokens in the `Authorization` header remain the primary auth transport.