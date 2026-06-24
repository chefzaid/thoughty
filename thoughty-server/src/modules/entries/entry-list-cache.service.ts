import { Injectable, Optional } from '@nestjs/common';
import { GetEntriesQueryDto, EntriesListResponseDto } from './dto';

interface CachedEntryList {
  expiresAt: number;
  value: EntriesListResponseDto;
}

const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_MAX_CACHE_KEYS = 500;

@Injectable()
export class EntryListCacheService {
  private readonly ttlMs: number;
  private readonly maxKeys: number;
  private readonly cache = new Map<string, CachedEntryList>();
  private readonly keysByUser = new Map<number, Set<string>>();

  constructor(@Optional() env: NodeJS.ProcessEnv = process.env) {
    this.ttlMs = parsePositiveInt(env.ENTRIES_CACHE_TTL_SECONDS, DEFAULT_CACHE_TTL_MS / 1000) * 1000;
    this.maxKeys = parsePositiveInt(env.ENTRIES_CACHE_MAX_KEYS, DEFAULT_MAX_CACHE_KEYS);
  }

  get(userId: number, query: GetEntriesQueryDto): EntriesListResponseDto | undefined {
    const key = this.buildKey(userId, query);
    const cached = this.cache.get(key);

    if (!cached) {
      return undefined;
    }

    if (cached.expiresAt <= Date.now()) {
      this.deleteKey(userId, key);
      return undefined;
    }

    return structuredClone(cached.value);
  }

  set(userId: number, query: GetEntriesQueryDto, value: EntriesListResponseDto): void {
    if (this.ttlMs <= 0 || this.maxKeys <= 0) {
      return;
    }

    const key = this.buildKey(userId, query);
    this.cache.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value: structuredClone(value),
    });

    const userKeys = this.keysByUser.get(userId) ?? new Set<string>();
    userKeys.add(key);
    this.keysByUser.set(userId, userKeys);
    this.pruneOldestKeys();
  }

  invalidateUser(userId: number): void {
    const userKeys = this.keysByUser.get(userId);
    if (!userKeys) {
      return;
    }

    for (const key of userKeys) {
      this.cache.delete(key);
    }
    this.keysByUser.delete(userId);
  }

  private buildKey(userId: number, query: GetEntriesQueryDto): string {
    const tags = query.tags
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .join(',');

    const normalized = {
      userId,
      archiveStatus: query.archiveStatus ?? '',
      date: query.date ?? '',
      diaryId: query.diaryId ?? '',
      favorites: query.favorites === true,
      limit: query.limit ?? 10,
      page: query.page ?? 1,
      search: query.search?.trim() ?? '',
      tags: tags ?? '',
      visibility: query.visibility ?? '',
    };

    return JSON.stringify(normalized);
  }

  private pruneOldestKeys(): void {
    while (this.cache.size > this.maxKeys) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (!oldestKey) {
        return;
      }
      this.deleteKeyByValue(oldestKey);
    }
  }

  private deleteKey(userId: number, key: string): void {
    this.cache.delete(key);
    const userKeys = this.keysByUser.get(userId);
    userKeys?.delete(key);
    if (userKeys?.size === 0) {
      this.keysByUser.delete(userId);
    }
  }

  private deleteKeyByValue(key: string): void {
    this.cache.delete(key);
    for (const [userId, userKeys] of this.keysByUser.entries()) {
      userKeys.delete(key);
      if (userKeys.size === 0) {
        this.keysByUser.delete(userId);
      }
    }
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
