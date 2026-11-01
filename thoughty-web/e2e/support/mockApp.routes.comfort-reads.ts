import { isMockSealed } from './mockApp.routes.time-capsules';
import { fulfillJson, type RouteContext } from './mockApp.route-utils';

/** The tags that mark an entry written with gratitude, compared without case, as the API reads them. */
const GRATITUDE_TAGS = ['gratitude', 'grateful', 'reconnaissance'];

/**
 * `GET /api/entries/comfort-reads` as the API answers it: up to three of the writer's favorites or gratitude
 * entries in a random order, never a sealed capsule or `excludeId`; the recycle bin is kept apart already.
 */
export async function handleComfortReadsRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname !== '/api/entries/comfort-reads' || request.method() !== 'GET') {
    return false;
  }

  const excludeId = Number(searchParams.get('excludeId') || '0');
  const candidates = state.entries.filter((entry) => entry.id !== excludeId
    && !isMockSealed(entry)
    && (entry.is_favorite || entry.tags.some((tag) => GRATITUDE_TAGS.includes(tag.toLowerCase()))));
  const picked = candidates
    .map((entry) => ({ entry, order: Math.random() }))
    .sort((left, right) => left.order - right.order)
    .slice(0, 3)
    .map(({ entry }) => entry);

  await fulfillJson(route, {
    entries: picked.map((entry) => ({
      id: entry.id,
      date: entry.date,
      index: entry.index,
      title: entry.title ?? null,
      excerpt: entry.content.replaceAll(/\s+/g, ' ').trim().slice(0, 140),
    })),
  });
  return true;
}
