import { IsString, IsOptional, IsIn, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export type CloudProviderType = 'google_drive' | 'onedrive' | 'dropbox';

export class CloudConnectDto {
  @ApiProperty({ description: 'OAuth authorization code' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'Cloud provider', enum: ['google_drive', 'onedrive', 'dropbox'] })
  @IsIn(['google_drive', 'onedrive', 'dropbox'])
  provider: CloudProviderType;

  @ApiProperty({ description: 'OAuth redirect URI used in the authorization request' })
  @IsString()
  redirectUri: string;
}

export class CloudDisconnectDto {
  @ApiProperty({ description: 'Cloud provider', enum: ['google_drive', 'onedrive', 'dropbox'] })
  @IsIn(['google_drive', 'onedrive', 'dropbox'])
  provider: CloudProviderType;
}

export class CloudUploadDto {
  @ApiPropertyOptional({ description: 'Diary ID to export' })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsNumber()
  diaryId?: number;

  @ApiPropertyOptional({ description: 'Export format', enum: ['txt', 'json', 'md'], default: 'txt' })
  @IsOptional()
  @IsIn(['txt', 'json', 'md'])
  format?: 'txt' | 'json' | 'md';

  @ApiProperty({ description: 'Cloud provider', enum: ['google_drive', 'onedrive', 'dropbox'] })
  @IsIn(['google_drive', 'onedrive', 'dropbox'])
  provider: CloudProviderType;

  @ApiPropertyOptional({ description: 'Include visibility field', default: false })
  @IsOptional()
  includeVisibility?: boolean;
}

export class CloudDownloadDto {
  @ApiProperty({ description: 'Cloud provider', enum: ['google_drive', 'onedrive', 'dropbox'] })
  @IsIn(['google_drive', 'onedrive', 'dropbox'])
  provider: CloudProviderType;

  @ApiProperty({ description: 'File ID in cloud storage' })
  @IsString()
  fileId: string;
}

export class CloudListFilesDto {
  @ApiProperty({ description: 'Cloud provider', enum: ['google_drive', 'onedrive', 'dropbox'] })
  @IsIn(['google_drive', 'onedrive', 'dropbox'])
  provider: CloudProviderType;
}

export class CloudAuthUrlDto {
  @ApiProperty({ description: 'Cloud provider', enum: ['google_drive', 'onedrive', 'dropbox'] })
  @IsIn(['google_drive', 'onedrive', 'dropbox'])
  provider: CloudProviderType;

  @ApiProperty({ description: 'OAuth redirect URI' })
  @IsString()
  redirectUri: string;
}

export type SyncFrequency = 'every_6h' | 'every_12h' | 'daily' | 'weekly';

export class SetSyncScheduleDto {
  @ApiProperty({ description: 'Cloud provider', enum: ['google_drive', 'onedrive', 'dropbox'] })
  @IsIn(['google_drive', 'onedrive', 'dropbox'])
  provider: CloudProviderType;

  @ApiProperty({ description: 'Sync frequency', enum: ['every_6h', 'every_12h', 'daily', 'weekly'] })
  @IsIn(['every_6h', 'every_12h', 'daily', 'weekly'])
  frequency: SyncFrequency;

  @ApiPropertyOptional({ description: 'Export format', enum: ['txt', 'json', 'md'], default: 'txt' })
  @IsOptional()
  @IsIn(['txt', 'json', 'md'])
  format?: 'txt' | 'json' | 'md';

  @ApiPropertyOptional({ description: 'Diary ID to export' })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsNumber()
  diaryId?: number;

  @ApiPropertyOptional({ description: 'Include visibility field', default: false })
  @IsOptional()
  includeVisibility?: boolean;
}

export class DeleteSyncScheduleDto {
  @ApiProperty({ description: 'Cloud provider', enum: ['google_drive', 'onedrive', 'dropbox'] })
  @IsIn(['google_drive', 'onedrive', 'dropbox'])
  provider: CloudProviderType;
}

export class TriggerSyncDto {
  @ApiProperty({ description: 'Cloud provider', enum: ['google_drive', 'onedrive', 'dropbox'] })
  @IsIn(['google_drive', 'onedrive', 'dropbox'])
  provider: CloudProviderType;
}
