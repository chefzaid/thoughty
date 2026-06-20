import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import { CloudSyncJob, CLOUD_SYNC_JOB_STATUSES, CloudSyncJobStatus } from '@/database/entities';
import { HttpMetricSnapshot, HttpMetricsService } from '@/common';

const STUCK_JOB_THRESHOLD_MS = 15 * 60 * 1000;

type MetricLabelValue = string | number;
type MetricLabels = Record<string, MetricLabelValue>;

interface CloudSyncStatusCount {
  status: CloudSyncJobStatus;
  count: string;
}

function escapeLabel(value: MetricLabelValue): string {
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function metricLine(name: string, value: number, labels: MetricLabels = {}): string {
  const labelEntries = Object.entries(labels);
  const labelText =
    labelEntries.length > 0
      ? `{${labelEntries.map(([key, labelValue]) => `${key}="${escapeLabel(labelValue)}"`).join(',')}}`
      : '';

  return `${name}${labelText} ${Number.isFinite(value) ? value : 0}`;
}

function renderHttpMetrics(snapshot: HttpMetricSnapshot[]): string[] {
  const lines = [
    '# HELP thoughty_http_requests_total Total HTTP requests handled by the API.',
    '# TYPE thoughty_http_requests_total counter',
  ];

  for (const sample of snapshot) {
    lines.push(
      metricLine('thoughty_http_requests_total', sample.count, {
        method: sample.method,
        path: sample.path,
        status: sample.statusCode,
      }),
    );
  }

  lines.push(
    '# HELP thoughty_http_request_latency_ms_sum Total HTTP request latency in milliseconds.',
    '# TYPE thoughty_http_request_latency_ms_sum counter',
  );

  for (const sample of snapshot) {
    lines.push(
      metricLine('thoughty_http_request_latency_ms_sum', Math.round(sample.latencyMsSum * 100) / 100, {
        method: sample.method,
        path: sample.path,
        status: sample.statusCode,
      }),
    );
  }

  return lines;
}

@Injectable()
export class MetricsService {
  constructor(
    private readonly httpMetrics: HttpMetricsService,
    private readonly dataSource: DataSource,
    @InjectRepository(CloudSyncJob)
    private readonly cloudSyncJobs: Repository<CloudSyncJob>,
  ) {}

  async renderPrometheusMetrics(): Promise<string> {
    const [databaseUp, cloudSyncCounts, stuckCloudSyncJobs] = await Promise.all([
      this.getDatabaseUp(),
      this.getCloudSyncCounts(),
      this.getStuckCloudSyncJobs(),
    ]);

    const memory = process.memoryUsage();
    const lines = [
      '# HELP thoughty_process_uptime_seconds Process uptime in seconds.',
      '# TYPE thoughty_process_uptime_seconds gauge',
      metricLine('thoughty_process_uptime_seconds', Math.round(process.uptime())),
      '# HELP thoughty_process_memory_bytes Process memory usage in bytes.',
      '# TYPE thoughty_process_memory_bytes gauge',
      metricLine('thoughty_process_memory_bytes', memory.rss, { type: 'rss' }),
      metricLine('thoughty_process_memory_bytes', memory.heapUsed, { type: 'heap_used' }),
      '# HELP thoughty_database_up Database connectivity status, 1 for up and 0 for down.',
      '# TYPE thoughty_database_up gauge',
      metricLine('thoughty_database_up', databaseUp),
      ...renderHttpMetrics(this.httpMetrics.getSnapshot()),
      '# HELP thoughty_cloud_sync_jobs Jobs grouped by cloud sync status.',
      '# TYPE thoughty_cloud_sync_jobs gauge',
      ...CLOUD_SYNC_JOB_STATUSES.map((status) =>
        metricLine('thoughty_cloud_sync_jobs', cloudSyncCounts.get(status) ?? 0, { status }),
      ),
      '# HELP thoughty_cloud_sync_stuck_jobs Running cloud sync jobs locked longer than the operational threshold.',
      '# TYPE thoughty_cloud_sync_stuck_jobs gauge',
      metricLine('thoughty_cloud_sync_stuck_jobs', stuckCloudSyncJobs),
    ];

    return `${lines.join('\n')}\n`;
  }

  private async getDatabaseUp(): Promise<number> {
    try {
      await this.dataSource.query('select 1');
      return 1;
    } catch {
      return 0;
    }
  }

  private async getCloudSyncCounts(): Promise<Map<CloudSyncJobStatus, number>> {
    const rows = await this.cloudSyncJobs
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('job.status')
      .getRawMany<CloudSyncStatusCount>();

    return new Map(rows.map((row) => [row.status, Number.parseInt(row.count, 10)]));
  }

  private async getStuckCloudSyncJobs(): Promise<number> {
    return this.cloudSyncJobs.count({
      where: {
        status: 'running',
        lockedAt: LessThan(new Date(Date.now() - STUCK_JOB_THRESHOLD_MS)),
      },
    });
  }
}
