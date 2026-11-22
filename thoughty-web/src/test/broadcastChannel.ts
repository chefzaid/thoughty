/**
 * Node's `BroadcastChannel` reaches every worker thread of the test run, so the tabs one spec file
 * opens would hear another file's. Each file gets channels of its own instead, which deliver like the
 * browser's: to the other channels of the same name, never back to the sender, after the current task.
 */
class FileBroadcastChannel {
  private static readonly open = new Map<string, Set<FileBroadcastChannel>>();

  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(readonly name: string) {
    const peers = FileBroadcastChannel.open.get(name) ?? new Set<FileBroadcastChannel>();
    peers.add(this);
    FileBroadcastChannel.open.set(name, peers);
  }

  postMessage(data: unknown): void {
    for (const peer of FileBroadcastChannel.open.get(this.name) ?? []) {
      if (peer !== this) setTimeout(() => peer.onmessage?.(new MessageEvent('message', { data })), 0);
    }
  }

  close(): void {
    FileBroadcastChannel.open.get(this.name)?.delete(this);
  }
}

export function installFileBroadcastChannel(): void {
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    value: FileBroadcastChannel,
    writable: true,
    configurable: true,
  });
}
