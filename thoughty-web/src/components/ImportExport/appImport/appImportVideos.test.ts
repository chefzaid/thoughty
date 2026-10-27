// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppImportService } from '../../../services/api/appImportService';
import { captureVideoPoster } from '../../../utils/videoPoster';
import { AppImportError } from './appImportRetries';
import { sendVideo } from './appImportVideos';

vi.mock('../../../utils/videoPoster', () => ({ captureVideoPoster: vi.fn() }));

describe('sendVideo', () => {
  const clip = new File([new Uint8Array(10)], 'clip.mp4', { type: 'video/mp4' });
  const uploadVideo = vi.fn();
  const uploadPoster = vi.fn();
  const service = { uploadVideo, uploadPoster } as unknown as AppImportService;
  const send = (signal = new AbortController().signal) => sendVideo(clip, 12, service, signal, vi.fn());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(captureVideoPoster).mockResolvedValue(new Blob(['jpeg']));
  });

  it('stores the video on its entry, then its poster frame, or the video alone when no frame can be drawn', async () => {
    uploadVideo.mockResolvedValue({ ok: true, data: { id: 9 } });

    await expect(send()).resolves.toBe('attached');
    expect(uploadVideo).toHaveBeenCalledWith(clip, 12);
    expect(uploadPoster).toHaveBeenCalledWith(9, expect.any(Blob));

    vi.mocked(captureVideoPoster).mockResolvedValueOnce(null);
    uploadPoster.mockClear();
    await expect(send()).resolves.toBe('attached');
    expect(uploadPoster).not.toHaveBeenCalled();
  });

  it('reports a video over the limit or refused for its content, and fails on a server error', async () => {
    uploadVideo.mockResolvedValueOnce({ ok: false, status: 413, error: 'too large' });
    await expect(send()).resolves.toBe('tooLarge');

    uploadVideo.mockResolvedValueOnce({ ok: false, status: 400, error: 'not a video' });
    await expect(send()).resolves.toBe('rejected');

    uploadVideo.mockResolvedValue({ ok: false, status: 503, error: 'down' });
    vi.useFakeTimers();
    const failing = expect(send()).rejects.toBeInstanceOf(AppImportError);
    await vi.runAllTimersAsync();
    await failing;
    vi.useRealTimers();
  });

  it('stops quietly when the reader stops the import', async () => {
    const controller = new AbortController();
    uploadVideo.mockImplementation(async () => {
      controller.abort();
      return { ok: false, status: 0, error: 'aborted' };
    });

    await expect(send(controller.signal)).resolves.toBe('stopped');
    expect(uploadPoster).not.toHaveBeenCalled();
  });
});
