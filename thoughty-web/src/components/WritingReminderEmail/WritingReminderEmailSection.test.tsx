import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OptInEmailSettings } from '../../services/api';
import type { Diary } from '../../types';
import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation, type Language } from '../../utils/translations';
import WritingReminderEmailSection from './WritingReminderEmailSection';

const service = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));
vi.mock('../../utils/timeZone', () => ({
  browserTimeZone: () => 'Asia/Tokyo',
  timeZoneOptions: (current: string) => [...new Set(['Asia/Tokyo', 'Europe/Paris', 'UTC', current])].sort(),
}));

const settings = (overrides: Partial<OptInEmailSettings> = {}): OptInEmailSettings => ({
  enabled: false,
  deliveryHour: 20,
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
      <WritingReminderEmailSection diaries={diaries} isDark={false} language={language} t={t} />
    </QueryClientProvider>,
  );
}

describe('WritingReminderEmailSection', () => {
  beforeEach(() => {
    service.get.mockResolvedValue({ data: settings(), error: null });
    service.save.mockImplementation(async (changes) => ({
      data: settings({ ...changes, nextSendAt: changes.enabled ? '2026-11-22T11:00:00.000Z' : null }),
      error: null,
    }));
  });

  afterEach(() => vi.clearAllMocks());

  it('is off by default, turns on in the browser’s zone, and says when the next reminder can arrive', async () => {
    renderSection();

    expect(screen.getByRole('region', { name: 'Writing reminder by email' })).toHaveAttribute('id', 'writing-reminder-email');
    const toggle = await screen.findByRole('switch', { name: 'Remind me to write by email' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/A day that already has an entry/)).toBeInTheDocument();

    fireEvent.click(toggle);

    await waitFor(() => expect(service.save).toHaveBeenCalledWith({ enabled: true, deliveryHour: 20, timeZone: 'Asia/Tokyo', diaryId: null }));
    expect(await screen.findByText('Writing reminder emails are on.')).toBeInTheDocument();
    expect(screen.getByText('Next possible reminder: Sunday, November 22, 2026 at 8:00 PM.')).toBeInTheDocument();
    expect(screen.getByText(/holds nothing from your journal/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Diary'), { target: { value: '4' } });
    await waitFor(() => expect(service.save).toHaveBeenLastCalledWith(expect.objectContaining({ diaryId: 4 })));
    expect(await screen.findByText('Writing reminder settings saved.')).toBeInTheDocument();
  });

  it('turns off again', async () => {
    service.get.mockResolvedValueOnce({ data: settings({ enabled: true, timeZone: 'UTC' }), error: null });
    renderSection();
    fireEvent.click(await screen.findByRole('switch', { name: 'Remind me to write by email' }));
    expect(await screen.findByText('Writing reminder emails are off.')).toBeInTheDocument();
  });

  it('says in French when the setting cannot be loaded', async () => {
    service.get.mockResolvedValue({ data: null, error: null });
    renderSection('fr');

    expect(await screen.findByRole('alert')).toHaveTextContent('Le réglage du rappel d’écriture n’a pas pu être chargé.');
    expect(screen.getByRole('region', { name: 'Rappel d’écriture par e-mail' })).toBeInTheDocument();
  });
});
