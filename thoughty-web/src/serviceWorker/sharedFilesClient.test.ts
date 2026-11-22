import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SHARED_FILES_ANSWER_MS, claimSharedFiles, takeSharedFiles } from './sharedFilesClient';
import { TAKE_SHARED_FILES } from './shareTargetProtocol';

/** A message channel whose ports hand messages straight across, as the browser's do between page and worker. */
class FakeChannel {
  static readonly made: FakeChannel[] = [];
  readonly port1 = { onmessage: null as ((event: MessageEvent) => void) | null, close: vi.fn() };
  readonly port2 = { postMessage: (data: unknown) => this.port1.onmessage?.({ data } as MessageEvent) };

  constructor() {
    FakeChannel.made.push(this);
  }
}

/** The worker controlling the page, answering each request with `answer` (none: it never answers). */
function controllerAnswering(answer?: unknown) {
  const postMessage = vi.fn((_message: unknown, [port]: [{ postMessage: (data: unknown) => void }]) => {
    if (answer !== undefined) port.postMessage(answer);
  });
  return { container: { controller: { postMessage } as unknown as ServiceWorker }, postMessage };
}

describe('sharedFilesClient', () => {
  beforeEach(() => {
    FakeChannel.made.length = 0;
    vi.stubGlobal('MessageChannel', FakeChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('asks the worker for the files kept under the id, and gives them to the composer once', async () => {
    const photo = new File(['jpeg'], 'beach.jpg', { type: 'image/jpeg' });
    const { container, postMessage } = controllerAnswering({ files: [photo, 'not a file'] });

    claimSharedFiles('id-1', container);

    expect(postMessage).toHaveBeenCalledWith({ type: TAKE_SHARED_FILES, id: 'id-1' }, [FakeChannel.made[0]?.port2]);
    await expect(takeSharedFiles()).resolves.toEqual([photo]);
    expect(FakeChannel.made[0]?.port1.close).toHaveBeenCalled();
    await expect(takeSharedFiles()).resolves.toEqual([]);
  });

  it('gives none when no worker controls the page, or its answer holds none', async () => {
    claimSharedFiles('id-1', { controller: null });
    await expect(takeSharedFiles()).resolves.toEqual([]);
    claimSharedFiles('id-1', undefined);
    await expect(takeSharedFiles()).resolves.toEqual([]);

    claimSharedFiles('id-2', controllerAnswering(null).container);
    await expect(takeSharedFiles()).resolves.toEqual([]);
    claimSharedFiles('id-3', controllerAnswering({ files: 'beach.jpg' }).container);
    await expect(takeSharedFiles()).resolves.toEqual([]);
  });

  it('stops waiting for a worker that does not answer', async () => {
    vi.useFakeTimers();
    claimSharedFiles('id-1', controllerAnswering().container);
    const files = takeSharedFiles();

    vi.advanceTimersByTime(SHARED_FILES_ANSWER_MS);
    await expect(files).resolves.toEqual([]);
    expect(FakeChannel.made[0]?.port1.close).toHaveBeenCalled();
  });

  it('asks the browser’s own worker by default', async () => {
    const { container, postMessage } = controllerAnswering({ files: [] });
    vi.stubGlobal('navigator', { serviceWorker: container });

    claimSharedFiles('id-9');

    expect(postMessage).toHaveBeenCalledTimes(1);
    await expect(takeSharedFiles()).resolves.toEqual([]);
  });
});
