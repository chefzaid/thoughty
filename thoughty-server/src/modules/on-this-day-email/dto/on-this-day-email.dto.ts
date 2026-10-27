import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class OnThisDayEmailSettingsDto {
  @ApiProperty({ example: true, description: 'Whether the "On this day" email is on; off until the writer turns it on' })
  enabled!: boolean;

  @ApiProperty({ example: 8, minimum: 0, maximum: 23, description: 'Local hour the email arrives at' })
  deliveryHour!: number;

  @ApiProperty({
    example: 'Europe/Paris',
    type: String,
    nullable: true,
    description: 'IANA time zone of the delivery hour; null until the setting is first saved',
  })
  timeZone!: string | null;

  @ApiProperty({ example: 4, type: Number, nullable: true, description: 'The diary the email reads; null for all diaries' })
  diaryId!: number | null;

  @ApiProperty({
    example: '2026-10-28T07:00:00.000Z',
    type: String,
    nullable: true,
    description: 'When the email is next due, on days with past entries; null while it is off',
  })
  nextSendAt!: string | null;

  @ApiProperty({ example: true, description: 'Whether the account has a verified email and this server can send email' })
  emailAvailable!: boolean;
}

export class UpdateOnThisDayEmailDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ example: 8, minimum: 0, maximum: 23 })
  @IsInt()
  @Min(0)
  @Max(23)
  deliveryHour!: number;

  @ApiProperty({ example: 'Europe/Paris', maxLength: 64 })
  @IsString()
  @MaxLength(64)
  timeZone!: string;

  @ApiProperty({ example: null, type: Number, nullable: true, description: 'One of your diaries, or null for all of them' })
  @ValidateIf((dto: UpdateOnThisDayEmailDto) => dto.diaryId !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  diaryId!: number | null;
}

export class UnsubscribeOnThisDayEmailQueryDto {
  @ApiProperty({ description: 'The signed token from the email’s unsubscribe link', example: '12.Xq0o2Zr4b0bq9m3xg1Vd7QF2s8kPj5tYwHn6cLzA_eE' })
  @IsString()
  @MaxLength(64)
  token!: string;
}
