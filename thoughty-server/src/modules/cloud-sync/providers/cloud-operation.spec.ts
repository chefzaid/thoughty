import { BadGatewayException, Logger } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { cloudFetch, withCloudOperation } from './cloud-operation';

describe('cloud operation cancellation', () => {
  afterEach(() => jest.restoreAllMocks());

  it('cancels only the interrupted operation and retains request body/headers', async () => {
    const first = new AbortController();
    const second = new AbortController();
    const calls: RequestInit[] = [];
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      calls.push(init!);
      return new Promise<Response>((resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
        if (calls.length === 2) resolve(new Response('second'));
      });
    });
    const verifyOwnership = jest.fn().mockResolvedValue(undefined);
    const pending = withCloudOperation({ signal: first.signal, verifyOwnership }, () => cloudFetch('https://provider.test/upload', { method: 'POST', body: 'fixture', headers: { 'X-Test': 'kept' } }));
    const rejected = expect(pending).rejects.toThrow('cancelled');
    await Promise.resolve();
    await Promise.resolve();
    const other = withCloudOperation({ signal: second.signal, verifyOwnership }, () => cloudFetch('https://provider.test/upload'));
    await other;
    first.abort();
    await rejected;
    expect(calls[1].signal!.aborted).toBe(false);
    expect(calls[0]).toEqual(expect.objectContaining({ method: 'POST', body: 'fixture', headers: { 'X-Test': 'kept' } }));
  });

  it('refuses a new provider request after losing database ownership', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch');
    await expect(withCloudOperation({ signal: new AbortController().signal,
      verifyOwnership: async () => { throw new Error('lease lost'); } },
    () => cloudFetch('https://provider.test/upload'))).rejects.toThrow('lease lost');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers a 502 when a provider cannot be reached, without the request path', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expectApiError(cloudFetch('https://provider.test/files/secret-file-id'), BadGatewayException, 'CLOUD_PROVIDER_FAILED');
    await expectApiError(withCloudOperation({ signal: new AbortController().signal, verifyOwnership: async () => undefined },
      () => cloudFetch(new Request('https://provider.test/upload'))), BadGatewayException, 'CLOUD_PROVIDER_FAILED');
    expect(logError).toHaveBeenCalledWith('Cloud provider request to provider.test failed: TypeError');
    expect(logError).not.toHaveBeenCalledWith(expect.stringContaining('secret-file-id'));
  });

  it('keeps a manual request\'s own cancellation error', async () => {
    const controller = new AbortController();
    controller.abort();
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('aborted by caller'));

    await expect(cloudFetch('https://provider.test/upload', { signal: controller.signal })).rejects.toThrow('aborted by caller');
  });
});
