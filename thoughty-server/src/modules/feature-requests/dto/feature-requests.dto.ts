import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FEATURE_REQUEST_STATUSES, type FeatureRequestStatus } from '@/database/entities';

export class CreateFeatureRequestDto {
  @ApiProperty({ example: 'Calendar view for journal themes', minLength: 3, maxLength: 120 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 120)
  title!: string;

  @ApiProperty({
    example: 'Show how recurring themes change across weeks and months.',
    minLength: 10,
    maxLength: 2000,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(10, 2000)
  details!: string;
}

export class FeatureRequestDto {
  @ApiProperty({ example: 14 })
  id!: number;

  @ApiProperty({ example: 'Calendar view for journal themes' })
  title!: string;

  @ApiProperty({ example: 'Show how recurring themes change across weeks and months.' })
  details!: string;

  @ApiProperty({ enum: FEATURE_REQUEST_STATUSES, example: 'open' })
  status!: FeatureRequestStatus;

  @ApiProperty({ example: 27 })
  votes!: number;

  @ApiProperty({ example: '2026-07-23T18:30:00.000Z' })
  createdAt!: string;
}

export class FeatureRequestListResponseDto {
  @ApiProperty({ type: [FeatureRequestDto] })
  requests!: FeatureRequestDto[];
}

export class FeatureRequestVotesResponseDto {
  @ApiProperty({ type: [Number], example: [3, 14] })
  requestIds!: number[];
}

export class FeatureRequestVoteResponseDto {
  @ApiProperty({ example: 14 })
  requestId!: number;

  @ApiProperty({ example: 28 })
  votes!: number;

  @ApiProperty({ example: true })
  voted!: true;
}
