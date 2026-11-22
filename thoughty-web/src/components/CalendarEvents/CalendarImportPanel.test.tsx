import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation } from '../../utils/translations';
import CalendarImportPanel from './CalendarImportPanel';

const service = vi.hoisted(() => ({ summary: vi.fn(), importFile: vi.fn(), clear: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));
vi.mock('../../utils/timeZone', () => ({ browserTimeZone: () => 'Europe/Paris' }));

const summaryOf = (eventCount: number) => ({
  data: { eventCount, lastImportedAt: eventCount ? '2026-11-22T09:30:00.000Z' : null, limit: 10000 },
  error: null,
});

function renderPanel(language: 'en' | 'fr' = 'en') {
  const client = createTestQueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
  render(<QueryClientProvider client={client}><CalendarImportPanel language={language} theme="dark" t={t} /></QueryClientProvider>);
  return { invalidate };
}

const chooseFile = (file: File) =>
  fireEvent.change(screen.getByLabelText('Choose a calendar file (.ics)'), { target: { files: [file] } });

describe('CalendarImportPanel', () => {
  beforeEach(() => {
    service.summary.mockResolvedValue(summaryOf(0));
  });
  afterEach(() => vi.clearAllMocks());

  it('imports a calendar file in the browser’s zone, says what it read and reloads the calendar', async () => {
    let finish: (value: unknown) => void = () => undefined;
    service.importFile.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { invalidate } = renderPanel();
    expect(await screen.findByText('No calendar imported yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove imported events' })).not.toBeInTheDocument();

    const file = new File(['BEGIN:VCALENDAR'], 'work.ics', { type: 'text/calendar' });
    chooseFile(file);
    expect(await screen.findByRole('status')).toHaveTextContent('Importing work.ics…');
    expect(screen.getByLabelText('Choose a calendar file (.ics)')).toBeDisabled();
    expect(service.importFile).toHaveBeenCalledWith(file, 'Europe/Paris');

    service.summary.mockResolvedValue(summaryOf(42));
    finish({ data: { imported: 42, skippedRecurring: 3, eventCount: 42 }, error: null });
    expect(await screen.findByText('Imported 42 events. 3 repeating events could not be read and were left out.')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['calendar'] });
    expect(await screen.findByText('42 imported events, last imported on November 22, 2026.')).toBeInTheDocument();
  });

  it('says why a file was refused, and says nothing of unreadable repeating events when there are none', async () => {
    service.importFile
      .mockResolvedValueOnce({ data: null, error: 'apiError_CALENDAR_FILE_INVALID' })
      .mockResolvedValueOnce({ data: { imported: 1, skippedRecurring: 0, eventCount: 1 }, error: null });
    const { invalidate } = renderPanel();
    await screen.findByText('No calendar imported yet.');

    chooseFile(new File(['hello'], 'notes.txt'));
    expect(await screen.findByRole('alert')).toHaveTextContent('This file is not a calendar.');
    expect(invalidate).not.toHaveBeenCalled();

    chooseFile(new File(['BEGIN:VCALENDAR'], 'one.ics'));
    expect(await screen.findByRole('status')).toHaveTextContent(/^Imported 1 event\.$/);
  });

  it('removes every imported event once confirmed, in French', async () => {
    service.summary.mockResolvedValue({ data: { eventCount: 1, lastImportedAt: '2026-11-22T09:30:00.000Z', limit: 10000 }, error: null });
    service.clear.mockResolvedValueOnce({ data: null, error: 'calendarClearFailed' }).mockResolvedValueOnce({ data: { success: true }, error: null });
    renderPanel('fr');
    expect(await screen.findByText('1 événement importé, dernier import le 22 novembre 2026.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retirer les événements importés' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Retirer les événements importés ?' });
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(dialog).not.toBeInTheDocument();
    expect(service.clear).not.toHaveBeenCalled();

    const confirm = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retirer les événements importés' }));
      const opened = await screen.findByRole('alertdialog');
      fireEvent.click(within(opened).getByRole('button', { name: 'Retirer les événements importés' }));
    };
    await confirm();
    expect(await screen.findByRole('alert')).toHaveTextContent('Les événements importés n’ont pas pu être retirés.');
    await confirm();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Les événements importés ont été retirés.'));
    expect(service.clear).toHaveBeenCalledTimes(2);
  });

  it('says when the calendar cannot be loaded, and ignores an empty pick', async () => {
    service.summary.mockResolvedValue({ data: null, error: 'calendarEventsLoadFailed' });
    renderPanel();

    expect(await screen.findByText('Your calendar could not be loaded.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Choose a calendar file (.ics)'), { target: { files: [] } });
    expect(service.importFile).not.toHaveBeenCalled();
  });
});
