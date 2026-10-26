import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTranslation } from '../../../utils/translations';
import type { ZipEntry } from '../../../utils/zipReader';
import { AppImportPanel } from './AppImportPanel';
import type { AppExport, ImportedEntry } from './appImportTypes';
import { readAppExport, UnsupportedExportError } from './readAppExport';
import { runAppImport, type AppImportProgress, type AppImportSummary } from './runAppImport';

const service = { importEntries: vi.fn(), uploadAttachments: vi.fn() };

vi.mock('../../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));
vi.mock('./readAppExport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./readAppExport')>()),
  readAppExport: vi.fn(),
}));
vi.mock('./runAppImport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./runAppImport')>()),
  runAppImport: vi.fn(),
}));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' | ')}` : key;

const file: ZipEntry = { name: 'photos/a.jpeg', size: 1, compressedSize: 1, method: 0, encrypted: false, localHeaderOffset: 0 };
const entry = (date: string, mediaCount = 0): ImportedEntry => ({
  sourceId: date,
  date,
  timestamp: Date.parse(date),
  content: 'text',
  tags: [],
  favorite: false,
  journal: 'Journal',
  media: Array.from({ length: mediaCount }, () => ({ name: 'a.jpeg', mimetype: 'image/jpeg', convert: false, file })),
});
const dayOneExport: AppExport = {
  source: 'dayone',
  archive: new Blob(['zip']),
  entries: [entry('2019-04-02', 2), entry('2024-11-30', 1)],
  journals: ['Journal', 'Travel'],
  skippedMedia: 3,
};
const summary: AppImportSummary = {
  imported: 2,
  alreadyImported: 0,
  attached: 3,
  failedFiles: [],
  createdDiaries: ['Travel'],
  stopped: false,
};

function chooseExport(name = 'export.zip', label = 'appImportChoose') {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { files: [new File(['zip'], name)] } });
}

describe('AppImportPanel', () => {
  beforeEach(() => {
    vi.mocked(readAppExport).mockReset();
    vi.mocked(runAppImport).mockReset();
  });

  it('reads an export and shows what it found before importing', async () => {
    vi.mocked(readAppExport).mockResolvedValue(dayOneExport);
    render(<AppImportPanel diaryId={4} diaryName="Notes" language="en" t={t} />);

    chooseExport();

    expect(await screen.findByText('appImportFoundFrom Day One')).toBeInTheDocument();
    expect(screen.getByText('appImportStatEntries').previousSibling).toHaveTextContent('2');
    expect(screen.getByText('appImportStatJournals').previousSibling).toHaveTextContent('2');
    expect(screen.getByText('appImportStatMedia').previousSibling).toHaveTextContent('3');
    expect(screen.getByText('appImportStatSkipped').previousSibling).toHaveTextContent('3');
    expect(screen.getByText('appImportRange April 2, 2019 | November 30, 2024')).toBeInTheDocument();
    expect(screen.getByLabelText('appImportJournalsAsDiaries Journal, Travel')).toBeChecked();
    expect(screen.getByLabelText('appImportIntoDiary Notes')).not.toBeChecked();
  });

  it('runs the import with the chosen destination and reports the result', async () => {
    vi.mocked(readAppExport).mockResolvedValue(dayOneExport);
    let report: (progress: AppImportProgress) => void = () => undefined;
    let finish: (value: AppImportSummary) => void = () => undefined;
    vi.mocked(runAppImport).mockImplementation((_data, _options, _service, onProgress) => {
      report = onProgress;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const onImported = vi.fn();
    render(<AppImportPanel diaryId={4} diaryName="Notes" language="en" onImported={onImported} t={t} />);
    chooseExport();
    fireEvent.click(await screen.findByLabelText('appImportIntoDiary Notes'));

    fireEvent.click(screen.getByRole('button', { name: 'appImportStart' }));

    expect(runAppImport).toHaveBeenCalledWith(dayOneExport, { diaryId: 4, journalsAsDiaries: false }, service, expect.any(Function), expect.any(AbortSignal));
    act(() => report({ phase: 'files', done: 1, total: 3, waitingSeconds: 30 }));
    expect(screen.getByText('appImportProgressFiles 1 | 3')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'appImportProgressFiles 1 | 3' })).toHaveAttribute('value', '1');
    expect(screen.getByText('appImportWaiting 30')).toBeInTheDocument();

    await act(async () => finish(summary));

    expect(screen.getByRole('status')).toHaveTextContent('appImportDone');
    expect(screen.getByText('appImportResultImported').previousSibling).toHaveTextContent('2');
    expect(screen.getByText('appImportResultAttached').previousSibling).toHaveTextContent('3');
    expect(screen.getByText('appImportCreatedDiaries Travel')).toBeInTheDocument();
    expect(onImported).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'appImportAnother' }));
    expect(screen.getByLabelText('appImportChoose')).toBeInTheDocument();
  });

  it('stops a running import and explains how to continue', async () => {
    vi.mocked(readAppExport).mockResolvedValue(dayOneExport);
    vi.mocked(runAppImport).mockImplementation((_data, _options, _service, _onProgress, signal) => new Promise((resolve) => {
      signal.addEventListener('abort', () => resolve({ ...summary, imported: 1, stopped: true }));
    }));
    render(<AppImportPanel language="en" t={t} />);
    chooseExport();
    fireEvent.click(await screen.findByRole('button', { name: 'appImportStart' }));

    fireEvent.click(screen.getByRole('button', { name: 'appImportStop' }));

    expect(await screen.findByText('appImportStopped')).toBeInTheDocument();
  });

  it('lists files that could not be attached and the import error', async () => {
    vi.mocked(readAppExport).mockResolvedValue({ ...dayOneExport, journals: ['Journal'] });
    vi.mocked(runAppImport).mockResolvedValue({
      ...summary,
      createdDiaries: [],
      failedFiles: Array.from({ length: 12 }, (_, index) => ({ name: `clip${index}.heic`, reason: index === 0 ? 'tooLarge' : 'unreadable' })),
    });
    render(<AppImportPanel language="fr" t={t} />);
    chooseExport();

    expect(await screen.findByLabelText('appImportIntoDiary appImportDefaultDiary')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'appImportStart' }));

    expect(await screen.findByText('clip0.heic (appImportReasonTooLarge)')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('appImportMoreFailed_other 2')).toBeInTheDocument();
  });

  it.each([
    ['en', '…and 1 more'],
    ['fr', '…et 1 autre'],
  ] as const)('counts one more failed file in %s', async (language, expected) => {
    vi.mocked(readAppExport).mockResolvedValue(dayOneExport);
    vi.mocked(runAppImport).mockResolvedValue({
      ...summary,
      failedFiles: Array.from({ length: 11 }, (_, index) => ({ name: `clip${index}.heic`, reason: 'unreadable' as const })),
    });
    const translate = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
    render(<AppImportPanel language={language} t={translate} />);
    chooseExport('export.zip', translate('appImportChoose'));

    fireEvent.click(await screen.findByRole('button', { name: translate('appImportStart') }));
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it('shows why an import failed', async () => {
    vi.mocked(readAppExport).mockResolvedValue(dayOneExport);
    vi.mocked(runAppImport).mockRejectedValue(new Error('Diary not found'));
    render(<AppImportPanel language="en" t={t} />);
    chooseExport();
    fireEvent.click(await screen.findByRole('button', { name: 'appImportStart' }));

    expect(await screen.findByText('appImportFailed Diary not found')).toBeInTheDocument();
  });

  it('explains when the file is not an export it knows', async () => {
    vi.mocked(readAppExport).mockRejectedValueOnce(new UnsupportedExportError('nope')).mockRejectedValueOnce(new Error('broken'));
    render(<AppImportPanel language="en" t={t} />);

    chooseExport('notes.txt');
    expect(await screen.findByRole('alert')).toHaveTextContent('appImportUnsupported');

    chooseExport('export.zip');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('appImportReadError'));
  });

  it('cancels a previewed export and disables an empty one', async () => {
    vi.mocked(readAppExport).mockResolvedValue({ ...dayOneExport, entries: [], skippedMedia: 0 });
    render(<AppImportPanel language="en" t={t} />);
    chooseExport();

    expect(await screen.findByRole('button', { name: 'appImportStart' })).toBeDisabled();
    expect(screen.queryByText('appImportStatSkipped')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(screen.getByLabelText('appImportChoose')).toBeInTheDocument();
  });
});
