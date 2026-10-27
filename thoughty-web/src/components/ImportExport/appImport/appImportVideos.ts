import type { AppImportService } from '../../../services/api/appImportService';
import { captureVideoPoster } from '../../../utils/videoPoster';
import { AppImportError, withRetries } from './appImportRetries';

/** How sending one video went: stored, refused as too large or for its content, or stopped by the reader. */
export type VideoUploadOutcome = 'attached' | 'tooLarge' | 'rejected' | 'stopped';

/**
 * Sends one video of an import to its entry, then the poster frame the browser draws from it. A
 * video the API refuses (over its limit, or not the video its name says) is listed in the summary;
 * a frame that cannot be drawn or stored leaves the video with a generic icon.
 */
export async function sendVideo(
  file: File,
  entryId: number,
  service: AppImportService,
  signal: AbortSignal,
  onWait: (seconds: number) => void,
): Promise<VideoUploadOutcome> {
  const result = await withRetries(() => service.uploadVideo(file, entryId), signal, onWait);
  if (!result.ok) {
    if (signal.aborted) {
      return 'stopped';
    }
    if (result.status === 413) {
      return 'tooLarge';
    }
    if (result.status >= 400 && result.status < 500) {
      return 'rejected';
    }
    throw new AppImportError(result.error);
  }
  const poster = await captureVideoPoster(file);
  if (poster) {
    await service.uploadPoster(result.data.id, poster);
  }
  return 'attached';
}
