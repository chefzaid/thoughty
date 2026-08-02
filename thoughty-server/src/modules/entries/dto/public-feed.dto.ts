import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const publicFeedScopes = ['community', 'mine'] as const;
export type PublicFeedScope = (typeof publicFeedScopes)[number];

export class GetPublicFeedQueryDto {
  @ApiPropertyOptional({ enum: publicFeedScopes, default: 'community' })
  @IsOptional()
  @IsIn(publicFeedScopes)
  scope?: PublicFeedScope;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class PublicFeedAuthorDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  avatarUrl: string | null;
}

export class PublicFeedEntryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  date: string;

  @ApiProperty()
  index: number;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: ['plain', 'markdown'] })
  format: 'plain' | 'markdown';

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: PublicFeedAuthorDto })
  author: PublicFeedAuthorDto;
}

export class PublicFeedResponseDto {
  @ApiProperty({ type: [PublicFeedEntryDto] })
  entries: PublicFeedEntryDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasMore: boolean;
}
