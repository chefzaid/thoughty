import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SHARED_CONTENT_STORAGE_KEY } from '../../utils/shareTarget';
import { getTranslation } from '../../utils/translations';
import { takeSharedFiles } from '../../serviceWorker/sharedFilesClient';
import { useShareTargetSeed } from './useShareTargetSeed';

vi.mock('../../serviceWorker/sharedFilesClient', () => ({ takeSharedFiles: vi.fn() }));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const store = (captured: Record<string, unknown>) => sessionStorage.setItem(
  SHARED_CONTENT_STORAGE_KEY,
  JSON.stringify({ title: '', text: '', withFiles: false, notReceived: false, ...captured }),
);
const photo = new File(['jpeg'], 'beach.jpg', { type: 'image/jpeg' });
const program = new File(['MZ'], 'setup.exe', { type: 'application/x-msdownload' });

function seed(ready = true) {
  const shareInto = vi.fn();
  const notify = vi.fn();
  const hook = renderHook(({ isReady }) => useShareTargetSeed({ ready: isReady, shareInto, notify, t }), { initialProps: { isReady: ready } });
  return { shareInto, notify, ...hook };
}

describe('useShareTargetSeed', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(takeSharedFiles).mockReset();
  });

  it('waits for the draft, then fills the composer with what was shared, once', () => {
    store({ title: 'Tides', text: 'High tide' });
    const { shareInto, notify, rerender } = seed(false);
    expect(shareInto).not.toHaveBeenCalled();

    rerender({ isReady: true });
    expect(shareInto).toHaveBeenCalledWith({ title: 'Tides', text: 'High tide' });
    expect(sessionStorage.getItem(SHARED_CONTENT_STORAGE_KEY)).toBeNull();
    expect(takeSharedFiles).not.toHaveBeenCalled();

    rerender({ isReady: false });
    rerender({ isReady: true });
    expect(shareInto).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it('leaves the composer alone when nothing was shared', () => {
    const { shareInto } = seed();
    expect(shareInto).not.toHaveBeenCalled();
  });

  it('attaches the files shared with the text, and names those it cannot attach', async () => {
    vi.mocked(takeSharedFiles).mockResolvedValue([photo, program]);
    store({ text: 'At the beach', withFiles: true });
    const { shareInto, notify } = seed();

    await waitFor(() => expect(shareInto).toHaveBeenCalledWith({ title: '', text: 'At the beach', files: [photo] }));
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/^setup\.exe: This file type is not allowed\./));
  });

  it('shares files without text, and nothing when none of them can be attached', async () => {
    vi.mocked(takeSharedFiles).mockResolvedValue([photo]);
    store({ withFiles: true });
    const first = seed();
    await waitFor(() => expect(first.shareInto).toHaveBeenCalledWith({ title: '', text: '', files: [photo] }));
    first.unmount();

    vi.mocked(takeSharedFiles).mockResolvedValue([program]);
    store({ withFiles: true });
    const second = seed();
    await waitFor(() => expect(second.notify).toHaveBeenCalledTimes(1));
    expect(second.shareInto).not.toHaveBeenCalled();
  });

  it('says when the files did not survive, and still shares the text', async () => {
    vi.mocked(takeSharedFiles).mockResolvedValue([]);
    store({ text: 'At the beach', withFiles: true });
    const { shareInto, notify } = seed();

    await waitFor(() => expect(notify).toHaveBeenCalledWith('The files you shared to Thoughty could not be received. Please share them again.'));
    expect(shareInto).toHaveBeenCalledWith({ title: '', text: 'At the beach', files: [] });
  });

  it('says when the share could not be received at all', () => {
    store({ notReceived: true });
    const { shareInto, notify } = seed();

    expect(notify).toHaveBeenCalledWith('Thoughty could not receive what you shared. Open Thoughty once, then share it again.');
    expect(shareInto).not.toHaveBeenCalled();
  });
});
