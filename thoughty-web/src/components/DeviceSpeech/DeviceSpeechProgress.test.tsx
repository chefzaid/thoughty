import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DeviceSpeechProgress from './DeviceSpeechProgress';

const t = (key: string, params?: Record<string, string | number>) => (params ? `${key} ${params.loaded}/${params.total}` : key);

describe('DeviceSpeechProgress', () => {
  it('says each step of a transcription on this device, with a bar while the model downloads', () => {
    const { rerender } = render(<DeviceSpeechProgress step={{ phase: 'queued' }} t={t} />);
    expect(screen.getByRole('status')).toHaveTextContent('deviceSpeechQueued');

    rerender(<DeviceSpeechProgress step={{ phase: 'preparing' }} t={t} />);
    expect(screen.getByRole('status')).toHaveTextContent('deviceSpeechPreparing');

    rerender(<DeviceSpeechProgress step={{ phase: 'downloading', loaded: 40_600_000, total: 0 }} t={t} />);
    expect(screen.getByRole('status')).toHaveTextContent('deviceSpeechDownloading 41/0');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    rerender(<DeviceSpeechProgress step={{ phase: 'downloading', loaded: 40_600_000, total: 81_000_000 }} t={t} />);
    expect(screen.getByRole('progressbar', { name: 'deviceSpeechDownloadLabel' })).toHaveAttribute('max', '81000000');

    rerender(<DeviceSpeechProgress step={{ phase: 'transcribing' }} t={t} />);
    expect(screen.getByRole('status')).toHaveTextContent('deviceSpeechTranscribing');
  });
});
