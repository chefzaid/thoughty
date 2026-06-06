import type { Request, Route } from '@playwright/test';

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
  return route.fulfill({
    status: options.status ?? 200,
    contentType: 'application/json',
    headers: options.headers,
    body: JSON.stringify(body),
  });
}

export function sortStrings(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function toEntryResponse(entry: MockEntry, state: MockAppState) {
  const diary = state.diaries.find((candidate) => candidate.id === (entry.diaryId ?? 1));

  return {
    ...entry,
    diary_id: entry.diaryId ?? null,
    diary_name: diary?.name,
    diary_icon: diary?.icon,
    diary_color: diary?.color,
  };
}