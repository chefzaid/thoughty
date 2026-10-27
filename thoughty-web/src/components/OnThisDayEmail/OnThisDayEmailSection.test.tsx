import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OnThisDayEmailSettings } from '../../services/api';
import type { Diary } from '../../types';
import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation, type Language } from '../../utils/translations';
import OnThisDayEmailSection from './OnThisDayEmailSection';

const service = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));
vi.mock('../../utils/timeZone', () => ({
  browserTimeZone: () => 'Europe/Paris',
  timeZoneOptions: (current: string) => [...new Set(['America/New_York', 'Europe/Paris', 'UTC', current])].sort(),
}));

const settings = (overrides: Partial<OnThisDayEmailSettings> = {}): OnThisDayEmailSettings => ({
  enabled: false,
  deliveryHour: 8,
  timeZone: null,
  diaryId: null,
  nextSendAt: null,
  emailAvailable: true,
  ...overrides,
});
const diaries = [{ id: 4, name: 'Work', icon: '💼' }] as Diary[];

function renderSection(language: Language = 'en', isDark = true) {
  const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <OnThisDayEmailSection diaries={diaries} isDark={isDark} language={language} t={t} />
    </QueryClientProvider>,
  );
}

describe('OnThisDayEmailSection', () => {
  beforeEach(() => {
    service.get.mockResolvedValue({ data: settings(), error: null });
    service.save.mockImplementation(async (changes) => ({
      data: settings({ ...changes, nextSendAt: changes.enabled ? '2026-10-28T07:00:00.000Z' : null }),
      error: null,
    }));
  });

  afterEach(() => vi.clearAllMocks());

  it('is off by default and turns on with the browser’s time zone', async () => {
    renderSection();

    const toggle = await screen.findByRole('switch', { name: 'Email me “On this day”' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByLabelText('Delivery time')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'On this day by email' })).toHaveAttribute('id', 'on-this-day-email');

    fireEvent.click(toggle);

    await waitFor(() => expect(service.save).toHaveBeenCalledWith({ enabled: true, deliveryHour: 8, timeZone: 'Europe/Paris', diaryId: null }));
    expect(await screen.findByText('“On this day” emails are on.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Email me “On this day”' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Time zone')).toHaveValue('Europe/Paris');
    expect(screen.getByText(/^Next possible email: .*2026/)).toBeInTheDocument();
    expect(screen.getByText(/never more than their title and first 200 characters/)).toBeInTheDocument();
  });

  it('saves the hour, time zone and diary as each one changes', async () => {
    service.get.mockResolvedValue({ data: settings({ enabled: true, timeZone: 'UTC', nextSendAt: '2026-10-28T08:00:00.000Z' }), error: null });
    renderSection();

    fireEvent.change(await screen.findByLabelText('Delivery time'), { target: { value: '21' } });
    await waitFor(() => expect(service.save).toHaveBeenLastCalledWith({ enabled: true, deliveryHour: 21, timeZone: 'UTC', diaryId: null }));
    expect(await screen.findByText('“On this day” email settings saved.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'America/New_York' } });
    await waitFor(() => expect(service.save).toHaveBeenLastCalledWith(expect.objectContaining({ deliveryHour: 21, timeZone: 'America/New_York' })));

    const diary = screen.getByLabelText('Diary');
    expect(diary).toHaveDisplayValue('All diaries');
    fireEvent.change(diary, { target: { value: '4' } });
    await waitFor(() => expect(service.save).toHaveBeenLastCalledWith(expect.objectContaining({ diaryId: 4 })));
    expect(screen.getByLabelText('Diary')).toHaveDisplayValue('💼 Work');

    fireEvent.change(screen.getByLabelText('Diary'), { target: { value: '' } });
    await waitFor(() => expect(service.save).toHaveBeenLastCalledWith(expect.objectContaining({ diaryId: null })));

    fireEvent.click(screen.getByRole('switch', { name: 'Email me “On this day”' }));
    expect(await screen.findByText('“On this day” emails are off.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Delivery time')).not.toBeInTheDocument();
  });

  it('warns when email cannot reach the writer, and reports failures', async () => {
    service.get.mockResolvedValue({ data: settings({ emailAvailable: false }), error: null });
    service.save.mockResolvedValueOnce({ data: null, error: 'apiError_DIARY_NOT_FOUND' }).mockResolvedValueOnce({ data: null, error: null });
    renderSection('en', false);

    expect(await screen.findByText(/We can’t email you yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Email me “On this day”' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This diary could not be found.');
    fireEvent.click(screen.getByRole('switch', { name: 'Email me “On this day”' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('The “On this day” email setting could not be saved.'));
  });

  it('says when the setting cannot be loaded', async () => {
    service.get.mockResolvedValue({ data: null, error: 'onThisDayEmailLoadFailed' });
    renderSection('fr');

    expect(screen.getByText('Chargement du réglage de l’e-mail…')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Le réglage de l’e-mail « Ce jour-là » n’a pas pu être chargé.');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
