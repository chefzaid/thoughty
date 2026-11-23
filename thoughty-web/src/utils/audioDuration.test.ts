import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAudioDuration } from './audioDuration';

/** A stand-in for the page's `Audio`, which answers with the metadata or the error the test gives it. */
function fakeAudio(answer: { duration?: number; error?: boolean; silent?: boolean }) {
  class FakeAudio extends EventTarget {
    preload = '';
    duration = Number.NaN;
    removeAttribute = vi.fn();
    set src(_url: string) {
      if (answer.silent) return;
      queueMicrotask(() => {
        if (answer.error) {
          this.dispatchEvent(new Event('error'));
          return;
        }
        this.duration = answer.duration ?? Number.NaN;
        this.dispatchEvent(new Event('loadedmetadata'));
      });
    }
  }
  vi.stubGlobal('Audio', FakeAudio);
}

describe('readAudioDuration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reads the length a recording says it has', async () => {
    fakeAudio({ duration: 42.5 });
    await expect(readAudioDuration('blob:a')).resolves.toBe(42.5);
  });

  it('knows none for no address, a recording that does not say or fails to load, or one too slow to answer', async () => {
    await expect(readAudioDuration(null)).resolves.toBeNull();
    fakeAudio({ duration: Number.POSITIVE_INFINITY });
    await expect(readAudioDuration('blob:a')).resolves.toBeNull();
    fakeAudio({ error: true });
    await expect(readAudioDuration('blob:a')).resolves.toBeNull();

    vi.useFakeTimers();
    fakeAudio({ silent: true });
    const slow = readAudioDuration('blob:a', 100);
    vi.advanceTimersByTime(100);
    await expect(slow).resolves.toBeNull();
  });
});
