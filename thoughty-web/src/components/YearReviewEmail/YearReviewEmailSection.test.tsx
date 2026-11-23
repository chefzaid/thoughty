import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OptInEmailSettings } from '../../services/api';
import type { Diary } from '../../types';
import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation, type Language } from '../../utils/translations';
import YearReviewEmailSection from './YearReviewEmailSection';

const service = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));
vi.mock('../../utils/timeZone', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/timeZone')>()),
  browserTimeZone: () => 'Asia/Tokyo',
  timeZoneOptions: (current: string) => [...new Set(['Asia/Tokyo', 'Europe/Paris', 'UTC', current])].sort(),
}));

const settings = (overrides: Partial<OptInEmailSettings> = {}): OptInEmailSettings => ({
  enabled: false,
  deliveryHour: 9,
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
      <YearReviewEmailSection diaries={diaries} isDark={false} language={language} t={t} />
    </QueryClientProvider>,
  );
}

describe('YearReviewEmailSection', () => {
  beforeEach(() => {
    service.get.mockResolvedValue({ data: settings(), error: null });
    service.save.mockImplementation(async (changes) => ({
      data: settings({ ...changes, nextSendAt: changes.enabled ? '2027-01-01T00:00:00.000Z' : null }),
      error: null,
    }));
  });

  afterEach(() => vi.clearAllMocks());

  it('is off by default, turns on in the browser’s zone, and says when the next email can arrive', async () => {
    renderSection();

    expect(screen.getByRole('region', { name: 'Year in review by email' })).toHaveAttribute('id', 'year-review-email');
    const toggle = await screen.findByRole('switch', { name: 'Email me my year in review' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/A year with no entries sends nothing/)).toBeInTheDocument();

    fireEvent.click(toggle);

    await waitFor(() => expect(service.save).toHaveBeenCalledWith({ enabled: true, deliveryHour: 9, timeZone: 'Asia/Tokyo', diaryId: null }));
    expect(await screen.findByText('Year in review emails are on.')).toBeInTheDocument();
    expect(screen.getByText('Next possible email: Friday, January 1, 2027 at 9:00 AM.')).toBeInTheDocument();
    expect(screen.getByText(/holds no text from your entries/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Diary'), { target: { value: '4' } });
    await waitFor(() => expect(service.save).toHaveBeenLastCalledWith(expect.objectContaining({ diaryId: 4 })));
    expect(await screen.findByText('Year in review email settings saved.')).toBeInTheDocument();
  });

  it('turns off again', async () => {
    service.get.mockResolvedValueOnce({ data: settings({ enabled: true, timeZone: 'UTC' }), error: null });
    renderSection();
    fireEvent.click(await screen.findByRole('switch', { name: 'Email me my year in review' }));
    expect(await screen.findByText('Year in review emails are off.')).toBeInTheDocument();
  });

  it('says in French when the setting cannot be loaded', async () => {
    service.get.mockResolvedValue({ data: null, error: null });
    renderSection('fr');

    expect(await screen.findByRole('alert')).toHaveTextContent('Le réglage du bilan de l’année n’a pas pu être chargé.');
    expect(screen.getByRole('region', { name: 'Bilan de l’année par e-mail' })).toBeInTheDocument();
  });
});
