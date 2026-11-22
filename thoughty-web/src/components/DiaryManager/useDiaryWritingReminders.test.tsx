import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../../test/queryClient';
import { useDiaryWritingReminders } from './useDiaryWritingReminders';

const service = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));
vi.mock('../../utils/timeZone', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../utils/timeZone')>()),
    browserTimeZone: () => 'Asia/Tokyo',
}));

const reminders = (entries: Array<[number, number]>, emailAvailable = true) => ({
    reminders: entries.map(([diaryId, deliveryHour]) => ({ diaryId, deliveryHour, timeZone: 'Europe/Paris', nextSendAt: '2026-11-23T06:00:00.000Z' })),
    emailAvailable,
});

function renderReminders() {
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    return renderHook(() => useDiaryWritingReminders(), { wrapper });
}

describe('useDiaryWritingReminders', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        service.list.mockResolvedValue({ data: reminders([[2, 7]]), error: null });
    });

    it('reads each diary’s own hour, and saves one with the browser’s zone, keeping what the server answers', async () => {
        service.save.mockResolvedValue({ data: reminders([[2, 7], [4, 20]], false), error: null });
        const { result } = renderReminders();

        await waitFor(() => expect(result.current.reminders).toEqual({ hours: { 2: 7 }, emailAvailable: true }));
        await act(() => result.current.save(4, 20));

        expect(service.save).toHaveBeenCalledWith(4, { deliveryHour: 20, timeZone: 'Asia/Tokyo' });
        await waitFor(() => expect(result.current.reminders).toEqual({ hours: { 2: 7, 4: 20 }, emailAvailable: false }));
    });

    it('rejects with the API’s reason, or its own key, when a save fails, and stays unknown when the list cannot load', async () => {
        service.list.mockResolvedValue({ data: null, error: 'diaryReminderLoadFailed' });
        const { result } = renderReminders();

        service.save.mockResolvedValueOnce({ data: null, error: 'apiError_DIARY_NOT_FOUND' });
        await expect(result.current.save(9, 7)).rejects.toThrow('apiError_DIARY_NOT_FOUND');
        service.save.mockResolvedValueOnce({ data: null, error: null });
        await expect(result.current.save(9, null)).rejects.toThrow('diaryReminderSaveFailed');
        await waitFor(() => expect(service.list).toHaveBeenCalled());
        expect(result.current.reminders).toBeUndefined();
    });
});
