# ADR 0013: Define Public Social Content and Moderation Before Building Feed Features

- Status: Proposed
- Date: 2026-06-05

## Context

The roadmap includes public feeds, follows, comments, likes, reports, bans, leaderboards, badges, and social sharing of AI chats. Those features change Thoughty from a primarily private journaling product into a mixed private/public platform.

The current `Entry.visibility` field supports `public` and `private`, but the implemented architecture still mostly assumes user-owned private workflows. A social feed introduces new concerns around discovery, moderation, abuse, privacy boundaries, notification volume, and public data retention.

## Decision

Before implementing feed or social interaction features, define a public-content and moderation model as an explicit architecture boundary.

- Treat public/social content as a separate product mode layered on top of journal entries, not as a casual extension of private-entry browsing.
- Keep private entries private by default; public exposure must require explicit user action.
- Model moderation state separately from ordinary entry visibility so content can be public, hidden, reported, under review, or removed without losing original ownership semantics.
- Add report records with reporter, target content, reason, status, reviewer/action metadata, and timestamps.
- Add ban or restriction records separately from the user profile so temporary and permanent enforcement can be audited.
- Define social write surfaces, such as comments and likes, with their own ownership, deletion, and abuse controls.
- Decide whether feed reads use direct relational queries initially or a dedicated projection once scale requires it.

## Rationale

- Public social behavior has a different risk profile than private journaling.
- Moderation state should not be overloaded into `Entry.visibility`; visibility is a user intent, while moderation is platform enforcement.
- Report and enforcement workflows need auditability because they affect user access and content availability.
- A feed feature can start simple, but the ownership and moderation semantics need to be correct from the beginning.

## Consequences

- Feed, follow, comment, like, report, and ban work should not proceed as isolated UI additions.
- New database tables or projections are likely required for reports, follows, comments, likes, and enforcement actions.
- Public API endpoints will need stricter throttling and possibly spam/bot controls.
- Privacy and terms documentation will need updates before public social features are enabled.
- Leaderboards and badges should account for abuse and moderation outcomes rather than counting all activity blindly.