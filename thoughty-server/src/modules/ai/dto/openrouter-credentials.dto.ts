import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SaveOpenRouterCredentialDto {
  @ApiProperty({
    description: 'Write-only OpenRouter API key',
    example: 'sk-or-v1-example-key-value',
    minLength: 20,
    maxLength: 256,
    writeOnly: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  @Matches(/^sk-or-v1-[A-Za-z0-9_-]+$/, { message: 'API key must be a valid OpenRouter key' })
  apiKey!: string;
}

export class OpenRouterCredentialStatusDto {
  @ApiProperty() hasPersonalKey!: boolean;
  @ApiPropertyOptional({ nullable: true, example: '...0b855d' }) keyHint!: string | null;
  @ApiProperty({ enum: ['personal', 'server', 'none'] }) source!: 'personal' | 'server' | 'none';
  @ApiProperty() aiAvailable!: boolean;
}

export class OpenRouterProviderUsageDto {
  @ApiPropertyOptional({ nullable: true }) label!: string | null;
  @ApiProperty() usage!: number;
  @ApiProperty() usageDaily!: number;
  @ApiProperty() usageWeekly!: number;
  @ApiProperty() usageMonthly!: number;
  @ApiPropertyOptional({ nullable: true }) limit!: number | null;
  @ApiPropertyOptional({ nullable: true }) limitRemaining!: number | null;
  @ApiPropertyOptional({ nullable: true, enum: ['daily', 'weekly', 'monthly'] })
  limitReset!: 'daily' | 'weekly' | 'monthly' | null;
  @ApiPropertyOptional({ nullable: true }) expiresAt!: string | null;
}

export class ThoughtyAiUsageDto {
  @ApiProperty() promptTokens!: number;
  @ApiProperty() completionTokens!: number;
  @ApiProperty() reasoningTokens!: number;
  @ApiProperty() totalTokens!: number;
  @ApiProperty() cost!: number;
  @ApiProperty() requests!: number;
  @ApiProperty() periodDays!: number;
}

export class OpenRouterUsageDashboardDto {
  @ApiProperty({ type: OpenRouterProviderUsageDto }) provider!: OpenRouterProviderUsageDto;
  @ApiProperty({ type: ThoughtyAiUsageDto }) thoughty!: ThoughtyAiUsageDto;
}
