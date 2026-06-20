import { Injectable } from '@nestjs/common';

export interface FeatureTelemetrySample {
  method: string;
  path: string;
  statusCode: number;
}

export interface FeatureTelemetrySnapshot {
  feature: string;
  action: string;
  statusFamily: string;
  count: number;
}

const FEATURE_BY_ROUTE: Record<string, string> = {
  ai: 'ai',
  attachments: 'attachments',
  auth: 'auth',
  books: 'book_converter',
  'cloud-sync': 'cloud_sync',
  config: 'profile_settings',
  diaries: 'diaries',
  entries: 'journal_entries',
  io: 'import_export',
  stats: 'stats',
};

const ACTION_BY_METHOD: Record<string, string> = {
  DELETE: 'delete',
  GET: 'read',
  PATCH: 'update',
  POST: 'create',
  PUT: 'update',
};

function getRouteSegments(path: string): string[] {
  const segments = path.split('?')[0].split('/').filter(Boolean);
  return segments[0] === 'api' ? segments.slice(1) : segments;
}

function getStatusFamily(statusCode: number): string {
  return `${Math.floor(statusCode / 100)}xx`;
}

function getFeatureAction(method: string, path: string): { action: string; feature: string } | null {
  const [route, subRoute] = getRouteSegments(path);

  if (!route || route === 'health' || route === 'metrics') {
    return null;
  }

  const feature = FEATURE_BY_ROUTE[route];

  if (!feature) {
    return null;
  }

  if ((route === 'ai' || route === 'auth' || route === 'cloud-sync') && subRoute) {
    return { feature, action: subRoute.replace(/[^a-z0-9_-]/gi, '_').toLowerCase() };
  }

  return { feature, action: ACTION_BY_METHOD[method.toUpperCase()] ?? 'other' };
}

@Injectable()
export class FeatureTelemetryService {
  private readonly samples = new Map<string, FeatureTelemetrySnapshot>();

  record(sample: FeatureTelemetrySample): void {
    const featureAction = getFeatureAction(sample.method, sample.path);

    if (!featureAction) {
      return;
    }

    const statusFamily = getStatusFamily(sample.statusCode);
    const key = `${featureAction.feature} ${featureAction.action} ${statusFamily}`;
    const current =
      this.samples.get(key) ??
      ({
        ...featureAction,
        statusFamily,
        count: 0,
      } satisfies FeatureTelemetrySnapshot);

    current.count += 1;
    this.samples.set(key, current);
  }

  getSnapshot(): FeatureTelemetrySnapshot[] {
    return [...this.samples.values()].sort(
      (left, right) =>
        left.feature.localeCompare(right.feature) ||
        left.action.localeCompare(right.action) ||
        left.statusFamily.localeCompare(right.statusFamily),
    );
  }
}
