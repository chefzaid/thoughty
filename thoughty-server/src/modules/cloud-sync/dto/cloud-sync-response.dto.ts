// Response bodies of the cloud sync API.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CloudFileInfoDto, SYNC_FREQUENCIES, type SyncFrequency } from './cloud-sync.dto';

export class CloudProviderStatusDto {
  @ApiProperty()
  connected: boolean;

  @ApiPropertyOptional({ description: 'When the provider was connected (ISO 8601)' })
  connectedAt?: string;
}

export class CloudStatusResponseDto {
  @ApiProperty({ type: CloudProviderStatusDto })
  google_drive: CloudProviderStatusDto;

  @ApiProperty({ type: CloudProviderStatusDto })
  onedrive: CloudProviderStatusDto;

  @ApiProperty({ type: CloudProviderStatusDto })
  dropbox: CloudProviderStatusDto;
}

export class CloudAuthUrlResponseDto {
  @ApiProperty({ description: 'The provider page that asks the user to allow access' })
  url: string;
}

export class CloudConnectResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ description: 'When the provider was connected (ISO 8601)' })
  connectedAt: string;
}

export class CloudDownloadResponseDto {
  @ApiProperty({ description: 'The file content as text' })
  content: string;
}

export class SyncScheduleDto {
  @ApiProperty()
  enabled: boolean;

  @ApiPropertyOptional({ enum: SYNC_FREQUENCIES })
  frequency?: SyncFrequency;

  @ApiPropertyOptional({ description: 'Export format (txt, json or md)' })
  format?: string;

  @ApiPropertyOptional({ description: 'The diary exported, or all diaries when absent' })
  diaryId?: number;

  @ApiProperty()
  includeVisibility: boolean;

  @ApiPropertyOptional({ description: 'Last sync time (ISO 8601)' })
  lastSyncAt?: string;

  @ApiPropertyOptional({ description: 'SHA-256 of the last uploaded export, to skip unchanged ones' })
  lastSyncHash?: string;

  @ApiPropertyOptional({ description: 'When the next sync is due (ISO 8601)' })
  nextSyncAt?: string;
}

export class CloudSyncSchedulesResponseDto {
  @ApiProperty({ type: SyncScheduleDto })
  google_drive: SyncScheduleDto;

  @ApiProperty({ type: SyncScheduleDto })
  onedrive: SyncScheduleDto;

  @ApiProperty({ type: SyncScheduleDto })
  dropbox: SyncScheduleDto;
}

export class DiffSyncResponseDto {
  @ApiProperty({ description: 'False when nothing changed since the last sync, so nothing was uploaded' })
  synced: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional({ type: CloudFileInfoDto, description: 'The uploaded file, when one was' })
  file?: CloudFileInfoDto;
}
