import { STATUS_CODES } from 'node:http';

import type { Request, Route } from '@playwright/test';

import type { components } from '../../src/generated/openapi';

import { checkMockResponse, recordContractViolations } from './mockApp.contract';
import type { MockAppState, MockEntry } from './mockApp.shared';

export type RouteContext = {
  route: Route;
  request: Request;
  url: URL;
  pathname: string;
  searchParams: URLSearchParams;
  state: MockAppState;
};

export function fulfillJson(
  route: Route,
  body: unknown,
  options: { status?: number; headers?: Record<string, string> } = {},
) {
  const status = options.status ?? 200;
  const request = route.request();
  recordContractViolations(checkMockResponse(request.method(), new URL(request.url()).pathname, status, body));
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: options.headers,
    body: JSON.stringify(body),
  });
}

/** Answers like the API's errors: Nest's body plus the stable `code` the web app translates (docs/architecture.md). */
export function fulfillApiError(route: Route, statusCode: number, code: string, message: string) {
  return fulfillJson(route, { statusCode, message, error: STATUS_CODES[statusCode] ?? 'Error', code }, { status: statusCode });
}

export function sortStrings(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

/** An entry exactly as the API serializes it (`EntryResponseDto`), so the mock cannot drift from the contract. */
export function toEntryResponse(entry: MockEntry, state: MockAppState): components['schemas']['EntryResponseDto'] {
  const diary = state.diaries.find((candidate) => candidate.id === (entry.diaryId ?? 1));

  return {
    id: entry.id,
    user_id: entry.userId ?? state.user.id,
    diary_id: entry.diaryId ?? null,
    date: entry.date,
    index: entry.index,
    title: entry.title ?? null,
    time_of_day: entry.time_of_day ?? null,
    mood: entry.mood ?? null,
    feelings: entry.feelings ?? [],
    tags: entry.tags,
    content: entry.content,
    format: entry.format ?? 'plain',
    visibility: entry.visibility,
    is_favorite: entry.is_favorite ?? false,
    is_archived: entry.is_archived ?? false,
    // The mock journal has no pinning, so no entry is pinned.
    is_pinned: false,
    diary_name: diary?.name,
    diary_icon: diary?.icon,
    diary_color: diary?.color ?? undefined,
    ...(entry.attachments ? { attachments: entry.attachments } : {}),
    created_at: entry.createdAt ?? `${entry.date}T12:00:00.000Z`,
  };
}

/** What the entry mutations answer: success and the entry as it now stands. */
export function toEntryMutationResponse(state: MockAppState, entryId: number): components['schemas']['EntryMutationResponseDto'] | { success: true } {
  const entry = state.entries.find((candidate) => candidate.id === entryId);
  return entry ? { success: true, entry: toEntryResponse(entry, state) } : { success: true };
}
