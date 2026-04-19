import { Controller, Get, Post, Delete, Body, Query, UseGuards } from '@nestjs/common';
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
} from './dto';
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
  @ApiResponse({ status: 200, description: 'Connection status for each provider' })
  async getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.cloudSyncService.getStatus(user.userId);
  }

  @Post('auth-url')
  @ApiOperation({ summary: 'Get OAuth authorization URL for a provider' })
  @ApiResponse({ status: 200, description: 'Authorization URL' })
  async getAuthUrl(@Body() dto: CloudAuthUrlDto) {
    const state = Math.random().toString(36).substring(2);
    return this.cloudSyncService.getAuthUrl(dto.provider, dto.redirectUri, state);
  }

  @Post('connect')
  @ApiOperation({ summary: 'Connect a cloud provider with OAuth code' })
  @ApiResponse({ status: 200, description: 'Provider connected' })
  async connect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CloudConnectDto,
  ) {
    return this.cloudSyncService.connect(user.userId, dto.provider, dto.code, dto.redirectUri);
  }

  @Post('disconnect')
  @ApiOperation({ summary: 'Disconnect a cloud provider' })
  @ApiResponse({ status: 200, description: 'Provider disconnected' })
  async disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CloudDisconnectDto,
  ) {
    return this.cloudSyncService.disconnect(user.userId, dto.provider);
  }

  @Get('files')
  @ApiOperation({ summary: 'List files in cloud storage' })
  @ApiResponse({ status: 200, description: 'List of files' })
  async listFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CloudListFilesDto,
  ) {
    return this.cloudSyncService.listFiles(user.userId, query.provider);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Export and upload journal to cloud storage' })
  @ApiResponse({ status: 200, description: 'File uploaded' })
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CloudUploadDto,
  ) {
    return this.cloudSyncService.uploadExport(user.userId, dto.provider, dto.diaryId, dto.format, dto.includeVisibility);
  }

  @Post('download')
  @ApiOperation({ summary: 'Download a file from cloud storage' })
  @ApiResponse({ status: 200, description: 'File content' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CloudDownloadDto,
  ) {
    return this.cloudSyncService.downloadFile(user.userId, dto.provider, dto.fileId);
  }

  @Get('schedules')
  @ApiOperation({ summary: 'Get sync schedules for all providers' })
  @ApiResponse({ status: 200, description: 'Sync schedule configurations' })
  async getSchedules(@CurrentUser() user: AuthenticatedUser) {
    return this.cloudSyncService.getSyncSchedules(user.userId);
  }

  @Post('schedule')
  @ApiOperation({ summary: 'Set or update a sync schedule' })
  @ApiResponse({ status: 200, description: 'Schedule configured' })
  async setSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetSyncScheduleDto,
  ) {
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
  @ApiResponse({ status: 200, description: 'Schedule removed' })
  async deleteSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DeleteSyncScheduleDto,
  ) {
    return this.cloudSyncService.deleteSyncSchedule(user.userId, query.provider);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Trigger a diff-based sync (uploads only if content has changed)' })
  @ApiResponse({ status: 200, description: 'Sync result' })
  async triggerSync(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TriggerSyncDto,
  ) {
    return this.cloudSyncService.executeDiffSync(user.userId, dto.provider);
  }
}
