import type { INestApplication } from '@nestjs/common';

/** The signals that stop the API: Kubernetes sends SIGTERM, a terminal Ctrl+C sends SIGINT. */
export const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const;

/**
 * Stops the API cleanly on a shutdown signal: the workers' destroy hooks, then the emails still in
 * flight (`beforeApplicationShutdown`), then the HTTP server, which finishes the requests in progress,
 * then the database pool and the Redis client (`onApplicationShutdown`), and exits. The exit is
 * explicit because Node runs as PID 1 in the container, where re-raising the signal does nothing.
 */
export function enableGracefulShutdown(app: INestApplication): void {
  app.enableShutdownHooks([...SHUTDOWN_SIGNALS], { useProcessExit: true });
}
