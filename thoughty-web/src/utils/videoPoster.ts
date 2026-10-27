/** Widest poster frame drawn; the API takes up to 1 MB and 4096 pixels a side. */
const POSTER_MAX_WIDTH = 960;
const POSTER_QUALITY = 0.82;
const POSTER_MAX_BYTES = 1024 * 1024;
/** A frame this far in is usually past a fade from black, and still within a short clip. */
const POSTER_SEEK_SECONDS = 1;
const POSTER_TIMEOUT_MS = 15_000;

function waitFor(video: HTMLVideoElement, event: 'loadeddata' | 'seeked', signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const done = () => {
            video.removeEventListener(event, done);
            video.removeEventListener('error', failed);
            resolve();
        };
        const failed = () => {
            video.removeEventListener(event, done);
            video.removeEventListener('error', failed);
            reject(new Error('The browser cannot decode this video'));
        };
        video.addEventListener(event, done);
        video.addEventListener('error', failed);
        signal.addEventListener('abort', failed, { once: true });
    });
}

/** Where to take the frame: a second in, or a tenth of the way through a shorter clip. */
function posterTime(duration: number): number {
    if (!Number.isFinite(duration) || duration <= 0) {
        return 0;
    }
    return Math.min(POSTER_SEEK_SECONDS, duration / 10);
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', POSTER_QUALITY));
}

/**
 * Draws a poster frame of a video file in the browser: the video plays muted in a detached
 * `<video>`, is seeked a second in, and that frame is drawn on a canvas at most 960 pixels wide and
 * saved as a JPEG. Answers null when the browser cannot decode the video (an HEVC movie in Firefox,
 * say) or takes too long; the app then shows a generic video icon instead.
 */
export async function captureVideoPoster(file: Blob): Promise<Blob | null> {
    let url: string | null = null;
    let video: HTMLVideoElement | null = null;
    const timeout = new AbortController();
    const timer = globalThis.setTimeout(() => timeout.abort(), POSTER_TIMEOUT_MS);
    try {
        url = URL.createObjectURL(file);
        video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        const loaded = waitFor(video, 'loadeddata', timeout.signal);
        video.src = url;
        await loaded;

        const time = posterTime(video.duration);
        if (time > 0) {
            const seeked = waitFor(video, 'seeked', timeout.signal);
            video.currentTime = time;
            await seeked;
        }
        if (!video.videoWidth || !video.videoHeight) {
            return null;
        }

        const scale = Math.min(1, POSTER_MAX_WIDTH / video.videoWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const context = canvas.getContext('2d');
        if (!context) {
            return null;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const jpeg = await canvasToJpeg(canvas);
        return jpeg && jpeg.size <= POSTER_MAX_BYTES ? jpeg : null;
    } catch {
        return null;
    } finally {
        globalThis.clearTimeout(timer);
        video?.removeAttribute('src');
        video?.load();
        if (url) URL.revokeObjectURL(url);
    }
}
