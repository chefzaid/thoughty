import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OptInEmailSettings } from '../../services/api';
import type { Diary } from '../../types';
import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation, type Language } from '../../utils/translations';
import MonthlyRecapEmailSection from './MonthlyRecapEmailSection';

const service = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));
vi.mock('../../utils/timeZone', () => ({
  browserTimeZone: () => 'Asia/Tokyo',
  timeZoneOptions: (current: string) => [...new Set(['Asia/Tokyo', 'Europe/Paris', 'UTC', current])].sort(),
}));

const settings = (overrides: Partial<OptInEmailSettings> = {}): OptInEmailSettings => ({
  enabled: false,
  deliveryHour: 8,
  timeZone: null,
  diaryId: null,
  nextSendAt: null,
  emailAvailable: true,
  ...overrides,
});
const diaries = [{ id: 4, name: 'Work', icon: '💼' }] as Diary[];

function renderSection(language: Language = 'en') {
  const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MonthlyRecapEmailSection diaries={diaries} isDark={false} language={language} t={t} />
    </QueryClientProvider>,
  );
}

describe('MonthlyRecapEmailSection', () => {
  beforeEach(() => {
    service.get.mockResolvedValue({ data: settings(), error: null });
    service.save.mockImplementation(async (changes) => ({
      data: settings({ ...changes, nextSendAt: changes.enabled ? '2026-10-31T23:00:00.000Z' : null }),
      error: null,
    }));
  });

  afterEach(() => vi.clearAllMocks());

  it('is off by default, turns on in the browser’s zone, and says when the next recap can arrive', async () => {
    renderSection();

    expect(screen.getByRole('region', { name: 'Monthly recap by email' })).toHaveAttribute('id', 'monthly-recap-email');
    const toggle = await screen.findByRole('switch', { name: 'Email me a monthly recap' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/A month with no entries and no memory/)).toBeInTheDocument();

    fireEvent.click(toggle);

    await waitFor(() => expect(service.save).toHaveBeenCalledWith({ enabled: true, deliveryHour: 8, timeZone: 'Asia/Tokyo', diaryId: null }));
    expect(await screen.findByText('Monthly recap emails are on.')).toBeInTheDocument();
    expect(screen.getByText('Next possible recap: Sunday, November 1, 2026 at 8:00 AM.')).toBeInTheDocument();
    expect(screen.getByText(/no AI reads your entries/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Diary'), { target: { value: '4' } });
    await waitFor(() => expect(service.save).toHaveBeenLastCalledWith(expect.objectContaining({ diaryId: 4 })));
    expect(await screen.findByText('Monthly recap email settings saved.')).toBeInTheDocument();
  });

  it('turns off again', async () => {
    service.get.mockResolvedValueOnce({ data: settings({ enabled: true, timeZone: 'UTC' }), error: null });
    renderSection();
    fireEvent.click(await screen.findByRole('switch', { name: 'Email me a monthly recap' }));
    expect(await screen.findByText('Monthly recap emails are off.')).toBeInTheDocument();
  });

  it('says in French when the setting cannot be loaded', async () => {
    service.get.mockResolvedValue({ data: null, error: null });
    renderSection('fr');

    expect(await screen.findByRole('alert')).toHaveTextContent('Le réglage du bilan mensuel n’a pas pu être chargé.');
    expect(screen.getByRole('region', { name: 'Bilan mensuel par e-mail' })).toBeInTheDocument();
  });
});
