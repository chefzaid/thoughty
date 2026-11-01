import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createSavedSearchesService, type SavedSearch, type ServiceResult } from '../../services/api';
import type { Person } from '../../services/api/peopleService';
import type { TranslationFunction } from '../../types';
import { buildBookConverterRoute } from '../../utils/appRouting';
import {
  SAVED_SEARCH_NAME_MAX_LENGTH,
  findPersonViewSearch,
  personViewFilterState,
  toSavedSearchFilters,
} from '../../utils/savedSearches';
import { useSavedSearches } from '../SavedSearches/useSavedSearches';

const NAME_TAKEN = 'apiError_SAVED_SEARCH_NAME_TAKEN';

interface UsePersonBookOptions {
  /** Shows why the book could not be started. */
  readonly onNotify: (message: string) => void;
  readonly t: TranslationFunction;
}

/**
 * The person view's Make a book: the book is built from a saved search of exactly that view (every
 * diary, every entry that mentions them, archived ones too), so it keeps its own version history and
 * a later version adds what was written since. The writer's own saved search of that view is reused;
 * otherwise one is saved, named after the person (or "Book about …" when that name is taken).
 */
export function usePersonBook({ onNotify, t }: UsePersonBookOptions) {
  const service = useAuthenticatedService(createSavedSearchesService);
  const { create } = useSavedSearches();
  const navigate = useNavigate();
  const [pendingPersonId, setPendingPersonId] = useState<number | null>(null);
  const pendingRef = useRef(false);

  const personSearch = useCallback(async (person: Person): Promise<ServiceResult<SavedSearch>> => {
    const listed = await service.list();
    if (!listed.data) return { data: null, error: listed.error };
    const existing = findPersonViewSearch(listed.data.savedSearches, person.id);
    if (existing) return { data: existing, error: null };

    const filters = toSavedSearchFilters(personViewFilterState(person.id));
    const save = (name: string) => create({ name: name.slice(0, SAVED_SEARCH_NAME_MAX_LENGTH), diaryId: null, filters });
    const saved = await save(person.name);
    return saved.error === NAME_TAKEN ? save(t('personBookSearchName', { name: person.name })) : saved;
  }, [create, service, t]);

  const makeBook = useCallback(async (person: Person): Promise<void> => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingPersonId(person.id);
    try {
      const saved = await personSearch(person);
      if (!saved.data) {
        onNotify(t(saved.error ?? 'savedSearchSaveFailed'));
        return;
      }
      const { state, ...to } = buildBookConverterRoute(null, {
        kind: 'person',
        name: person.name,
        savedSearchId: saved.data.id,
        savedSearchName: saved.data.name,
      });
      navigate(to, { state });
    } finally {
      pendingRef.current = false;
      setPendingPersonId(null);
    }
  }, [navigate, onNotify, personSearch, t]);

  return { makeBook, pendingPersonId };
}
