import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureVideoPoster } from './videoPoster';

/** Just enough of a `<video>` that decodes (or fails to decode) a file. */
class FakeVideo extends EventTarget {
    muted = false;
    playsInline = false;
    preload = '';
    videoWidth = 1920;
    videoHeight = 1080;
    duration = 30;
    seekedTo: number | null = null;
    load = vi.fn();
    removeAttribute = vi.fn();

    constructor(private readonly outcome: 'decodes' | 'fails' | 'hangs') {
        super();
    }

    set src(_url: string) {
        if (this.outcome === 'hangs') return;
        queueMicrotask(() => this.dispatchEvent(new Event(this.outcome === 'decodes' ? 'loadeddata' : 'error')));
    }

    set currentTime(time: number) {
        this.seekedTo = time;
        queueMicrotask(() => this.dispatchEvent(new Event('seeked')));
    }
}

describe('captureVideoPoster', () => {
    const createElement = document.createElement.bind(document);
    let video: FakeVideo;
    let canvas: { width: number; height: number; getContext: ReturnType<typeof vi.fn>; toBlob: ReturnType<typeof vi.fn> };
    const drawImage = vi.fn();
    const revokeObjectURL = vi.fn();

    function stubElements(outcome: 'decodes' | 'fails' | 'hangs', jpeg: Blob | null = new Blob(['jpeg'], { type: 'image/jpeg' })) {
        video = new FakeVideo(outcome);
        canvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => ({ drawImage })),
            toBlob: vi.fn((done: (blob: Blob | null) => void) => done(jpeg)),
        };
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            if (tag === 'video') return video as unknown as HTMLVideoElement;
            if (tag === 'canvas') return canvas as unknown as HTMLCanvasElement;
            return createElement(tag);
        });
    }

    beforeEach(() => {
        drawImage.mockClear();
        revokeObjectURL.mockClear();
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:video'), revokeObjectURL });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('draws the frame a second in, at most 960 pixels wide, as a JPEG', async () => {
        stubElements('decodes');

        const poster = await captureVideoPoster(new Blob(['video'], { type: 'video/mp4' }));

        expect(poster?.type).toBe('image/jpeg');
        expect(video.muted).toBe(true);
        expect(video.seekedTo).toBe(1);
        expect([canvas.width, canvas.height]).toEqual([960, 540]);
        expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 960, 540);
        expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.82);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:video');
        expect(video.load).toHaveBeenCalled();
    });

    it('takes a tenth of a short clip, the first frame of one without a known length, and keeps a small video’s size', async () => {
        stubElements('decodes');
        video.duration = 4;
        video.videoWidth = 640;
        video.videoHeight = 480;
        await captureVideoPoster(new Blob(['video']));
        expect(video.seekedTo).toBeCloseTo(0.4);
        expect([canvas.width, canvas.height]).toEqual([640, 480]);

        stubElements('decodes');
        video.duration = Number.POSITIVE_INFINITY;
        await expect(captureVideoPoster(new Blob(['video']))).resolves.not.toBeNull();
        expect(video.seekedTo).toBeNull();
    });

    it('answers null when the browser cannot decode the video or draw it', async () => {
        stubElements('fails');
        await expect(captureVideoPoster(new Blob(['video']))).resolves.toBeNull();
        expect(revokeObjectURL).toHaveBeenCalled();

        stubElements('decodes');
        video.videoWidth = 0;
        await expect(captureVideoPoster(new Blob(['video']))).resolves.toBeNull();

        stubElements('decodes');
        canvas.getContext.mockReturnValue(null);
        await expect(captureVideoPoster(new Blob(['video']))).resolves.toBeNull();

        stubElements('decodes', null);
        await expect(captureVideoPoster(new Blob(['video']))).resolves.toBeNull();

        stubElements('decodes', new Blob([new Uint8Array(1024 * 1024 + 1)], { type: 'image/jpeg' }));
        await expect(captureVideoPoster(new Blob(['video']))).resolves.toBeNull();
    });

    it('answers null where the page cannot make a video element', async () => {
        vi.spyOn(document, 'createElement').mockImplementation(() => {
            throw new Error('no DOM');
        });

        await expect(captureVideoPoster(new Blob(['video']))).resolves.toBeNull();
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:video');
    });

    it('gives up on a video that never loads', async () => {
        vi.useFakeTimers();
        stubElements('hangs');

        const poster = captureVideoPoster(new Blob(['video']));
        await vi.advanceTimersByTimeAsync(15_000);

        await expect(poster).resolves.toBeNull();
    });
});
