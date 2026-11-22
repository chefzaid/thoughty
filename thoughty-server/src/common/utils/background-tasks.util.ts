/**
 * Work a service starts without awaiting it, such as an email sent after the response, kept so
 * that a shutdown can wait for it (`beforeApplicationShutdown`) before the database closes.
 */
export class BackgroundTasks {
  private readonly inFlight = new Set<Promise<void>>();

  /** Keeps `task` in flight until it settles. It handles (logs) its own failure. */
  run(task: Promise<void>): void {
    const tracked = task.finally(() => this.inFlight.delete(tracked));
    this.inFlight.add(tracked);
  }

  /** Resolves once every task in flight, and any started meanwhile, has settled; never rejects. */
  async settled(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.allSettled(this.inFlight);
    }
  }
}
