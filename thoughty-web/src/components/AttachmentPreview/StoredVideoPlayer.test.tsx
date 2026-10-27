import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StoredVideoPlayer from './StoredVideoPlayer';
import type { Attachment } from '../../types';
import { getTranslation } from '../../utils/translations';

const authFetch = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ authFetch }),
}));

const video: Attachment = {
  id: 4,
  original_filename: 'beach.mp4',
  stored_filename: 'video-key.mp4',
  mimetype: 'video/mp4',
  size: 4_000_000,
  poster_filename: 'poster-key.jpg',
};

function file(body: string) {
  return { ok: true, blob: () => Promise.resolve(new Blob([body])) };
}

describe('StoredVideoPlayer', () => {
  const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
  let urls = 0;

  beforeEach(() => {
    urls = 0;
    authFetch.mockReset();
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => `blob:file-${++urls}`), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the poster frame as a play button and fetches the video only when asked to play it', async () => {
    authFetch.mockResolvedValue(file('bytes'));
    const { container } = render(<StoredVideoPlayer attachment={video} isDark t={t} />);

    const play = screen.getByRole('button', { name: 'Play the video beach.mp4' });
    await waitFor(() => expect(play.querySelector('img')).toHaveAttribute('src', 'blob:file-1'));
    expect(play.querySelector('img')).toHaveAttribute('alt', '');
    expect(authFetch).toHaveBeenCalledTimes(1);
    expect(authFetch).toHaveBeenCalledWith('/api/attachments/file/poster-key.jpg');

    await userEvent.click(play);

    await waitFor(() => expect(container.querySelector('video')).toBeInTheDocument());
    expect(authFetch).toHaveBeenLastCalledWith('/api/attachments/file/video-key.mp4');
    const player = container.querySelector('video')!;
    expect(player).toHaveAttribute('src', 'blob:file-2');
    expect(player).toHaveAttribute('poster', 'blob:file-1');
    expect(player).toHaveAttribute('controls');
    expect(player).toHaveAccessibleName('beach.mp4');
    expect(player.querySelector('track')).toHaveAttribute('kind', 'captions');
    expect(screen.getByRole('link', { name: 'Download attachment' })).toHaveAttribute('href', 'blob:file-2');

    fireEvent.error(player);
    expect(screen.getByRole('status')).toHaveTextContent('This browser cannot play this video. Download it to watch it.');
  });

  it('shows a video icon when the video has no poster frame, and can try a failed load again', async () => {
    authFetch.mockResolvedValueOnce({ ok: false, status: 500 }).mockResolvedValueOnce(file('bytes'));
    const french = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
    const { container } = render(
      <StoredVideoPlayer attachment={{ ...video, poster_filename: null }} variant="compact" isDark={false} showDownload={false} t={french} />,
    );

    const play = screen.getByRole('button', { name: 'Lire la vidéo beach.mp4' });
    expect(play.querySelector('img')).toBeNull();
    expect(play.querySelector('svg')).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalled();

    await userEvent.click(play);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('La vidéo beach.mp4 n’a pas pu être chargée.'));

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(container.querySelector('video')).toBeInTheDocument());
    expect(authFetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('says it is loading while the video is fetched', async () => {
    authFetch.mockReturnValue(new Promise(() => undefined));
    render(<StoredVideoPlayer attachment={{ ...video, poster_filename: undefined }} isDark t={t} />);

    await userEvent.click(screen.getByRole('button', { name: 'Play the video beach.mp4' }));

    expect(screen.getByRole('status')).toHaveTextContent('Loading the video beach.mp4…');
    expect(screen.getByRole('button', { name: 'Play the video beach.mp4' })).toBeDisabled();
  });
});
