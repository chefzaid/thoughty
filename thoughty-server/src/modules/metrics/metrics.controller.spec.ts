import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  it('is excluded from the global rate limiter for Prometheus scrapes', () => {
    expect(Reflect.getMetadata('THROTTLER:SKIPdefault', MetricsController)).toBe(true);
  });

  it('returns Prometheus text from the metrics service', async () => {
    const metricsService = {
      renderPrometheusMetrics: jest.fn().mockResolvedValue('thoughty_database_up 1\n'),
    } as unknown as MetricsService;
    const controller = new MetricsController(metricsService);

    await expect(controller.getMetrics()).resolves.toBe('thoughty_database_up 1\n');
    expect(metricsService.renderPrometheusMetrics).toHaveBeenCalled();
  });
});
