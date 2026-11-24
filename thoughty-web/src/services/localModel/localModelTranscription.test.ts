import { afterEach, describe, expect, it, vi } from 'vitest';
import { silentWav, testLocalTranscription, transcribeWithLocalModel } from './localModelTranscription';

const settings = { baseUrl: 'http://localhost:8000/v1', model: 'llama3.2', apiKey: '', transcriptionModel: 'Systran/faster-whisper-small' };
const recording = new Blob(['voice'], { type: 'audio/webm' });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function stubFetch(...answers: unknown[]) {
  const fetchMock = vi.fn();
  for (const answer of answers) {
    if (answer instanceof Response) fetchMock.mockResolvedValueOnce(answer);
    else fetchMock.mockRejectedValueOnce(answer);
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('transcribeWithLocalModel', () => {
  it('posts the recording and the model as multipart to the writer’s server, without cookies or redirects', async () => {
    const fetchMock = stubFetch(json({ text: '  Dear sister.  ' }));

    await expect(transcribeWithLocalModel({ ...settings, apiKey: 'k-1' }, recording, 'note.webm')).resolves.toEqual({ data: 'Dear sister.', problem: null });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8000/v1/audio/transcriptions');
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', credentials: 'omit' });
    // The browser sets the multipart boundary itself: no Content-Type of ours
    expect(init.headers).toEqual({ Authorization: 'Bearer k-1' });
    const form = init.body as FormData;
    expect((form.get('file') as File).name).toBe('note.webm');
    expect(form.get('model')).toBe('Systran/faster-whisper-small');
    expect(form.get('response_format')).toBe('json');
  });

  it('sends nothing without a speech-to-text model', async () => {
    const fetchMock = stubFetch();
    await expect(transcribeWithLocalModel({ ...settings, transcriptionModel: '' }, recording, 'note.webm')).resolves.toEqual({
      data: null,
      problem: 'localModelTranscriptionModelRequired',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('names a server with no transcription endpoint, an unknown model, a recording too large and a refused key', async () => {
    const cases: Array<[Response, string]> = [
      [new Response('404 page not found', { status: 404 }), 'localModelNoTranscription'],
      [new Response('Method Not Allowed', { status: 405 }), 'localModelNoTranscription'],
      [json({ detail: "Model 'whisper-9' is not found" }, 404), 'localModelTranscriptionModelNotFound'],
      [json({ error: 'Request Entity Too Large' }, 413), 'localModelRecordingTooLarge'],
      [json({ error: 'unauthorized' }, 401), 'localModelUnauthorized'],
      [json({ error: 'boom' }, 500), 'localModelFailed'],
      [json({ transcript: 'not where it should be' }), 'localModelUnreadable'],
    ];
    for (const [response, problem] of cases) {
      stubFetch(response);
      await expect(transcribeWithLocalModel(settings, recording, 'note.webm')).resolves.toEqual({ data: null, problem });
    }
  });

  it('tells a server that does not allow this site from one that cannot be reached', async () => {
    stubFetch(new TypeError('Failed to fetch'), new Response(null, { status: 200 }));
    await expect(transcribeWithLocalModel(settings, recording, 'note.webm')).resolves.toEqual({ data: null, problem: 'localModelBlocked' });

    stubFetch(new TypeError('Failed to fetch'), new TypeError('Failed to fetch'));
    await expect(transcribeWithLocalModel(settings, recording, 'note.webm')).resolves.toEqual({ data: null, problem: 'localModelUnreachable' });
  });

  it('answers an empty text for a recording with no words in it', async () => {
    stubFetch(json({ text: '   ' }));
    await expect(transcribeWithLocalModel(settings, recording, 'note.webm')).resolves.toEqual({ data: '', problem: null });
  });
});

describe('testLocalTranscription', () => {
  it('sends a second of silence, and says the endpoint works whatever it heard', async () => {
    const fetchMock = stubFetch(json({ text: '' }));

    await expect(testLocalTranscription(settings)).resolves.toEqual({ data: true, problem: null });

    const form = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as FormData;
    const file = form.get('file') as File;
    expect(file.name).toBe('thoughty-test.wav');
    expect(file.type).toBe('audio/wav');
  });

  it('says when the server has no transcription endpoint', async () => {
    stubFetch(new Response('404 page not found', { status: 404 }));
    await expect(testLocalTranscription(settings)).resolves.toEqual({ data: null, problem: 'localModelNoTranscription' });
  });
});

describe('silentWav', () => {
  it('is a 16 kHz mono 16-bit WAV of one second', async () => {
    const wav = silentWav();
    const bytes = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(wav);
    });
    const view = new DataView(bytes);
    const text = (offset: number) => String.fromCharCode(...new Uint8Array(view.buffer, offset, 4));
    expect([text(0), text(8), text(36)]).toEqual(['RIFF', 'WAVE', 'data']);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(40, true)).toBe(32_000);
    expect(wav.size).toBe(44 + 32_000);
  });
});
