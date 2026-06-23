import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Render Prometheus metrics' })
  @ApiProduces('text/plain')
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics text exposition',
    content: {
      'text/plain': {
        example: 'thoughty_database_up 1\nthoughty_cloud_sync_jobs_stuck 0\n',
      },
    },
  })
  getMetrics(): Promise<string> {
    return this.metricsService.renderPrometheusMetrics();
  }
}
