import { Controller, Get, Header, NotFoundException, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common';
import { isPrivateNetworkAddress } from '@/common/security';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Prometheus scrapes the pods directly. The API is also reachable through the public ingress,
   * so requests from outside the private network answer as if the route did not exist.
   */
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
  @ApiResponse({ status: 404, description: 'The caller is not on the private network' })
  async getMetrics(@Req() request: Pick<Request, 'ip'>): Promise<string> {
    if (!isPrivateNetworkAddress(request.ip)) {
      throw new NotFoundException();
    }
    return this.metricsService.renderPrometheusMetrics();
  }
}
