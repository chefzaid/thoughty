import { PassThrough, Writable } from 'node:stream';
import { DownloadClosedError, responseSink } from './response-sink';

describe('responseSink', () => {
  it('writes chunks straight through while the client keeps up', async () => {
    const response = new PassThrough();
    const received: Buffer[] = [];
    response.on('data', (chunk: Buffer) => received.push(chunk));

    await responseSink(response)(Buffer.from('PK'));

    expect(Buffer.concat(received).toString()).toBe('PK');
  });

  it('waits for the client to drain a full buffer', async () => {
    const response = new PassThrough({ highWaterMark: 1 });
    let settled = false;

    const pending = responseSink(response)(Buffer.from('a large chunk')).then(() => {
      settled = true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);

    response.resume();
    await pending;
    expect(settled).toBe(true);
  });

  it('fails when the client disconnects while it waits', async () => {
    const response = new Writable({ highWaterMark: 1, write: () => undefined });

    const pending = responseSink(response)(Buffer.from('chunk'));
    response.destroy();

    await expect(pending).rejects.toBeInstanceOf(DownloadClosedError);
  });

  it('fails at once on a response that is already closed', async () => {
    const response = new PassThrough();
    response.end();

    await expect(responseSink(response)(Buffer.from('chunk'))).rejects.toBeInstanceOf(DownloadClosedError);
  });
});
