import { useCallback, useSyncExternalStore } from 'react';
import { recordingTranscriptions, type RecordingTranscription, type RecordingTranscriptions } from '../services/speech/recordingTranscriptions';

/** Where the transcription of the recording `attachmentId` on this device is, following it as it goes; null if none. */
export function useRecordingTranscription(
  attachmentId: number,
  queue: Pick<RecordingTranscriptions, 'stateOf' | 'subscribe'> = recordingTranscriptions,
): RecordingTranscription | null {
  const read = useCallback(() => queue.stateOf(attachmentId), [attachmentId, queue]);
  return useSyncExternalStore(queue.subscribe, read, read);
}
