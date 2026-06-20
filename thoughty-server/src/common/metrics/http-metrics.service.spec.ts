import { HttpMetricsService } from './http-metrics.service';

describe('HttpMetricsService', () => {
  it('records request counts and latency sums by normalized route labels', () => {
    const service = new HttpMetricsService();

    service.record({ method: 'get', path: '/api/entries/123?search=private', statusCode: 200, latencyMs: 12.5 });
    service.record({ method: 'GET', path: '/api/entries/456', statusCode: 200, latencyMs: 7.5 });
    service.record({
      method: 'post',
      path: '/api/diaries/550e8400-e29b-41d4-a716-446655440000',
      statusCode: 201,
      latencyMs: 20,
    });

    expect(service.getSnapshot()).toEqual([
      {
        method: 'GET',
        path: '/api/entries/:id',
        statusCode: 200,
        count: 2,
        latencyMsSum: 20,
      },
      {
        method: 'POST',
        path: '/api/diaries/:id',
        statusCode: 201,
        count: 1,
        latencyMsSum: 20,
      },
    ]);
  });
});
