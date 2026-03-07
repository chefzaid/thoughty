import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from './config.service';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';

@ApiTags('Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get user configuration' })
  @ApiResponse({ status: 200, description: 'User configuration' })
  async getConfig(@CurrentUser() user: AuthenticatedUser): Promise<Record<string, string>> {
    return this.configService.getConfig(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Update user configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  async updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() newConfig: Record<string, string>,
  ): Promise<{ success: boolean }> {
    return this.configService.updateConfig(user.userId, newConfig);
  }
}
