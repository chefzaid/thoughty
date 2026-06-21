# ADR 0017: Separate Feature Flags from User Entitlements

- Status: Accepted
- Date: 2026-06-05

## Context

The roadmap includes feature flags, AI paywalls, free trials, and an exception for users who provide their own AI API token. These concerns are related but not identical.

Feature flags control whether code paths are enabled for environments, cohorts, or rollout safety. Entitlements control whether a specific user is allowed to use a paid or limited capability.

## Decision

Treat feature flags and entitlements as separate concepts.

- Feature flags decide whether a capability is globally or gradually available.
- Entitlements decide whether an authenticated user can access a capability.
- Backend enforcement is required for paid or privacy-sensitive features; frontend hiding is only UX.
- AI features should check both infrastructure availability and user entitlement.
- A user's own API key may satisfy entitlement for model usage while still respecting global feature flags and safety limits.
- Trials should be represented with explicit start, end, and status fields rather than inferred only from account age.

## Rationale

- Combining rollout flags and billing/permission state creates confusing authorization rules.
- Backend enforcement prevents users from bypassing paid gates through direct API calls.
- AI usage can create direct third-party cost, so entitlement checks belong near the API boundary.
- Explicit trial state is easier to support, audit, and communicate to users.

## Consequences

- New gated features should define both flag behavior and entitlement behavior.
- The configuration model may need new tables or settings for flags, subscriptions, trials, and user-owned provider keys.
- Generated API contracts should expose enough state for the frontend to explain available/unavailable features without duplicating enforcement logic.
- The initial implementation supports a remote feature flag provider through `FEATURE_FLAG_PROVIDER_URL`, with cached reads and inline fallback flags for local development.
