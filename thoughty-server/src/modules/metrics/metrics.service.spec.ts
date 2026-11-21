import { DataSource } from 'typeorm';
import { FeatureTelemetryService, HttpMetricsService } from '@/common';
import { MetricsService } from './metrics.service';
import type { WritingEngagementMetricsService } from './writing-engagement-metrics.service';

describe('MetricsService', () => {
  let httpMetrics: HttpMetricsService;
  let featureTelemetry: FeatureTelemetryService;
  let dataSource: Pick<DataSource, 'query'>;
  let repository: {
    createQueryBuilder: jest.Mock;
    count: jest.Mock;
  };
  let writingEngagement: { getSnapshot: jest.Mock };
  let service: MetricsService;

  beforeEach(() => {
    httpMetrics = new HttpMetricsService();
    httpMetrics.record({ method: 'GET', path: '/api/entries/123', statusCode: 200, latencyMs: 15 });
    featureTelemetry = new FeatureTelemetryService();
    featureTelemetry.record({ method: 'GET', path: '/api/entries/123', statusCode: 200 });
    dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    repository = {
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: 'queued', count: '3' },
          { status: 'failed', count: '1' },
        ]),
      })),
      count: jest.fn().mockResolvedValue(2),
    };
    writingEngagement = {
      getSnapshot: jest.fn().mockResolvedValue({
        activeWriters7d: 3,
        activeWriters28d: 4,
        writingDays7d: 10,
        funnel: { signed_up: 8, first_entry: 6, fifth_entry: 3, week_four: 2 },
      }),
    };
    service = new MetricsService(
      httpMetrics,
      featureTelemetry,
      dataSource as DataSource,
      repository as never,
      writingEngagement as unknown as WritingEngagementMetricsService,
    );
  });

  it('renders process, HTTP, database, and cloud sync metrics', async () => {
    const output = await service.renderPrometheusMetrics();

    expect(output).toContain('# TYPE thoughty_process_uptime_seconds gauge');
    expect(output).toContain('thoughty_database_up 1');
    expect(output).toContain(
      'thoughty_http_requests_total{method="GET",path="/api/entries/:id",status="200"} 1',
    );
    expect(output).toContain(
      'thoughty_feature_usage_total{feature="journal_entries",action="read",status_family="2xx"} 1',
    );
    expect(output).toContain('thoughty_cloud_sync_jobs{status="queued"} 3');
    expect(output).toContain('thoughty_cloud_sync_jobs{status="running"} 0');
    expect(output).toContain('thoughty_cloud_sync_jobs{status="failed"} 1');
    expect(output).toContain('thoughty_cloud_sync_stuck_jobs 2');
    expect(output).toContain('thoughty_weekly_writing_days_per_active_writer 2.5');
    expect(output).toContain('thoughty_sign_up_funnel_accounts{stage="week_four"} 2');
  });

  it('leaves the writing engagement metrics out while their counts are unavailable', async () => {
    writingEngagement.getSnapshot.mockResolvedValue(null);

    const output = await service.renderPrometheusMetrics();

    expect(output).toContain('thoughty_cloud_sync_stuck_jobs 2');
    expect(output).not.toContain('thoughty_active_writers');
  });

  it('reports database down when the connectivity check fails', async () => {
    dataSource.query = jest.fn().mockRejectedValue(new Error('connection refused'));

    const output = await service.renderPrometheusMetrics();

    expect(output).toContain('thoughty_database_up 0');
  });
});
