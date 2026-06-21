import { Controller, Get, Post, Body, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from './config.service';
import { UserDataExportService } from './user-data-export.service';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { Response } from 'express';
import { FeatureFlagsService } from '@/common';

@ApiTags('Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('config')
export class ConfigController {
  constructor(
    private readonly configService: ConfigService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly userDataExportService: UserDataExportService,
  ) {}

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

  @Get('feature-flags')
  @ApiOperation({ summary: 'Get runtime feature flags for the current environment' })
  @ApiResponse({ status: 200, description: 'Feature flag key/value map' })
  async getFeatureFlags(): Promise<Record<string, boolean>> {
    return this.featureFlagsService.getFeatureFlags();
  }

  @Get('download-data')
  @ApiOperation({ summary: 'Download all user data (GDPR)' })
  @ApiResponse({ status: 200, description: 'JSON file with all user data' })
  async downloadData(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const data = await this.userDataExportService.downloadData(user.userId);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `thoughty_data_${dateStr}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }
}
