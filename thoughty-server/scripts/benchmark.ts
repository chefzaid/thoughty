#!/usr/bin/env ts-node

import { closeDatabase, query } from './lib/db';

interface HttpBenchmarkTarget {
  method: 'GET';
  path: string;
  name: string;
}

interface LatencyStats {
  avgMs: number;
  maxMs: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
}

interface HttpBenchmarkResult extends LatencyStats {
  errors: number;
  name: string;
  requests: number;
  statusCodes: Record<string, number>;
}

interface DbBenchmarkTarget {
  name: string;
  sql: string;
}

interface DbBenchmarkResult extends LatencyStats {
  errors: number;
  name: string;
  runs: number;
}

const DEFAULT_HTTP_TARGETS: HttpBenchmarkTarget[] = [
  { name: 'health', method: 'GET', path: '/api/health' },
  { name: 'metrics', method: 'GET', path: '/api/metrics' },
];

const DEFAULT_DB_TARGETS: DbBenchmarkTarget[] = [
  { name: 'users_count', sql: 'select count(*) from users where deleted_at is null' },
  { name: 'diaries_count', sql: 'select count(*) from diaries' },
  { name: 'entries_count', sql: 'select count(*) from entries' },
  { name: 'cloud_sync_jobs_count', sql: 'select count(*) from cloud_sync_jobs' },
];

function readPositiveInt(name: string, fallback: number): number {
  const rawValue = process.env[name];
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(name: string): boolean {
  return ['1', 'true', 'yes'].includes((process.env[name] ?? '').toLowerCase());
}

function percentile(sortedValues: number[], percentileRank: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.min(sortedValues.length - 1, Math.ceil((percentileRank / 100) * sortedValues.length) - 1);
  return sortedValues[index];
}

function getLatencyStats(latencies: number[]): LatencyStats {
  if (latencies.length === 0) {
    return { minMs: 0, maxMs: 0, avgMs: 0, p50Ms: 0, p95Ms: 0 };
  }

  const sorted = [...latencies].sort((left, right) => left - right);
  const total = latencies.reduce((sum, latency) => sum + latency, 0);

  return {
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    avgMs: total / latencies.length,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
  };
}

function formatMs(value: number): string {
  return value.toFixed(2);
}

function parseHttpTargets(): HttpBenchmarkTarget[] {
  const rawTargets = process.env.BENCHMARK_ENDPOINTS;

  if (!rawTargets) {
    return DEFAULT_HTTP_TARGETS;
  }

  return rawTargets
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean)
    .map((path) => ({
      name: path.replace(/^\/api\//, '').replace(/[^a-z0-9]+/gi, '_') || 'root',
      method: 'GET' as const,
      path: path.startsWith('/') ? path : `/${path}`,
    }));
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function runLimited<T>(count: number, concurrency: number, worker: () => Promise<T>): Promise<T[]> {
  const results: T[] = [];
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < count) {
      nextIndex += 1;
      results.push(await worker());
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, runWorker));
  return results;
}

async function time<T>(fn: () => Promise<T>): Promise<{ durationMs: number; value: T }> {
  const startedAt = process.hrtime.bigint();
  const value = await fn();
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

  return { durationMs, value };
}

async function benchmarkHttpTarget(
  baseUrl: string,
  target: HttpBenchmarkTarget,
  requestCount: number,
  concurrency: number,
  authToken?: string,
): Promise<HttpBenchmarkResult> {
  const headers: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  const statusCodes: Record<string, number> = {};
  const latencies: number[] = [];
  let errors = 0;

  await runLimited(requestCount, concurrency, async () => {
    try {
      const result = await time(() => fetch(buildUrl(baseUrl, target.path), { method: target.method, headers }));
      statusCodes[result.value.status] = (statusCodes[result.value.status] ?? 0) + 1;
      latencies.push(result.durationMs);

      if (!result.value.ok) {
        errors += 1;
      }
    } catch {
      errors += 1;
    }
  });

  return {
    name: target.name,
    requests: requestCount,
    errors,
    statusCodes,
    ...getLatencyStats(latencies),
  };
}

async function benchmarkDbTarget(target: DbBenchmarkTarget, runs: number): Promise<DbBenchmarkResult> {
  const latencies: number[] = [];
  let errors = 0;

  for (let index = 0; index < runs; index += 1) {
    try {
      const result = await time(() => query(target.sql));
      latencies.push(result.durationMs);
    } catch {
      errors += 1;
    }
  }

  return {
    name: target.name,
    runs,
    errors,
    ...getLatencyStats(latencies),
  };
}

function printHttpResults(results: HttpBenchmarkResult[]): void {
  console.log('\nHTTP benchmark');
  console.log('target,requests,errors,min_ms,p50_ms,p95_ms,avg_ms,max_ms,status_codes');

  for (const result of results) {
    console.log(
      [
        result.name,
        result.requests,
        result.errors,
        formatMs(result.minMs),
        formatMs(result.p50Ms),
        formatMs(result.p95Ms),
        formatMs(result.avgMs),
        formatMs(result.maxMs),
        JSON.stringify(result.statusCodes),
      ].join(','),
    );
  }
}

function printDbResults(results: DbBenchmarkResult[]): void {
  console.log('\nDatabase benchmark');
  console.log('target,runs,errors,min_ms,p50_ms,p95_ms,avg_ms,max_ms');

  for (const result of results) {
    console.log(
      [
        result.name,
        result.runs,
        result.errors,
        formatMs(result.minMs),
        formatMs(result.p50Ms),
        formatMs(result.p95Ms),
        formatMs(result.avgMs),
        formatMs(result.maxMs),
      ].join(','),
    );
  }
}

async function main(): Promise<void> {
  const baseUrl = process.env.BENCHMARK_BASE_URL ?? 'http://localhost:3001';
  const requestCount = readPositiveInt('BENCHMARK_REQUESTS', 100);
  const concurrency = readPositiveInt('BENCHMARK_CONCURRENCY', 10);
  const dbRuns = readPositiveInt('BENCHMARK_DB_RUNS', 10);
  const authToken = process.env.BENCHMARK_AUTH_TOKEN;

  console.log('Thoughty benchmark');
  console.log(`baseUrl=${baseUrl}`);
  console.log(`requests=${requestCount}`);
  console.log(`concurrency=${concurrency}`);
  console.log(`dbRuns=${dbRuns}`);

  if (!readBoolean('BENCHMARK_SKIP_HTTP')) {
    const httpResults = await Promise.all(
      parseHttpTargets().map((target) => benchmarkHttpTarget(baseUrl, target, requestCount, concurrency, authToken)),
    );
    printHttpResults(httpResults);
  }

  if (!readBoolean('BENCHMARK_SKIP_DB')) {
    const dbResults = [];

    try {
      for (const target of DEFAULT_DB_TARGETS) {
        dbResults.push(await benchmarkDbTarget(target, dbRuns));
      }
    } finally {
      await closeDatabase();
    }

    printDbResults(dbResults);
  }
}

main().catch(async (error: unknown) => {
  await closeDatabase();
  console.error(`Benchmark failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
