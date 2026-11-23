import { Controller, Get, Post, Body, Query, UseGuards, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from './config.service';
import { UserDataExportService } from './user-data-export.service';
import { DownloadDataQueryDto, UpdateConfigDto } from './dto/config.dto';
import { FEATURE_FLAGS_SCHEMA, UserConfigDto } from './dto/config-response.dto';
import { SuccessResponseDto } from '@/common/dto';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { AccountActivityService } from '@/modules/auth/account-activity/account-activity.service';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { Response } from 'express';
import { FeatureFlagsService } from '@/common';
import { writersDayOr } from '@/common/utils/writers-day.util';

@ApiTags('Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('config')
export class ConfigController {
  constructor(
    private readonly configService: ConfigService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly userDataExportService: UserDataExportService,
    private readonly activity: AccountActivityService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get user configuration' })
  @ApiResponse({
    status: 200,
    description: 'User preferences (the keys POST /api/config accepts), as text',
    type: UserConfigDto,
  })
  async getConfig(@CurrentUser() user: AuthenticatedUser): Promise<UserConfigDto> {
    return this.configService.getConfig(user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user configuration',
    description:
      'Saves the given preferences. Credentials, cloud connections, sync state, and export ' +
      'format have their own endpoints and cannot be set here.',
  })
  @ApiResponse({ status: 200, description: 'Configuration updated', type: SuccessResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Unknown or reserved setting (SETTINGS_RESERVED), or an invalid value; `entryTemplates` must be a JSON list of ' +
      'templates (ENTRY_TEMPLATES_INVALID) whose names are at most 100 characters (ENTRY_TEMPLATE_NAME_TOO_LONG)',
  })
  async updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() newConfig: UpdateConfigDto,
  ): Promise<SuccessResponseDto> {
    return this.configService.updateConfig(user.userId, newConfig);
  }

  @Get('feature-flags')
  @ApiOperation({
    summary: 'Get runtime feature flags for the current environment',
    description:
      'Each feature is on unless its flag is false; a flag missing from the answer is on. While a flag is ' +
      'off, the routes of its feature answer 503 with the code FEATURE_DISABLED. A change at the flag ' +
      'provider shows here within FEATURE_FLAG_CACHE_TTL_MS (60 seconds by default).',
  })
  @ApiResponse({ status: 200, description: 'Feature flag key/value map', schema: FEATURE_FLAGS_SCHEMA })
  async getFeatureFlags(): Promise<Record<string, boolean>> {
    return this.featureFlagsService.getFeatureFlags();
  }

  @Get('download-data')
  @ApiOperation({ summary: 'Download all user data (GDPR)' })
  @ApiResponse({ status: 200, description: 'JSON file with all user data' })
  @ApiResponse({ status: 423, description: 'Something is locked and the request is not unlocked with the PIN' })
  async downloadData(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DownloadDataQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.userDataExportService.downloadData(user.userId);
    await this.activity.record(user.userId, 'data_downloaded');
    const filename = `thoughty_data_${writersDayOr(query.today)}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }
}
