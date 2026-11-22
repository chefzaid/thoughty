import { afterEach, describe, expect, it, vi } from 'vitest';

import { ALLOWED_ATTACHMENT_TYPES } from '../utils/attachments';
import {
  SHARED_FILES_WINDOW_MS,
  SharedFilesStore,
  answerSharedFilesRequest,
  isSharePost,
  receiveShare,
} from './shareTargetReceiver';
import { TAKE_SHARED_FILES } from './shareTargetProtocol';
import manifestSource from '../../public/site.webmanifest?raw';

const ORIGIN = 'https://thoughty.example';
const photo = () => new File(['jpeg bytes'], 'beach.jpg', { type: 'image/jpeg' });

/** A posted share as the worker sees it; `formData` fails as a body that is not a form does. */
function sharePost(fields: Record<string, string | File | File[]> | null, path = '/share-target') {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) form.append(name, item);
  }
  return {
    method: 'POST',
    url: `${ORIGIN}${path}`,
    formData: fields ? async () => form : async () => Promise.reject(new TypeError('Could not parse content as FormData.')),
  } as unknown as Request;
}

const sequentialIds = () => {
  let next = 0;
  return () => `id-${++next}`;
};

describe('SharedFilesStore', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hands the files over once, and releases the worker then', async () => {
    const store = new SharedFilesStore(sequentialIds());
    const files = [photo()];
    const { id, released } = store.keep(files);

    expect(id).toBe('id-1');
    expect(store.size).toBe(1);
    expect(store.take('id-2')).toEqual([]);
    expect(store.take(id)).toBe(files);
    await expect(released).resolves.toBeUndefined();
    expect(store.take(id)).toEqual([]);
    expect(store.size).toBe(0);
  });

  it('drops files the page never takes once the window has passed', async () => {
    vi.useFakeTimers();
    const store = new SharedFilesStore(sequentialIds());
    const { id, released } = store.keep([photo()]);

    vi.advanceTimersByTime(SHARED_FILES_WINDOW_MS - 1);
    expect(store.size).toBe(1);
    vi.advanceTimersByTime(1);
    await expect(released).resolves.toBeUndefined();
    expect(store.size).toBe(0);
    expect(store.take(id)).toEqual([]);
  });

  it('names each share with an id that cannot be guessed by default', () => {
    const store = new SharedFilesStore();
    const { id } = store.keep([photo()]);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    store.take(id);
  });
});

describe('isSharePost', () => {
  it('takes only a post to the share target on this origin', () => {
    expect(isSharePost(sharePost({}), ORIGIN)).toBe(true);
    expect(isSharePost(sharePost({}, '/share-target/'), ORIGIN)).toBe(true);
    expect(isSharePost(sharePost({}, '/journal'), ORIGIN)).toBe(false);
    expect(isSharePost(new Request(`${ORIGIN}/share-target?text=a`), ORIGIN)).toBe(false);
    expect(isSharePost(sharePost({}), 'https://elsewhere.example')).toBe(false);
  });
});

describe('receiveShare', () => {
  it('sends the page on with the text in its address, cut to what an entry holds', async () => {
    const store = new SharedFilesStore(sequentialIds());
    const { response, released } = await receiveShare(
      sharePost({ title: 'Tide tables', text: 'x'.repeat(50_010), url: 'https://example.org/tides' }),
      store,
      ORIGIN,
    );

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get('Location') ?? '');
    expect(location.origin + location.pathname).toBe(`${ORIGIN}/share-target`);
    expect(location.searchParams.get('title')).toBe('Tide tables');
    expect(location.searchParams.get('text')).toHaveLength(50_000);
    expect(location.searchParams.get('url')).toBe('https://example.org/tides');
    expect(location.searchParams.has('files')).toBe(false);
    expect(store.size).toBe(0);
    await expect(released).resolves.toBeUndefined();
  });

  it('keeps the files for the page under the id its address names, leaving out blank fields and empty parts', async () => {
    const store = new SharedFilesStore(sequentialIds());
    const files = [photo(), new File(['%PDF'], 'ticket.pdf', { type: 'application/pdf' })];
    const { response, released } = await receiveShare(
      sharePost({ title: ' ', text: '', files: [...files, new File([], '', { type: 'application/octet-stream' })] }),
      store,
      ORIGIN,
    );

    const location = new URL(response.headers.get('Location') ?? '');
    expect([...location.searchParams.keys()]).toEqual(['files']);
    expect(location.searchParams.get('files')).toBe('id-1');
    const taken = store.take('id-1');
    expect(taken.map((file) => file.name)).toEqual(['beach.jpg', 'ticket.pdf']);
    await expect(released).resolves.toBeUndefined();
  });

  it('says so when the form cannot be read', async () => {
    const store = new SharedFilesStore(sequentialIds());
    const { response } = await receiveShare(sharePost(null), store, ORIGIN);

    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(`${ORIGIN}/share-target?unreceived=1`);
    expect(store.size).toBe(0);
  });
});

describe('answerSharedFilesRequest', () => {
  it('answers the page on its port with the files, once', () => {
    const store = new SharedFilesStore(sequentialIds());
    const files = [photo()];
    const { id } = store.keep(files);
    const port = { postMessage: vi.fn() } as unknown as MessagePort & { postMessage: ReturnType<typeof vi.fn> };

    expect(answerSharedFilesRequest({ data: { type: TAKE_SHARED_FILES, id }, ports: [port] }, store)).toBe(true);
    expect(port.postMessage).toHaveBeenCalledWith({ files });
    answerSharedFilesRequest({ data: { type: TAKE_SHARED_FILES, id }, ports: [port] }, store);
    expect(port.postMessage).toHaveBeenLastCalledWith({ files: [] });
  });

  it('ignores other messages, and keeps the files for a request without a port', () => {
    const store = new SharedFilesStore(sequentialIds());
    const { id } = store.keep([photo()]);
    const port = { postMessage: vi.fn() } as unknown as MessagePort;

    expect(answerSharedFilesRequest({ data: null, ports: [port] }, store)).toBe(false);
    expect(answerSharedFilesRequest({ data: { type: 'other', id }, ports: [port] }, store)).toBe(false);
    expect(answerSharedFilesRequest({ data: { type: TAKE_SHARED_FILES, id: 4 }, ports: [port] }, store)).toBe(false);
    expect(answerSharedFilesRequest({ data: { type: TAKE_SHARED_FILES, id }, ports: [] }, store)).toBe(false);
    expect(store.size).toBe(1);
  });
});

describe('the manifest’s share target', () => {
  it('posts the text and the files the composer can attach to the address the worker receives', () => {
    const manifest = JSON.parse(manifestSource) as {
      share_target: { action: string; method: string; enctype: string; params: Record<string, unknown> };
    };

    expect(manifest.share_target).toMatchObject({
      action: '/share-target',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: { title: 'title', text: 'text', url: 'url' },
    });
    expect(manifest.share_target.params.files).toEqual([{ name: 'files', accept: [...ALLOWED_ATTACHMENT_TYPES] }]);
  });
});
