# ADR 0009: Apply Layered Rate Limiting for Baseline Abuse Resistance

- Status: Accepted
- Date: 2026-05-27

## Context

Thoughty's authentication and recovery endpoints are public by design. That creates an obvious abuse surface for brute-force attempts, repeated registration abuse, and password-reset spam. A single global limit is not enough because the risk profile of login and forgot-password endpoints is different from ordinary authenticated read traffic.

## Decision

Use layered rate limiting.

- Apply Nest's `ThrottlerGuard` globally through `APP_GUARD`.
- Set a general default limit of `100` requests per `15` minutes.
- Tighten sensitive auth routes with endpoint-specific decorators:
  - register: `5` requests per `15` minutes
  - login: `5` requests per `15` minutes
  - OAuth login: `5` requests per `15` minutes
  - refresh token: `30` requests per `15` minutes
  - forgot password: `3` requests per hour
  - reset password: `3` requests per hour
  - change password: `5` requests per hour
  - delete account: `5` requests per hour

## Rationale

- Public auth flows need stricter protection than authenticated journal browsing.
- Token refresh needs enough headroom for normal clients, while still bounding refresh-token replay loops.
- Password and account deletion routes deserve lower hourly ceilings because failed attempts indicate account takeover pressure.
- The global limit gives broad baseline protection, while endpoint overrides reflect the actual abuse pressure points.
- Using framework-native throttling keeps the implementation small and easy to audit.
- Throttling composes with the separate global JWT guard described in ADR 0008. The application registers both through `APP_GUARD`, so protected routes are both authenticated and rate-limited by default while explicit public routes still inherit throttling unless overridden.

## Consequences

- The product now has explicit abuse controls instead of relying only on password strength and token handling.
- Rate-limit behavior is part of the external API contract for auth flows and should be considered when changing those endpoints.
- The current throttling model is process-local unless a shared throttler storage backend is introduced. In multi-replica deployments, the limit is effectively applied per application instance rather than as a single cluster-wide counter.
- If deployment scale or attack pressure increases, the next step should be shared throttling storage rather than removing the current controls.
