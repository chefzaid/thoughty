import type { Writable } from 'node:stream';
import type { ZipSink } from '@/common/utils';

export class DownloadClosedError extends Error {
  constructor() {
    super('The download was closed before the archive was complete');
  }
}

/** Writes to an HTTP response, waiting for the client to catch up and failing once it disconnects. */
export function responseSink(response: Writable): ZipSink {
  return async (chunk) => {
    if (response.destroyed || response.writableEnded) {
      throw new DownloadClosedError();
    }
    if (response.write(chunk)) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const onDrain = () => {
        cleanup();
        resolve();
      };
      const onClose = () => {
        cleanup();
        reject(new DownloadClosedError());
      };
      const cleanup = () => {
        response.off('drain', onDrain);
        response.off('close', onClose);
      };
      response.on('drain', onDrain);
      response.on('close', onClose);
    });
  };
}
