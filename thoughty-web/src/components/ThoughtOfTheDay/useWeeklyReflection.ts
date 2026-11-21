import { useCallback, useEffect, useState } from 'react';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createReviewService, type WeeklyReflectionState } from '../../services/api';
import { writersToday } from '../../utils/entryDate';

/**
 * The past seven days on the writer's clock and their saved reflection, loaded while `enabled`, and
 * reflecting on them with AI on request. `error` is a translation key.
 */
export function useWeeklyReflection(diaryId: number | null, enabled: boolean) {
  const service = useAuthenticatedService(createReviewService);
  const [week, setWeek] = useState<WeeklyReflectionState | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let active = true;
    setWeek(null);
    setError(null);
    void service.fetchWeek(writersToday(), diaryId).then((result) => {
      if (active) {
        setWeek(result.data);
      }
    });
    return () => {
      active = false;
    };
  }, [service, diaryId, enabled]);

  const reflect = useCallback(async () => {
    if (!week || reading) {
      return;
    }
    setReading(true);
    setError(null);
    const result = await service.reflectOnWeek(week.weekEnd, diaryId);
    setReading(false);
    const reflection = result.data?.reflection;
    if (reflection) {
      setWeek((current) => (current ? { ...current, reflection } : current));
    } else {
      setError(result.error ?? 'weeklyReflectionError');
    }
  }, [service, week, reading, diaryId]);

  return { week, reading, error, reflect };
}
