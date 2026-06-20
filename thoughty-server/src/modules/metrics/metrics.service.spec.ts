import { DataSource } from 'typeorm';
import { HttpMetricsService } from '@/common';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let httpMetrics: HttpMetricsService;
  let dataSource: Pick<DataSource, 'query'>;
  let repository: {
    createQueryBuilder: jest.Mock;
    count: jest.Mock;
  };
  let service: MetricsService;

  beforeEach(() => {
    httpMetrics = new HttpMetricsService();
    httpMetrics.record({ method: 'GET', path: '/api/entries/123', statusCode: 200, latencyMs: 15 });
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
    service = new MetricsService(httpMetrics, dataSource as DataSource, repository as never);
  });

  it('renders process, HTTP, database, and cloud sync metrics', async () => {
    const output = await service.renderPrometheusMetrics();

    expect(output).toContain('# TYPE thoughty_process_uptime_seconds gauge');
    expect(output).toContain('thoughty_database_up 1');
    expect(output).toContain(
      'thoughty_http_requests_total{method="GET",path="/api/entries/:id",status="200"} 1',
    );
    expect(output).toContain('thoughty_cloud_sync_jobs{status="queued"} 3');
    expect(output).toContain('thoughty_cloud_sync_jobs{status="running"} 0');
    expect(output).toContain('thoughty_cloud_sync_jobs{status="failed"} 1');
    expect(output).toContain('thoughty_cloud_sync_stuck_jobs 2');
  });

  it('reports database down when the connectivity check fails', async () => {
    dataSource.query = jest.fn().mockRejectedValue(new Error('connection refused'));

    const output = await service.renderPrometheusMetrics();

    expect(output).toContain('thoughty_database_up 0');
  });
});
