import { NotFoundException } from '@nestjs/common';
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

    await expect(controller.getMetrics({ ip: '10.42.0.17' })).resolves.toBe('thoughty_database_up 1\n');
    expect(metricsService.renderPrometheusMetrics).toHaveBeenCalled();
  });

  it('answers 404 to callers outside the private network, such as visitors through the ingress', async () => {
    const metricsService = { renderPrometheusMetrics: jest.fn() } as unknown as MetricsService;
    const controller = new MetricsController(metricsService);

    await expect(controller.getMetrics({ ip: '203.0.113.9' })).rejects.toThrow(NotFoundException);
    await expect(controller.getMetrics({ ip: undefined })).rejects.toThrow(NotFoundException);
    expect(metricsService.renderPrometheusMetrics).not.toHaveBeenCalled();
  });
});
