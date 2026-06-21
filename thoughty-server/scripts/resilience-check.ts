#!/usr/bin/env ts-node

import { closeDatabase, query } from './lib/db';

interface ProbeResult {
  detail?: string;
  durationMs: number;
  expected: string;
  name: string;
  observed: string;
  ok: boolean;
  target: string;
}

interface HttpProbe {
  body?: string;
  expectedStatuses: number[];
  headers?: Record<string, string>;
  method: 'GET' | 'POST';
  name: string;
  path: string;
  verifyHealthAfter?: boolean;
}

const HTTP_PROBES: HttpProbe[] = [
  {
    name: 'health_baseline',
    method: 'GET',
    path: '/api/health',
    expectedStatuses: [200],
  },
  {
    name: 'missing_route',
    method: 'GET',
    path: '/api/__chaos_missing_route__',
    expectedStatuses: [404],
    verifyHealthAfter: true,
  },
  {
    name: 'malformed_json',
    method: 'POST',
    path: '/api/auth/login',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
    expectedStatuses: [400],
    verifyHealthAfter: true,
  },
  {
    name: 'unauthenticated_private_route',
    method: 'GET',
    path: '/api/entries',
    expectedStatuses: [401],
    verifyHealthAfter: true,
  },
];

function readPositiveInt(name: string, fallback: number): number {
  const rawValue = process.env[name];
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(name: string): boolean {
  return ['1', 'true', 'yes'].includes((process.env[name] ?? '').toLowerCase());
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function formatMs(value: number): string {
  return value.toFixed(2);
}

async function time<T>(fn: () => Promise<T>): Promise<{ durationMs: number; value: T }> {
  const startedAt = process.hrtime.bigint();
  const value = await fn();
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

  return { durationMs, value };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkHealth(baseUrl: string, timeoutMs: number): Promise<{ detail?: string; ok: boolean }> {
  try {
    const response = await fetchWithTimeout(buildUrl(baseUrl, '/api/health'), { method: 'GET' }, timeoutMs);
    await response.text();

    if (response.status === 200) {
      return { ok: true };
    }

    return { ok: false, detail: `health returned ${response.status}` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function runHttpProbe(baseUrl: string, probe: HttpProbe, timeoutMs: number): Promise<ProbeResult> {
  const target = buildUrl(baseUrl, probe.path);
  const expected = probe.expectedStatuses.join('|');

  try {
    const { durationMs, value: response } = await time(() =>
      fetchWithTimeout(
        target,
        {
          method: probe.method,
          headers: probe.headers,
          body: probe.body,
        },
        timeoutMs,
      ),
    );
    await response.text();

    const expectedStatus = probe.expectedStatuses.includes(response.status);
    if (!expectedStatus) {
      return {
        name: probe.name,
        target: probe.path,
        expected,
        observed: String(response.status),
        durationMs,
        ok: false,
        detail: 'unexpected status',
      };
    }

    if (probe.verifyHealthAfter) {
      const health = await checkHealth(baseUrl, timeoutMs);
      if (!health.ok) {
        return {
          name: probe.name,
          target: probe.path,
          expected,
          observed: String(response.status),
          durationMs,
          ok: false,
          detail: `health check failed after probe: ${health.detail ?? 'unknown error'}`,
        };
      }
    }

    return {
      name: probe.name,
      target: probe.path,
      expected,
      observed: String(response.status),
      durationMs,
      ok: true,
    };
  } catch (error) {
    return {
      name: probe.name,
      target: probe.path,
      expected,
      observed: 'request_error',
      durationMs: 0,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runDbProbe(name: string, sql: string, shouldSucceed: boolean): Promise<ProbeResult> {
  const startedAt = process.hrtime.bigint();

  try {
    await query(sql);
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    return {
      name,
      target: 'database',
      expected: shouldSucceed ? 'success' : 'failure',
      observed: 'success',
      durationMs,
      ok: shouldSucceed,
      detail: shouldSucceed ? undefined : 'query unexpectedly succeeded',
    };
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    return {
      name,
      target: 'database',
      expected: shouldSucceed ? 'success' : 'failure',
      observed: 'failure',
      durationMs,
      ok: !shouldSucceed,
      detail: shouldSucceed && error instanceof Error ? error.message : undefined,
    };
  }
}

async function runDbProbes(): Promise<ProbeResult[]> {
  try {
    return [
      await runDbProbe('db_precheck', 'select 1', true),
      await runDbProbe('db_invalid_statement', 'select * from chaos_table_that_should_not_exist', false),
      await runDbProbe('db_recovery', 'select 1', true),
    ];
  } finally {
    await closeDatabase();
  }
}

function printResults(title: string, results: ProbeResult[]): void {
  console.log(`\n${title}`);
  console.log('status,name,target,expected,observed,duration_ms,detail');

  for (const result of results) {
    console.log(
      [
        result.ok ? 'PASS' : 'FAIL',
        result.name,
        result.target,
        result.expected,
        result.observed,
        formatMs(result.durationMs),
        result.detail ?? '',
      ].join(','),
    );
  }
}

async function main(): Promise<void> {
  const baseUrl = process.env.CHAOS_BASE_URL ?? 'http://localhost:3001';
  const timeoutMs = readPositiveInt('CHAOS_TIMEOUT_MS', 5_000);
  const results: ProbeResult[] = [];

  console.log('Thoughty resilience check');
  console.log(`baseUrl=${baseUrl}`);
  console.log(`timeoutMs=${timeoutMs}`);

  if (!readBoolean('CHAOS_SKIP_HTTP')) {
    const httpResults = [];
    for (const probe of HTTP_PROBES) {
      httpResults.push(await runHttpProbe(baseUrl, probe, timeoutMs));
    }
    printResults('HTTP fault probes', httpResults);
    results.push(...httpResults);
  }

  if (!readBoolean('CHAOS_SKIP_DB')) {
    const dbResults = await runDbProbes();
    printResults('Database fault probes', dbResults);
    results.push(...dbResults);
  }

  const failures = results.filter((result) => !result.ok);
  if (failures.length > 0) {
    console.error(`\nResilience check failed: ${failures.length} probe(s) failed`);
    process.exit(1);
  }

  console.log('\nResilience check passed');
}

main().catch(async (error: unknown) => {
  await closeDatabase();
  console.error(`Resilience check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
