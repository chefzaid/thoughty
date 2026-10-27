import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GetEntriesQueryDto, EntriesListResponseDto } from './dto';

interface CachedEntryList {
  expiresAt: number;
  /** The writer's `entry_list_versions.version` when the list was read. */
  version: string;
  value: EntriesListResponseDto;
}

const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_MAX_CACHE_KEYS = 500;

/**
 * Repeated journal-list reads, kept per API replica for `ENTRIES_CACHE_TTL_SECONDS`. A copy is served
 * only while the writer's `entry_list_versions.version` is the one it was read at: triggers on every
 * table the list reads move that version on in the commit that changes the list, so a write by any
 * service, replica, worker or raw SQL statement makes the next read fresh. No write path has to
 * invalidate anything (see `docs/architecture.md`, Data Ownership Rules).
 */
@Injectable()
export class EntryListCacheService {
  private readonly ttlMs: number;
  private readonly maxKeys: number;
  private readonly cache = new Map<string, CachedEntryList>();
  private readonly keysByUser = new Map<number, Set<string>>();

  constructor(
    private readonly dataSource: DataSource,
    @Optional() env: NodeJS.ProcessEnv = process.env,
  ) {
    this.ttlMs = parsePositiveInt(env.ENTRIES_CACHE_TTL_SECONDS, DEFAULT_CACHE_TTL_MS / 1000) * 1000;
    this.maxKeys = parsePositiveInt(env.ENTRIES_CACHE_MAX_KEYS, DEFAULT_MAX_CACHE_KEYS);
  }

  /**
   * The writer's list for the query: the cached copy when their version has not moved since it was
   * read, otherwise `load`'s result, kept under the version read before it ran (a change committed
   * while it ran moves the version on, so that copy is never served again).
   */
  async getOrLoad(
    userId: number,
    query: GetEntriesQueryDto,
    load: () => Promise<EntriesListResponseDto>,
  ): Promise<EntriesListResponseDto> {
    const version = await this.readVersion(userId);
    const key = this.buildKey(userId, query);
    const cached = this.cache.get(key);
    if (cached && cached.version === version && cached.expiresAt > Date.now()) {
      return structuredClone(cached.value);
    }
    if (cached) {
      this.deleteKey(userId, key);
    }

    const value = await load();
    this.set(userId, key, version, value);
    return value;
  }

  /** `'0'` until the writer's list first changes. Read from the primary, where every write lands. */
  private async readVersion(userId: number): Promise<string> {
    const rows: Array<{ version: string }> = await this.dataSource.query(
      'SELECT version FROM entry_list_versions WHERE user_id = $1',
      [userId],
    );
    return String(rows[0]?.version ?? '0');
  }

  private set(userId: number, key: string, version: string, value: EntriesListResponseDto): void {
    if (this.ttlMs <= 0 || this.maxKeys <= 0) {
      return;
    }

    this.cache.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      version,
      value: structuredClone(value),
    });

    const userKeys = this.keysByUser.get(userId) ?? new Set<string>();
    userKeys.add(key);
    this.keysByUser.set(userId, userKeys);
    this.pruneOldestKeys();
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
      eraId: query.eraId ?? '',
      favorites: query.favorites === true,
      ids: query.ids ?? '',
      limit: query.limit ?? 10,
      mood: query.mood ?? '',
      page: query.page ?? 1,
      personId: query.personId ?? '',
      search: query.search?.trim() ?? '',
      sort: query.sort ?? 'relevance',
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
