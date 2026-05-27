import { Controller, Get } from '@nestjs/common';
import { Public } from '@/common/decorators';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}