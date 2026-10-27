// Sealing a new entry as a time capsule.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import {
  DEFAULT_TIME_CAPSULE_HOUR,
  MAX_TIME_CAPSULE_YEARS,
  type TimeCapsuleRequest,
} from '@/modules/time-capsules/time-capsule-schedule';

export class SealEntryDto implements TimeCapsuleRequest {
  @ApiProperty({
    description: `Local day the entry opens on (YYYY-MM-DD in \`timeZone\`): from tomorrow up to ${MAX_TIME_CAPSULE_YEARS} years ahead`,
    example: '2031-10-27',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Opening date must be YYYY-MM-DD' })
  opensOn: string;

  @ApiPropertyOptional({
    description: `Local hour it opens at, ${DEFAULT_TIME_CAPSULE_HOUR}:00 when left out`,
    minimum: 0,
    maximum: 23,
    default: DEFAULT_TIME_CAPSULE_HOUR,
    example: 9,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  openHour?: number;

  @ApiProperty({ description: 'IANA time zone of the writer’s clock', example: 'Europe/Paris', maxLength: 64 })
  @IsString()
  @MaxLength(64)
  timeZone: string;
}
