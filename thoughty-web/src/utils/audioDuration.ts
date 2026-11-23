/** How long the duration of a recording may take to read before the consent dialog opens without it. */
const DURATION_TIMEOUT_MS = 1500;

/**
 * The length in seconds of the recording at `url`, read from its metadata; null when it is not known in time (a
 * recording that does not say, such as many browser recordings, one that fails to load, or no `url`).
 */
export function readAudioDuration(url: string | null | undefined, timeoutMs = DURATION_TIMEOUT_MS): Promise<number | null> {
  if (!url || typeof Audio === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const audio = new Audio();
    const finish = (seconds: number | null) => {
      clearTimeout(timer);
      audio.removeEventListener('loadedmetadata', onMetadata);
      audio.removeEventListener('error', onError);
      audio.removeAttribute('src');
      resolve(seconds);
    };
    const onMetadata = () => finish(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null);
    const onError = () => finish(null);
    // Set before the address, so nothing answers before it exists
    const timer = setTimeout(() => finish(null), timeoutMs);
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', onMetadata);
    audio.addEventListener('error', onError);
    audio.src = url;
  });
}
