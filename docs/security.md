# Security and Privacy Reference

Thoughty stores personal journal content, profile data, attachments, refresh tokens, and encrypted third-party provider tokens. This guide summarizes the current security model for contributors and operators.

## Security Posture Summary

- API routes are protected by default through a global JWT guard.
- Public routes must be explicitly marked with `@Public()`.
- A global throttling guard applies baseline abuse protection, with stricter limits on sensitive auth flows.
- DTO validation uses whitelisting and rejects unexpected fields.
- User-controlled text and attachment filenames are sanitized in relevant flows.
- Passwords are hashed with bcrypt.
- Password reset tokens are hashed before storage.
- Cloud provider tokens are encrypted at rest with AES-256-GCM using `CONFIG_ENCRYPTION_SECRET`.
- Production secrets are expected to come from Vault-backed environment injection.

## Authentication and Sessions

Thoughty uses bearer-token authentication.

```mermaid
sequenceDiagram
    participant User
    participant API
    participant DB as PostgreSQL

    User->>API: Login or OAuth sign-in
    API->>DB: Verify/create user and store refresh token
    API-->>User: Access token + refresh token
    User->>API: API request with Authorization bearer token
    API-->>User: Protected response
    User->>API: Refresh request
    API->>DB: Validate stored refresh token
    API-->>User: New access token
```

Refresh tokens are revoked when sensitive account lifecycle events occur, including password changes, password resets, and account deletion.

## Public Routes

Public routes are exceptions to the default protected API model. They should remain few and deliberate.

Known public route categories include:

- health checks
- signup/login/OAuth entry points
- password recovery entry points
- any explicitly documented public product surface added in the future

When adding a public endpoint, document why it must be public, what throttling applies, and what information it can reveal to unauthenticated callers.

## Rate Limiting

Current limits are documented in ADR 0009:

- general default: `100` requests per `15` minutes
- register: `5` requests per `15` minutes
- login: `5` requests per `15` minutes
- OAuth login: `5` requests per `15` minutes
- refresh token: `30` requests per `15` minutes
- forgot password: `3` requests per hour
- reset password: `3` requests per hour
- change password: `5` requests per hour
- delete account: `5` requests per hour

The current throttling model is process-local. In multi-replica or higher-risk deployments, shared throttling storage should be introduced instead of weakening endpoint limits.

## Secrets

Never commit real secrets. Production-like deployments should provide these through Vault or equivalent secret injection:

- `JWT_SECRET`
- `REFRESH_SECRET`
- `CONFIG_ENCRYPTION_SECRET`
- PostgreSQL credentials
- S3/object-storage access keys
- OpenRouter API key
- OAuth provider client secrets
- SMTP credentials

`CONFIG_ENCRYPTION_SECRET` is especially sensitive because it protects encrypted user integration settings such as cloud provider tokens.

## Attachments

Attachment security relies on both application checks and object-storage configuration.

- Validate MIME types and size limits before storage.
- Store generated object keys separately from original filenames.
- Serve files through application endpoints rather than exposing arbitrary object keys directly.
- Sanitize requested filenames before object retrieval.
- Keep bucket access private unless a future ADR explicitly changes the sharing model.

## AI Privacy

AI features are optional at the infrastructure level. When enabled, relevant journal content may be sent to OpenRouter or the configured model provider for operations such as writing fixes, tag suggestions, mood/tone analysis, and entry-specific chat.

Product and deployment documentation should make this clear to users and operators. Future local-LLM support should be covered by a dedicated ADR because it changes privacy, hosting, and performance assumptions.

## Email Verification Status

The `User` entity includes `emailVerified`, but the backlog still tracks completion of the email verification flow. Do not treat `emailVerified` as a complete production-grade verification system until the verification endpoint, email delivery behavior, and account restrictions are implemented and documented.

## Password Reset Email Behavior

Password reset tokens are hashed before storage and expire after one hour. The forgot-password endpoint intentionally returns a generic success response to reduce email enumeration risk.

In local or misconfigured email environments, the current email service path can fall back to logging the reset URL when SMTP delivery fails. That is useful for development, but production deployments should configure SMTP correctly and treat reset-link logging as sensitive operational output.

## Security Backlog

Important remaining work includes:

- two-factor authentication
- active session management and logout-from-other-devices
- stronger bot/spam protection on public auth forms
- distributed rate limiting for multi-replica deployments
- CSP hardening with nonces instead of unsafe inline behavior
- dependency vulnerability scanning in CI
- structured security audit logging for sensitive actions
- backup and disaster recovery implementation

## Review Checklist for Security-Sensitive Changes

- Does this introduce a new public route?
- Does it expose user-owned journal data, attachments, settings, or provider tokens?
- Does it need endpoint-specific rate limiting?
- Does it preserve user scoping in database queries?
- Does it send journal content to a third party?
- Does it require a new secret or secret-rotation story?
- Does it require an ADR because it changes security or privacy assumptions?
