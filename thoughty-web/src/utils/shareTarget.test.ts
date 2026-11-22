import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SHARED_CONTENT_STORAGE_KEY,
  captureSharedContent,
  sharedContentFrom,
  takeSharedContent,
} from './shareTarget';

const params = (values: Record<string, string>) => new URLSearchParams(values);

describe('sharedContentFrom', () => {
  it('puts the link on a line of its own after the text, and the title on one line as the title', () => {
    expect(sharedContentFrom(params({ title: '  Tide\n tables ', text: ' High tide at 6 ', url: 'https://example.org/tides' })))
      .toEqual({ title: 'Tide tables', text: 'High tide at 6\nhttps://example.org/tides' });
  });

  it('keeps the link once when the text already holds it, and alone when there is no text', () => {
    expect(sharedContentFrom(params({ text: 'Read this https://example.org/a', url: 'https://example.org/a' })))
      .toEqual({ title: '', text: 'Read this https://example.org/a' });
    expect(sharedContentFrom(params({ url: 'https://example.org/b' }))).toEqual({ title: '', text: 'https://example.org/b' });
  });

  it('writes a title shared alone as the text, and gives nothing for nothing shared', () => {
    expect(sharedContentFrom(params({ title: 'Just a thought' }))).toEqual({ title: '', text: 'Just a thought' });
    expect(sharedContentFrom(params({ title: ' ', text: '\n', url: '' }))).toBeNull();
    expect(sharedContentFrom(params({}))).toBeNull();
  });

  it('cuts the title and the text to what an entry holds', () => {
    const shared = sharedContentFrom(params({ title: 't'.repeat(300), text: 'x'.repeat(60_000) }));
    expect(shared?.title).toHaveLength(200);
    expect(shared?.text).toHaveLength(50_000);
  });
});

describe('captureSharedContent', () => {
  beforeEach(() => sessionStorage.clear());

  it('keeps what was shared in the tab and moves to the journal on the share target', () => {
    const history = { replaceState: vi.fn() };
    captureSharedContent({ pathname: '/share-target/', search: '?title=Tides&text=High+tide' }, history);

    expect(JSON.parse(sessionStorage.getItem(SHARED_CONTENT_STORAGE_KEY) ?? 'null')).toEqual({ title: 'Tides', text: 'High tide' });
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/journal');
  });

  it('leaves every other address alone, and opens the journal with nothing kept when nothing was shared', () => {
    const history = { replaceState: vi.fn() };
    captureSharedContent({ pathname: '/journal', search: '?text=Hello' }, history);
    expect(history.replaceState).not.toHaveBeenCalled();

    captureSharedContent({ pathname: '/share-target', search: '' }, history);
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/journal');
    expect(sessionStorage.getItem(SHARED_CONTENT_STORAGE_KEY)).toBeNull();
  });

  it('still opens the journal when the storage refuses what was shared, or there is none', () => {
    const history = { replaceState: vi.fn() };
    const refusing = { setItem: vi.fn(() => { throw new Error('QuotaExceededError'); }) } as unknown as Storage;
    captureSharedContent({ pathname: '/share-target', search: '?text=Hello' }, history, refusing);
    captureSharedContent({ pathname: '/share-target', search: '?text=Hello' }, history, null);
    expect(history.replaceState).toHaveBeenCalledTimes(2);
  });
});

describe('takeSharedContent', () => {
  beforeEach(() => sessionStorage.clear());

  it('gives what was shared once', () => {
    sessionStorage.setItem(SHARED_CONTENT_STORAGE_KEY, JSON.stringify({ title: 'Tides', text: 'High tide' }));
    expect(takeSharedContent()).toEqual({ title: 'Tides', text: 'High tide' });
    expect(takeSharedContent()).toBeNull();
  });

  it('drops what is not shared content, cut to what an entry holds', () => {
    for (const stored of ['not json', 'null', '{"title":1,"text":"x"}', '{"title":"","text":"  "}']) {
      sessionStorage.setItem(SHARED_CONTENT_STORAGE_KEY, stored);
      expect(takeSharedContent()).toBeNull();
      expect(sessionStorage.getItem(SHARED_CONTENT_STORAGE_KEY)).toBeNull();
    }
    sessionStorage.setItem(SHARED_CONTENT_STORAGE_KEY, JSON.stringify({ title: 't'.repeat(250), text: 'x'.repeat(50_010) }));
    const shared = takeSharedContent();
    expect(shared?.title).toHaveLength(200);
    expect(shared?.text).toHaveLength(50_000);
  });

  it('gives nothing when the storage cannot be read', () => {
    const refusing = { getItem: vi.fn(() => { throw new Error('SecurityError'); }) } as unknown as Storage;
    expect(takeSharedContent(refusing)).toBeNull();
    expect(takeSharedContent(null)).toBeNull();
  });

  it('reads nothing where the browser refuses the tab storage', () => {
    const spy = vi.spyOn(globalThis, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('SecurityError'); });
    expect(takeSharedContent()).toBeNull();
    spy.mockRestore();
  });
});
