import type { components } from '../../src/generated/openapi';
import type { MockAppState } from './mockApp.shared';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';

export const MOCK_LIFE_ERA_LIMIT = 100;

export type MockLifeEra = components['schemas']['LifeEraResponseDto'];
type LifeEraDraft = components['schemas']['CreateLifeEraDto'];

/** By start date, the closed era first on the same day, then by name, as `LifeErasService.findAll` orders them. */
export const byStart = (left: MockLifeEra, right: MockLifeEra) =>
  left.startDate.localeCompare(right.startDate)
  || (left.endDate ?? '9999-12-31').localeCompare(right.endDate ?? '9999-12-31')
  || left.name.toLowerCase().localeCompare(right.name.toLowerCase());

/** Whether an entry dated `date` falls in the era, its first and last days included. */
export function mockEraContains(era: Pick<MockLifeEra, 'startDate' | 'endDate'>, date: string): boolean {
  return date >= era.startDate && (era.endDate === null || date <= era.endDate);
}

function nameTaken(state: MockAppState, name: string, exceptId?: number): boolean {
  return state.lifeEras.some((era) => era.id !== exceptId && era.name.toLowerCase() === name.toLowerCase());
}

const clean = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);

/**
 * `/api/life-eras` as the API answers it: by start date, one name per writer whatever its case, an end
 * on or after the start, a limit, and deleting an era widens the saved searches filtered by it.
 */
export async function handleLifeEraRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/life-eras' && request.method() === 'GET') {
    await fulfillJson(route, { lifeEras: [...state.lifeEras].sort(byStart), limit: MOCK_LIFE_ERA_LIMIT });
    return true;
  }

  if (pathname === '/api/life-eras' && request.method() === 'POST') {
    const draft = request.postDataJSON() as LifeEraDraft;
    if (state.lifeEras.length >= MOCK_LIFE_ERA_LIMIT) {
      await fulfillApiError(route, 400, 'LIFE_ERA_LIMIT_REACHED', `Life era limit reached (${MOCK_LIFE_ERA_LIMIT})`);
      return true;
    }
    if (draft.endDate && draft.endDate < draft.startDate) {
      await fulfillApiError(route, 400, 'LIFE_ERA_DATES_INVALID', 'A life era cannot end before it starts');
      return true;
    }
    if (nameTaken(state, draft.name.trim())) {
      await fulfillApiError(route, 409, 'LIFE_ERA_NAME_TAKEN', 'A life era with this name already exists');
      return true;
    }
    const now = new Date().toISOString();
    const era: MockLifeEra = {
      id: Math.max(0, ...state.lifeEras.map((candidate) => candidate.id)) + 1,
      name: draft.name.trim(),
      startDate: draft.startDate,
      endDate: draft.endDate ?? null,
      color: clean(draft.color)?.toUpperCase() ?? null,
      emoji: clean(draft.emoji),
      note: clean(draft.note),
      createdAt: now,
      updatedAt: now,
    };
    state.lifeEras.push(era);
    await fulfillJson(route, era, { status: 201 });
    return true;
  }

  const match = /^\/api\/life-eras\/(\d+)$/.exec(pathname);
  if (!match) return false;
  const era = state.lifeEras.find((candidate) => candidate.id === Number(match[1]));
  if (!era) {
    await fulfillApiError(route, 404, 'LIFE_ERA_NOT_FOUND', 'Life era not found');
    return true;
  }

  if (request.method() === 'PATCH') {
    const changes = request.postDataJSON() as Partial<LifeEraDraft>;
    const next: MockLifeEra = {
      ...era,
      ...(changes.name === undefined ? {} : { name: changes.name.trim() }),
      ...(changes.startDate === undefined ? {} : { startDate: changes.startDate }),
      ...(changes.endDate === undefined ? {} : { endDate: changes.endDate }),
      ...(changes.color === undefined ? {} : { color: clean(changes.color)?.toUpperCase() ?? null }),
      ...(changes.emoji === undefined ? {} : { emoji: clean(changes.emoji) }),
      ...(changes.note === undefined ? {} : { note: clean(changes.note) }),
      updatedAt: new Date().toISOString(),
    };
    if (next.endDate && next.endDate < next.startDate) {
      await fulfillApiError(route, 400, 'LIFE_ERA_DATES_INVALID', 'A life era cannot end before it starts');
      return true;
    }
    if (nameTaken(state, next.name, era.id)) {
      await fulfillApiError(route, 409, 'LIFE_ERA_NAME_TAKEN', 'A life era with this name already exists');
      return true;
    }
    Object.assign(era, next);
    await fulfillJson(route, era);
    return true;
  }

  if (request.method() === 'DELETE') {
    state.lifeEras = state.lifeEras.filter((candidate) => candidate.id !== era.id);
    for (const saved of state.savedSearches) {
      if (saved.filters.eraId === era.id) saved.filters.eraId = null;
    }
    await fulfillJson(route, { success: true });
    return true;
  }

  return false;
}
