import { randomBytes } from 'node:crypto';
import { Controller, Get, Post, Delete, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CloudSyncService } from './cloud-sync.service';
import {
  CloudConnectDto,
  CloudDisconnectDto,
  CloudUploadDto,
  CloudDownloadDto,
  CloudListFilesDto,
  CloudAuthUrlDto,
  SetSyncScheduleDto,
  DeleteSyncScheduleDto,
  TriggerSyncDto,
  CloudStatusResponseDto,
  CloudAuthUrlResponseDto,
  CloudConnectResponseDto,
  CloudFileInfoDto,
  CloudDownloadResponseDto,
  CloudSyncSchedulesResponseDto,
  DiffSyncResponseDto,
} from './dto';
import { SuccessResponseDto } from '@/common/dto';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';

@ApiTags('Cloud Sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cloud-sync')
export class CloudSyncController {
  constructor(private readonly cloudSyncService: CloudSyncService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get cloud provider connection status' })
  @ApiResponse({ status: 200, description: 'Connection status for each provider', type: CloudStatusResponseDto })
  async getStatus(@CurrentUser() user: AuthenticatedUser): Promise<CloudStatusResponseDto> {
    return this.cloudSyncService.getStatus(user.userId);
  }

  @Post('auth-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get OAuth authorization URL for a provider' })
  @ApiResponse({ status: 200, description: 'Authorization URL', type: CloudAuthUrlResponseDto })
  @ApiResponse({ status: 503, description: 'This server has no OAuth client for the provider (`CLOUD_PROVIDER_NOT_CONFIGURED`)' })
  async getAuthUrl(@Body() dto: CloudAuthUrlDto): Promise<CloudAuthUrlResponseDto> {
    const state = randomBytes(32).toString('hex');
    return this.cloudSyncService.getAuthUrl(dto.provider, dto.redirectUri, state);
  }

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connect a cloud provider with OAuth code' })
  @ApiResponse({ status: 200, description: 'Provider connected', type: CloudConnectResponseDto })
  @ApiResponse({ status: 503, description: 'This server has no OAuth client for the provider (`CLOUD_PROVIDER_NOT_CONFIGURED`)' })
  async connect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CloudConnectDto,
  ): Promise<CloudConnectResponseDto> {
    return this.cloudSyncService.connect(user.userId, dto.provider, dto.code, dto.redirectUri);
  }

  @Post('disconnect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect a cloud provider' })
  @ApiResponse({ status: 200, description: 'Provider disconnected', type: SuccessResponseDto })
  async disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CloudDisconnectDto,
  ): Promise<SuccessResponseDto> {
    return this.cloudSyncService.disconnect(user.userId, dto.provider);
  }

  @Get('files')
  @ApiOperation({ summary: 'List files in cloud storage' })
  @ApiResponse({ status: 200, description: 'List of files', type: [CloudFileInfoDto] })
  async listFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CloudListFilesDto,
  ): Promise<CloudFileInfoDto[]> {
    return this.cloudSyncService.listFiles(user.userId, query.provider);
  }

  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export and upload journal to cloud storage' })
  @ApiResponse({ status: 200, description: 'File uploaded', type: CloudFileInfoDto })
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CloudUploadDto,
  ): Promise<CloudFileInfoDto> {
    return this.cloudSyncService.uploadExport(user.userId, dto.provider, dto.diaryId, dto.format, dto.includeVisibility);
  }

  @Post('download')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download a file from cloud storage' })
  @ApiResponse({ status: 200, description: 'File content', type: CloudDownloadResponseDto })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CloudDownloadDto,
  ): Promise<CloudDownloadResponseDto> {
    return this.cloudSyncService.downloadFile(user.userId, dto.provider, dto.fileId);
  }

  @Get('schedules')
  @ApiOperation({ summary: 'Get sync schedules for all providers' })
  @ApiResponse({ status: 200, description: 'Sync schedule configurations', type: CloudSyncSchedulesResponseDto })
  async getSchedules(@CurrentUser() user: AuthenticatedUser): Promise<CloudSyncSchedulesResponseDto> {
    return this.cloudSyncService.getSyncSchedules(user.userId);
  }

  @Post('schedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set or update a sync schedule' })
  @ApiResponse({ status: 200, description: 'Schedule configured', type: SuccessResponseDto })
  async setSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetSyncScheduleDto,
  ): Promise<SuccessResponseDto> {
    return this.cloudSyncService.setSyncSchedule(
      user.userId,
      dto.provider,
      dto.frequency,
      dto.format,
      dto.diaryId,
      dto.includeVisibility,
    );
  }

  @Delete('schedule')
  @ApiOperation({ summary: 'Remove a sync schedule' })
  @ApiResponse({ status: 200, description: 'Schedule removed', type: SuccessResponseDto })
  async deleteSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DeleteSyncScheduleDto,
  ): Promise<SuccessResponseDto> {
    return this.cloudSyncService.deleteSyncSchedule(user.userId, query.provider);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger a diff-based sync (uploads only if content has changed)' })
  @ApiResponse({ status: 200, description: 'Sync result', type: DiffSyncResponseDto })
  async triggerSync(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TriggerSyncDto,
  ): Promise<DiffSyncResponseDto> {
    return this.cloudSyncService.executeDiffSync(user.userId, dto.provider);
  }
}
