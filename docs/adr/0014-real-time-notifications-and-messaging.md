# ADR 0014: Choose a Real-Time Notifications and Messaging Model Deliberately

- Status: Proposed
- Date: 2026-06-05

## Context

The roadmap includes private messaging, notifications for comments, likes and follows, and real-time updates for public entries and messages. The current application is request/response oriented and does not run a WebSocket gateway, message broker, or push-notification service.

Real-time features affect frontend state management, backend scaling, authentication, abuse controls, and deployment topology.

## Decision

Do not add ad hoc WebSocket behavior until the notification and messaging model is defined.

The target model should decide:

- whether initial notifications use polling, Server-Sent Events, or WebSockets
- how notification records are stored
- read/unread and dismissal semantics
- private message threading and participant authorization
- delivery guarantees and retry behavior
- whether Redis, Postgres `LISTEN/NOTIFY`, or a broker is needed for multi-replica fan-out
- how real-time connections authenticate and refresh credentials

For the first implementation, prefer persisted notification records and a simple delivery mechanism over ephemeral-only events.

## Rationale

- Users should not lose important notifications because they were offline.
- Persistent records are easier to test, inspect, and backfill than ephemeral events.
- WebSockets may be appropriate later, but they add operational complexity and multi-replica fan-out requirements.
- Private messaging has stronger authorization and abuse requirements than ordinary feed updates.

## Consequences

- Notification persistence should be designed before live delivery.
- The frontend should treat real-time delivery as an acceleration path over persisted state, not as the only source of truth.
- If WebSockets are chosen, Kubernetes ingress, CORS, auth refresh, and horizontal scaling need explicit support.
- Messaging and notifications should receive endpoint-specific rate limits and moderation/reporting hooks.