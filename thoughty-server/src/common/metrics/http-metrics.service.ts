import { Injectable } from '@nestjs/common';

export interface HttpMetricSample {
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
}

export interface HttpMetricSnapshot {
  method: string;
  path: string;
  statusCode: number;
  count: number;
  latencyMsSum: number;
}

function normalizePath(path: string): string {
  return (
    path
      .split('?')[0]
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi, '/:id')
      .replace(/\/\d+(?=\/|$)/g, '/:id') || '/'
  );
}

@Injectable()
export class HttpMetricsService {
  private readonly samples = new Map<string, HttpMetricSnapshot>();

  record(sample: HttpMetricSample): void {
    const path = normalizePath(sample.path);
    const method = sample.method.toUpperCase();
    const key = `${method} ${path} ${sample.statusCode}`;
    const current =
      this.samples.get(key) ??
      ({
        method,
        path,
        statusCode: sample.statusCode,
        count: 0,
        latencyMsSum: 0,
      } satisfies HttpMetricSnapshot);

    current.count += 1;
    current.latencyMsSum += sample.latencyMs;
    this.samples.set(key, current);
  }

  getSnapshot(): HttpMetricSnapshot[] {
    return [...this.samples.values()].sort(
      (left, right) =>
        left.method.localeCompare(right.method) ||
        left.path.localeCompare(right.path) ||
        left.statusCode - right.statusCode,
    );
  }
}
