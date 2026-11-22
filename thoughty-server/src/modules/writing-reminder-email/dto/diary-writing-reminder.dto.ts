import { ApiProperty } from '@nestjs/swagger';
import { IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { StrictInt } from '@/common/validation';

/** A diary's own writing reminder hour. */
export class DiaryWritingReminderDto {
  @ApiProperty({ example: 4 })
  diaryId!: number;

  @ApiProperty({ example: 8, minimum: 0, maximum: 23, description: 'Local hour the diary’s reminder arrives at' })
  deliveryHour!: number;

  @ApiProperty({ example: 'Europe/Paris', description: 'IANA time zone of the hour: the account reminder’s' })
  timeZone!: string;

  @ApiProperty({ example: '2026-11-23T07:00:00.000Z', description: 'When the reminder is next due, unless the diary has an entry that day' })
  nextSendAt!: string;
}

/** The diaries that have their own writing reminder hour. */
export class DiaryWritingRemindersDto {
  @ApiProperty({ type: [DiaryWritingReminderDto], description: 'One per diary with its own hour; the others follow the Profile reminder' })
  reminders!: DiaryWritingReminderDto[];

  @ApiProperty({ example: true, description: 'Whether the account has a verified email and this server can send email' })
  emailAvailable!: boolean;
}

/** Giving a diary its own writing reminder hour, or removing it. */
export class UpdateDiaryWritingReminderDto {
  @ApiProperty({ example: 8, type: Number, nullable: true, minimum: 0, maximum: 23, description: 'null removes the diary’s own reminder' })
  @ValidateIf((dto: UpdateDiaryWritingReminderDto) => dto.deliveryHour !== null)
  @StrictInt()
  @Min(0)
  @Max(23)
  deliveryHour!: number | null;

  @ApiProperty({
    example: 'Europe/Paris',
    maxLength: 64,
    description: 'The browser’s zone, used only while the account reminder was never saved; otherwise its zone is kept',
  })
  @IsString()
  @MaxLength(64)
  timeZone!: string;
}
