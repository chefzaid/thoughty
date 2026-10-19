import { useCallback, useEffect, useRef, useState } from 'react';

/** Recordings stop on their own before they outgrow the 5 MB attachment limit (about 20 minutes at 32 kbit/s). */
export const MAX_RECORDING_SECONDS = 15 * 60;
const AUDIO_BITS_PER_SECOND = 32_000;
const PREFERRED_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

export type RecorderStatus = 'idle' | 'recording' | 'unavailable';

export interface VoiceRecording {
  readonly file: File;
  readonly url: string;
  /** Length of an in-browser recording; null for an uploaded file. */
  readonly seconds: number | null;
}

function supportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function fileExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

export function isVoiceRecordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && Boolean(globalThis.navigator?.mediaDevices?.getUserMedia);
}

/**
 * Records one voice answer from the microphone. The microphone is released as soon as recording
 * stops, and the preview URL is revoked when the recording is replaced, cleared, or the form unmounts.
 */
export function useVoiceRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState<VoiceRecording | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);
  const urlRef = useRef<string | null>(null);

  const releaseMicrophone = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const replaceRecording = useCallback((next: VoiceRecording | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next?.url ?? null;
    setRecording(next);
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  const start = useCallback(async () => {
    if (!isVoiceRecordingSupported()) {
      setStatus('unavailable');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus('unavailable');
      return;
    }

    const mimeType = supportedMimeType();
    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: AUDIO_BITS_PER_SECOND });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      releaseMicrophone();
      recorderRef.current = null;
      const type = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0] ?? 'audio/webm';
      const blob = new Blob(chunks, { type });
      const file = new File([blob], `memoir-answer.${fileExtension(type)}`, { type });
      replaceRecording({ file, url: URL.createObjectURL(blob), seconds: secondsRef.current });
      setStatus('idle');
    };

    streamRef.current = stream;
    recorderRef.current = recorder;
    secondsRef.current = 0;
    setSeconds(0);
    replaceRecording(null);
    recorder.start();
    setStatus('recording');
    timerRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current >= MAX_RECORDING_SECONDS) stop();
    }, 1000);
  }, [releaseMicrophone, replaceRecording, stop]);

  const clear = useCallback(() => replaceRecording(null), [replaceRecording]);

  useEffect(() => () => {
    if (recorderRef.current) {
      recorderRef.current.onstop = null;
      if (recorderRef.current.state === 'recording') recorderRef.current.stop();
    }
    releaseMicrophone();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, [releaseMicrophone]);

  return { status, seconds, recording, start, stop, clear, setRecording: replaceRecording };
}

export function formatRecordingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
